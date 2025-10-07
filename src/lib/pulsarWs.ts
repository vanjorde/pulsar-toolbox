export type ProduceParams = {
  wsBase: string;
  tenant: string;
  ns: string;
  topic: string;
  json: string;
};

export type ReadParams = {
  wsBase: string;
  tenant: string;
  ns: string;
  topic: string;
  start?: "earliest" | "latest";
  limit?: number;
  timeoutMs?: number;
  abortRef?: { current?: () => void };
};

export type PulsarMessage = {
  decoded: unknown;
  messageId?: string;
  payload?: string;
  [key: string]: unknown;
};

function toBase64(value: string) {
  return btoa(
    encodeURIComponent(value).replace(/%([0-9A-F]{2})/g, (_, p1) =>
      String.fromCharCode(parseInt(p1, 16))
    )
  );
}

function fromBase64(value: string) {
  return decodeURIComponent(escape(atob(value)));
}

export async function produce({
  wsBase,
  tenant,
  ns,
  topic,
  json,
}: ProduceParams) {
  const url = `${wsBase}/ws/v2/producer/persistent/${tenant}/${ns}/${topic}`;
  return new Promise<unknown>((resolve, reject) => {
    let payloadObject: unknown;
    try {
      payloadObject = JSON.parse(json);
    } catch {
      reject(new Error("Invalid JSON payload"));
      return;
    }

    const ws = new WebSocket(url);
    let settled = false;

    const close = () => {
      try {
        ws.close();
      } catch {}
    };

    ws.onopen = () => {
      const payload = toBase64(JSON.stringify(payloadObject));
      ws.send(
        JSON.stringify({
          payload,
          properties: { "content-type": "application/json" },
          context: "ui",
        })
      );
    };

    ws.onmessage = (event) => {
      if (settled) return;
      settled = true;
      try {
        resolve(JSON.parse(event.data as string));
      } catch {
        resolve(event.data);
      }
      close();
    };

    ws.onerror = (event) => {
      if (settled) return;
      settled = true;
      close();
      reject(event);
    };

    ws.onclose = () => {
      if (!settled) {
        settled = true;
        reject(new Error("Producer connection closed before acknowledgement"));
      }
    };
  });
}

export async function readN({
  wsBase,
  tenant,
  ns,
  topic,
  start = "latest",
  limit = 10,
  timeoutMs = 2000,
  abortRef,
}: ReadParams) {
  const url = `${wsBase}/ws/v2/reader/persistent/${tenant}/${ns}/${topic}?messageId=${start}`;

  return new Promise<PulsarMessage[]>((resolve, reject) => {
    const messages: PulsarMessage[] = [];
    let settled = false;

    const ws = new WebSocket(url);
    let timer: ReturnType<typeof setTimeout> | null = null;

    const clearTimer = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimer();
      try {
        ws.close();
      } catch {}
      resolve(messages);
    };

    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      clearTimer();
      try {
        ws.close();
      } catch {}
      reject(error);
    };

    const armTimer = () => {
      clearTimer();
      timer = setTimeout(finish, timeoutMs);
    };

    if (abortRef) {
      abortRef.current = () => finish();
    }

    ws.onopen = () => {
      armTimer();
    };

    ws.onmessage = (event) => {
      try {
        const raw = JSON.parse(event.data as string) as Record<string, unknown>;
        const encodedPayload =
          typeof raw.payload === "string" ? raw.payload : undefined;
        const decodedText = encodedPayload
          ? fromBase64(encodedPayload)
          : undefined;

        let decoded: unknown = decodedText;
        if (typeof decodedText === "string" && decodedText.length > 0) {
          try {
            decoded = JSON.parse(decodedText);
          } catch {
            decoded = decodedText;
          }
        }

        messages.push({
          ...raw,
          decoded,
        });

        if (raw.messageId) {
          ws.send(JSON.stringify({ messageId: raw.messageId }));
        }

        if (messages.length >= limit) {
          finish();
        } else {
          armTimer();
        }
      } catch (error) {
        fail(error);
      }
    };

    ws.onerror = (error) => {
      fail(error);
    };

    ws.onclose = () => {
      finish();
    };
  });
}
