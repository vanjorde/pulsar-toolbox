"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  HOSTS_STORAGE_KEY,
  addAllowedTopic as addAllowedTopicToHost,
  ensureTopicVisibleInTree,
  initHostTreeMap,
  loadHostsFromStorage,
  normalizeHost,
  persistHostsToStorage,
  removeAllowedTopic as removeAllowedTopicFromHost,
  updateAllowedTopic as updateAllowedTopicOnHost,
} from "@/lib/hosts";
import { deleteAllHostTokens } from "@/lib/pulsarTokenStorage";
import { DEFAULT_HOSTS } from "@/lib/defaults";
import type { Host, HostTree, TopicNode } from "@/types/pulsar";

export function useHostManagement() {
  const [hosts, setHostsState] = useState<Host[]>(() =>
    DEFAULT_HOSTS.map((host) => normalizeHost(host))
  );
  const [isInitialized, setInitialized] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const loaded = await loadHostsFromStorage(DEFAULT_HOSTS, HOSTS_STORAGE_KEY);
      if (cancelled) return;
      setHostsState(loaded);
      await persistHostsToStorage(loaded, HOSTS_STORAGE_KEY);
      if (!cancelled) {
        setInitialized(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setHosts = useCallback(
    (update: React.SetStateAction<Host[]>) => {
      setHostsState((prev) => {
        const normalizedPrev = prev.map((host) => normalizeHost(host));
        const nextValue =
          typeof update === "function"
            ? (update as (prev: Host[]) => Host[])(normalizedPrev)
            : update;
        const normalizedNext = nextValue.map((host) => normalizeHost(host));
        void persistHostsToStorage(normalizedNext, HOSTS_STORAGE_KEY);
        return normalizedNext;
      });
    },
    []
  );

  const serviceUrl = useMemo(
    () => hosts[0]?.serviceUrl ?? DEFAULT_HOSTS[0]?.serviceUrl ?? "pulsar://localhost:6650",
    [hosts]
  );
  const [serviceUrlState, setServiceUrl] = useState<string>(serviceUrl);

  useEffect(() => {
    setServiceUrl((current) => (current === serviceUrl ? current : serviceUrl));
  }, [serviceUrl]);

  const [hostTrees, setHostTrees] = useState<Record<string, HostTree>>(() =>
    initHostTreeMap(hosts)
  );
  const [activeHostId, setActiveHostId] = useState<string | null>(() => hosts[0]?.id ?? null);

  useEffect(() => {
    setHostTrees((prev) => {
      const next = { ...prev } as Record<string, HostTree>;
      for (const host of hosts) {
        if (!next[host.id]) {
          next[host.id] = { loading: false, tenants: [] };
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

  const handleSelectHost = useCallback((host: Host) => {
    setActiveHostId((current) => (current === host.id ? current : host.id));
    setServiceUrl((current) => (current === host.serviceUrl ? current : host.serviceUrl));
  }, []);

  useEffect(() => {
    if (!isInitialized) {
      return;
    }
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
  }, [hosts, activeHostId, handleSelectHost, isInitialized]);

  const ensureTopicVisible = useCallback(
    (host: Host, topicNode: TopicNode) => {
      setHostTrees((prev) => ensureTopicVisibleInTree(prev, host, topicNode));
    },
    []
  );

  const addHost = useCallback(
    (host: Host) => {
      setHosts((prev) => [...prev, host]);
    },
    [setHosts]
  );

  const updateHost = useCallback(
    (host: Host) => {
      setHosts((prev) => {
        let changed = false;
        const next = prev.map((item) => {
          if (item.id !== host.id) {
            return item;
          }
          changed = true;
          return host;
        });
        return changed ? next : prev;
      });
    },
    [setHosts]
  );

  const deleteHost = useCallback(
    (hostId: string) => {
      void deleteAllHostTokens(hostId);
      setHosts((prev) => {
        const next = prev.filter((host) => host.id !== hostId);
        return next.length === prev.length ? prev : next;
      });
    },
    [setHosts]
  );

  const addLimitedTopic = useCallback(
    (hostId: string, topic: string) => {
      if (!topic) {
        return;
      }
      setHosts((prev) => {
        let changed = false;
        const next = prev.map((item) => {
          if (item.id !== hostId) {
            return item;
          }
          const updated = addAllowedTopicToHost(item, topic);
          if (updated !== item) {
            changed = true;
          }
          return updated;
        });
        return changed ? next : prev;
      });
    },
    [setHosts]
  );

  const removeLimitedTopic = useCallback(
    (hostId: string, topic: string) => {
      setHosts((prev) => {
        let changed = false;
        const next = prev.map((item) => {
          if (item.id !== hostId) {
            return item;
          }
          const updated = removeAllowedTopicFromHost(item, topic);
          if (updated !== item) {
            changed = true;
          }
          return updated;
        });
        return changed ? next : prev;
      });
    },
    [setHosts]
  );

  const updateLimitedTopic = useCallback(
    (hostId: string, previousTopic: string, nextTopic: string) => {
      if (!nextTopic) {
        return;
      }
      setHosts((prev) => {
        let changed = false;
        const next = prev.map((item) => {
          if (item.id !== hostId) {
            return item;
          }
          const updated = updateAllowedTopicOnHost(item, previousTopic, nextTopic);
          if (updated !== item) {
            changed = true;
          }
          return updated;
        });
        return changed ? next : prev;
      });
    },
    [setHosts]
  );

  return {
    hosts,
    setHosts,
    serviceUrl: serviceUrlState,
    setServiceUrl,
    hostTrees,
    setHostTrees,
    activeHostId,
    setActiveHostId,
    handleSelectHost,
    ensureTopicVisible,
    addHost,
    updateHost,
    deleteHost,
    addLimitedTopic,
    removeLimitedTopic,
    updateLimitedTopic,
  } as const;
}
