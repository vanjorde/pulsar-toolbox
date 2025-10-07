"use client";
import type React from "react";
import { useMemo } from "react";
import type { ScenariosExplorerProps } from "@/types/scenario";

export function ScenariosExplorer({
  scenarios,
  selectedId = null,
  onOpenScenario,
  onCreateScenario,
  onRunScenario,
  runningScenarioIds = [],
  hideHeader = false,
}: ScenariosExplorerProps) {
  const sorted = useMemo(
    () =>
      [...scenarios].sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    [scenarios]
  );

  const listClassName = hideHeader
    ? "flex-1 overflow-y-auto pb-3 space-y-2 px-4"
    : "flex-1 overflow-y-auto px-3 pb-3 space-y-2";

  return (
    <div className="flex h-full flex-col">
      {!hideHeader && (
        <div className="flex items-center justify-between px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">Scenarios</h3>
          <button
            type="button"
            onClick={onCreateScenario}
            className="text-xs px-2 py-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
            title="Create new scenario"
          >
            + New
          </button>
        </div>
      )}

      <div className={listClassName}>
        {sorted.length === 0 ? (
          <div className="text-xs text-muted-foreground px-1">
            No scenarios yet.
          </div>
        ) : (
          sorted.map((scenario) => {
            const isActive = scenario.id === selectedId;
            const isRunning =
              runningScenarioIds?.includes(scenario.id) ?? false;
            const containerClassName = `w-full cursor-pointer rounded-md border px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
              isActive
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card/50 hover:bg-card/70"
            }`;

            const handleContainerKeyDown = (
              event: React.KeyboardEvent<HTMLDivElement>
            ) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onOpenScenario(scenario.id);
              }
            };

            const handleRunClick = (
              event: React.MouseEvent<HTMLButtonElement>
            ) => {
              event.stopPropagation();
              onRunScenario(scenario.id);
            };

            const handleRunKeyDown = (
              event: React.KeyboardEvent<HTMLButtonElement>
            ) => {
              if (event.key === "Enter" || event.key === " ") {
                event.stopPropagation();
              }
            };

            return (
              <div
                key={scenario.id}
                role="button"
                tabIndex={0}
                onClick={() => onOpenScenario(scenario.id)}
                onKeyDown={handleContainerKeyDown}
                className={containerClassName}
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">
                      {scenario.name || "Untitled scenario"}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {scenario.steps.length} step
                      {scenario.steps.length === 1 ? "" : "s"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleRunClick}
                    onKeyDown={handleRunKeyDown}
                    className={`cursor-pointer flex h-8 w-8 items-center justify-center rounded-full border border-emerald-500/70 text-emerald-500 transition-colors hover:bg-emerald-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 ${
                      isRunning ? "bg-emerald-500/10" : ""
                    }`}
                    title="Run scenario"
                    aria-label={`Run ${scenario.name || "scenario"}`}
                  >
                    {isRunning ? (
                      <div className="h-4 w-4 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 16 16"
                        className="h-4 w-4"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path d="M6 4.5v7l5-3.5-5-3.5z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
