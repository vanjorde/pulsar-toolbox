export type Host = {
  id: string;
  name: string;
  adminBase: string;
  wsBase: string;
};

export type TopicNode = {
  fullName: string;
  type: "persistent" | "non-persistent";
  topic: string;
  tenant: string;
  ns: string;
};

export type NamespaceNode = {
  name: string;
  tenant: string;
  ns: string;
  expanded: boolean;
  loading: boolean;
  error?: string | null;
  topics: TopicNode[];
};

export type TenantNode = {
  name: string;
  expanded: boolean;
  loading: boolean;
  error?: string | null;
  namespaces: NamespaceNode[];
};

export type HostTree = {
  loading: boolean;
  error?: string | null;
  tenants: TenantNode[];
};

export type Template = {
  id: string;
  name: string;
  payload: string;
};
