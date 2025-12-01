"use client";
import { useCallback, useEffect, useState } from "react";
import { useLiveTopic } from "@/hooks/useLiveTopic";
import type { Host, Template, TopicNode } from "@/types/pulsar";
import { useHostManagement } from "./useHostManagement";
import { useMessaging } from "./useMessaging";
import { useScenarioManager } from "./useScenarioManager";
import { useTemplateManager } from "./useTemplateManager";
import { useTopicFormState } from "./useTopicFormState";

export type LimitedTopicModalState =
  | { hostId: string; mode: { type: "create" } }
  | { hostId: string; mode: { type: "edit"; topic: string } };

export type DashboardModal =
  | { kind: "host"; host: Host | null }
  | ({ kind: "limitedTopic" } & LimitedTopicModalState)
  | { kind: "template" }
  | { kind: "scenario" };

export function useDashboardState() {
  const {
    tenant,
    setTenant,
    ns,
    setNs,
    topic,
    setTopic,
    json,
    setJson,
    start,
    setStart,
    limit,
    setLimit,
    timeoutMs,
    setTimeoutMs,
  } = useTopicFormState();
  const {
    hosts,
    setHosts,
    serviceUrl,
    setServiceUrl,
    hostTrees,
    setHostTrees,
    activeHostId,
    handleSelectHost,
    ensureTopicVisible,
    addHost,
    updateHost,
    deleteHost,
    addLimitedTopic,
    removeLimitedTopic,
    updateLimitedTopic,
  } = useHostManagement();
  const {
    templates,
    setTemplates,
    editingTemplate,
    setEditingTemplate,
    handleEditTemplate: baseHandleEditTemplate,
    handleUpdateTemplate,
    handleDeleteTemplate,
    closeTemplateEditor: baseCloseTemplateEditor,
  } = useTemplateManager();

  const [activeModal, setActiveModal] = useState<DashboardModal | null>(null);

  const hostModal = activeModal?.kind === "host" ? activeModal : null;
  const limitedTopicModal =
    activeModal?.kind === "limitedTopic"
      ? { hostId: activeModal.hostId, mode: activeModal.mode }
      : null;

  useEffect(() => {
    if (!limitedTopicModal) {
      return;
    }
    const host = hosts.find((item) => item.id === limitedTopicModal.hostId);
    if (!host || host.isAdmin) {
      setActiveModal((previous) =>
        previous?.kind === "limitedTopic" ? null : previous
      );
    }
  }, [hosts, limitedTopicModal]);

  const {
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
  } = useLiveTopic(10);

  const {
    scenarios,
    editingScenario,
    openScenarioEditor: baseOpenScenarioEditor,
    closeScenarioEditor: baseCloseScenarioEditor,
    scenarioRunState,
    createScenario: baseCreateScenario,
    updateScenarioMeta,
    deleteScenario,
    saveScenario,
    addScenarioStep,
    replaceScenarioStep,
    updateScenarioStep,
    removeScenarioStep,
    moveScenarioStep,
    runScenario,
    cancelScenarioRun,
  } = useScenarioManager({
    hosts,
    activeHostId,
    tenant,
    ns,
    topic,
    json,
    activeTopic,
    refreshActiveTopic,
  });

  const closeScenarioEditor = useCallback(() => {
    baseCloseScenarioEditor();
    setActiveModal((previous) =>
      previous?.kind === "scenario" ? null : previous
    );
  }, [baseCloseScenarioEditor]);

  const closeTemplateEditor = useCallback(() => {
    baseCloseTemplateEditor();
    setActiveModal((previous) =>
      previous?.kind === "template" ? null : previous
    );
  }, [baseCloseTemplateEditor]);

  useEffect(() => {
    if (editingTemplate) {
      setActiveModal((previous) =>
        previous?.kind === "template" ? previous : { kind: "template" }
      );
    } else {
      setActiveModal((previous) =>
        previous?.kind === "template" ? null : previous
      );
    }
  }, [editingTemplate]);

  useEffect(() => {
    if (editingScenario) {
      setActiveModal((previous) =>
        previous?.kind === "scenario" ? previous : { kind: "scenario" }
      );
    } else {
      setActiveModal((previous) =>
        previous?.kind === "scenario" ? null : previous
      );
    }
  }, [editingScenario]);

  const closeHostModal = useCallback(() => {
    setActiveModal((previous) => (previous?.kind === "host" ? null : previous));
  }, []);

  const closeLimitedTopicModal = useCallback(() => {
    setActiveModal((previous) =>
      previous?.kind === "limitedTopic" ? null : previous
    );
  }, []);

  const handleTopicClick = useCallback(
    async (host: Host, topicNode: TopicNode) => {
      closeScenarioEditor();
      setEditingTemplate(null);
      setActiveModal(null);
      if (
        activeTopic?.host.id === host.id &&
        activeTopic?.topic.fullName === topicNode.fullName
      ) {
        return;
      }
      handleSelectHost(host);
      setTenant(topicNode.tenant);
      setNs(topicNode.ns);
      setTopic(topicNode.topic);
      await onTopicClick(host, topicNode);
    },
    [
      activeTopic?.host.id,
      activeTopic?.topic.fullName,
      closeScenarioEditor,
      handleSelectHost,
      onTopicClick,
      setEditingTemplate,
      setNs,
      setTenant,
      setTopic,
    ]
  );

  const messaging = useMessaging({
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
  });

  const handleAddHost = useCallback(
    (host: Host) => {
      addHost(host);
      closeHostModal();
    },
    [addHost, closeHostModal]
  );

  const handleUpdateHost = useCallback(
    (host: Host) => {
      updateHost(host);
      if (activeHostId === host.id) {
        handleSelectHost(host);
      }
      closeHostModal();
    },
    [activeHostId, closeHostModal, handleSelectHost, updateHost]
  );

  const handleAddLimitedTopic = useCallback(
    (host: Host, topic: string) => {
      addLimitedTopic(host.id, topic);
    },
    [addLimitedTopic]
  );

  const handleRemoveLimitedTopic = useCallback(
    (host: Host, topic: string) => {
      removeLimitedTopic(host.id, topic);
    },
    [removeLimitedTopic]
  );

  const handleUpdateLimitedTopic = useCallback(
    (host: Host, previousTopic: string, nextTopic: string) => {
      updateLimitedTopic(host.id, previousTopic, nextTopic);
    },
    [updateLimitedTopic]
  );

  const openLimitedTopicModal = useCallback(
    (
      host: Host,
      action: { type: "create" } | { type: "edit"; topic: string }
    ) => {
      if (host.isAdmin) {
        return;
      }
      setEditingTemplate(null);
      closeScenarioEditor();
      setActiveModal(
        action.type === "create"
          ? { kind: "limitedTopic", hostId: host.id, mode: { type: "create" } }
          : {
              kind: "limitedTopic",
              hostId: host.id,
              mode: { type: "edit", topic: action.topic },
            }
      );
    },
    [closeScenarioEditor, setEditingTemplate]
  );

  const handleDeleteHost = useCallback(
    (hostId: string) => {
      deleteHost(hostId);
      closeHostModal();
    },
    [closeHostModal, deleteHost]
  );

  const handleEditTemplate = useCallback(
    (template: Template) => {
      closeScenarioEditor();
      setActiveModal(null);
      baseHandleEditTemplate(template);
    },
    [baseHandleEditTemplate, closeScenarioEditor]
  );

  const openAddHostModal = useCallback(() => {
    setEditingTemplate(null);
    closeScenarioEditor();
    setActiveModal({ kind: "host", host: null });
  }, [closeScenarioEditor, setEditingTemplate]);

  const openEditHostModal = useCallback(
    (host: Host) => {
      setEditingTemplate(null);
      closeScenarioEditor();
      setActiveModal({ kind: "host", host });
    },
    [closeScenarioEditor, setEditingTemplate]
  );

  const openScenarioEditor = useCallback(
    (scenarioId: string) => {
      setEditingTemplate(null);
      closeHostModal();
      closeLimitedTopicModal();
      baseOpenScenarioEditor(scenarioId);
    },
    [
      baseOpenScenarioEditor,
      closeHostModal,
      closeLimitedTopicModal,
      setEditingTemplate,
    ]
  );

  const createScenario = useCallback(() => {
    setEditingTemplate(null);
    closeHostModal();
    closeLimitedTopicModal();
    return baseCreateScenario();
  }, [
    baseCreateScenario,
    closeHostModal,
    closeLimitedTopicModal,
    setEditingTemplate,
  ]);

  const toggleLive = useCallback(() => {
    setIsLiveUpdating((value) => !value);
  }, [setIsLiveUpdating]);

  return {
    serviceUrl,
    setServiceUrl,
    tenant,
    setTenant,
    ns,
    setNs,
    topic,
    setTopic,
    json,
    setJson,
    start,
    setStart,
    limit,
    setLimit,
    timeoutMs,
    setTimeoutMs,
    hosts,
    setHosts,
    hostTrees,
    setHostTrees,
    templates,
    setTemplates,
    sending: messaging.sending,
    peeking: messaging.peeking,
    messages: messaging.messages,
    formTarget: messaging.formTarget,
    currentSendResult: messaging.currentSendResult,
    activeModal,
    hostModal,
    editingTemplate,
    activeHostId,
    activeTopic,
    liveMessages,
    isLiveUpdating,
    connectionStatus,
    maxMessages,
    setMaxMessages,
    handleSelectHost,
    handleTopicClick,
    sendTemplateToTopic: messaging.sendTemplateToTopic,
    sendMessage: messaging.sendMessage,
    peekMessages: messaging.peekMessages,
    cancelPeek: messaging.cancelPeek,
    handleAddHost,
    handleUpdateHost,
    handleAddLimitedTopic,
    handleUpdateLimitedTopic,
    handleRemoveLimitedTopic,
    openLimitedTopicModal,
    closeLimitedTopicModal,
    limitedTopicModal,
    handleDeleteHost,
    handleEditTemplate,
    handleUpdateTemplate,
    handleDeleteTemplate,
    closeTemplateEditor,
    openAddHostModal,
    openEditHostModal,
    closeHostModal,
    scenarios,
    editingScenario,
    openScenarioEditor,
    closeScenarioEditor,
    scenarioRunState,
    createScenario,
    updateScenarioMeta,
    deleteScenario,
    saveScenario,
    addScenarioStep,
    replaceScenarioStep,
    updateScenarioStep,
    removeScenarioStep,
    moveScenarioStep,
    runScenario,
    cancelScenarioRun,
    toggleLive,
    keyboardShortcuts: messaging.keyboardShortcuts,
    isLiveLoading: isLoading,
  } as const;
}
