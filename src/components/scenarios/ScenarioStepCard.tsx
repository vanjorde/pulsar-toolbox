"use client";
import type { Host } from "@/types/pulsar";
import type {
  MessageStep,
  ScenarioStepCardProps,
  WaitStep,
} from "@/types/scenario";

export function ScenarioStepCard({
  step,
  index,
  isActive,
  isRunning,
  isCollapsed,
  error,
  hosts,
  disableMoveUp,
  disableMoveDown,
  onToggle,
  onMoveUp,
  onMoveDown,
  onRemove,
  onUpdate,
  onChangeType,
  onFormatJson,
}: ScenarioStepCardProps) {
  const isMessage = step.type === "message";
  const label = step.label || (isMessage ? "Message" : "Wait");

  return (
    <div
      className={`rounded-lg border-2 overflow-hidden shadow-sm transition ${
        isActive
          ? "border-primary ring-1 ring-primary/60 bg-primary/10"
          : "border-neutral-800"
      }`}
    >
      <header className="flex items-center justify-between bg-neutral-800 p-4">
        <button
          type="button"
          onClick={() => onToggle(step.id)}
          className="group flex cursor-pointer items-center gap-3 text-left"
          aria-expanded={!isCollapsed}
          aria-controls={`step-${step.id}-body`}
          title={isCollapsed ? "Expand" : "Collapse"}
        >
          <IconCaret open={!isCollapsed} />

          <div className="flex items-center gap-2">
            {isMessage ? (
              <IconMessage className="h-4 w-4 text-blue-500" />
            ) : (
              <IconStopwatch className="h-4 w-4 text-amber-500" />
            )}

            <span className="text-sm text-foreground">{label}</span>
            <span className="mt-px rounded border border-neutral-600 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              {isMessage ? "message" : "wait"}
            </span>
            {isActive && (
              <span className="text-xs text-primary">Running...</span>
            )}
            {error && (
              <span className="text-xs text-destructive">JSON error</span>
            )}
          </div>
        </button>

        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => onMoveUp(step.id)}
            disabled={isRunning || disableMoveUp}
            className="cursor-pointer rounded border border-neutral-600 px-2 py-1 text-muted-foreground hover:bg-neutral-700/50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-muted/30"
          >
            Up
          </button>
          <button
            type="button"
            onClick={() => onMoveDown(step.id)}
            disabled={isRunning || disableMoveDown}
            className="cursor-pointer rounded border border-neutral-600 px-2 py-1 text-muted-foreground hover:bg-neutral-700/50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-muted/30"
          >
            Down
          </button>
          <button
            type="button"
            onClick={() => onRemove(step.id)}
            disabled={isRunning}
            className="cursor-pointer rounded border border-red-500/50 px-2 py-1 text-red-400 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Remove
          </button>
        </div>
      </header>

      {!isCollapsed && (
        <div id={`step-${step.id}-body`} className="border-t border-border p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">Label</span>
              <input
                type="text"
                value={step.label}
                onChange={(event) =>
                  onUpdate(step.id, { label: event.target.value })
                }
                disabled={isRunning}
                className="rounded-md border border-border bg-background/90 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">Step type</span>
              <select
                value={step.type}
                onChange={(event) =>
                  onChangeType(step, event.target.value as "message" | "wait")
                }
                disabled={isRunning}
                className="rounded-md border border-border bg-background/90 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="message">Message</option>
                <option value="wait">Wait</option>
              </select>
            </label>
          </div>

          {isMessage ? (
            <MessageStepFields
              step={step as MessageStep}
              hosts={hosts}
              disabled={isRunning}
              error={error}
              onUpdate={(updates) => onUpdate(step.id, updates)}
              onFormatJson={onFormatJson}
            />
          ) : (
            <WaitStepFields
              step={step as WaitStep}
              disabled={isRunning}
              onUpdate={(updates) => onUpdate(step.id, updates)}
            />
          )}
        </div>
      )}
    </div>
  );
}

