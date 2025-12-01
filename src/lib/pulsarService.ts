import { buildPulsarServiceUrl } from "@/lib/pulsarUrl";

function isTauriEnvironment() {
  return (
    typeof window !== "undefined" && "__TAURI_INTERNALS__" in (window as any)
  );
}

async function invokeTauri<T>(
  command: string,
  args: Record<string, unknown>
): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, args);
}

function ensureDesktopEnvironment() {
  if (!isTauriEnvironment()) {
    throw new Error(
      'Native Pulsar access requires the Tauri desktop shell. Launch Pulsar Toolbox via "npm run tauri:dev" or the packaged app.'
    );
  }
}

export function isNativePulsarAvailable() {
  return isTauriEnvironment();
}

export type ProduceParams = {
  serviceUrl: string;
  tenant: string;
  ns: string;
  topic: string;
  json: string;
  caPem?: string | null;
  token?: string | null;
};

export type ReadParams = {
  serviceUrl: string;
  tenant: string;
  ns: string;
  topic: string;
  start?: "earliest" | "latest";
  limit?: number;
  timeoutMs?: number;
  abortRef?: { current?: () => void };
  caPem?: string | null;
  token?: string | null;
};

export type PulsarMessage = {
  decoded?: unknown;
  messageId?: string | number;
  messageIdString?: string;
  messageIdData?: {
    ledgerId?: number | string;
    entryId?: number | string;
    partition?: number;
    batchIndex?: number;
    batchSize?: number;
    chunkId?: unknown;
    firstChunkMessageId?: unknown;
    ackSet?: unknown;
  };
  payload?: string;
  publishTime?: number;
  publishTimestamp?: number;
  eventTime?: number;
  producerName?: string;
  sequenceId?: number;
  partitionKey?: string;
  orderingKey?: string;
  schemaVersion?: string;
  properties?: Record<string, string>;
  replicateTo?: string[];
  [key: string]: unknown;
};

export async function produce({
  serviceUrl,
  tenant,
  ns,
  topic,
  json,
  caPem,
  token,
}: ProduceParams) {
  ensureDesktopEnvironment();

  const resolvedServiceUrl = buildPulsarServiceUrl(serviceUrl, {
    token: token ?? undefined,
  });
  const topicName = `persistent://${tenant}/${ns}/${topic}`;

  return invokeTauri<unknown>("pulsar_produce", {
    serviceUrl: resolvedServiceUrl,
    topic: topicName,
    message: json,
    caPem: caPem ?? null,
    token: token ?? null,
  });
}

export async function readN({
  serviceUrl,
  tenant,
  ns,
  topic,
  start = "latest",
  limit = 10,
  timeoutMs = 2000,
  abortRef,
  caPem,
  token,
}: ReadParams) {
  ensureDesktopEnvironment();

  let cancelled = false;

  if (abortRef) {
    abortRef.current = () => {
      cancelled = true;
    };
  }

  try {
    const resolvedServiceUrl = buildPulsarServiceUrl(serviceUrl, {
      token: token ?? undefined,
    });
    const topicName = `persistent://${tenant}/${ns}/${topic}`;

    const messages = await invokeTauri<PulsarMessage[]>(
      "pulsar_read_messages",
      {
        serviceUrl: resolvedServiceUrl,
        topic: topicName,
        startPosition: start,
        limit,
        timeoutMs,
        caPem: caPem ?? null,
        token: token ?? null,
      }
    );

    if (cancelled) {
      return [];
    }

    return messages;
  } finally {
    if (abortRef) {
      abortRef.current = undefined;
    }
  }
}

export async function verifyPulsarConnection({
  serviceUrl,
  caPem,
  token,
}: {
  serviceUrl: string;
  caPem?: string | null;
  token?: string | null;
}) {
  ensureDesktopEnvironment();

  const resolvedServiceUrl = buildPulsarServiceUrl(serviceUrl, {
    token: token ?? undefined,
  });

  await invokeTauri<unknown>("pulsar_check_connection", {
    serviceUrl: resolvedServiceUrl,
    caPem: caPem ?? null,
    token: token ?? null,
  });
}
