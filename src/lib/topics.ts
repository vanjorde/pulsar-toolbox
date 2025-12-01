import type { TopicNode } from "@/types/pulsar";

const DEFAULT_SCHEME = "persistent";

export function parseTopicIdentifier(raw: string): TopicNode | null {
  const value = raw.trim();
  if (!value) return null;

  const [maybeScheme, ...restParts] = value.split("://");
  let scheme = DEFAULT_SCHEME;
  let remainder = value;

  if (restParts.length > 0) {
    scheme = maybeScheme.toLowerCase();
    remainder = restParts.join("://");
  }

  const segments = remainder.split("/").filter((segment) => segment.length > 0);
  if (segments.length < 3) {
    return null;
  }

  const [tenant, ns, ...topicParts] = segments;
  if (!tenant || !ns || topicParts.length === 0) {
    return null;
  }

  const topicName = topicParts.join("/");
  const normalizedScheme = scheme === "non-persistent" ? "non-persistent" : DEFAULT_SCHEME;
  return {
    fullName: `${normalizedScheme}://${tenant}/${ns}/${topicName}`,
    type: normalizedScheme === "non-persistent" ? "non-persistent" : "persistent",
    tenant,
    ns,
    topic: topicName,
  };
}

export function normalizeTopicIdentifier(topic: string): string {
  const parsed = parseTopicIdentifier(topic);
  if (parsed) {
    return parsed.fullName;
  }
  const trimmed = topic.trim();
  return trimmed;
}

export function dedupeTopicList(topics: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const topic of topics) {
    const normalized = normalizeTopicIdentifier(topic);
    if (!normalized) {
      continue;
    }
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}
