import type { TopicNode } from "@/types/pulsar";

export function parseTopic(fullName: string): TopicNode {
  const [scheme, rest] = fullName.split("://");
  const [tenant, ns, ...tParts] = rest.split("/");
  const topic = tParts.join("/");
  return {
    fullName,
    type: scheme === "non-persistent" ? "non-persistent" : "persistent",
    tenant,
    ns,
    topic,
  };
}
