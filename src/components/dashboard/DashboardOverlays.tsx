"use client";
import { useCallback, useState } from "react";
import { AddHostModal } from "@/components/hosts/AddHostModal";
import { ScenarioEditor } from "@/components/scenarios/ScenarioEditor";
import { TemplateEditor } from "@/components/templates/TemplateEditor";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { Host, Template } from "@/types/pulsar";
import type { Scenario } from "@/types/scenario";
import { PanelOverlay } from "./PanelOverlay";

interface ScenarioRunState {
  running: Record<string, { currentStepIndex: number | null }>;
}

interface DashboardOverlaysProps {
  editingScenario: Scenario | null;
  onCloseScenario: () => void;
  onSaveScenario: (scenario: Scenario) => void;
  onDeleteScenario: (scenarioId: string) => void;
  onRunScenario: (scenarioId: string) => Promise<void> | void;
  onCancelScenarioRun: (scenarioId: string) => void;
  scenarioRunState: ScenarioRunState;
  hosts: Host[];
  activeHostId: string | null;
  defaultTenant: string;
  defaultNamespace: string;
  defaultTopic: string;
  defaultPayload: string;
  editingTemplate: Template | null;
  onUpdateTemplate: (template: Template) => void;
  onCloseTemplate: () => void;
  onDeleteTemplate: (templateId: string) => void;
  showAddHostModal: boolean;
  onCloseAddHost: () => void;
  onAddHost: (host: Host) => void;
}

export function DashboardOverlays({
  editingScenario,
  onCloseScenario,
  onSaveScenario,
  onDeleteScenario,
  onRunScenario,
  onCancelScenarioRun,
  scenarioRunState,
  hosts,
  activeHostId,
  defaultTenant,
  defaultNamespace,
  defaultTopic,
  defaultPayload,
  editingTemplate,
  onUpdateTemplate,
  onCloseTemplate,
  onDeleteTemplate,
  showAddHostModal,
  onCloseAddHost,
  onAddHost,
}: DashboardOverlaysProps) {
  const [scenarioPendingDelete, setScenarioPendingDelete] =
    useState<Scenario | null>(null);

  const handleScenarioDelete = useCallback(
    (scenarioId: string) => {
      if (editingScenario && editingScenario.id === scenarioId) {
        setScenarioPendingDelete(editingScenario);
      }
    },
    [editingScenario]
  );

  const handleConfirmDelete = useCallback(() => {
    if (!scenarioPendingDelete) {
      return;
    }
    onDeleteScenario(scenarioPendingDelete.id);
    onCloseScenario();
  }, [onDeleteScenario, onCloseScenario, scenarioPendingDelete]);

  const closeDeleteDialog = useCallback(() => {
    setScenarioPendingDelete(null);
  }, []);

  const handleScenarioCancel = () => {};

  return (
    <>
      {editingScenario && (
        <PanelOverlay>
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-[min(1080px,calc(100%-48px))] max-h-[97%] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">
                {editingScenario.name || "Edit Scenario"}
              </h3>
              <button
                type="button"
                onClick={onCloseScenario}
                className="cursor-pointer px-3 py-1.5 text-sm bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <ScenarioEditor
                scenario={editingScenario}
                hosts={hosts}
                isRunning={
                  !!editingScenario &&
                  editingScenario.id in scenarioRunState.running
                }
                runningStepIndex={
                  editingScenario
                    ? scenarioRunState.running[editingScenario.id]
                        ?.currentStepIndex ?? null
                    : null
                }
                defaultHostId={activeHostId ?? null}
                defaultTenant={defaultTenant}
                defaultNamespace={defaultNamespace}
                defaultTopic={defaultTopic}
                defaultPayload={defaultPayload}
                onSave={onSaveScenario}
                onCancel={handleScenarioCancel}
                onDelete={handleScenarioDelete}
                onRun={onRunScenario}
                onCancelRun={onCancelScenarioRun}
              />
            </div>
          </div>
        </PanelOverlay>
      )}

      <ConfirmDialog
        isOpen={scenarioPendingDelete !== null}
        onClose={closeDeleteDialog}
        onConfirm={handleConfirmDelete}
        title="Delete scenario"
        message={`Are you sure you want to delete "${
          scenarioPendingDelete?.name || "this scenario"
        }"? This action cannot be undone.`}
      />

      {editingTemplate && (
        <PanelOverlay>
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-[min(980px,calc(100%-48px))] max-h-[90%] overflow-hidden flex flex-col">
            <TemplateEditor
              template={editingTemplate}
              onUpdate={onUpdateTemplate}
              onClose={onCloseTemplate}
              onDelete={onDeleteTemplate}
            />
          </div>
        </PanelOverlay>
      )}

      {showAddHostModal && (
        <PanelOverlay>
          <AddHostModal
            isOpen={showAddHostModal}
            onClose={onCloseAddHost}
            onAdd={onAddHost}
          />
        </PanelOverlay>
      )}
    </>
  );
}
