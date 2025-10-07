"use client";
import { Toaster } from "sonner";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { DashboardMainContent } from "@/components/dashboard/DashboardMainContent";
import { DashboardOverlays } from "@/components/dashboard/DashboardOverlays";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { useDashboardHotkeys } from "@/hooks/useDashboardHotkeys";
import { createDefaultTemplate } from "../../utils/templates";
import { useDashboardState } from "@/hooks/useDashboardState";

export function DashboardPage() {
  const {
    wsBase,
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
    sending,
    peeking,
    messages,
    activeHostId,
    formTarget,
    currentSendResult,
    showAddHostModal,
    editingTemplate,
    editingScenario,
    activeTopic,
    liveMessages,
    isLiveUpdating,
    connectionStatus,
    maxMessages,
    setMaxMessages,
    isLiveLoading,
    handleSelectHost,
    handleTopicClick,
    sendTemplateToTopic,
    sendMessage,
    peekMessages,
    cancelPeek,
    handleAddHost,
    handleEditTemplate,
    handleUpdateTemplate,
    handleDeleteTemplate,
    closeTemplateEditor,
    openAddHostModal,
    closeAddHostModal,
    scenarios,
    openScenarioEditor,
    closeScenarioEditor,
    createScenario,
    scenarioRunState,
    saveScenario,
    runScenario,
    cancelScenarioRun,
    deleteScenario,
    toggleLive,
    keyboardShortcuts,
  } = useDashboardState();

  const headingLabel = activeTopic?.topic.fullName ?? formTarget;
  const showLivePanel = Boolean(
    activeTopic && isLiveUpdating && activeTopic.topic.fullName === formTarget
  );

  const handleCreateScenarioClick = () => {
    createScenario();
  };

  const handleCreateTemplateClick = () => {
    const newTemplate = createDefaultTemplate(templates.length);
    setTemplates((prev) => [...prev, newTemplate]);
    handleEditTemplate(newTemplate);
  };

  useDashboardHotkeys({
    isTemplateOpen: Boolean(editingTemplate),
    isScenarioOpen: Boolean(editingScenario),
    isSending: sending,
    isPeeking: peeking,
    shortcuts: keyboardShortcuts,
  });

  const hasOverlay = Boolean(
    editingScenario || showAddHostModal || editingTemplate
  );

  const runningScenarioIds = Object.keys(scenarioRunState.running);

  return (
    <main className="h-screen bg-background text-foreground">
      <Toaster position="bottom-right" richColors theme="dark" />

      <ResizablePanelGroup
        direction="horizontal"
        className="h-full min-h-0 overflow-hidden"
      >
        <ResizablePanel
          defaultSize={26}
          minSize={18}
          maxSize={40}
          className="min-w-0 md:min-w-[250px]"
        >
          <DashboardSidebar
            hosts={hosts}
            setHosts={setHosts}
            hostTrees={hostTrees}
            setHostTrees={setHostTrees}
            onTopicClick={handleTopicClick}
            onDropTemplateOnTopic={sendTemplateToTopic}
            activeTopic={activeTopic}
            activeHostId={activeHostId}
            onSelectHost={handleSelectHost}
            onAddHost={openAddHostModal}
            scenarios={scenarios}
            selectedScenarioId={editingScenario?.id ?? null}
            onCreateScenario={handleCreateScenarioClick}
            onOpenScenario={openScenarioEditor}
            onRunScenario={runScenario}
            runningScenarioIds={runningScenarioIds}
            templates={templates}
            setTemplates={setTemplates}
            onEditTemplate={handleEditTemplate}
            onDeleteTemplate={handleDeleteTemplate}
            onCreateTemplate={handleCreateTemplateClick}
            editingTemplateId={editingTemplate?.id ?? null}
          />
        </ResizablePanel>

        <ResizableHandle />

        <ResizablePanel defaultSize={74} minSize={40} className="min-w-0">
          <DashboardMainContent
            hasOverlay={hasOverlay}
            headingLabel={headingLabel}
            wsBase={wsBase}
            liveControls={{
              activeTopic,
              connectionStatus,
              isLiveUpdating,
              maxMessages,
              onChangeMax: setMaxMessages,
              onToggleLive: toggleLive,
            }}
            sendMessage={{
              tenant,
              ns,
              topic,
              json,
              setTenant,
              setNs,
              setTopic,
              setJson,
              sending,
              ack: currentSendResult,
              onSend: sendMessage,
            }}
            showLivePanel={showLivePanel}
            livePanel={{
              messages: liveMessages,
              isLive: true,
              isLoading: isLiveLoading,
            }}
            readerPanel={{
              start,
              setStart,
              limit,
              setLimit,
              timeoutMs,
              setTimeoutMs,
              peeking,
              onPeek: peekMessages,
              onCancel: cancelPeek,
              messages,
            }}
            overlays={
              <DashboardOverlays
                editingScenario={editingScenario}
                onCloseScenario={closeScenarioEditor}
                onSaveScenario={saveScenario}
                onDeleteScenario={deleteScenario}
                onRunScenario={runScenario}
                onCancelScenarioRun={cancelScenarioRun}
                scenarioRunState={scenarioRunState}
                hosts={hosts}
                activeHostId={activeHostId}
                defaultTenant={tenant}
                defaultNamespace={ns}
                defaultTopic={topic}
                defaultPayload={json}
                editingTemplate={editingTemplate}
                onUpdateTemplate={handleUpdateTemplate}
                onCloseTemplate={closeTemplateEditor}
                onDeleteTemplate={handleDeleteTemplate}
                showAddHostModal={showAddHostModal}
                onCloseAddHost={closeAddHostModal}
                onAddHost={handleAddHost}
              />
            }
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </main>
  );
}
