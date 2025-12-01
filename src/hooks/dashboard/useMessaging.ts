"use client";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { ActiveTopic } from "@/hooks/useLiveTopic";
import { formatPayloadString } from "@/lib/payload";
import { produce, readN, type PulsarMessage } from "@/lib/pulsarService";
import type { Host, Template, TopicNode } from "@/types/pulsar";
import type { SendResult } from "@/types/messaging";

function interpretProducerResponse(
  response: unknown,
  target: string,
  defaultSuccessMessage: string
): SendResult {
  const timestamp = Date.now();
  const record =
    typeof response === "object" && response !== null
      ? (response as Record<string, unknown>)
      : undefined;

  const pickString = (value: unknown): string | undefined =>
    typeof value === "string" ? value : undefined;

  const statusString =
    typeof record?.status === "string"
      ? record.status.toLowerCase()
      : undefined;
  const resultString =
    typeof record?.result === "string"
      ? record.result.toLowerCase()
      : undefined;

  const failureMessage =
    pickString(record?.error) ??
    pickString(record?.reason) ??
    (record?.success === false || record?.ok === false
      ? pickString(record?.message)
      : undefined) ??
    (statusString && ["error", "failed", "failure"].includes(statusString)
      ? pickString(record?.status)
      : undefined) ??
    (resultString && resultString !== "ok"
      ? pickString(record?.result)
      : undefined) ??
    pickString(record?.Exception) ??
    pickString(record?.exception);

  const failureCode =
    typeof record?.code === "number" && record.code >= 400
      ? `Broker returned code ${record.code}`
      : typeof record?.status === "number" && record.status >= 400
      ? `Broker returned status ${record.status}`
      : undefined;

  let succeeded = true;
  let message = defaultSuccessMessage;

  if (failureMessage || failureCode) {
    succeeded = false;
    message = failureMessage ?? failureCode ?? "Message send failed";
  } else if (record && record.success === false) {
    succeeded = false;
    message = pickString(record.message) ?? "Message send failed";
  } else if (typeof response === "string") {
    const lower = response.toLowerCase();
    if (lower.includes("error") || lower.includes("fail")) {
      succeeded = false;
      message = response;
    } else {
      message = response;
    }
  } else if (record && record.success === true) {
    message = pickString(record.message) ?? defaultSuccessMessage;
  }

  if (
    record &&
    typeof record.result === "string" &&
    !["ok", "success"].includes((record.result as string).toLowerCase())
  ) {
    succeeded = false;
    message = record.result as string;
  }

  return {
    target,
    response,
    succeeded,
    message,
    timestamp,
  };
}

function buildFailureResult(error: unknown, target: string): SendResult {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
      ? error
      : "Message send failed";
  return {
    target,
    response: error,
    succeeded: false,
    message,
    timestamp: Date.now(),
  };
}

type RefreshActiveTopic = (options?: {
  showSpinner?: boolean;
}) => Promise<void>;

type ClearActiveTopic = () => void;

interface MessagingOptions {
  serviceUrl: string;
  tenant: string;
  ns: string;
  topic: string;
  json: string;
  setJson: React.Dispatch<React.SetStateAction<string>>;
  start: "earliest" | "latest";
  limit: number;
  timeoutMs: number;
  hosts: Host[];
  activeHostId: string | null;
  activeTopic: ActiveTopic;
  templates: Template[];
  handleTopicClick: (host: Host, topicNode: TopicNode) => Promise<void>;
  handleSelectHost: (host: Host) => void;
  ensureTopicVisible: (host: Host, topicNode: TopicNode) => void;
  refreshActiveTopic: RefreshActiveTopic;
  clearActiveTopic: ClearActiveTopic;
}

