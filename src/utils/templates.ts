import { uid } from "@/lib/uid";
import type { Template } from "@/types/pulsar";

const DEFAULT_TEMPLATE_PAYLOAD = '{\n  "hello": "world"\n}';

export function createDefaultTemplate(existingCount: number): Template {
  return {
    id: uid("tpl"),
    name: `Template ${existingCount + 1}`,
    payload: DEFAULT_TEMPLATE_PAYLOAD,
  };
}
