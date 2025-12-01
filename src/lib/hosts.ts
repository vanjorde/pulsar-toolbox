import { safeClone } from "@/lib/safeClone";
import { parsePulsarEndpoint } from "@/lib/pulsarUrl";
import { dedupeTopicList, normalizeTopicIdentifier } from "@/lib/topics";
import {
  deleteHostAdminToken,
  deleteHostServiceToken,
  getHostAdminToken,
  getHostServiceToken,
  setHostAdminToken,
  setHostServiceToken,
} from "@/lib/pulsarTokenStorage";
import type { Host, HostTree, TopicNode } from "@/types/pulsar";

export const HOSTS_STORAGE_KEY = "pulsar.hosts";

type StoredHost = {
  id: string;
  name: string;
  adminBase: string;
  serviceUrl: string;
  adminCaPem?: string | null;
  useSeparateAdminToken?: boolean;
  isAdmin?: boolean;
  allowedTopics?: string[];
};

function stringifyParsedEndpoint(parsed: ReturnType<typeof parsePulsarEndpoint>) {
  const url = new URL(parsed.url.toString());
  const search = parsed.searchParams.toString();
  url.search = search ? `?${search}` : "";
  return url.toString();
}

export function sanitizeEndpoint(
  value: string,
  kind: "http" | "service"
): { url: string; token?: string } {
  try {
    const parsed = parsePulsarEndpoint(value, { kind });
    return { url: stringifyParsedEndpoint(parsed), token: parsed.token ?? undefined };
  } catch {
    return { url: value, token: undefined };
  }
}

export function normalizeHost(host: Host): Host {
  const admin = sanitizeEndpoint(host.adminBase, "http");
  const service = sanitizeEndpoint(host.serviceUrl, "service");
  const isAdmin = host.isAdmin !== false;
  const requestedSplit = Boolean(host.useSeparateAdminToken);
  const useSeparateAdminToken = isAdmin ? requestedSplit : false;

  const serviceTokenCandidates: Array<string | null | undefined> = [
    host.token,
    service.token,
    useSeparateAdminToken ? null : host.adminToken,
    useSeparateAdminToken ? null : admin.token,
  ];
  const serviceToken =
    serviceTokenCandidates
      .map((value) => value?.trim())
      .find((value) => value && value.length > 0) ?? null;

  let adminToken: string | null = null;
  if (isAdmin) {
    const adminTokenCandidates: Array<string | null | undefined> = [
      host.adminToken,
      admin.token,
      useSeparateAdminToken ? null : serviceToken,
    ];
    adminToken =
      adminTokenCandidates
        .map((value) => value?.trim())
        .find((value) => value && value.length > 0) ?? null;
  }

  return {
    ...host,
    adminBase: admin.url,
    serviceUrl: service.url,
    token: serviceToken,
    adminToken: adminToken,
    useSeparateAdminToken,
    adminCaPem:
      typeof host.adminCaPem === "string" && host.adminCaPem.trim().length > 0
        ? host.adminCaPem
        : undefined,
    isAdmin,
    allowedTopics: dedupeTopicList(host.allowedTopics ?? []),
  };
}

async function resolveStoredToken(hostId: string, scope: "service" | "admin"): Promise<string | null> {
  return scope === "service"
    ? await getHostServiceToken(hostId)
    : await getHostAdminToken(hostId);
}

async function persistHostTokens(host: Host): Promise<void> {
  if (host.token) {
    await setHostServiceToken(host.id, host.token);
  } else {
    await deleteHostServiceToken(host.id);
  }

  const shouldPersistAdminToken = host.isAdmin && host.useSeparateAdminToken && host.adminToken;
  if (shouldPersistAdminToken) {
    await setHostAdminToken(host.id, host.adminToken as string);
  } else {
    await deleteHostAdminToken(host.id);
  }
}

export async function convertStoredHost(record: StoredHost): Promise<Host> {
  const admin = sanitizeEndpoint(record.adminBase, "http");
  const service = sanitizeEndpoint(record.serviceUrl, "service");
  const token = await resolveStoredToken(record.id, "service");
  const adminToken = await resolveStoredToken(record.id, "admin");
  const host: Host = {
    id: record.id,
    name: record.name,
    adminBase: admin.url,
    serviceUrl: service.url,
    adminCaPem: record.adminCaPem ?? undefined,
    token,
    adminToken,
    useSeparateAdminToken: record.useSeparateAdminToken ?? false,
    isAdmin: record.isAdmin !== false,
    allowedTopics: record.allowedTopics ?? [],
  };
  return normalizeHost(host);
}

export async function serializeHost(host: Host): Promise<StoredHost> {
  const normalized = normalizeHost(host);
  await persistHostTokens(normalized);
  return {
    id: normalized.id,
    name: normalized.name,
    adminBase: normalized.adminBase,
    serviceUrl: normalized.serviceUrl,
    adminCaPem: normalized.adminCaPem ?? null,
    isAdmin: normalized.isAdmin,
    useSeparateAdminToken: normalized.isAdmin
      ? normalized.useSeparateAdminToken ?? false
      : false,
    allowedTopics: normalized.allowedTopics,
  };
}