function MessageStepFields({
  step,
  hosts,
  disabled,
  error,
  onUpdate,
  onFormatJson,
}: {
  step: MessageStep;
  hosts: Host[];
  disabled: boolean;
  error?: string;
  onUpdate: (updates: Partial<MessageStep>) => void;
  onFormatJson?: (step: MessageStep) => void;
}) {
  return (
    <div className="mt-4 space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Host</span>
          <select
            value={step.hostId ?? ""}
            onChange={(event) =>
              onUpdate({ hostId: event.target.value || null })
            }
            disabled={disabled}
            className="rounded-md border border-border bg-background/90 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value="">Use active host</option>
            {hosts.map((host) => (
              <option key={host.id} value={host.id}>
                {host.name || host.id}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Tenant</span>
          <input
            type="text"
            value={step.tenant}
            onChange={(event) => onUpdate({ tenant: event.target.value })}
            disabled={disabled}
            className="rounded-md border border-border bg-background/90 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Namespace</span>
          <input
            type="text"
            value={step.ns}
            onChange={(event) => onUpdate({ ns: event.target.value })}
            disabled={disabled}
            className="rounded-md border border-border bg-background/90 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Topic</span>
          <input
            type="text"
            value={step.topic}
            onChange={(event) => onUpdate({ topic: event.target.value })}
            disabled={disabled}
            className="rounded-md border border-border bg-background/90 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">JSON payload</span>
          {onFormatJson && (
            <button
              type="button"
              onClick={() => onFormatJson(step)}
              disabled={disabled}
              className="cursor-pointer rounded bg-muted px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              Format
            </button>
          )}
        </div>
        <textarea
          value={step.payload}
          onChange={(event) => onUpdate({ payload: event.target.value })}
          rows={12}
          spellCheck={false}
          disabled={disabled}
          className={`w-full resize-none rounded-lg border bg-input px-3 py-2 font-mono text-sm text-foreground focus:border-transparent focus:outline-none focus:ring-2 ${
            error
              ? "border-destructive focus:ring-destructive"
              : "border-border focus:ring-primary"
          } disabled:cursor-not-allowed disabled:opacity-60`}
          placeholder='{"hello":"pulsar"}'
        />
        {error && (
          <div className="mt-2 text-xs text-destructive">
            JSON error: {error}
          </div>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Delay after send (ms)</span>
          <input
            type="number"
            min={0}
            value={step.delayMs}
            onChange={(event) =>
              onUpdate({
                delayMs: Math.max(0, Number(event.target.value) || 0),
              })
            }
            disabled={disabled}
            className="rounded-md border border-border bg-background/90 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>
      </div>
    </div>
  );
}

function WaitStepFields({
  step,
  disabled,
  onUpdate,
}: {
  step: WaitStep;
  disabled: boolean;
  onUpdate: (updates: Partial<WaitStep>) => void;
}) {
  return (
    <div className="mt-4 grid gap-3 md:grid-cols-2">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">Wait for (ms)</span>
        <input
          type="number"
          min={0}
          value={step.waitMs}
          onChange={(event) =>
            onUpdate({ waitMs: Math.max(0, Number(event.target.value) || 0) })
          }
          disabled={disabled}
          className="rounded-md border border-border bg-background/90 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60 disabled:cursor-not-allowed disabled:opacity-60"
        />
      </label>
    </div>
  );
}

function IconCaret({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-4 w-4 text-muted-foreground transition-transform ${
        open ? "rotate-90" : "rotate-0"
      }`}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707A1 1 0 118.707 5.293l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function IconMessage({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      <rect
        x="3"
        y="4"
        width="18"
        height="13"
        rx="3"
        ry="3"
        strokeWidth="1.8"
      />
      <path d="M8 20l4-3H21" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M7.5 9h9" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M7.5 12.5h6" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconStopwatch({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path d="M10 2h4" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M15.5 4.5l1.5 1.5" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="14" r="7" strokeWidth="1.8" />
      <path d="M12 14V9.5" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