export function useMessaging({
  serviceUrl,
  tenant,
  ns,
  topic,
  json,
  setJson,
  start,
  limit,
  timeoutMs,
  hosts,
  activeHostId,
  activeTopic,
  templates,
  handleTopicClick,
  handleSelectHost,
  ensureTopicVisible,
  refreshActiveTopic,
  clearActiveTopic,
}: MessagingOptions) {
  const [sending, setSending] = useState(false);
  const [peeking, setPeeking] = useState(false);
  const [messages, setMessages] = useState<PulsarMessage[]>([]);
  const [sendResultsByTopic, setSendResultsByTopic] = useState<
    Record<string, SendResult>
  >({});
  const readerAbort = useRef<(() => void) | undefined>(undefined);

  const activeHost = useMemo(
    () =>
      activeHostId
        ? hosts.find((host) => host.id === activeHostId) ?? null
        : hosts.find((host) => host.serviceUrl === serviceUrl) ?? null,
    [activeHostId, hosts, serviceUrl]
  );

  const buildFullTopicName = useCallback(
    (targetTenant: string, targetNs: string, targetTopic: string) =>
      `persistent://${targetTenant}/${targetNs}/${targetTopic}`,
    []
  );

  const recordSendResult = useCallback((result: SendResult) => {
    setSendResultsByTopic((prev) => ({ ...prev, [result.target]: result }));
  }, []);

  useEffect(() => {
    setMessages([]);
  }, [activeHostId]);

  const sendMessage = useCallback(async () => {
    const target = buildFullTopicName(tenant, ns, topic);
    setSending(true);
    try {
      const response = await produce({
        serviceUrl,
        tenant,
        ns,
        topic,
        json,
        caPem: activeHost?.adminCaPem ?? undefined,
        token: activeHost?.token ?? undefined,
      });
      const result = interpretProducerResponse(
        response,
        target,
        "Message sent successfully"
      );
      recordSendResult(result);
      if (result.succeeded) {
        toast.success(result.message || "Message sent successfully");
        const isActiveTarget =
          activeTopic &&
          activeTopic.topic.fullName === target &&
          activeTopic.host.serviceUrl === serviceUrl &&
          activeHostId === activeTopic.host.id;
        if (isActiveTarget) {
          await refreshActiveTopic({ showSpinner: false });
        } else {
          const targetHost =
            hosts.find((candidate) => candidate.id === activeHostId) ??
            hosts.find((candidate) => candidate.serviceUrl === serviceUrl);
          if (targetHost) {
            const topicNode: TopicNode = {
              fullName: target,
              type: "persistent",
              tenant,
              ns,
              topic,
            };
            ensureTopicVisible(targetHost, topicNode);
            await handleTopicClick(targetHost, topicNode);
          }
        }
      } else {
        toast.error(result.message || "Message send failed");
      }
    } catch (error) {
      const result = buildFailureResult(error, target);
      recordSendResult(result);
      toast.error(result.message);
    } finally {
      setSending(false);
    }
  }, [
    activeHostId,
    activeTopic,
    buildFullTopicName,
    ensureTopicVisible,
    handleTopicClick,
    hosts,
    json,
    ns,
    recordSendResult,
    refreshActiveTopic,
    tenant,
    topic,
    serviceUrl,
  ]);

  const sendTemplateToTopic = useCallback(
    async (host: Host, node: TopicNode, event: React.DragEvent) => {
      event.preventDefault();
      handleSelectHost(host);

      const templateId = event.dataTransfer.getData(
        "application/x-template-id"
      );
      let payload =
        event.dataTransfer.getData("application/json") ||
        event.dataTransfer.getData("text/plain") ||
        event.dataTransfer.getData("text");

      if (templateId) {
        const template = templates.find((item) => item.id === templateId);
        if (template) {
          payload = template.payload;
        }
      }

      const formatted = formatPayloadString(payload, 2);
      if (formatted.ok) {
        payload = formatted.value;
      }

      const target = buildFullTopicName(node.tenant, node.ns, node.topic);
      setSending(true);
      try {
        const response = await produce({
          serviceUrl: host.serviceUrl,
          tenant: node.tenant,
          ns: node.ns,
          topic: node.topic,
          json: payload,
          caPem: host.adminCaPem ?? undefined,
          token: host.token ?? undefined,
        });
        const result = interpretProducerResponse(
          response,
          target,
          `Message sent to ${node.fullName}`
        );
        recordSendResult(result);
        if (result.succeeded) {
          setJson(payload);
          if (
            activeTopic &&
            activeTopic.host.id === host.id &&
            activeTopic.topic.fullName === node.fullName
          ) {
            await refreshActiveTopic({ showSpinner: false });
          } else {
            ensureTopicVisible(host, node);
            await handleTopicClick(host, node);
          }
          toast.success(result.message || `Message sent to ${node.fullName}`);
        } else {
          toast.error(
            result.message || `Failed to send message to ${node.fullName}`
          );
        }
      } catch (error) {
        const result = buildFailureResult(error, target);
        recordSendResult(result);
        toast.error(
          result.message || `Failed to send message to ${node.fullName}`
        );
      } finally {
        setSending(false);
      }
    },
    [
      activeTopic,
      buildFullTopicName,
      ensureTopicVisible,
      handleSelectHost,
      handleTopicClick,
      recordSendResult,
      refreshActiveTopic,
      setJson,
      templates,
    ]
  );

  const peekMessages = useCallback(async () => {
    setPeeking(true);
    setMessages([]);
    readerAbort.current = undefined;
    try {
      const result = await readN({
        serviceUrl,
        tenant,
        ns,
        topic,
        start,
        limit,
        timeoutMs,
        abortRef: readerAbort,
        caPem: activeHost?.adminCaPem ?? undefined,
        token: activeHost?.token ?? undefined,
      });
      setMessages(result);
      toast.success(`Retrieved ${result.length} messages`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to read messages: ${message}`);
    } finally {
      setPeeking(false);
    }
  }, [
    activeHost?.adminCaPem,
    activeHost?.token,
    limit,
    ns,
    start,
    tenant,
    timeoutMs,
    topic,
    serviceUrl,
  ]);

  const cancelPeek = useCallback(() => {
    readerAbort.current?.();
  }, []);

  const keyboardShortcuts = useMemo(
    () => ({
      sendMessage,
      peekMessages,
    }),
    [sendMessage, peekMessages]
  );

  const formTarget = useMemo(
    () => buildFullTopicName(tenant, ns, topic),
    [buildFullTopicName, tenant, ns, topic]
  );

  useEffect(() => {
    const activeFullName = activeTopic?.topic.fullName;
    if (activeFullName && activeFullName !== formTarget) {
      clearActiveTopic();
    }
    setMessages([]);
  }, [formTarget, activeTopic?.topic.fullName, clearActiveTopic]);

  const currentSendResult = sendResultsByTopic[formTarget] ?? null;

  return {
    sending,
    peeking,
    messages,
    sendMessage,
    sendTemplateToTopic,
    peekMessages,
    cancelPeek,
    keyboardShortcuts,
    formTarget,
    currentSendResult,
  } as const;
}
