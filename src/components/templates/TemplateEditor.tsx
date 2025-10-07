"use client";
import React, { useLayoutEffect, useMemo, useState, useEffect } from "react";
import { formatJsonString, getJsonError } from "@/lib/json";
import type { Template } from "@/types/pulsar";

export function TemplateEditor({
  template,
  onUpdate,
  onClose,
  onDelete,
}: {
  template: Template;
  onUpdate: (updated: Template) => void;
  onClose: () => void;
  onDelete?: (id: string) => void;
}) {
  const baselineName = useMemo(
    () => template.name ?? "",
    [template.id, template.name]
  );
  const baselinePayload = useMemo(
    () => template.payload ?? "",
    [template.id, template.payload]
  );

  const [name, setName] = useState(baselineName);
  const [payload, setPayload] = useState(baselinePayload);
  const [touched, setTouched] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useLayoutEffect(() => {
    setName(baselineName);
    setPayload(baselinePayload);
    setTouched(false);
    setShowDeleteConfirm(false);
  }, [baselineName, baselinePayload, template.id]);

  const jsonError = useMemo(() => getJsonError(payload), [payload]);

  const isDirty = name !== baselineName || payload !== baselinePayload;
  const showRevert = touched && isDirty;

  function onNameChange(v: string) {
    setName(v);
    setTouched(true);
  }
  function onPayloadChange(v: string) {
    setPayload(v);
    setTouched(true);
  }

  function formatJson() {
    const result = formatJsonString(payload, 2);
    if (!result.ok) {
      return;
    }
    setPayload(result.value);
    setTouched(true);
  }

  function revertChanges() {
    setName(baselineName);
    setPayload(baselinePayload);
    setTouched(false);
  }

  function handleSave() {
    if (jsonError) return;
    const nextName = name.trim() || baselineName;
    onUpdate({ ...template, name: nextName, payload });
  }

  function handleDelete() {
    if (!onDelete) {
      setShowDeleteConfirm(false);
      return;
    }
    onDelete(template.id);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSave();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [jsonError, name, payload, baselineName, baselinePayload]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Edit Template</h3>
      </div>

      <div className="p-6 space-y-4 overflow-y-auto">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Display Name
          </label>
          <input
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Template name"
            className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            This is the friendly name shown in the template list.
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-foreground">
              JSON Payload
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={formatJson}
                className="cursor-pointer text-xs px-2 py-1 bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground rounded transition-colors"
                title="Format JSON (pretty print)"
              >
                Format
              </button>
              {showRevert && (
                <button
                  onClick={revertChanges}
                  className="cursor-pointer text-xs px-2 py-1 bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground rounded transition-colors"
                  title="Revert to original"
                >
                  Revert
                </button>
              )}
            </div>
          </div>
          <textarea
            value={payload}
            onChange={(e) => onPayloadChange(e.target.value)}
            rows={14}
            spellCheck={false}
            className={`w-full px-3 py-2 bg-input border ${
              jsonError ? "border-destructive" : "border-border"
            } rounded-lg text-foreground font-mono text-sm resize-none focus:outline-none focus:ring-2 ${
              jsonError ? "focus:ring-destructive" : "focus:ring-primary"
            } focus:border-transparent transition-all`}
            placeholder='{"hello":"pulsar"}'
          />
          {!!jsonError && (
            <div className="mt-2 text-xs text-destructive">
              JSON error: {jsonError}
            </div>
          )}
        </div>
      </div>

      <div className="px-6 py-4 border-t border-border flex items-center justify-between">
        <div>
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="cursor-pointer px-3 py-1.5 text-sm bg-destructive text-white hover:bg-destructive/90 rounded-lg transition-colors"
              title="Delete this template"
            >
              Delete
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Delete this template?
              </span>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="cursor-pointer px-3 py-1.5 text-sm bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="cursor-pointer px-3 py-1.5 text-sm bg-destructive text-white hover:bg-destructive/90 rounded-lg transition-colors"
              >
                Confirm
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="cursor-pointer px-3 py-1.5 text-sm bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!!jsonError || (!touched && !name.trim())}
            className={`cursor-pointer px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              jsonError || (!touched && !name.trim())
                ? "bg-primary/40 text-primary-foreground/70 cursor-not-allowed"
                : "bg-primary hover:bg-primary/90 text-primary-foreground"
            }`}
            title="Save (⌘/Ctrl+S)"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
