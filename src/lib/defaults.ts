import type { Host, Template } from "@/types/pulsar";

export const DEFAULT_HOSTS: Host[] = [
  {
    id: "host-local",
    name: "Local Pulsar",
    adminBase: "http://localhost:8080",
    wsBase: "ws://localhost:8080",
  },
];

export const DEFAULT_TEMPLATES: Template[] = [
  {
    id: "tpl",
    name: "Hello Pulsar",
    payload: JSON.stringify({ hello: "pulsar" }, null, 2),
  },
];

export const DEFAULT_JSON_PAYLOAD = DEFAULT_TEMPLATES[0]?.payload ?? "{}";

export const DEFAULT_TOPIC = {
  tenant: "public",
  namespace: "default",
  topic: "my-topic",
} as const;
