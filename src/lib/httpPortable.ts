export async function fetchJsonPortable<T>(
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: any }
): Promise<T> {
  const mod = await import("@tauri-apps/plugin-http");
  const res = await mod.fetch(url, {
    method: init?.method ?? "GET",
    headers: init?.headers,
    body: init?.body,
  });
  if (!(res as any).ok)
    throw new Error(`${(res as any).status} ${(res as any).statusText}`);
  return (await (res as any).json()) as T;
}
