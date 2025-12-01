import {
  PortableInit,
  PortableOptions,
  RequestDiagnostics,
} from "@/types/httpPortable";

class PortableRequestError extends Error {
  readonly context: string;
  readonly diagnostics: RequestDiagnostics;
  readonly originalMessage: string;
  details?: string;

  constructor(
    friendlyMessage: string,
    context: string,
    diagnostics: RequestDiagnostics,
    originalMessage: string,
    options?: { details?: string; cause?: unknown }
  ) {
    super(friendlyMessage);
    this.name = "PortableRequestError";
    this.context = context;
    this.diagnostics = diagnostics;
    this.originalMessage = originalMessage;
    this.details = options?.details;
    if (options && "cause" in options) {
      (this as any).cause = options.cause;
    }
  }
}

function isTauriEnvironment() {
  return (
    typeof window !== "undefined" && "__TAURI_INTERNALS__" in (window as any)
  );
}

function sanitizeHeaders(headers?: Record<string, string>) {
  if (!headers) {
    return undefined;
  }

  const sanitized: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === "authorization") {
      const trimmed = value.trim();
      if (trimmed.length <= 8) {
        sanitized[key] = "[redacted]";
      } else {
        sanitized[key] = `${trimmed.slice(0, 4)}…[redacted]`;
      }
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

function formatDiagnostics({
  method,
  url,
  hasBody,
  usingCustomCa,
}: RequestDiagnostics) {
  const parts = [
    `${method.toUpperCase()} ${url}`,
    hasBody ? "body: yes" : "body: no",
    usingCustomCa ? "custom CA: yes" : "custom CA: no",
  ];

  return parts.join(" | ");
}

function formatTarget(url: string) {
  try {
    const parsed = new URL(url);
    const hostPort = parsed.port
      ? `${parsed.hostname}:${parsed.port}`
      : parsed.hostname;
    const path = parsed.pathname === "/" ? "" : parsed.pathname;
    return `${hostPort}${path}`;
  } catch {
    return url;
  }
}

function interpretErrorMessage(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("401")) {
    return "Authentication failed (HTTP 401). Check the provided admin token or credentials.";
  }
  if (normalized.includes("403")) {
    return "Access denied (HTTP 403). The current credentials do not have permission to access this resource.";
  }
  if (normalized.includes("404")) {
    return "The requested resource was not found (HTTP 404). Verify the Pulsar admin API endpoint.";
  }
  if (
    normalized.includes("certificate") ||
    normalized.includes("ssl") ||
    normalized.includes("tls")
  ) {
    return "TLS handshake failed. Check the server certificate and any configured custom certificate authority.";
  }
  if (
    normalized.includes("failed to fetch") ||
    normalized.includes("networkerror") ||
    normalized.includes("network request failed") ||
    normalized.includes("connection refused") ||
    normalized.includes("econnrefused") ||
    normalized.includes("dns") ||
    normalized.includes("enotfound")
  ) {
    return "Unable to reach the Pulsar host. Check connectivity or TLS settings.";
  }

  return message;
}

function createPortableError(
  context: string,
  error: unknown,
  diagnostics: RequestDiagnostics
) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
      ? error
      : (() => {
          try {
            return JSON.stringify(error);
          } catch {
            return String(error);
          }
        })();

  const summary = formatDiagnostics(diagnostics);

  console.debug(
    `[httpPortable] ${summary} failed via ${context}`,
    {
      context,
      ...diagnostics,
    },
    error
  );

  const requestLabel = formatTarget(diagnostics.url);
  const friendlyExplanation = interpretErrorMessage(message);
  const explanationIsRaw = friendlyExplanation === message;
  const trimmedExplanation = friendlyExplanation.replace(/\.+$/, "");
  const friendlyMessage = explanationIsRaw
    ? `Request to ${requestLabel} failed: ${trimmedExplanation}.`
    : `${trimmedExplanation}. (${requestLabel}).`;
  const detailedMessage =
    `${summary} failed via ${context}: ${message}. ` +
    "Check the devtools console or the Tauri log directory for detailed stack traces.";

  return new PortableRequestError(
    friendlyMessage,
    context,
    diagnostics,
    message,
    { details: detailedMessage, cause: error }
  );
}

export async function fetchJsonPortable<T>(
  url: string,
  init?: PortableInit,
  options?: PortableOptions
): Promise<T> {
  const method = init?.method ?? "GET";
  const headers = init?.headers;
  const body = init?.body;
  const caPem = options?.caPem;
  const usingCustomCa = Boolean(caPem && caPem.trim().length > 0);
  const diagnostics: RequestDiagnostics = {
    method,
    url,
    headers: sanitizeHeaders(headers),
    hasBody: typeof body === "string" && body.length > 0,
    usingCustomCa,
  };

  if (usingCustomCa && isTauriEnvironment()) {
    const { invoke } = await import("@tauri-apps/api/core");
    try {
      return await invoke<T>("fetch_json_with_tls", {
        args: {
          url,
          method,
          headers,
          body,
          caPem,
        },
      });
    } catch (error) {
      throw createPortableError(
        "tauri:fetch_json_with_tls",
        error,
        diagnostics
      );
    }
  }

  try {
    const mod = await import("@tauri-apps/plugin-http");
    let danger:
      | {
          acceptInvalidCerts?: boolean;
          acceptInvalidHostnames?: boolean;
        }
      | undefined;

    try {
      const parsed = new URL(url);
      if (
        parsed.protocol === "https:" &&
        (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1")
      ) {
        danger = {
          acceptInvalidCerts: true,
          acceptInvalidHostnames: true,
        };
      }
    } catch {
      //ignore parsing failures and fall back to the default safe settings
    }

    try {
      const res = await mod.fetch(url, {
        method,
        headers,
        body,
        danger,
      });
      if (!(res as any).ok)
        throw new Error(`${(res as any).status} ${(res as any).statusText}`);
      return (await (res as any).json()) as T;
    } catch (error) {
      const pluginError = createPortableError(
        "tauri-plugin-http",
        error,
        diagnostics
      );

      if (typeof fetch !== "undefined") {
        try {
          const response = await fetch(url, {
            method,
            headers,
            body,
          });
          if (!response.ok) {
            throw new Error(`${response.status} ${response.statusText}`);
          }
          return (await response.json()) as T;
        } catch (browserError) {
          const browserPortableError = createPortableError(
            "browser-fetch",
            browserError,
            diagnostics
          );

          if (pluginError.details) {
            browserPortableError.details = browserPortableError.details
              ? `${browserPortableError.details}\n\nAlternate stack (tauri-plugin-http): ${pluginError.details}`
              : pluginError.details;
          }
          (browserPortableError as any).fallback = pluginError;
          throw browserPortableError;
        }
      }

      throw pluginError;
    }
  } catch (error) {
    if (typeof fetch !== "undefined") {
      try {
        const response = await fetch(url, {
          method,
          headers,
          body,
        });
        if (!response.ok) {
          throw new Error(`${response.status} ${response.statusText}`);
        }
        return (await response.json()) as T;
      } catch (browserError) {
        throw createPortableError("browser-fetch", browserError, diagnostics);
      }
    }

    throw createPortableError("tauri-plugin-http", error, diagnostics);
  }
}
