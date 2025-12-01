import { validatePayload } from "@/lib/payload";
import type { PayloadValidationResult } from "@/lib/payload";
import { createScenarioStep } from "@/lib/scenario";
import type { MessageStep, ScenarioStep, WaitStep } from "@/types/scenario";

export function computeScenarioPayloadIssues(
  steps: ScenarioStep[],
): Record<string, PayloadValidationResult> {
  const errors: Record<string, PayloadValidationResult> = {};
  for (const step of steps) {
    if (step.type !== "message") continue;
    const validation = validatePayload(step.payload);
    if (validation.error) {
      errors[step.id] = validation;
    }
  }
  return errors;
}

export interface ScenarioStepDefaults {
  hostId: string | null;
  tenant: string;
  namespace: string;
  topic: string;
  payload: string;
}

interface ConvertScenarioStepTypeInput {
  step: ScenarioStep;
  nextType: "message" | "wait";
  position: number;
  defaults: ScenarioStepDefaults;
}

export function convertScenarioStepType({
  step,
  nextType,
  position,
  defaults,
}: ConvertScenarioStepTypeInput): ScenarioStep {
  if (step.type === nextType) {
    return step;
  }

  if (nextType === "wait") {
    const waitDuration =
      step.type === "message"
        ? Math.max(0, step.delayMs ?? 0)
        : Math.max(0, (step as WaitStep).waitMs ?? 1000);

    return createScenarioStep({
      type: "wait",
      id: step.id,
      position,
      label: step.label || undefined,
      waitMs: waitDuration,
    });
  }

  const previous = step as Partial<MessageStep>;

  return createScenarioStep({
    type: "message",
    id: step.id,
    position,
    label: step.label || undefined,
    hostId:
      "hostId" in previous && previous.hostId !== undefined
        ? previous.hostId ?? defaults.hostId
        : defaults.hostId,
    tenant:
      "tenant" in previous && previous.tenant !== undefined
        ? previous.tenant ?? defaults.tenant
        : defaults.tenant,
    ns:
      "ns" in previous && previous.ns !== undefined
        ? previous.ns ?? defaults.namespace
        : defaults.namespace,
    topic:
      "topic" in previous && previous.topic !== undefined
        ? previous.topic ?? defaults.topic
        : defaults.topic,
    payload:
      "payload" in previous && previous.payload !== undefined
        ? previous.payload ?? defaults.payload
        : defaults.payload,
    delayMs:
      "delayMs" in previous && previous.delayMs !== undefined
        ? Math.max(0, previous.delayMs ?? 0)
        : 0,
  });
}
