import { uid } from "@/lib/uid";
import type {
  MessageStep,
  ScenarioStep,
  StepOptions,
  WaitStep,
} from "@/types/scenario";

export function createScenarioStep(options: StepOptions): ScenarioStep {
  const id = options.id ?? uid("step");

  if (options.type === "message") {
    const {
      position,
      label,
      hostId,
      tenant,
      ns,
      topic,
      payload,
      delayMs = 0,
    } = options;

    return {
      id,
      type: "message",
      label: label ?? `Message ${position}`,
      hostId,
      tenant,
      ns,
      topic,
      payload,
      delayMs,
    } as MessageStep;
  }

  const { position, label, waitMs = 1000 } = options;

  return {
    id,
    type: "wait",
    label: label ?? `Wait ${position}`,
    waitMs,
  } as WaitStep;
}
