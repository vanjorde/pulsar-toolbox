import { parseJsonSafe } from "@/lib/json";
import { FormatPayloadResult, PayloadFormat } from "@/types/payload";

export interface PayloadValidationResult {
  format: PayloadFormat;
  error: string | null;
}

export function guessPayloadFormat(input: string): PayloadFormat {
  const trimmed = input.trim();
  if (!trimmed) {
    return "text";
  }

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return "json";
  }

  if (trimmed.startsWith("<")) {
    return "xml";
  }

  return "text";
}

export function validatePayload(input: string): PayloadValidationResult {
  const format = guessPayloadFormat(input);

  if (format === "json") {
    const parsed = parseJsonSafe(input);
    return { format, error: parsed.ok ? null : parsed.error };
  }

  if (format === "xml") {
    const validation = validateXml(input);
    return {
      format,
      error: validation.ok ? null : validation.error,
    };
  }

  return { format, error: null };
}

export function getPayloadError(input: string): string | null {
  const { error } = validatePayload(input);
  return error;
}

export function formatPayloadString(
  input: string,
  indent = 2
): FormatPayloadResult {
  const format = guessPayloadFormat(input);

  if (format === "json") {
    const parsed = parseJsonSafe(input);
    if (!parsed.ok) {
      return { ok: false, error: parsed.error, format };
    }

    try {
      return {
        ok: true,
        format,
        value: JSON.stringify(parsed.value, null, indent),
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to format JSON";
      return { ok: false, error: message, format };
    }
  }

  if (format === "xml") {
    const validation = validateXml(input);
    if (!validation.ok) {
      return { ok: false, error: validation.error, format };
    }

    try {
      return { ok: true, format, value: prettyPrintXml(input, indent) };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to format XML";
      return { ok: false, error: message, format };
    }
  }

  return { ok: true, value: input, format };
}

export function formatPayloadForDisplay(value: unknown, indent = 2): string {
  return formatPayloadForDisplayWithFormat(value, indent).formatted;
}

export function formatPayloadForDisplayWithFormat(
  value: unknown,
  indent = 2
): { formatted: string; format: PayloadFormat } {
  if (typeof value === "string") {
    const result = formatPayloadString(value, indent);
    if (result.ok) {
      return { formatted: result.value, format: result.format };
    }
    return { formatted: value, format: result.format };
  }

  try {
    return {
      formatted: JSON.stringify(value, null, indent),
      format: "json",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      formatted: `Unable to format value: ${message}`,
      format: "text",
    };
  }
}

function validateXml(
  input: string
): { ok: true } | { ok: false; error: string } {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: true };
  }

  if (
    typeof window !== "undefined" &&
    typeof window.DOMParser !== "undefined"
  ) {
    try {
      const parser = new window.DOMParser();
      const doc = parser.parseFromString(trimmed, "text/xml");
      const parserErrors = doc.getElementsByTagName("parsererror");
      if (parserErrors.length > 0) {
        const errorText = parserErrors[0]?.textContent?.trim();
        return {
          ok: false,
          error: errorText || "Invalid XML payload",
        };
      }
      return { ok: true };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Invalid XML payload";
      return { ok: false, error: message };
    }
  }

  return validateXmlFallback(trimmed);
}

function validateXmlFallback(
  input: string
): { ok: true } | { ok: false; error: string } {
  try {
    const stack: string[] = [];
    const pattern = /<\/?([A-Za-z_][A-Za-z0-9_.:-]*)([^>]*)>/g;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(input))) {
      const [token, tagName, rest] = match;
      const isClosing = token.startsWith("</");
      const isSelfClosing = /\/$/.test(rest.trim());
      const isDeclaration = token.startsWith("<?") || token.startsWith("<!");

      if (isDeclaration || isSelfClosing) {
        continue;
      }

      if (isClosing) {
        const expected = stack.pop();
        if (expected !== tagName) {
          throw new Error("Mismatched closing tag");
        }
      } else {
        stack.push(tagName);
      }
    }

    if (stack.length > 0) {
      throw new Error("Unclosed XML tags");
    }

    return { ok: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid XML payload";
    return { ok: false, error: message };
  }
}

function prettyPrintXml(input: string, indentSize: number): string {
  const indent = Math.max(indentSize, 0);
  const indentString = indent === 0 ? "" : " ".repeat(indent);
  const normalized = input.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();

  if (!normalized) {
    return normalized;
  }

  const tokens = normalized
    .replace(/>\s+</g, "><")
    .replace(/\s{2,}/g, (match) => (match.includes("\n") ? match : " "))
    .split(/(?=<)/g)
    .flatMap((part) => part.split(/(?<=>)/g))
    .map((part) => part.trim())
    .filter(Boolean);

  let level = 0;
  const lines: string[] = [];

  for (const token of tokens) {
    if (token.startsWith("</")) {
      level = Math.max(level - 1, 0);
    }

    const padding = indentString.repeat(level);
    lines.push(`${padding}${token}`);

    if (token.startsWith("<") && !token.startsWith("</")) {
      if (
        !token.endsWith("/>") &&
        !token.startsWith("<!") &&
        !token.startsWith("<?")
      ) {
        level += 1;
      }
    }

    if (
      token.match(/<[^>]+>[^<]+<\/[A-Za-z_][A-Za-z0-9_.:-]*>$/) &&
      !token.startsWith("<!") &&
      !token.startsWith("<?")
    ) {
      level = Math.max(level - 1, 0);
    }
  }

  return lines.join("\n");
}
