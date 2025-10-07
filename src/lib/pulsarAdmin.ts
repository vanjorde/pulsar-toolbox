import type { Host, NamespaceNode, TopicNode } from "@/types/pulsar";
import { fetchJsonPortable } from "@/lib/httpPortable";

function url(h: Host, p: string) {
  return `${h.adminBase.replace(/\/$/, "")}${p}`;
}

export async function listTenants(h: Host): Promise<string[]> {
  return fetchJsonPortable<string[]>(url(h, "/admin/v2/tenants"));
}

export async function listNamespaces(
  h: Host,
  tenantName: string
): Promise<NamespaceNode[]> {
  const arr = await fetchJsonPortable<string[]>(
    url(h, `/admin/v2/namespaces/${tenantName}`)
  );
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
  const [pers, non] = await Promise.all([
    fetchJsonPortable<string[]>(
      url(h, `/admin/v2/persistent/${nsNode.tenant}/${nsNode.ns}`)
    ),
    fetchJsonPortable<string[]>(
      url(h, `/admin/v2/non-persistent/${nsNode.tenant}/${nsNode.ns}`)
    ).catch(() => []),
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
