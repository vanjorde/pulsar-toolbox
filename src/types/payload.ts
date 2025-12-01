export type PayloadFormat = "json" | "xml" | "text";

export type FormatPayloadResult =
  | { ok: true; value: string; format: PayloadFormat }
  | { ok: false; error: string; format: PayloadFormat };
