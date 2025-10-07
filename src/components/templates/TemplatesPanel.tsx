"use client";
import type React from "react";
import type { Template } from "@/types/pulsar";
import { createDefaultTemplate } from "@/utils/templates";

export function TemplatesPanel({
  templates,
  setTemplates,
  onEditTemplate,
  onDeleteTemplate,
  showHeader = true,
  activeTemplateId = null,
}: {
  templates: Template[];
  setTemplates: (updater: (previous: Template[]) => Template[]) => void;
  onEditTemplate?: (template: Template) => void;
  onDeleteTemplate?: (templateId: string) => void;
  showHeader?: boolean;
  activeTemplateId?: string | null;
}) {
  const createTemplate = () => {
    const newTemplate = createDefaultTemplate(templates.length);
    setTemplates((current) => [...current, newTemplate]);
    onEditTemplate?.(newTemplate);
  };

  const handleDragStart = (
    event: React.DragEvent<HTMLButtonElement>,
    template: Template
  ) => {
    event.stopPropagation();
    event.dataTransfer.setData("application/x-template-id", template.id);
    event.dataTransfer.setData("application/json", template.payload);
    event.dataTransfer.setData("text/plain", template.payload);
    event.dataTransfer.setData("text", template.payload);
    event.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div className="h-full overflow-hidden pb-2">
      <div className="h-full overflow-y-auto px-4">
        {showHeader && (
          <div className="mb-4 flex items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground">Templates</h2>
            <button
              type="button"
              onClick={createTemplate}
              className="ml-auto cursor-pointer h-6 px-2 py-0.5 bg-green-500/20 transition-all border border-green-600 hover:bg-green-700 text-white font-medium rounded-md flex items-center justify-center gap-2"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              New
            </button>
          </div>
        )}

        <div className="space-y-3">
          {templates.map((template) => {
            const isActive = template.id === activeTemplateId;

            return (
              <div
                key={template.id}
                className={`rounded-lg border transition-colors ${
                  isActive
                    ? "border-primary/60 bg-primary/10 shadow-sm"
                    : "border-border bg-card/30"
                }`}
              >
                <div
                  className={`px-4 py-1 text-sm font-medium select-none flex items-center justify-between transition-colors cursor-pointer ${
                    isActive
                      ? "bg-primary/20 text-primary"
                      : "bg-muted/30 hover:bg-muted/50 text-foreground"
                  }`}
                  onClick={() => onEditTemplate?.(template)}
                >
                  <span
                    className={`truncate ${
                      isActive ? "text-primary" : "text-foreground"
                    }`}
                  >
                    {template.name}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="text-xs px-1 py-0.5 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 rounded-sm cursor-grab active:cursor-grabbing transition-colors flex items-center gap-1"
                      draggable
                      onDragStart={(event) => handleDragStart(event, template)}
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {templates.length === 0 && (
            <div className="text-xs text-muted-foreground text-center py-6">
              No templates yet. Create one to get started.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
