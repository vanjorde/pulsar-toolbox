import type { Host, NamespaceNode, TopicNode } from "@/types/pulsar";
import { fetchJsonPortable } from "@/lib/httpPortable";
import { buildPulsarHttpRequest } from "@/lib/pulsarUrl";

function adminRequest(host: Host, path: string) {
  if (!host.isAdmin) {
    throw new Error("Topic discovery is disabled for this host.");
  }
  const request = buildPulsarHttpRequest(host.adminBase, path, undefined, {
    token: host.adminToken ?? host.token ?? undefined,
  });
  return {
    url: request.url,
    headers: request.token
      ? { Authorization: `Bearer ${request.token}` }
      : undefined,
    caPem:
      host.adminCaPem && host.adminCaPem.trim().length > 0
        ? host.adminCaPem
        : undefined,
  } as const;
}

export async function listTenants(h: Host): Promise<string[]> {
  const { url, headers, caPem } = adminRequest(h, "/admin/v2/tenants");
  return fetchJsonPortable<string[]>(url, { headers }, { caPem });
}

export async function listNamespaces(
  h: Host,
  tenantName: string
): Promise<NamespaceNode[]> {
  const { url, headers, caPem } = adminRequest(
    h,
    `/admin/v2/namespaces/${tenantName}`
  );
  const arr = await fetchJsonPortable<string[]>(url, { headers }, { caPem });
  return arr
    .map((full) => {
      const [tenant, ns] = full.split("/");
      return {
        name: full,
        tenant,
        ns,
        expanded: false,
        loading: false,
        topics: [],
      } as NamespaceNode;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function listTopics(
  h: Host,
  nsNode: NamespaceNode
): Promise<TopicNode[]> {
  const persistent = adminRequest(
    h,
    `/admin/v2/persistent/${nsNode.tenant}/${nsNode.ns}`
  );
  const nonPersistent = adminRequest(
    h,
    `/admin/v2/non-persistent/${nsNode.tenant}/${nsNode.ns}`
  );
  const [pers, non] = await Promise.all([
    fetchJsonPortable<string[]>(persistent.url, { headers: persistent.headers }, { caPem: persistent.caPem }),
    fetchJsonPortable<string[]>(
      nonPersistent.url,
      { headers: nonPersistent.headers },
      { caPem: nonPersistent.caPem }
    ).catch(
      () => []
    ),
  ]);

  return [...pers, ...non]
    .map((fullName) => {
      const [scheme, rest] = fullName.split("://");
      const [tenant, ns, ...tparts] = rest.split("/");
      return {
        fullName,
        type: scheme === "non-persistent" ? "non-persistent" : "persistent",
        tenant,
        ns,
        topic: tparts.join("/"),
      } as TopicNode;
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}
