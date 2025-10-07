import { Host } from "./pulsar";
export type MessageStep = {
  id: string;
  type: "message";
  label: string;
  hostId: string | null;
  tenant: string;
  ns: string;
  topic: string;
  payload: string;
  delayMs: number;
};

export type WaitStep = {
  id: string;
  type: "wait";
  label: string;
  waitMs: number;
};

export type ScenarioStep = MessageStep | WaitStep;

export type Scenario = {
  id: string;
  name: string;
  description?: string;
  steps: ScenarioStep[];
};

export type ScenarioEditorProps = {
  scenario: Scenario | null;
  hosts: Host[];
  isRunning: boolean;
  runningStepIndex: number | null;
  defaultHostId: string | null;
  defaultTenant: string;
  defaultNamespace: string;
  defaultTopic: string;
  defaultPayload: string;
  onSave: (scenario: Scenario) => void;
  onCancel: () => void;
  onDelete: (scenarioId: string) => void;
  onRun: (scenarioId: string) => Promise<void> | void;
  onCancelRun: (scenarioId: string) => void;
};

export type ScenariosExplorerProps = {
  scenarios: Scenario[];
  selectedId?: string | null;
  onOpenScenario: (id: string) => void;
  onCreateScenario: () => void;
  onRunScenario: (id: string) => Promise<void> | void;
  runningScenarioIds?: string[];
  hideHeader?: boolean;
};

export type ScenarioStepCardProps = {
  step: ScenarioStep;
  index: number;
  isActive: boolean;
  isRunning: boolean;
  isCollapsed: boolean;
  error?: string;
  hosts: Host[];
  disableMoveUp: boolean;
  disableMoveDown: boolean;
  onToggle: (stepId: string) => void;
  onMoveUp: (stepId: string) => void;
  onMoveDown: (stepId: string) => void;
  onRemove: (stepId: string) => void;
  onUpdate: (stepId: string, updates: Partial<ScenarioStep>) => void;
  onChangeType: (step: ScenarioStep, nextType: "message" | "wait") => void;
  onFormatJson?: (step: MessageStep) => void;
};

export type BaseStepOptions = {
  id?: string;
  position: number;
  label?: string;
};

export type MessageStepOptions = BaseStepOptions & {
  type: "message";
  hostId: string | null;
  tenant: string;
  ns: string;
  topic: string;
  payload: string;
  delayMs?: number;
};

export type WaitStepOptions = BaseStepOptions & {
  type: "wait";
  waitMs?: number;
};

export type StepOptions = MessageStepOptions | WaitStepOptions;