export async function loadHostsFromStorage(
  defaultHosts: Host[],
  storageKey = HOSTS_STORAGE_KEY
): Promise<Host[]> {
  if (typeof window === "undefined") {
    return defaultHosts.map((host) => normalizeHost(host));
  }
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) {
    return defaultHosts.map((host) => normalizeHost(host));
  }
  try {
    const parsed = JSON.parse(raw) as StoredHost[];
    const converted = await Promise.all(parsed.map((record) => convertStoredHost(record)));
    return converted.map((host) => normalizeHost(host));
  } catch (error) {
    console.error("Failed to load stored hosts, falling back to defaults", error);
    return defaultHosts.map((host) => normalizeHost(host));
  }
}

export async function persistHostsToStorage(
  hosts: Host[],
  storageKey = HOSTS_STORAGE_KEY
) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const serialized = await Promise.all(hosts.map((host) => serializeHost(host)));
    window.localStorage.setItem(storageKey, JSON.stringify(serialized));
  } catch (error) {
    console.error("Failed to persist hosts", error);
  }
}

export function initHostTreeMap(hosts: Host[]): Record<string, HostTree> {
  return hosts.reduce<Record<string, HostTree>>((acc, host) => {
    acc[host.id] = { loading: false, tenants: [] };
    return acc;
  }, {});
}

export function cloneHostTreeMap(value: Record<string, HostTree>): Record<string, HostTree> {
  return safeClone(value);
}

export function ensureTopicVisibleInTree(
  treeMap: Record<string, HostTree>,
  host: Host,
  topicNode: TopicNode
): Record<string, HostTree> {
  const existingTree = treeMap[host.id];
  const existingTenant = existingTree?.tenants.find((t) => t.name === topicNode.tenant);
  const existingNamespace = existingTenant?.namespaces.find((n) => n.ns === topicNode.ns);
  const existingTopic = existingNamespace?.topics.some(
    (t) => t.fullName === topicNode.fullName
  );

  if (
    existingTopic &&
    (existingTenant?.expanded ?? false) &&
    (existingNamespace?.expanded ?? false)
  ) {
    return treeMap;
  }

  const next = cloneHostTreeMap(treeMap);
  const tree =
    next[host.id] ??
    (next[host.id] = {
      loading: false,
      tenants: [],
    });

  let tenantNode = tree.tenants.find((t) => t.name === topicNode.tenant);
  if (!tenantNode) {
    tenantNode = {
      name: topicNode.tenant,
      expanded: true,
      loading: false,
      error: null,
      namespaces: [],
    };
    tree.tenants.push(tenantNode);
  } else {
    tenantNode.expanded = true;
  }

  let namespace = tenantNode.namespaces.find((n) => n.ns === topicNode.ns);
  if (!namespace) {
    namespace = {
      name: `${topicNode.tenant}/${topicNode.ns}`,
      tenant: topicNode.tenant,
      ns: topicNode.ns,
      expanded: true,
      loading: false,
      error: null,
      topics: [],
    };
    tenantNode.namespaces.push(namespace);
  } else {
    namespace.expanded = true;
  }

  if (!namespace.topics.some((t) => t.fullName === topicNode.fullName)) {
    namespace.topics.push(topicNode);
    namespace.topics.sort((a, b) => a.fullName.localeCompare(b.fullName));
  }

  tenantNode.namespaces.sort((a, b) => a.name.localeCompare(b.name));
  tree.tenants.sort((a, b) => a.name.localeCompare(b.name));

  return next;
}

function isLimitedHost(host: Host): boolean {
  return !host.isAdmin;
}

export function addAllowedTopic(host: Host, topic: string): Host {
  if (!isLimitedHost(host)) {
    return host;
  }
  const normalized = normalizeTopicIdentifier(topic);
  if (!normalized) {
    return host;
  }
  const nextTopics = dedupeTopicList([...host.allowedTopics, normalized]);
  if (nextTopics.length === host.allowedTopics.length) {
    return host;
  }
  return { ...host, allowedTopics: nextTopics };
}

export function removeAllowedTopic(host: Host, topic: string): Host {
  if (!isLimitedHost(host)) {
    return host;
  }
  const targetKey = normalizeTopicIdentifier(topic);
  if (!targetKey) {
    return host;
  }
  const nextTopics = host.allowedTopics.filter(
    (existing) => normalizeTopicIdentifier(existing) !== targetKey
  );
  if (nextTopics.length === host.allowedTopics.length) {
    return host;
  }
  return { ...host, allowedTopics: nextTopics };
}

export function updateAllowedTopic(
  host: Host,
  previousTopic: string,
  nextTopic: string
): Host {
  if (!isLimitedHost(host)) {
    return host;
  }
  const nextKey = normalizeTopicIdentifier(nextTopic);
  if (!nextKey) {
    return host;
  }
  const previousKey = normalizeTopicIdentifier(previousTopic);
  const nextTopics = [...host.allowedTopics];
  const previousIndex = nextTopics.findIndex(
    (value) => normalizeTopicIdentifier(value) === previousKey
  );
  if (previousIndex >= 0) {
    nextTopics.splice(previousIndex, 1, nextKey);
  } else {
    nextTopics.push(nextKey);
  }
  return { ...host, allowedTopics: dedupeTopicList(nextTopics) };
}
