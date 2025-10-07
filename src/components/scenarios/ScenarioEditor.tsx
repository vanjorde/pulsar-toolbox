"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ScenarioStepCard } from "@/components/scenarios/ScenarioStepCard";
import { formatJsonString } from "@/lib/json";
import { createScenarioStep } from "@/lib/scenario";
import {
  computeScenarioJsonErrors,
  convertScenarioStepType,
} from "@/lib/scenarioEditor";
import { safeClone } from "@/lib/safeClone";
import type {
  MessageStep,
  Scenario,
  ScenarioEditorProps,
  ScenarioStep,
} from "@/types/scenario";

export function ScenarioEditor({
  scenario: scenarioProp,
  hosts,
  isRunning,
  runningStepIndex,
  defaultHostId,
  defaultTenant,
  defaultNamespace,
  defaultTopic,
  defaultPayload,
  onSave,
  onCancel,
  onDelete,
  onRun,
  onCancelRun,
}: ScenarioEditorProps) {
  const [draft, setDraft] = useState<Scenario | null>(
    scenarioProp ? safeClone(scenarioProp) : null
  );
  const [jsonErrors, setJsonErrors] = useState<Record<string, string>>({});
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const scenario = draft;

  useEffect(() => {
    if (!scenarioProp) {
      setDraft(null);
      setJsonErrors({});
      setCollapsed({});
      return;
    }
    const copy = safeClone(scenarioProp);
    setDraft(copy);
    setJsonErrors(computeScenarioJsonErrors(copy.steps));
    setCollapsed((prev) => {
      const map: Record<string, boolean> = {};
      for (const step of copy.steps) {
        map[step.id] = prev[step.id] ?? false;
      }
      return map;
    });
  }, [scenarioProp]);

  const resolvedDefaultHostId = useMemo(
    () => defaultHostId ?? hosts[0]?.id ?? null,
    [defaultHostId, hosts]
  );

  const isDirty = useMemo(() => {
    if (!scenario && !scenarioProp) return false;
    if (!scenario || !scenarioProp) return true;
    return JSON.stringify(scenario) !== JSON.stringify(scenarioProp);
  }, [scenario, scenarioProp]);

  const hasErrors = Object.keys(jsonErrors).length > 0;
  const canSave = Boolean(scenario) && isDirty && !hasErrors && !isRunning;
  const runDisabled =
    !scenario || scenario.steps.length === 0 || isDirty || hasErrors;

  const applyScenario = useCallback(
    (updater: (current: Scenario) => Scenario) => {
      setDraft((prev) => {
        if (!prev) return prev;
        const next = updater(safeClone(prev));
        setJsonErrors(computeScenarioJsonErrors(next.steps));
        setCollapsed((prevCollapsed) => {
          const map: Record<string, boolean> = {};
          for (const step of next.steps) {
            map[step.id] = prevCollapsed[step.id] ?? false;
          }
          return map;
        });
        return next;
      });
    },
    []
  );

  const updateScenarioMeta = useCallback(
    (_: string, updates: Partial<Pick<Scenario, "name" | "description">>) => {
      applyScenario((current) => ({ ...current, ...updates }));
    },
    [applyScenario]
  );

  const addScenarioStep = useCallback(
    (_: string, type: "message" | "wait" = "message") => {
      applyScenario((current) => {
        const position = current.steps.length + 1;
        const nextStep: ScenarioStep =
          type === "message"
            ? createScenarioStep({
                type: "message",
                position,
                hostId: resolvedDefaultHostId,
                tenant: defaultTenant,
                ns: defaultNamespace,
                topic: defaultTopic,
                payload: defaultPayload,
              })
            : createScenarioStep({ type: "wait", position });
        return { ...current, steps: [...current.steps, nextStep] };
      });
    },
    [
      applyScenario,
      resolvedDefaultHostId,
      defaultTenant,
      defaultNamespace,
      defaultTopic,
      defaultPayload,
    ]
  );

  const replaceScenarioStep = useCallback(
    (_: string, stepId: string, nextStep: ScenarioStep) => {
      applyScenario((current) => ({
        ...current,
        steps: current.steps.map((step) =>
          step.id === stepId ? nextStep : step
        ),
      }));
    },
    [applyScenario]
  );

  const updateScenarioStep = useCallback(
    (_: string, stepId: string, updates: Partial<ScenarioStep>) => {
      applyScenario((current) => ({
        ...current,
        steps: current.steps.map((step) =>
          step.id === stepId ? ({ ...step, ...updates } as ScenarioStep) : step
        ),
      }));
    },
    [applyScenario]
  );

  const removeScenarioStep = useCallback(
    (_: string, stepId: string) => {
      applyScenario((current) => ({
        ...current,
        steps: current.steps.filter((step) => step.id !== stepId),
      }));
    },
    [applyScenario]
  );

  const moveScenarioStep = useCallback(
    (_: string, stepId: string, direction: "up" | "down") => {
      applyScenario((current) => {
        const index = current.steps.findIndex((step) => step.id === stepId);
        if (index === -1) return current;
        const targetIndex = direction === "up" ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= current.steps.length) {
          return current;
        }
        const steps = [...current.steps];
        const [removed] = steps.splice(index, 1);
        steps.splice(targetIndex, 0, removed);
        return { ...current, steps };
      });
    },
    [applyScenario]
  );

  const changeStepType = useCallback(
    (input: {
      step: ScenarioStep;
      nextType: "message" | "wait";
      position: number;
    }) => {
      if (!scenario) {
        return;
      }

      const nextStep = convertScenarioStepType({
        step: input.step,
        nextType: input.nextType,
        position: input.position,
        defaults: {
          hostId: resolvedDefaultHostId,
          tenant: defaultTenant,
          namespace: defaultNamespace,
          topic: defaultTopic,
          payload: defaultPayload,
        },
      });

      if (nextStep === input.step) {
        return;
      }

      replaceScenarioStep(scenario.id, input.step.id, nextStep);
    },
    [
      scenario,
      replaceScenarioStep,
      resolvedDefaultHostId,
      defaultTenant,
      defaultNamespace,
      defaultTopic,
      defaultPayload,
    ]
  );

  const toggleStep = useCallback((stepId: string) => {
    setCollapsed((prev) => ({ ...prev, [stepId]: !prev[stepId] }));
  }, []);

  const expandAll = useCallback(() => {
    if (!scenario) return;
    const map: Record<string, boolean> = {};
    for (const step of scenario.steps) {
      map[step.id] = false;
    }
    setCollapsed(map);
  }, [scenario]);

  const collapseAll = useCallback(() => {
    if (!scenario) return;
    const map: Record<string, boolean> = {};
    for (const step of scenario.steps) {
      map[step.id] = true;
    }
    setCollapsed(map);
  }, [scenario]);

  const handleSave = useCallback(() => {
    if (!scenario || !canSave) return;
    onSave(safeClone(scenario));
  }, [scenario, canSave, onSave]);

  const handleCancel = useCallback(() => {
    if (scenarioProp) {
      const reset = safeClone(scenarioProp);
      setDraft(reset);
      setJsonErrors(computeScenarioJsonErrors(reset.steps));
      setCollapsed((prev) => {
        const map: Record<string, boolean> = {};
        for (const step of reset.steps) {
          map[step.id] = prev[step.id] ?? false;
        }
        return map;
      });
    } else {
      setDraft(null);
      setJsonErrors({});
      setCollapsed({});
    }
    onCancel();
  }, [scenarioProp, onCancel]);

  const handleDelete = useCallback(() => {
    if (!scenario) return;
    onDelete(scenario.id);
  }, [scenario, onDelete]);

  const handleRunClick = useCallback(() => {
    if (!scenario) return;
    onRun(scenario.id);
  }, [scenario, onRun]);

  const handleFormatJson = useCallback(
    (step: MessageStep) => {
      if (!scenario) return;
      try {
        const result = formatJsonString(step.payload, 2);
        if (!result.ok) {
          return;
        }
        updateScenarioStep(scenario.id, step.id, { payload: result.value });
      } catch {}
    },
    [scenario, updateScenarioStep]
  );

  if (!scenario) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
        Select or create a scenario to start editing.
      </div>
    );
  }

  const tooltipForRun = !scenario.steps.length
    ? "Add steps before running"
    : isDirty
    ? "Save changes before running"
    : hasErrors
    ? "Fix JSON errors before running"
    : undefined;

  return (
    <div className="">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-xl font-semibold text-foreground">
            {scenario.name || "Untitled scenario"}
          </h3>
          <p className="text-sm text-muted-foreground">
            Build and run a sequence of message & wait steps.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 justify-end">
          <button
            type="button"
            onClick={handleCancel}
            className="cursor-pointer rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted/20 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className={`cursor-pointer rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              canSave
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-primary/40 text-primary-foreground/70 cursor-not-allowed"
            }`}
          >
            Save
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isRunning}
            className="cursor-pointer rounded-md border border-red-500/40 px-3 py-1.5 text-sm font-medium text-red-400 hover:bg-red-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Delete scenario
          </button>
          {isRunning ? (
            <button
              type="button"
              onClick={() => onCancelRun(scenario.id)}
              className="cursor-pointer px-3 py-1.5 rounded-md border border-amber-500/60 bg-amber-500/10 text-amber-400 text-sm font-medium hover:bg-amber-500/20 transition-colors"
            >
              Cancel run
            </button>
          ) : (
            <button
              type="button"
              onClick={handleRunClick}
              disabled={runDisabled}
              title={tooltipForRun}
              className="cursor-pointer px-3 py-1.5 rounded-md bg-green-600/80 text-white text-sm font-medium transition-colors hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Run scenario
            </button>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Name</span>
          <input
            type="text"
            value={scenario.name}
            onChange={(e) =>
              updateScenarioMeta(scenario.id, { name: e.target.value })
            }
            disabled={isRunning}
            className="rounded-md border border-border bg-background/90 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Description</span>
          <textarea
            rows={2}
            value={scenario.description ?? ""}
            onChange={(e) =>
              updateScenarioMeta(scenario.id, { description: e.target.value })
            }
            disabled={isRunning}
            className="rounded-md border border-border bg-background/90 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground">Steps</h4>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => addScenarioStep(scenario.id, "message")}
            disabled={isRunning}
            className="cursor-pointer text-sm font-medium text-primary hover:text-primary/80 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + Add message
          </button>
          <button
            type="button"
            onClick={() => addScenarioStep(scenario.id, "wait")}
            disabled={isRunning}
            className="cursor-pointer text-sm font-medium text-primary hover:text-primary/80 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + Add wait
          </button>

          <div className="ml-2 hidden md:flex gap-2">
            <button
              type="button"
              onClick={expandAll}
              className="cursor-pointer text-xs rounded border border-border px-2 py-1 text-muted-foreground hover:bg-muted/30"
            >
              Expand all
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="cursor-pointer text-xs rounded border border-border px-2 py-1 text-muted-foreground hover:bg-muted/30"
            >
              Collapse all
            </button>
          </div>
        </div>
      </div>

      {scenario.steps.length === 0 ? (
        <div className="mt-3 rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          No steps yet. Add message or wait steps to build your flow.
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {scenario.steps.map((step, index) => {
            const isActiveStep = isRunning && runningStepIndex === index;
            const isCollapsed = collapsed[step.id] === true;
            const error = jsonErrors[step.id];

            return (
              <ScenarioStepCard
                key={step.id}
                step={step}
                index={index}
                isActive={isActiveStep}
                isRunning={isRunning}
                isCollapsed={isCollapsed}
                error={error}
                hosts={hosts}
                disableMoveUp={index === 0}
                disableMoveDown={index === scenario.steps.length - 1}
                onToggle={toggleStep}
                onMoveUp={(stepId) =>
                  moveScenarioStep(scenario.id, stepId, "up")
                }
                onMoveDown={(stepId) =>
                  moveScenarioStep(scenario.id, stepId, "down")
                }
                onRemove={(stepId) => removeScenarioStep(scenario.id, stepId)}
                onUpdate={(stepId, updates) =>
                  updateScenarioStep(scenario.id, stepId, updates)
                }
                onChangeType={(currentStep, nextType) =>
                  changeStepType({
                    step: currentStep,
                    nextType,
                    position: index + 1,
                  })
                }
                onFormatJson={handleFormatJson}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
