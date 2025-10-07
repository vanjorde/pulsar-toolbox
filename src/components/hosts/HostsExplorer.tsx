"use client";
import { useEffect, useRef, useState } from "react";
import type React from "react";
import type {
  Host,
  HostTree,
  NamespaceNode,
  TenantNode,
  TopicNode,
} from "@/types/pulsar";
import { listNamespaces, listTenants, listTopics } from "@/lib/pulsarAdmin";
import { safeClone } from "@/lib/safeClone";
import { ConfirmDialog } from "../ui/ConfirmDialog";

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

export function HostsExplorer({
  hosts,
  setHosts,
  hostTrees,
  setHostTrees,
  onTopicClick,
  onDropTemplateOnTopic,
  activeTopic,
  activeHostId,
  onSelectHost,
  onAddHost,
}: {
  hosts: Host[];
  setHosts: (fn: (prev: Host[]) => Host[]) => void;
  hostTrees: Record<string, HostTree>;
  setHostTrees: (
    fn: (prev: Record<string, HostTree>) => Record<string, HostTree>
  ) => void;
  onTopicClick: (h: Host, tp: TopicNode) => void;
  onDropTemplateOnTopic: (h: Host, node: TopicNode, e: React.DragEvent) => void;
  activeTopic?: { host: Host; topic: TopicNode } | null;
  activeHostId?: string | null;
  onSelectHost?: (host: Host) => void;
  onAddHost: () => void;
}) {
  const [hostToDelete, setHostToDelete] = useState<string | null>(null);
  const autoLoadedHostsRef = useRef<Set<string>>(new Set());

  const handleDeleteHost = (id: string) => {
    setHosts((h) => h.filter((x) => x.id !== id));
    setHostTrees((t) => {
      const copy = { ...t };
      delete copy[id];
      return copy;
    });
    setHostToDelete(null);
  };

  function removeHost(id: string) {
    setHostToDelete(id);
  }

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
          tenants: t[h.id]?.tenants ?? [],
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

    for (const host of hosts) {
      if (!autoLoadedHostsRef.current.has(host.id)) {
        autoLoadedHostsRef.current.add(host.id);
        void loadTenantsAction(host);
      }
    }
  }, [hosts]);

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

  return (
    <div className="flex flex-col">
      <div className="px-4">
        <div className="space-y-3">
          {hosts.map((h) => {
            const tree =
              hostTrees[h.id] || ({ loading: false, tenants: [] } as HostTree);
            const isActiveHost = activeHostId === h.id;
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
                  className={`flex items-center justify-between px-4 py-3 gap-3 ${
                    isActiveHost ? "bg-primary/10" : "bg-muted/30"
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <button
                      className="cursor-pointer w-8 h-8 inline-flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
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
                    className="text-xs cursor-pointer px-2 py-1 bg-destructive/30 hover:bg-destructive/40 text-red-500 border border-destructive/30 rounded transition-colors flex items-center gap-1 flex-shrink-0"
                    onClick={(event) => {
                      event.stopPropagation();
                      setHostToDelete(h.id);
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
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>

                <div className="p-3">
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
                                  !isExcludedNamespace(nsDisplayName(nsNode))
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
                                            onClick={() => onTopicClick(h, tp)}
                                            className={`group rounded-lg px-3 py-2 text-sm border transition-all cursor-pointer ${
                                              isActive && isActiveHost
                                                ? "bg-primary/20 border-primary/40 text-primary-foreground"
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
                                              onDropTemplateOnTopic(h, tp, e);
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
                                                <span className="font-medium truncate text-white">
                                                  {tp.topic}
                                                </span>
                                              </div>
                                              {isActive && isActiveHost && (
                                                <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                                              )}
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
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <ConfirmDialog
        isOpen={hostToDelete !== null}
        onClose={() => setHostToDelete(null)}
        onConfirm={() => hostToDelete && handleDeleteHost(hostToDelete)}
        title="Delete Host"
        message="Are you sure you want to delete this host? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
}
