export type PortableInit = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
};

export type PortableOptions = {
  caPem?: string;
};

export type RequestDiagnostics = {
  method: string;
  url: string;
  headers?: Record<string, string>;
  hasBody: boolean;
  usingCustomCa: boolean;
};
