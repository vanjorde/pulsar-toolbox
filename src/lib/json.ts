export type JsonParseResult<T = unknown> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export function parseJsonSafe<T = unknown>(input: string): JsonParseResult<T> {
  try {
    return { ok: true, value: JSON.parse(input) as T };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to parse JSON";
    return { ok: false, error: message };
  }
}

export function formatJsonString(
  input: string,
  indent = 2
): JsonParseResult<string> {
  const parsed = parseJsonSafe(input);
  if (!parsed.ok) {
    return parsed;
  }

  try {
    return { ok: true, value: JSON.stringify(parsed.value, null, indent) };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to format JSON";
    return { ok: false, error: message };
  }
}

export function getJsonError(input: string): string | null {
  const result = parseJsonSafe(input);
  return result.ok ? null : result.error;
}