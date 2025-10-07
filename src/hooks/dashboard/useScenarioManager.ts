"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { createScenarioStep } from "@/lib/scenario";
import { produce } from "@/lib/pulsarWs";
import { uid } from "@/lib/uid";
import type { ActiveTopic } from "@/hooks/useLiveTopic";
import type { Host } from "@/types/pulsar";
import type { Scenario, ScenarioStep } from "@/types/scenario";

type ScenarioRunState = {
  running: Record<string, { currentStepIndex: number | null }>;
};

type RefreshActiveTopic = (options?: {
  showSpinner?: boolean;
}) => Promise<void>;

interface ScenarioManagerOptions {
  hosts: Host[];
  activeHostId: string | null;
  tenant: string;
  ns: string;
  topic: string;
  json: string;
  activeTopic: ActiveTopic;
  refreshActiveTopic: RefreshActiveTopic;
}

export function useScenarioManager({
  hosts,
  activeHostId,
  tenant,
  ns,
  topic,
  json,
  activeTopic,
  refreshActiveTopic,
}: ScenarioManagerOptions) {
  const [scenarios, setScenarios] = useLocalStorage<Scenario[]>(
    "pulsar.scenarios",
    []
  );
  const [scenarioEditorId, setScenarioEditorId] = useState<string | null>(null);

  const editingScenario = useMemo(
    () =>
      scenarioEditorId
        ? scenarios.find((item) => item.id === scenarioEditorId) ?? null
        : null,
    [scenarioEditorId, scenarios]
  );

  useEffect(() => {
    if (!scenarioEditorId) return;
    if (!scenarios.some((scenario) => scenario.id === scenarioEditorId)) {
      setScenarioEditorId(null);
    }
  }, [scenarioEditorId, scenarios]);

  const openScenarioEditor = useCallback((scenarioId: string) => {
    setScenarioEditorId(scenarioId);
  }, []);

  const closeScenarioEditor = useCallback(() => {
    setScenarioEditorId(null);
  }, []);

  const [scenarioRunState, setScenarioRunState] = useState<ScenarioRunState>({
    running: {},
  });
  const scenarioAbortRefs = useRef<Map<string, () => void>>(new Map());

  const cancelScenarioRun = useCallback((scenarioId: string) => {
    const abort = scenarioAbortRefs.current.get(scenarioId);
    if (abort) {
      scenarioAbortRefs.current.delete(scenarioId);
      abort();
    }
    setScenarioRunState((prev) => {
      if (!(scenarioId in prev.running)) {
        return prev;
      }
      const nextRunning = { ...prev.running };
      delete nextRunning[scenarioId];
      return { running: nextRunning };
    });
  }, []);

  const createScenario = useCallback((): string => {
    const scenarioId = uid("scn");
    setScenarios((prev) => [
      ...prev,
      {
        id: scenarioId,
        name: `Scenario ${prev.length + 1}`,
        description: "",
        steps: [],
      },
    ]);
    openScenarioEditor(scenarioId);
    return scenarioId;
  }, [openScenarioEditor, setScenarios]);

  const updateScenarioMeta = useCallback(
    (
      scenarioId: string,
      updates: Partial<Pick<Scenario, "name" | "description">>
    ) => {
      setScenarios((prev) =>
        prev.map((scenario) =>
          scenario.id === scenarioId ? { ...scenario, ...updates } : scenario
        )
      );
    },
    [setScenarios]
  );

  const deleteScenario = useCallback(
    (scenarioId: string) => {
      setScenarios((prev) =>
        prev.filter((scenario) => scenario.id !== scenarioId)
      );
      setScenarioEditorId((current) =>
        current === scenarioId ? null : current
      );
      cancelScenarioRun(scenarioId);
    },
    [cancelScenarioRun, setScenarios]
  );

  const saveScenario = useCallback(
    (next: Scenario) => {
      setScenarios((prev) =>
        prev.map((scenario) =>
          scenario.id === next.id ? { ...next } : scenario
        )
      );
      toast.success(
        next.name ? `Scenario "${next.name}" saved` : "Scenario saved"
      );
    },
    [setScenarios]
  );

  const addScenarioStep = useCallback(
    (scenarioId: string, type: "message" | "wait" = "message") => {
      setScenarios((prev) =>
        prev.map((scenario) => {
          if (scenario.id !== scenarioId) return scenario;
          const position = scenario.steps.length + 1;
          const nextStep: ScenarioStep =
            type === "message"
              ? createScenarioStep({
                  type: "message",
                  position,
                  hostId: activeHostId ?? hosts[0]?.id ?? null,
                  tenant,
                  ns,
                  topic,
                  payload: json,
                })
              : createScenarioStep({ type: "wait", position });
          return { ...scenario, steps: [...scenario.steps, nextStep] };
        })
      );
    },
    [activeHostId, hosts, json, ns, tenant, topic, setScenarios]
  );

  const replaceScenarioStep = useCallback(
    (scenarioId: string, stepId: string, next: ScenarioStep) => {
      setScenarios((prev) =>
        prev.map((scenario) =>
          scenario.id === scenarioId
            ? {
                ...scenario,
                steps: scenario.steps.map((step) =>
                  step.id === stepId ? next : step
                ),
              }
            : scenario
        )
      );
    },
    [setScenarios]
  );

  const updateScenarioStep = useCallback(
    (scenarioId: string, stepId: string, updates: Partial<ScenarioStep>) => {
      setScenarios((prev) =>
        prev.map((scenario) =>
          scenario.id === scenarioId
            ? {
                ...scenario,
                steps: scenario.steps.map((step) =>
                  step.id === stepId
                    ? ({ ...step, ...updates } as ScenarioStep)
                    : step
                ),
              }
            : scenario
        )
      );
    },
    [setScenarios]
  );

  const removeScenarioStep = useCallback(
    (scenarioId: string, stepId: string) => {
      setScenarios((prev) =>
        prev.map((scenario) =>
          scenario.id === scenarioId
            ? {
                ...scenario,
                steps: scenario.steps.filter((step) => step.id !== stepId),
              }
            : scenario
        )
      );
    },
    [setScenarios]
  );

  const moveScenarioStep = useCallback(
    (scenarioId: string, stepId: string, direction: "up" | "down") => {
      setScenarios((prev) =>
        prev.map((scenario) => {
          if (scenario.id !== scenarioId) return scenario;
          const steps = [...scenario.steps];
          const index = steps.findIndex((s) => s.id === stepId);
          if (index === -1) return scenario;
          const newIndex =
            direction === "up"
              ? Math.max(0, index - 1)
              : Math.min(steps.length - 1, index + 1);
          if (index === newIndex) return scenario;
          const [moved] = steps.splice(index, 1);
          steps.splice(newIndex, 0, moved);
          return { ...scenario, steps };
        })
      );
    },
    [setScenarios]
  );

  const runScenario = useCallback(
    async (scenarioId: string) => {
      const scenario = scenarios.find((s) => s.id === scenarioId);
      if (!scenario) {
        toast.error("Scenario not found");
        return;
      }
      if (scenario.steps.length === 0) {
        toast.error("Scenario has no steps");
        return;
      }

      if (scenarioAbortRefs.current.has(scenarioId)) {
        toast.error("Scenario is already running");
        return;
      }

      let cancelled = false;
      const registerAbort = (abort: () => void) => {
        scenarioAbortRefs.current.set(scenarioId, () => {
          cancelled = true;
          abort();
        });
      };

      registerAbort(() => {});
      setScenarioRunState((prev) => ({
        running: {
          ...prev.running,
          [scenarioId]: { currentStepIndex: 0 },
        },
      }));

      const waitMs = (ms: number) =>
        new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            registerAbort(() => {});
            resolve();
          }, ms);
          registerAbort(() => {
            clearTimeout(timeout);
            resolve();
          });
        });

      for (let index = 0; index < scenario.steps.length; index += 1) {
        if (cancelled) break;
        const step = scenario.steps[index];
        setScenarioRunState((prev) => ({
          running: {
            ...prev.running,
            [scenarioId]: { currentStepIndex: index },
          },
        }));

        if (step.type === "wait") {
          const ms = Math.max(0, step.waitMs);
          if (ms > 0) {
            await waitMs(ms);
          }
          continue;
        }

        const host =
          (step.hostId ? hosts.find((h) => h.id === step.hostId) : undefined) ??
          (activeHostId
            ? hosts.find((h) => h.id === activeHostId)
            : undefined) ??
          hosts[0];

        if (!host) {
          toast.error(`Step ${index + 1}: No host available`);
          cancelled = true;
          break;
        }

        try {
          await produce({
            wsBase: host.wsBase,
            tenant: step.tenant,
            ns: step.ns,
            topic: step.topic,
            json: step.payload,
          });
          const isActiveTarget =
            activeTopic &&
            activeTopic.host.id === host.id &&
            activeTopic.topic.tenant === step.tenant &&
            activeTopic.topic.ns === step.ns &&
            activeTopic.topic.topic === step.topic;
          if (isActiveTarget) {
            refreshActiveTopic({ showSpinner: false }).catch((error) => {
              console.error(
                "Failed to refresh active topic after scenario step",
                error
              );
            });
          }
          toast.success(`Step ${index + 1} sent (${scenario.name})`);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          toast.error(`Step ${index + 1} failed: ${message}`);
          cancelled = true;
          break;
        }

        if (cancelled) break;

        if (step.delayMs > 0 && index < scenario.steps.length - 1) {
          await waitMs(step.delayMs);
        }

        registerAbort(() => {});
      }

      scenarioAbortRefs.current.delete(scenarioId);
      setScenarioRunState((prev) => {
        if (!(scenarioId in prev.running)) {
          return prev;
        }
        const nextRunning = { ...prev.running };
        delete nextRunning[scenarioId];
        return { running: nextRunning };
      });

      if (!cancelled) {
        toast.success(`Scenario completed (${scenario.name})`);
      }
    },
    [activeHostId, activeTopic, hosts, refreshActiveTopic, scenarios]
  );

  return {
    scenarios,
    setScenarios,
    scenarioEditorId,
    setScenarioEditorId,
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
  } as const;
}
