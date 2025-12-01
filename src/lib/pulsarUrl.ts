import { ParsedEndpoint, ParseOptions } from "@/types/pulsarUrl";

const TOKEN_KEYS = ["token", "jwt"] as const;

const PULSAR_SCHEMES = new Set(["pulsar:", "pulsar+plain:", "pulsar+ssl:"]);

function normalizeProtocol(protocol: string, kind: "http" | "service") {
  if (kind === "service") {
    if (
      protocol === "pulsar+ssl:" ||
      protocol === "wss:" ||
      protocol === "https:"
    ) {
      return "pulsar+ssl:";
    }
    if (
      protocol === "pulsar:" ||
      protocol === "pulsar+plain:" ||
      protocol === "ws:" ||
      protocol === "http:"
    ) {
      return "pulsar:";
    }
    return protocol;
  }

  if (protocol === "pulsar+ssl:" || protocol === "wss:") return "https:";
  if (
    protocol === "pulsar:" ||
    protocol === "pulsar+plain:" ||
    protocol === "ws:"
  ) {
    return "http:";
  }
  return protocol;
}

function adjustPulsarPort(
  url: URL,
  originalProtocol: string,
  kind: "http" | "service"
) {
  if (!PULSAR_SCHEMES.has(originalProtocol)) {
    return;
  }

  const secureProtocols = new Set(["pulsar+ssl:", "https:"]);
  const isSecure = secureProtocols.has(url.protocol);

  if (kind === "service") {
    if (url.port === "") {
      url.port = isSecure ? "6651" : "6650";
    }
    return;
  }

  if (url.port === "") {
    url.port = isSecure ? "8443" : "8080";
  }
}

function stripTrailingSlash(pathname: string) {
  if (pathname === "/") return "";
  return pathname.replace(/\/$/, "");
}

function cloneUrl(url: URL) {
  return new URL(url.toString());
}

function collectSearchParams(source: URLSearchParams) {
  const target = new URLSearchParams();
  source.forEach((value, key) => {
    target.set(key, value);
  });
  return target;
}

export function parsePulsarEndpoint(
  value: string,
  options: ParseOptions
): ParsedEndpoint {
  const trimmed = value.trim();

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    const fallbackPrefix = options.kind === "service" ? "pulsar://" : "http://";
    url = new URL(`${fallbackPrefix}${trimmed}`);
  }

  const originalProtocol = url.protocol;
  const originalPort = url.port || undefined;
  url.protocol = normalizeProtocol(url.protocol, options.kind);
  url.username = "";
  url.password = "";
  url.hash = "";

  adjustPulsarPort(url, originalProtocol, options.kind);

  const tokenKey = TOKEN_KEYS.find((key) => url.searchParams.has(key));
  const token = tokenKey
    ? url.searchParams.get(tokenKey) ?? undefined
    : undefined;

  const remainingParams = collectSearchParams(url.searchParams);
  if (tokenKey) {
    remainingParams.delete(tokenKey);
  }

  if (options.kind === "service") {
    url.pathname = "";
  } else {
    url.pathname = stripTrailingSlash(url.pathname);
  }
  url.search = "";

  return {
    url,
    searchParams: remainingParams,
    token,
    originalProtocol,
    originalPort,
  };
}

function joinPath(basePath: string, appendPath: string) {
  const normalizedBase = stripTrailingSlash(basePath);
  const normalizedAppend = appendPath.startsWith("/")
    ? appendPath
    : `/${appendPath}`;
  return `${normalizedBase}${normalizedAppend}` || "/";
}

export function buildPulsarUrl(
  parsed: ParsedEndpoint,
  appendPath: string,
  extraQuery?: Record<string, string | undefined>,
  options?: { includeTokenParam?: boolean; token?: string }
) {
  const url = cloneUrl(parsed.url);
  url.pathname = joinPath(url.pathname || "", appendPath);

  const query = collectSearchParams(parsed.searchParams);
  const token =
    options?.token ?? (options?.includeTokenParam ? parsed.token : undefined);
  if (token) {
    query.set("token", token);
  }
  if (extraQuery) {
    for (const [key, value] of Object.entries(extraQuery)) {
      if (typeof value === "undefined") continue;
      query.set(key, value);
    }
  }

  const searchString = query.toString();
  url.search = searchString ? `?${searchString}` : "";
  return url.toString();
}

export function buildPulsarServiceUrl(
  base: string,
  options?: { token?: string }
) {
  const parsed = parsePulsarEndpoint(base, { kind: "service" });
  const url = cloneUrl(parsed.url);
  url.pathname = "";

  const query = collectSearchParams(parsed.searchParams);
  const token = options?.token ?? parsed.token;
  if (token) {
    query.set("token", token);
  }

  const searchString = query.toString();
  url.search = searchString ? `?${searchString}` : "";
  return url.toString();
}

export function buildPulsarHttpRequest(
  base: string,
  appendPath: string,
  extraQuery?: Record<string, string | undefined>,
  options?: { token?: string }
) {
  const parsed = parsePulsarEndpoint(base, { kind: "http" });
  const url = buildPulsarUrl(parsed, appendPath, extraQuery, {
    includeTokenParam: false,
  });
  return {
    url,
    token: options?.token ?? parsed.token ?? undefined,
    queryParams: parsed.searchParams,
  };
}
