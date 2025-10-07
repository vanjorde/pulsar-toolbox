"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AsyncPoller } from "@/lib/asyncPoller";
import { mergeUniqueNewestFirst, sortNewestFirst } from "@/lib/messages";
import { readN, type PulsarMessage } from "@/lib/pulsarWs";
import type { Host, TopicNode } from "@/types/pulsar";

export type ActiveTopic = { host: Host; topic: TopicNode } | null;
export type ConnectionStatus = "disconnected" | "connecting" | "connected";

const HISTORY_SCAN_FACTOR = 5;
const HISTORY_TIMEOUT_MS = 2500;
const POLL_INTERVAL_MS = 1800;
const POLL_TIMEOUT_MS = 1400;

export function useLiveTopic(initialMax = 10) {
  const [activeTopic, setActiveTopic] = useState<ActiveTopic>(null);
  const [liveMessages, setLiveMessages] = useState<PulsarMessage[]>([]);
  const [isLiveUpdating, setLiveUpdating] = useState(false);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("disconnected");
  const [maxMessages, setMaxMessages] = useState(initialMax);
  const [isLoading, setIsLoading] = useState(false);

  const pollerRef = useRef<AsyncPoller<PulsarMessage[]> | null>(null);
  const pollAbortRef = useRef<(() => void) | null>(null);
  const historyAbortRef = useRef<(() => void) | null>(null);
  const prevMaxRef = useRef(initialMax);

  const stopPolling = useCallback(() => {
    pollerRef.current?.stop();
    pollerRef.current = null;
    if (pollAbortRef.current) {
      pollAbortRef.current();
      pollAbortRef.current = null;
    }
  }, []);

  const snapshotTail = useCallback(
    async (host: Host, tp: TopicNode, targetMax: number) => {
      if (historyAbortRef.current) {
        historyAbortRef.current();
        historyAbortRef.current = null;
      }
      const abortRef: { current?: () => void } = {};
      const abortHandle = () => {
        abortRef.current?.();
      };
      historyAbortRef.current = abortHandle;
      try {
        const initial = await readN({
          wsBase: host.wsBase,
          tenant: tp.tenant,
          ns: tp.ns,
          topic: tp.topic,
          start: "earliest",
          limit: Math.max(targetMax * HISTORY_SCAN_FACTOR, targetMax),
          timeoutMs: HISTORY_TIMEOUT_MS,
          abortRef,
        });
        return sortNewestFirst(initial).slice(0, targetMax);
      } finally {
        if (historyAbortRef.current === abortHandle) {
          historyAbortRef.current = null;
        }
      }
    },
    []
  );

  const fetchLatestBatch = useCallback(
    async (topicInfo: Exclude<ActiveTopic, null>, limit: number) => {
      const abortRef: { current?: () => void } = {};
      const abortHandle = () => {
        abortRef.current?.();
      };
      pollAbortRef.current = abortHandle;
      try {
        return await readN({
          wsBase: topicInfo.host.wsBase,
          tenant: topicInfo.topic.tenant,
          ns: topicInfo.topic.ns,
          topic: topicInfo.topic.topic,
          start: "latest",
          limit,
          timeoutMs: POLL_TIMEOUT_MS,
          abortRef,
        });
      } finally {
        if (pollAbortRef.current === abortHandle) {
          pollAbortRef.current = null;
        }
      }
    },
    []
  );

  const startPolling = useCallback(
    (topicInfo: Exclude<ActiveTopic, null>, limit: number) => {
      stopPolling();
      const poller = new AsyncPoller<PulsarMessage[]>({
        intervalMs: POLL_INTERVAL_MS,
        fetcher: () => fetchLatestBatch(topicInfo, limit),
        onResult: (batch) => {
          if (batch.length === 0) return;
          setLiveMessages((prev) => mergeUniqueNewestFirst(batch, prev, limit));
        },
        onError: () => {
          //keep trying -> status updates handled below
        },
        onStatusChange: (status) => {
          setConnectionStatus((current) => {
            if (status === "connecting" && current === "connected") {
              return current;
            }
            if (status === "error") {
              return "disconnected";
            }
            return status;
          });
        },
      });
      poller.start();
      pollerRef.current = poller;
    },
    [fetchLatestBatch, stopPolling]
  );

  const clearActiveTopic = useCallback(() => {
    stopPolling();
    if (historyAbortRef.current) {
      historyAbortRef.current();
      historyAbortRef.current = null;
    }
    setActiveTopic(null);
    setLiveMessages([]);
    setLiveUpdating(false);
    setConnectionStatus("disconnected");
    setIsLoading(false);
  }, [stopPolling]);

  const refreshActiveTopic = useCallback(
    async ({ showSpinner = true }: { showSpinner?: boolean } = {}) => {
      if (!activeTopic) return;
      if (showSpinner) {
        setIsLoading(true);
      }
      try {
        const tail = await snapshotTail(
          activeTopic.host,
          activeTopic.topic,
          maxMessages
        );
        setLiveMessages((prev) =>
          mergeUniqueNewestFirst(prev, tail, maxMessages)
        );
      } catch {
      } finally {
        if (showSpinner) {
          setIsLoading(false);
        }
      }
    },
    [activeTopic, maxMessages, snapshotTail]
  );

  const onTopicClick = useCallback(
    async (host: Host, topicNode: TopicNode) => {
      stopPolling();
      if (historyAbortRef.current) {
        historyAbortRef.current();
        historyAbortRef.current = null;
      }
      setActiveTopic({ host, topic: topicNode });
      setLiveMessages([]);
      setLiveUpdating(true);
      setConnectionStatus("connecting");
      setIsLoading(true);
      try {
        const tail = await snapshotTail(host, topicNode, maxMessages);
        setLiveMessages((prev) =>
          mergeUniqueNewestFirst(prev, tail, maxMessages)
        );
      } catch {
        setLiveMessages([]);
        setConnectionStatus("disconnected");
      } finally {
        setIsLoading(false);
      }
    },
    [maxMessages, snapshotTail, stopPolling]
  );

  const setIsLiveUpdating = useCallback(
    (updater: ((value: boolean) => boolean) | boolean) => {
      setLiveUpdating((prev) => {
        const next =
          typeof updater === "function"
            ? (updater as (value: boolean) => boolean)(prev)
            : updater;
        if (!next) {
          stopPolling();
          setConnectionStatus("disconnected");
        }
        return next;
      });
    },
    [stopPolling]
  );

  useEffect(() => {
    return () => {
      stopPolling();
      if (historyAbortRef.current) {
        historyAbortRef.current();
        historyAbortRef.current = null;
      }
    };
  }, [stopPolling]);

  useEffect(() => {
    if (!activeTopic) {
      stopPolling();
      setConnectionStatus("disconnected");
      setLiveMessages([]);
      return;
    }
    if (!isLiveUpdating) {
      stopPolling();
      setConnectionStatus("disconnected");
      return;
    }
    setConnectionStatus("connecting");
    startPolling(activeTopic, maxMessages);
    return () => {
      stopPolling();
    };
  }, [activeTopic, isLiveUpdating, maxMessages, startPolling, stopPolling]);

  useEffect(() => {
    if (!activeTopic) return;
    const previous = prevMaxRef.current;
    if (maxMessages === previous) return;
    if (maxMessages < previous) {
      setLiveMessages((prev) => prev.slice(0, maxMessages));
    } else {
      (async () => {
        try {
          setIsLoading(true);
          const tail = await snapshotTail(
            activeTopic.host,
            activeTopic.topic,
            maxMessages
          );
          setLiveMessages((prev) =>
            mergeUniqueNewestFirst(prev, tail, maxMessages)
          );
        } catch {
        } finally {
          setIsLoading(false);
        }
      })();
    }
    prevMaxRef.current = maxMessages;
  }, [activeTopic, maxMessages, snapshotTail]);

  return {
    activeTopic,
    onTopicClick,
    liveMessages,
    isLiveUpdating,
    setIsLiveUpdating,
    connectionStatus,
    maxMessages,
    setMaxMessages,
    isLoading,
    clearActiveTopic,
    refreshActiveTopic,
  } as const;
}
