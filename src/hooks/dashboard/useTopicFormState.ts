"use client";
import { useState } from "react";
import { DEFAULT_JSON_PAYLOAD, DEFAULT_TOPIC } from "@/lib/defaults";

export function useTopicFormState() {
  const [tenant, setTenant] = useState<string>(DEFAULT_TOPIC.tenant);
  const [ns, setNs] = useState<string>(DEFAULT_TOPIC.namespace);
  const [topic, setTopic] = useState<string>(DEFAULT_TOPIC.topic);
  const [json, setJson] = useState<string>(DEFAULT_JSON_PAYLOAD);

  const [start, setStart] = useState<"earliest" | "latest">("earliest");
  const [limit, setLimit] = useState(10);
  const [timeoutMs, setTimeoutMs] = useState(2000);

  return {
    tenant,
    setTenant,
    ns,
    setNs,
    topic,
    setTopic,
    json,
    setJson,
    start,
    setStart,
    limit,
    setLimit,
    timeoutMs,
    setTimeoutMs,
  } as const;
}
