import type { PulsarMessage } from "@/lib/pulsarService";
import { getPublishMs } from "@/lib/time";
import { MessageLike } from "@/types/messaging";

export function sortNewestFirst<T extends MessageLike>(arr: T[]): T[] {
  return [...arr].sort((a, b) => getPublishMs(b) - getPublishMs(a));
}

export function makeMessageKey(
  message: MessageLike,
  fallbackIndex?: number
): string {
  const rawId = message?.messageId;

  if (typeof rawId === "string" || typeof rawId === "number") {
    return String(rawId);
  }

  if (rawId && typeof rawId === "object") {
    try {
      return JSON.stringify(rawId);
    } catch {
    }
  }

  const publishMs = getPublishMs(message);
  const payload =
    typeof message?.payload === "string"
      ? message.payload
      : typeof (message as PulsarMessage)?.decoded === "string"
      ? (message as PulsarMessage).decoded
      : undefined;

  if (publishMs) {
    return `${publishMs}:${payload ?? fallbackIndex ?? ""}`;
  }

  if (fallbackIndex != null) {
    return `index:${fallbackIndex}`;
  }

  try {
    return JSON.stringify(message);
  } catch {
    return String(message);
  }
}

export function mergeUniqueNewestFirst<T extends MessageLike>(
  incoming: T[],
  prev: T[],
  max: number
): T[] {
  const merged = sortNewestFirst<T>([...incoming, ...prev]);
  const seen = new Set<string>();
  const output: T[] = [];

  for (let index = 0; index < merged.length; index += 1) {
    const message = merged[index];
    const key = makeMessageKey(message, index);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(message);
    if (output.length >= max) {
      break;
    }
  }

  return output;
}
