"use client";
import { useCallback, useState } from "react";
import { useLiveTopic } from "@/hooks/useLiveTopic";
import type { Host, Template, TopicNode } from "@/types/pulsar";
import { useHostManagement } from "./dashboard/useHostManagement";
import { useMessaging } from "./dashboard/useMessaging";
import { useScenarioManager } from "./dashboard/useScenarioManager";
import { useTemplateManager } from "./dashboard/useTemplateManager";
import { useTopicFormState } from "./dashboard/useTopicFormState";

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
    wsBase,
    setWsBase,
    hostTrees,
    setHostTrees,
    activeHostId,
    handleSelectHost,
    ensureTopicVisible,
  } = useHostManagement();
  const {
    templates,
    setTemplates,
    editingTemplate,
    setEditingTemplate,
    handleEditTemplate: baseHandleEditTemplate,
    handleUpdateTemplate,
    handleDeleteTemplate,
    closeTemplateEditor,
  } = useTemplateManager();
  const [showAddHostModal, setShowAddHostModal] = useState(false);

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
    closeScenarioEditor,
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

  const handleTopicClick = useCallback(
    async (host: Host, topicNode: TopicNode) => {
      closeScenarioEditor();
      setEditingTemplate(null);
      setShowAddHostModal(false);
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
      setShowAddHostModal,
      setNs,
      setTenant,
      setTopic,
    ]
  );

  const messaging = useMessaging({
    wsBase,
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
      setHosts((prev) => [...prev, host]);
      setShowAddHostModal(false);
    },
    [setHosts]
  );

  const handleEditTemplate = useCallback(
    (template: Template) => {
      closeScenarioEditor();
      setShowAddHostModal(false);
      baseHandleEditTemplate(template);
    },
    [baseHandleEditTemplate, closeScenarioEditor]
  );

  const openAddHostModal = useCallback(() => {
    setEditingTemplate(null);
    closeScenarioEditor();
    setShowAddHostModal(true);
  }, [closeScenarioEditor, setEditingTemplate]);

  const closeAddHostModal = useCallback(() => {
    setShowAddHostModal(false);
  }, []);

  const openScenarioEditor = useCallback(
    (scenarioId: string) => {
      setEditingTemplate(null);
      setShowAddHostModal(false);
      baseOpenScenarioEditor(scenarioId);
    },
    [baseOpenScenarioEditor, setEditingTemplate]
  );

  const createScenario = useCallback(() => {
    setEditingTemplate(null);
    setShowAddHostModal(false);
    return baseCreateScenario();
  }, [baseCreateScenario, setEditingTemplate]);

  const toggleLive = useCallback(() => {
    setIsLiveUpdating((value) => !value);
  }, [setIsLiveUpdating]);

  return {
    wsBase,
    setWsBase,
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
    showAddHostModal,
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
    handleEditTemplate,
    handleUpdateTemplate,
    handleDeleteTemplate,
    closeTemplateEditor,
    openAddHostModal,
    closeAddHostModal,
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
