"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type React from "react";
import type {
  Host,
  HostTree,
  NamespaceNode,
  TenantNode,
  TopicNode,
} from "@/types/pulsar";
import { listNamespaces, listTenants, listTopics } from "@/lib/pulsarAdmin";
import {
  isNativePulsarAvailable,
  verifyPulsarConnection,
} from "@/lib/pulsarService";
import { safeClone } from "@/lib/safeClone";
import { parseTopicIdentifier } from "@/lib/topics";

const SYS_TENANTS = new Set(["pulsar"]);
const SYS_NAMESPACES = new Set(["functions"]);

function norm(s?: string) {
  return (s ?? "").trim().toLowerCase();
}
function isExcludedTenant(name: string) {
  return SYS_TENANTS.has(norm(name));
}
function isExcludedNamespace(name: string) {
  return SYS_NAMESPACES.has(norm(name));
}
function nsDisplayName(ns: NamespaceNode) {
  return (ns.ns ?? ns.name ?? "").toString();
}

type LimitedExpansionState = Record<
  string,
  {
    tenants: Record<string, boolean>;
    namespaces: Record<string, Record<string, boolean>>;
  }
>;

export function HostsExplorer({
  hosts,
  hostTrees,
  setHostTrees,
  onTopicClick,
  onDropTemplateOnTopic,
  activeTopic,
  activeHostId,
  onSelectHost,
  onEditHost,
  onOpenLimitedTopicModal,
}: {
  hosts: Host[];
  hostTrees: Record<string, HostTree>;
  setHostTrees: (
    fn: (prev: Record<string, HostTree>) => Record<string, HostTree>
  ) => void;
  onTopicClick: (h: Host, tp: TopicNode) => void;
  onDropTemplateOnTopic: (h: Host, node: TopicNode, e: React.DragEvent) => void;
  activeTopic?: { host: Host; topic: TopicNode } | null;
  activeHostId?: string | null;
  onSelectHost?: (host: Host) => void;
  onEditHost: (host: Host) => void;
  onOpenLimitedTopicModal: (
    host: Host,
    action: { type: "create" } | { type: "edit"; topic: string }
  ) => void;
}) {
  const autoLoadedHostsRef = useRef<Set<string>>(new Set());
  const limitedProbeSignaturesRef = useRef<Map<string, string>>(new Map());
  const limitedProbeInFlightRef = useRef<Set<string>>(new Set());
  const [limitedExpansionState, setLimitedExpansionState] =
    useState<LimitedExpansionState>({});
  const nativePulsarAvailable = isNativePulsarAvailable();

  const buildLimitedSignature = (host: Host) =>
    [host.serviceUrl, host.token ?? "", host.adminCaPem ?? ""].join("|");

  const summarizeError = (input: string) => {
    const [first] = input.split(" | caused by: ");
    return first.trim();
  };

  const formatLimitedHostError = (host: Host, error: unknown) => {
    const rawMessage =
      error instanceof Error
        ? error.message
        : typeof error === "string"
        ? error
        : null;
    const detail = rawMessage ? summarizeError(rawMessage) : "Unknown error.";
    return `Failed to connect to ${host.name}. ${detail}`;
  };

  const verifyLimitedHostConnection = useCallback(
    async (host: Host, { force = false }: { force?: boolean } = {}) => {
      const signature = buildLimitedSignature(host);
      const previous = limitedProbeSignaturesRef.current.get(host.id);
      if (!force && previous === signature) {
        return;
      }
      limitedProbeSignaturesRef.current.set(host.id, signature);

      if (!nativePulsarAvailable) {
        return;
      }
      if (limitedProbeInFlightRef.current.has(host.id)) {
        return;
      }
      limitedProbeInFlightRef.current.add(host.id);

      setHostTrees((trees) => ({
        ...trees,
        [host.id]: {
          ...(trees[host.id] || { tenants: [] }),
          loading: true,
          error: null,
        },
      }));

      try {
        await verifyPulsarConnection({
          serviceUrl: host.serviceUrl,
          caPem: host.adminCaPem ?? null,
          token: host.token ?? null,
        });

        setHostTrees((trees) => ({
          ...trees,
          [host.id]: {
            ...(trees[host.id] || { tenants: [] }),
            loading: false,
            error: null,
          },
        }));
      } catch (error) {
        const message = formatLimitedHostError(host, error);
        setHostTrees((trees) => ({
          ...trees,
          [host.id]: {
            ...(trees[host.id] || { tenants: [] }),
            loading: false,
            error: message,
          },
        }));
      } finally {
        limitedProbeInFlightRef.current.delete(host.id);
      }
    },
    [nativePulsarAvailable, setHostTrees]
  );

  useEffect(() => {
    setLimitedExpansionState((prev) => {
      const next: LimitedExpansionState = { ...prev };
      for (const host of hosts) {
        if (!next[host.id]) {
          next[host.id] = { tenants: {}, namespaces: {} };
        }
      }
      for (const key of Object.keys(next)) {
        if (!hosts.some((host) => host.id === key)) {
          delete next[key];
        }
      }
      return next;
    });
  }, [hosts]);

  function mergeTenantsWithPrev(
    hostId: string,
    newTenantNames: string[]
  ): TenantNode[] {
    const prevTenants = hostTrees[hostId]?.tenants ?? [];
    return newTenantNames
      .filter((n) => !isExcludedTenant(n))
      .sort()
      .map<TenantNode>((name) => {
        const old = prevTenants.find((t) => t.name === name);
        return {
          name,
          expanded: old?.expanded ?? false,
          loading: false,
          error: null as any,
          namespaces: old?.namespaces ?? [],
        };
      });
  }

  function mergeNamespacesWithPrev(
    hostId: string,
    tenantName: string,
    fetched: NamespaceNode[]
  ): NamespaceNode[] {
    const prevTenant = hostTrees[hostId]?.tenants.find(
      (t) => t.name === tenantName
    );
    const prevNs = prevTenant?.namespaces ?? [];
    return fetched
      .filter((ns) => !isExcludedNamespace(nsDisplayName(ns)))
      .map<NamespaceNode>((ns) => {
        const key = nsDisplayName(ns);
        const old = prevNs.find((x) => nsDisplayName(x) === key);
        return {
          ...ns,
          expanded: old?.expanded ?? false,
          loading: false,
          error: null as any,
          topics: old?.topics ?? [],
        };
      });
  }
  async function loadTenantsAction(h: Host) {
    if (!h.isAdmin) {
      return;
    }
    setHostTrees((t) => ({
      ...t,
      [h.id]: {
        ...(t[h.id] || { tenants: [] }),
        loading: true,
        error: null as any,
      },
    }));

    try {
      const tenants = await listTenants(h);

      const tenantNodes = mergeTenantsWithPrev(h.id, tenants);

      setHostTrees((t) => ({
        ...t,
        [h.id]: { loading: false, error: null, tenants: tenantNodes },
      }));

      for (const tn of tenantNodes) {
        if (tn.expanded) {
          await refreshNamespaces(h, tn.name, true);
        }
      }
    } catch (e: any) {
      setHostTrees((t) => ({
        ...t,
        [h.id]: {
          loading: false,
          error: e?.message || String(e),
          tenants: [],
        },
      }));
    }
  }

  useEffect(() => {
    const currentHostIds = new Set(hosts.map((host) => host.id));
    for (const knownId of Array.from(autoLoadedHostsRef.current)) {
      if (!currentHostIds.has(knownId)) {
        autoLoadedHostsRef.current.delete(knownId);
      }
    }

    for (const [hostId] of Array.from(
      limitedProbeSignaturesRef.current.entries()
    )) {
      if (!currentHostIds.has(hostId)) {
        limitedProbeSignaturesRef.current.delete(hostId);
      }
    }

    for (const host of hosts) {
      if (!host.isAdmin) {
        void verifyLimitedHostConnection(host);
        continue;
      }
      limitedProbeSignaturesRef.current.delete(host.id);
      if (!autoLoadedHostsRef.current.has(host.id)) {
        autoLoadedHostsRef.current.add(host.id);
        void loadTenantsAction(host);
      }
    }
  }, [hosts, verifyLimitedHostConnection]);

  async function refreshNamespaces(
    h: Host,
    tenantName: string,
    refreshTopicsToo = false
  ) {
    setHostTrees((t) => {
      const copy = safeClone(t);
      const tn = copy[h.id]?.tenants.find((x) => x.name === tenantName);
      if (tn) {
        tn.loading = true;
        tn.error = null;
      }
      return copy;
    });

    try {
      const nsNodes = await listNamespaces(h, tenantName);
      const merged = mergeNamespacesWithPrev(h.id, tenantName, nsNodes);

      setHostTrees((t) => {
        const copy = safeClone(t);
        const tn = copy[h.id]?.tenants.find((x) => x.name === tenantName);
        if (tn) {
          tn.loading = false;
          tn.namespaces = merged;
        }
        return copy;
      });

      if (refreshTopicsToo) {
        for (const ns of merged) {
          if (ns.expanded) {
            await refreshTopics(h, tenantName, ns);
          }
        }
      }
    } catch (e: any) {
      setHostTrees((t) => {
        const copy = safeClone(t);
        const tn = copy[h.id]?.tenants.find((x) => x.name === tenantName);
        if (tn) {
          tn.loading = false;
          tn.error = e?.message || String(e);
          tn.namespaces = [];
        }
        return copy;
      });
    }
  }

  async function refreshTopics(
    h: Host,
    tenantName: string,
    nsNode: NamespaceNode
  ) {
    setHostTrees((t) => {
      const copy = safeClone(t);
      const tn = copy[h.id]?.tenants.find((x) => x.name === tenantName);
      const nsRef = tn?.namespaces.find(
        (x) => nsDisplayName(x) === nsDisplayName(nsNode)
      );
      if (nsRef) {
        nsRef.loading = true;
        nsRef.error = null;
      }
      return copy;
    });

    try {
      const topics = await listTopics(h, nsNode);
      setHostTrees((t) => {
        const copy = safeClone(t);
        const tn = copy[h.id]?.tenants.find((x) => x.name === tenantName);
        const nsRef = tn?.namespaces.find(
          (x) => nsDisplayName(x) === nsDisplayName(nsNode)
        );
        if (nsRef) {
          nsRef.loading = false;
          nsRef.topics = topics;
        }
        return copy;
      });
    } catch (e: any) {
      setHostTrees((t) => {
        const copy = safeClone(t);
        const tn = copy[h.id]?.tenants.find((x) => x.name === tenantName);
        const nsRef = tn?.namespaces.find(
          (x) => nsDisplayName(x) === nsDisplayName(nsNode)
        );
        if (nsRef) {
          nsRef.loading = false;
          nsRef.error = e?.message || String(e);
          nsRef.topics = [];
        }
        return copy;
      });
    }
  }

  async function toggleTenant(h: Host, tenantNode: TenantNode) {
    setHostTrees((t) => {
      const copy = safeClone(t);
      const tn = copy[h.id]?.tenants.find((x) => x.name === tenantNode.name)!;
      tn.expanded = !tn.expanded;
      return copy;
    });

    if (!tenantNode.expanded) {
      await refreshNamespaces(h, tenantNode.name, false);
    }
  }

  async function toggleNamespace(
    h: Host,
    tenantName: string,
    nsNode: NamespaceNode
  ) {
    setHostTrees((t) => {
      const copy = safeClone(t);
      const tn = copy[h.id].tenants.find((x) => x.name === tenantName)!;
      const nsRef = tn.namespaces.find(
        (x) => nsDisplayName(x) === nsDisplayName(nsNode)
      )!;
      nsRef.expanded = !nsRef.expanded;
      return copy;
    });

    if (!nsNode.expanded) {
      await refreshTopics(h, tenantName, nsNode);
    }
  }

  const toggleLimitedTenant = (hostId: string, tenantName: string) => {
    setLimitedExpansionState((prev) => {
      const hostState = prev[hostId] ?? { tenants: {}, namespaces: {} };
      const nextTenants = {
        ...hostState.tenants,
        [tenantName]: !(hostState.tenants[tenantName] ?? true),
      };
      return {
        ...prev,
        [hostId]: {
          tenants: nextTenants,
          namespaces: hostState.namespaces,
        },
      };
    });
  };

  const toggleLimitedNamespace = (
    hostId: string,
    tenantName: string,
    nsName: string
  ) => {
    setLimitedExpansionState((prev) => {
      const hostState = prev[hostId] ?? { tenants: {}, namespaces: {} };
      const existing = hostState.namespaces[tenantName] ?? {};
      const nextNamespaces = {
        ...hostState.namespaces,
        [tenantName]: {
          ...existing,
          [nsName]: !(existing[nsName] ?? true),
        },
      };
      return {
        ...prev,
        [hostId]: {
          tenants: hostState.tenants,
          namespaces: nextNamespaces,
        },
      };
    });
  };

  return (
    <div className="flex flex-col">
      <div className="px-4">
        <div className="space-y-3">
          {hosts.map((h) => {
            const tree =
              hostTrees[h.id] || ({ loading: false, tenants: [] } as HostTree);
            const isActiveHost = activeHostId === h.id;
            const hostExpansion = limitedExpansionState[h.id] ?? {
              tenants: {},
              namespaces: {},
            };
            let limitedTenantEntries: {
              tenant: string;
              namespaces: {
                ns: string;
                topics: { raw: string; parsed: TopicNode }[];
              }[];
            }[] = [];
            let limitedInvalidTopics: string[] = [];

            if (!h.isAdmin) {
              const grouped = new Map<
                string,
                Map<string, { raw: string; parsed: TopicNode }[]>
              >();
              const invalid: string[] = [];
              for (const rawTopic of h.allowedTopics) {
                const parsed = parseTopicIdentifier(rawTopic);
                if (!parsed) {
                  invalid.push(rawTopic);
                  continue;
                }
                let tenantGroup = grouped.get(parsed.tenant);
                if (!tenantGroup) {
                  tenantGroup = new Map();
                  grouped.set(parsed.tenant, tenantGroup);
                }
                let nsGroup = tenantGroup.get(parsed.ns);
                if (!nsGroup) {
                  nsGroup = [];
                  tenantGroup.set(parsed.ns, nsGroup);
                }
                nsGroup.push({ raw: rawTopic, parsed });
              }

              limitedTenantEntries = Array.from(grouped.entries())
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([tenant, namespaces]) => ({
                  tenant,
                  namespaces: Array.from(namespaces.entries())
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([ns, topics]) => ({
                      ns,
                      topics: topics.sort((a, b) =>
                        a.parsed.topic.localeCompare(b.parsed.topic)
                      ),
                    })),
                }));

              limitedInvalidTopics = invalid.sort((a, b) => a.localeCompare(b));
            }

            const handleHostSelect = () => {
              onSelectHost?.(h);
              if (!tree.loading && tree.tenants.length === 0) {
                void loadTenantsAction(h);
              }
            };
            return (
              <div
                key={h.id}
                className={`rounded-lg border bg-card/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${
                  isActiveHost
                    ? "border-primary/60 shadow-lg"
                    : "border-border hover:border-primary/30"
                }`}
                onClick={handleHostSelect}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handleHostSelect();
                  }
                }}
              >
                <div
                  className={`flex group items-center justify-between px-4 py-3 gap-3 ${
                    isActiveHost ? "bg-primary/10" : "bg-muted/30"
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    {h.isAdmin ? (
                      <button
                        className="w-8 h-8 inline-flex items-center justify-center rounded-lg transition-colors flex-shrink-0 cursor-pointer hover:bg-muted text-muted-foreground hover:text-foreground"
                        title="Load / Refresh"
                        onClick={(event) => {
                          event.stopPropagation();
                          void loadTenantsAction(h);
                        }}
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                          />
                        </svg>
                      </button>
                    ) : (
                      <button
                        className="w-8 h-8 inline-flex items-center justify-center rounded-lg transition-colors flex-shrink-0 cursor-pointer hover:bg-muted text-muted-foreground hover:text-foreground"
                        title="Check connection"
                        onClick={(event) => {
                          event.stopPropagation();
                          void verifyLimitedHostConnection(h, { force: true });
                        }}
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                          />
                        </svg>
                      </button>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm text-foreground truncate">
                        {h.name}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {h.adminBase}
                      </div>
                    </div>
                  </div>
                  <button
                    className="text-xs hidden group-hover:flex cursor-pointer -mr-2 px-1 py-1 bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground border border-border rounded transition-colors flex items-center gap-1 flex-shrink-0"
                    onClick={(event) => {
                      event.stopPropagation();
                      onEditHost(h);
                    }}
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16.862 3.487l3.651 3.651m-2.62-5.273a2.25 2.25 0 113.182 3.182L7.5 19.622 3 21l1.378-4.5Z"
                      />
                    </svg>
                  </button>
                </div>

                <div className="p-3">
                  {h.isAdmin ? (
                    <>
                      {tree.loading && (
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          <div className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin" />
                          Loading tenants...
                        </div>
                      )}
                      {tree.error && (
                        <div className="text-xs text-destructive bg-destructive/10 p-2 rounded border border-destructive/20">
                          <div className="break-words">{tree.error}</div>
                        </div>
                      )}
                      {tree.tenants
                        .filter((tn) => !isExcludedTenant(tn.name))
                        .map((tn) => (
                          <div key={tn.name}>
                            <div className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted/50 rounded">
                              <button
                                className="cursor-pointer w-5 h-5 inline-flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  toggleTenant(h, tn);
                                }}
                                title="Expand/Collapse"
                              >
                                {tn.expanded ? "-" : "+"}
                              </button>
                              <div className="text-sm font-medium text-foreground">
                                {tn.name}
                              </div>
                              {tn.loading && (
                                <div className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin ml-2" />
                              )}
                              {tn.error && (
                                <div className="ml-2 text-xs text-destructive break-words">
                                  {tn.error}
                                </div>
                              )}
                            </div>

                            {tn.expanded && (
                              <div className="ml-6 border-l border-border pl-3 space-y-1">
                                {tn.namespaces
                                  .filter(
                                    (nsNode) =>
                                      !isExcludedNamespace(
                                        nsDisplayName(nsNode)
                                      )
                                  )
                                  .map((nsNode) => (
                                    <div key={nsDisplayName(nsNode)}>
                                      <div className="flex items-center gap-2 py-1 px-2 hover:bg-muted/50 rounded">
                                        <button
                                          className="cursor-pointer w-5 h-5 inline-flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            toggleNamespace(h, tn.name, nsNode);
                                          }}
                                        >
                                          {nsNode.expanded ? "-" : "+"}
                                        </button>
                                        <div className="text-sm text-foreground">
                                          {nsDisplayName(nsNode)}
                                        </div>
                                        {nsNode.loading && (
                                          <div className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin ml-2" />
                                        )}
                                        {nsNode.error && (
                                          <div className="ml-2 text-xs text-destructive break-words">
                                            {nsNode.error}
                                          </div>
                                        )}
                                      </div>
                                      {nsNode.expanded && (
                                        <div className="ml-6 border-l border-border pl-3 space-y-1 overflow-visible">
                                          {nsNode.topics.length === 0 &&
                                            !nsNode.loading && (
                                              <div className="text-xs text-muted-foreground py-1 px-2">
                                                No topics
                                              </div>
                                            )}
                                          {nsNode.topics.map((tp) => {
                                            const isActive =
                                              activeTopic?.topic.fullName ===
                                              tp.fullName;
                                            return (
                                              <div
                                                key={tp.fullName}
                                                onClick={() =>
                                                  onTopicClick(h, tp)
                                                }
                                                className={`group rounded-lg px-3 py-2 text-sm border transition-all cursor-pointer ${
                                                  isActive && isActiveHost
                                                    ? "bg-primary/20 border-primary/40"
                                                    : "hover:bg-muted/50 border-transparent hover:border-border"
                                                }`}
                                                onDragEnter={(e) => {
                                                  e.preventDefault();
                                                  e.dataTransfer.dropEffect =
                                                    "copy";
                                                  e.currentTarget.classList.add(
                                                    "drag-over-topic"
                                                  );
                                                }}
                                                onDragOver={(e) => {
                                                  e.preventDefault();
                                                  e.dataTransfer.dropEffect =
                                                    "copy";
                                                }}
                                                onDragLeave={(e) => {
                                                  e.currentTarget.classList.remove(
                                                    "drag-over-topic"
                                                  );
                                                }}
                                                onDrop={(e) => {
                                                  e.preventDefault();
                                                  e.currentTarget.classList.remove(
                                                    "drag-over-topic"
                                                  );
                                                  onDropTemplateOnTopic(
                                                    h,
                                                    tp,
                                                    e
                                                  );
                                                }}
                                              >
                                                <div
                                                  className="pointer-events-none text-left truncate w-full flex items-center justify-between"
                                                  title={tp.fullName}
                                                >
                                                  <div className="flex items-center gap-2">
                                                    <span
                                                      className={`inline-block px-2 py-0.5 text-[10px] uppercase tracking-wide rounded font-medium ${
                                                        tp.type === "persistent"
                                                          ? "bg-green-500/20 text-green-400"
                                                          : "bg-yellow-500/20 text-yellow-400"
                                                      }`}
                                                    >
                                                      {tp.type === "persistent"
                                                        ? "PERS"
                                                        : "NON-PERS"}
                                                    </span>
                                                    <span className="truncate">
                                                      {tp.topic}
                                                    </span>
                                                  </div>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                              </div>
                            )}
                          </div>
                        ))}
                    </>
                  ) : (
                    <div>
                      <div className="flex flex-col sm:items-center sm:justify-between gap-1">
                        <div className="text-xs text-muted-foreground">
                          Topic discovery is disabled for this host. Manage the
                          allowed topics below.
                        </div>
                        <button
                          type="button"
                          className="ml-auto cursor-pointer px-2 py-1 text-xs bg-muted text-foreground hover:bg-muted/80 rounded-sm border border-border mb-1"
                          onClick={(event) => {
                            event.stopPropagation();
                            onOpenLimitedTopicModal(h, { type: "create" });
                          }}
                        >
                          + Add Topic
                        </button>
                      </div>
                      {tree.loading && (
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          <div className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin" />
                          Checking host connection...
                        </div>
                      )}
                      {!tree.loading && tree.error && (
                        <div className="text-xs text-destructive bg-destructive/10 p-2 rounded border border-destructive/20 space-y-2">
                          <div className="break-words">{tree.error}</div>
                        </div>
                      )}
                      {!tree.loading && !tree.error && (
                        <>
                          {limitedTenantEntries.length === 0 &&
                          limitedInvalidTopics.length === 0 ? (
                            <div className="text-xs text-muted-foreground bg-muted/40 border border-dashed border-border rounded px-3 py-2 text-center">
                              No topics configured yet.
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {limitedTenantEntries.map((tenantEntry) => {
                                const tenantExpanded =
                                  hostExpansion.tenants[tenantEntry.tenant] ??
                                  true;
                                return (
                                  <div key={tenantEntry.tenant}>
                                    <div className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted/50 rounded">
                                      <button
                                        type="button"
                                        className="cursor-pointer w-5 h-5 inline-flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          toggleLimitedTenant(
                                            h.id,
                                            tenantEntry.tenant
                                          );
                                        }}
                                        title="Expand/Collapse tenant"
                                      >
                                        {tenantExpanded ? "-" : "+"}
                                      </button>
                                      <div className="text-sm font-medium text-foreground">
                                        {tenantEntry.tenant}
                                      </div>
                                    </div>
                                    {tenantExpanded && (
                                      <div className="ml-6 border-l border-border pl-3 space-y-1">
                                        {tenantEntry.namespaces.map(
                                          (namespaceEntry) => {
                                            const namespaceExpanded =
                                              hostExpansion.namespaces[
                                                tenantEntry.tenant
                                              ]?.[namespaceEntry.ns] ?? true;
                                            return (
                                              <div
                                                key={`${tenantEntry.tenant}/${namespaceEntry.ns}`}
                                              >
                                                <div className="flex items-center gap-2 py-1 px-2 hover:bg-muted/40 rounded">
                                                  <button
                                                    type="button"
                                                    className="cursor-pointer w-5 h-5 inline-flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                                    onClick={(event) => {
                                                      event.stopPropagation();
                                                      toggleLimitedNamespace(
                                                        h.id,
                                                        tenantEntry.tenant,
                                                        namespaceEntry.ns
                                                      );
                                                    }}
                                                    title="Expand/Collapse namespace"
                                                  >
                                                    {namespaceExpanded
                                                      ? "-"
                                                      : "+"}
                                                  </button>
                                                  <div className="text-sm text-foreground">
                                                    {namespaceEntry.ns}
                                                  </div>
                                                </div>
                                                {namespaceExpanded && (
                                                  <div className="ml-6 border-l border-border pl-3 space-y-1">
                                                    {namespaceEntry.topics.map(
                                                      ({ raw, parsed }) => {
                                                        const isActive =
                                                          isActiveHost &&
                                                          activeTopic?.topic
                                                            .fullName ===
                                                            parsed.fullName;
                                                        return (
                                                          <div
                                                            key={
                                                              parsed.fullName
                                                            }
                                                            className="flex group items-center gap-2 transition-all min-w-0"
                                                          >
                                                            <div
                                                              onClick={() => {
                                                                onTopicClick(
                                                                  h,
                                                                  parsed
                                                                );
                                                              }}
                                                              className={`group rounded-lg px-3 py-2 text-sm border transition-colors flex-1 min-w-0 ${
                                                                isActive
                                                                  ? "bg-primary/20 border-primary/40 cursor-pointer"
                                                                  : "hover:bg-muted/50 border-transparent hover:border-border cursor-pointer"
                                                              }`}
                                                              title={
                                                                parsed.fullName
                                                              }
                                                              onDragEnter={(
                                                                event
                                                              ) => {
                                                                event.preventDefault();
                                                                event.dataTransfer.dropEffect =
                                                                  "copy";
                                                                event.currentTarget.classList.add(
                                                                  "drag-over-topic"
                                                                );
                                                              }}
                                                              onDragOver={(
                                                                event
                                                              ) => {
                                                                event.preventDefault();
                                                                event.dataTransfer.dropEffect =
                                                                  "copy";
                                                              }}
                                                              onDragLeave={(
                                                                event
                                                              ) => {
                                                                event.currentTarget.classList.remove(
                                                                  "drag-over-topic"
                                                                );
                                                              }}
                                                              onDrop={(
                                                                event
                                                              ) => {
                                                                event.preventDefault();
                                                                event.currentTarget.classList.remove(
                                                                  "drag-over-topic"
                                                                );
                                                                onDropTemplateOnTopic(
                                                                  h,
                                                                  parsed,
                                                                  event
                                                                );
                                                              }}
                                                            >
                                                              <div
                                                                className="pointer-events-none text-left truncate w-full flex items-center justify-between"
                                                                title={
                                                                  parsed.fullName
                                                                }
                                                              >
                                                                <div className="flex items-center gap-2">
                                                                  <span
                                                                    className={`inline-block px-2 py-0.5 text-[10px] uppercase tracking-wide rounded font-medium ${
                                                                      parsed.type ===
                                                                      "persistent"
                                                                        ? "bg-green-500/20 text-green-400"
                                                                        : "bg-yellow-500/20 text-yellow-400"
                                                                    }`}
                                                                  >
                                                                    {parsed.type ===
                                                                    "persistent"
                                                                      ? "PERS"
                                                                      : "NON-PERS"}
                                                                  </span>
                                                                  <span className="truncate">
                                                                    {
                                                                      parsed.topic
                                                                    }
                                                                  </span>
                                                                </div>
                                                              </div>
                                                            </div>
                                                            <button
                                                              className="text-xs hidden group-hover:flex cursor-pointer -mr-1 px-1 py-1.5 bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground border border-border rounded transition-colors flex items-center gap-1 flex-shrink-0"
                                                              onClick={(
                                                                event
                                                              ) => {
                                                                event.stopPropagation();
                                                                onOpenLimitedTopicModal(
                                                                  h,
                                                                  {
                                                                    type: "edit",
                                                                    topic: raw,
                                                                  }
                                                                );
                                                              }}
                                                            >
                                                              <svg
                                                                className="w-4 h-4"
                                                                fill="none"
                                                                stroke="currentColor"
                                                                viewBox="0 0 24 24"
                                                              >
                                                                <path
                                                                  strokeLinecap="round"
                                                                  strokeLinejoin="round"
                                                                  strokeWidth={
                                                                    2
                                                                  }
                                                                  d="M16.862 3.487l3.651 3.651m-2.62-5.273a2.25 2.25 0 113.182 3.182L7.5 19.622 3 21l1.378-4.5Z"
                                                                />
                                                              </svg>
                                                            </button>
                                                          </div>
                                                        );
                                                      }
                                                    )}
                                                    {namespaceEntry.topics
                                                      .length === 0 && (
                                                      <div className="text-xs text-muted-foreground py-1 px-2">
                                                        No topics
                                                      </div>
                                                    )}
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          }
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {limitedInvalidTopics.length > 0 && (
                            <div className="space-y-2 pt-3 border-t border-border/60">
                              <div className="text-xs font-medium text-destructive">
                                Topics with invalid format
                              </div>
                              {limitedInvalidTopics.map((raw) => (
                                <div
                                  key={raw}
                                  className="flex items-center gap-2"
                                >
                                  <div className="flex-1 px-3 py-2 text-xs border border-destructive/40 bg-destructive/10 text-destructive rounded break-all">
                                    {raw}
                                  </div>
                                  <button
                                    type="button"
                                    className="px-2 py-1 text-xs bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground rounded border border-border"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      onOpenLimitedTopicModal(h, {
                                        type: "edit",
                                        topic: raw,
                                      });
                                    }}
                                  >
                                    Edit
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
