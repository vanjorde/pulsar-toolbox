"use client";
import type React from "react";
import type { Dispatch, SetStateAction } from "react";
import { HostsExplorer } from "@/components/hosts/HostsExplorer";
import { ScenariosExplorer } from "@/components/scenarios/ScenarioExplorer";
import { TemplatesPanel } from "@/components/templates/TemplatesPanel";
import { SidebarSection } from "@/components/ui/SidebarSection";
import type { Host, HostTree, Template, TopicNode } from "@/types/pulsar";
import type { Scenario } from "@/types/scenario";

import { SidebarActionButton } from "./SidebarActionButton";

interface DashboardSidebarProps {
  hosts: Host[];
  setHosts: Dispatch<SetStateAction<Host[]>>;
  hostTrees: Record<string, HostTree>;
  setHostTrees: Dispatch<SetStateAction<Record<string, HostTree>>>;
  onTopicClick: (host: Host, topic: TopicNode) => void;
  onDropTemplateOnTopic: (
    host: Host,
    topic: TopicNode,
    event: React.DragEvent
  ) => void;
  activeTopic: { host: Host; topic: TopicNode } | null;
  activeHostId: string | null;
  onSelectHost: (host: Host) => void;
  onAddHost: () => void;
  scenarios: Scenario[];
  selectedScenarioId: string | null;
  onCreateScenario: () => void;
  onOpenScenario: (id: string) => void;
  onRunScenario: (id: string) => Promise<void> | void;
  runningScenarioIds: string[];
  templates: Template[];
  setTemplates: Dispatch<SetStateAction<Template[]>>;
  onEditTemplate: (template: Template) => void;
  onDeleteTemplate: (templateId: string) => void;
  onCreateTemplate: () => void;
  editingTemplateId: string | null;
}

export function DashboardSidebar({
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
  scenarios,
  selectedScenarioId,
  onCreateScenario,
  onOpenScenario,
  onRunScenario,
  runningScenarioIds,
  templates,
  setTemplates,
  onEditTemplate,
  onDeleteTemplate,
  onCreateTemplate,
  editingTemplateId,
}: DashboardSidebarProps) {
  return (
    <aside className="flex h-full flex-col border-r border-border bg-card/50 backdrop-blur-sm">
      <div className="relative flex items-center h-14 px-4">
        <img src="/logo.png" alt="Logo" className="w-9 h-9 mr-2 -mt-1" />
        <h1 className="text-2xl font-bold text-primary/80">Pulsar Toolbox</h1>
      </div>

      <SidebarSection
        title="Hosts"
        storageKey="hosts"
        defaultHeight={3}
        minHeight={220}
        borderTop={false}
        actions={
          <SidebarActionButton onClick={onAddHost}>+ New</SidebarActionButton>
        }
      >
        <div className="h-full overflow-auto pr-1">
          <HostsExplorer
            hosts={hosts}
            setHosts={setHosts}
            hostTrees={hostTrees}
            setHostTrees={setHostTrees}
            onTopicClick={onTopicClick}
            onDropTemplateOnTopic={onDropTemplateOnTopic}
            activeTopic={activeTopic ?? undefined}
            activeHostId={activeHostId ?? undefined}
            onSelectHost={onSelectHost}
            onAddHost={onAddHost}
          />
        </div>
      </SidebarSection>

      <SidebarSection
        title="Scenarios"
        storageKey="scenarios"
        defaultHeight={2}
        minHeight={160}
        actions={
          <SidebarActionButton onClick={onCreateScenario}>
            + New
          </SidebarActionButton>
        }
      >
        <ScenariosExplorer
          scenarios={scenarios}
          selectedId={selectedScenarioId ?? undefined}
          onCreateScenario={onCreateScenario}
          onOpenScenario={onOpenScenario}
          onRunScenario={onRunScenario}
          runningScenarioIds={runningScenarioIds}
          hideHeader
        />
      </SidebarSection>

      <SidebarSection
        title="Templates"
        storageKey="templates"
        defaultHeight={2}
        minHeight={160}
        actions={
          <SidebarActionButton onClick={onCreateTemplate}>
            + New
          </SidebarActionButton>
        }
      >
        <div className="h-full overflow-auto pr-1">
          <TemplatesPanel
            templates={templates}
            setTemplates={setTemplates}
            onEditTemplate={onEditTemplate}
            onDeleteTemplate={onDeleteTemplate}
            showHeader={false}
            activeTemplateId={editingTemplateId ?? undefined}
          />
        </div>
      </SidebarSection>
    </aside>
  );
}
