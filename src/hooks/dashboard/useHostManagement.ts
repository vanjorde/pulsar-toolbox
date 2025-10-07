"use client";
import { useCallback, useEffect, useState } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { safeClone } from "@/lib/safeClone";
import { DEFAULT_HOSTS } from "@/lib/defaults";
import type { Host, HostTree, TopicNode } from "@/types/pulsar";

function initHostTrees(hosts: Host[]): Record<string, HostTree> {
  return hosts.reduce<Record<string, HostTree>>((acc, host) => {
    acc[host.id] = { loading: false, tenants: [] };
    return acc;
  }, {});
}

function cloneHostTrees(
  value: Record<string, HostTree>
): Record<string, HostTree> {
  return safeClone(value);
}

export function useHostManagement() {
  const [hosts, setHosts] = useLocalStorage<Host[]>(
    "pulsar.hosts",
    DEFAULT_HOSTS
  );

  const [wsBase, setWsBase] = useState<string>(
    () => hosts[0]?.wsBase ?? DEFAULT_HOSTS[0]?.wsBase ?? "ws://localhost:8080"
  );

  const [hostTrees, setHostTrees] = useState<Record<string, HostTree>>(() =>
    initHostTrees(hosts)
  );
  const [activeHostId, setActiveHostId] = useState<string | null>(
    () => hosts[0]?.id ?? null
  );

  useEffect(() => {
    setHostTrees((prev) => {
      const next = { ...prev } as Record<string, HostTree>;
      for (const host of hosts) {
        if (!next[host.id]) {
          next[host.id] = { loading: false, tenants: [] };
        }
      }
      for (const key of Object.keys(next)) {
        if (!hosts.find((host) => host.id === key)) {
          delete next[key];
        }
      }
      return next;
    });
  }, [hosts]);

  const handleSelectHost = useCallback((host: Host) => {
    setActiveHostId((current) => (current === host.id ? current : host.id));
    setWsBase((current) => (current === host.wsBase ? current : host.wsBase));
  }, []);

  useEffect(() => {
    if (hosts.length === 0) {
      setActiveHostId(null);
      return;
    }
    if (!activeHostId) {
      handleSelectHost(hosts[0]);
      return;
    }
    if (!hosts.some((host) => host.id === activeHostId)) {
      handleSelectHost(hosts[0]);
    }
  }, [hosts, activeHostId, handleSelectHost]);

  const ensureTopicVisible = useCallback(
    (host: Host, topicNode: TopicNode) => {
      setHostTrees((prev) => {
        const existingTree = prev[host.id];
        const existingTenant = existingTree?.tenants.find(
          (t) => t.name === topicNode.tenant
        );
        const existingNamespace = existingTenant?.namespaces.find(
          (n) => n.ns === topicNode.ns
        );
        const existingTopic = existingNamespace?.topics.some(
          (t) => t.fullName === topicNode.fullName
        );

        if (
          existingTopic &&
          (existingTenant?.expanded ?? false) &&
          (existingNamespace?.expanded ?? false)
        ) {
          return prev;
        }

        const next = cloneHostTrees(prev);
        const tree =
          next[host.id] ??
          (next[host.id] = {
            loading: false,
            tenants: [],
          });

        let tenantNode = tree.tenants.find((t) => t.name === topicNode.tenant);
        if (!tenantNode) {
          tenantNode = {
            name: topicNode.tenant,
            expanded: true,
            loading: false,
            error: null,
            namespaces: [],
          };
          tree.tenants.push(tenantNode);
        } else {
          tenantNode.expanded = true;
        }

        let namespace = tenantNode.namespaces.find(
          (n) => n.ns === topicNode.ns
        );
        if (!namespace) {
          namespace = {
            name: `${topicNode.tenant}/${topicNode.ns}`,
            tenant: topicNode.tenant,
            ns: topicNode.ns,
            expanded: true,
            loading: false,
            error: null,
            topics: [],
          };
          tenantNode.namespaces.push(namespace);
        } else {
          namespace.expanded = true;
        }

        if (!namespace.topics.some((t) => t.fullName === topicNode.fullName)) {
          namespace.topics.push(topicNode);
          namespace.topics.sort((a, b) => a.fullName.localeCompare(b.fullName));
        }

        tenantNode.namespaces.sort((a, b) => a.name.localeCompare(b.name));
        tree.tenants.sort((a, b) => a.name.localeCompare(b.name));

        return next;
      });
    },
    [setHostTrees]
  );

  return {
    hosts,
    setHosts,
    wsBase,
    setWsBase,
    hostTrees,
    setHostTrees,
    activeHostId,
    setActiveHostId,
    handleSelectHost,
    ensureTopicVisible,
  } as const;
}
