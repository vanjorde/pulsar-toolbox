export type ParseOptions = {
  kind: "http" | "service";
};

export type ParsedEndpoint = {
  url: URL;
  searchParams: URLSearchParams;
  token?: string;
  originalProtocol: string;
  originalPort?: string;
};
