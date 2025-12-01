"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Host } from "@/types/pulsar";
import { normalizeTopicIdentifier, parseTopicIdentifier } from "@/lib/topics";

interface LimitedTopicModalProps {
  isOpen: boolean;
  host: Host;
  mode:
    | { type: "create"; onSubmit: (topic: string) => void }
    | {
        type: "edit";
        initialTopic: string;
        onSubmit: (topic: string) => void;
        onDelete: () => void;
      };
  existingTopics: string[];
  onClose: () => void;
}

export function LimitedTopicModal({
  isOpen,
  host,
  mode,
  existingTopics,
  onClose,
}: LimitedTopicModalProps) {
  const [topicValue, setTopicValue] = useState("persistent://");
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const editInitialTopic = mode.type === "edit" ? mode.initialTopic : undefined;

  const handleClose = useCallback(() => {
    setTopicValue("persistent://");
    setError(null);
    setShowDeleteConfirm(false);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    if (mode.type === "edit") {
      setTopicValue(editInitialTopic ?? "persistent://");
    } else {
      setTopicValue("persistent://");
    }
    setError(null);
    setShowDeleteConfirm(false);
  }, [editInitialTopic, isOpen, mode.type]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleClose, isOpen]);

  const handleSubmit = () => {
    const trimmed = topicValue.trim();
    if (!trimmed) {
      setError(
        "Enter a topic that includes tenant, namespace, and topic name."
      );
      return;
    }

    const parsed = parseTopicIdentifier(trimmed);
    if (!parsed) {
      setError(
        "Use tenant/namespace/topic or non-persistent://tenant/ns/topic format."
      );
      return;
    }

    const normalized = parsed.fullName;
    const existingKeys = new Set(
      existingTopics
        .filter((item) =>
          mode.type === "edit"
            ? normalizeTopicIdentifier(item) !==
              normalizeTopicIdentifier(mode.initialTopic)
            : true
        )
        .map((item) => normalizeTopicIdentifier(item))
    );

    if (existingKeys.has(normalized)) {
      setError("Topic already exists for this host.");
      return;
    }

    mode.onSubmit(normalized);
    handleClose();
  };

  const handleDelete = () => {
    if (mode.type !== "edit") return;
    mode.onDelete();
    handleClose();
  };

  const formattedDialogTopic = useMemo(() => {
    if (mode.type !== "edit") {
      return "this topic";
    }
    const parsed = parseTopicIdentifier(editInitialTopic ?? "");
    return parsed ? parsed.fullName : editInitialTopic ?? "this topic";
  }, [editInitialTopic, mode.type]);

  if (!isOpen) {
    return null;
  }

  const modalTitle = mode.type === "edit" ? "Edit topic" : "Add topic";

  return (
    <div className="flex items-center justify-center min-w-[32rem] w-[40%] p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-[min(520px,calc(100%-48px))] max-h-[85vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        <div className="flex items-start justify-between px-6 py-4 border-b border-border gap-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {modalTitle}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">{host.name}</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors p-1 rounded-lg hover:bg-muted"
            aria-label="Close"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-2">
                Topic identifier
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 bg-input border border-border rounded-lg text-sm text-foreground placeholder-muted-foreground ring-primary transition-all"
                value={topicValue}
                onChange={(event) => {
                  setTopicValue(event.target.value);
                  setError(null);
                }}
                placeholder="persistent://tenant/namespace/topic"
              />
              <p className="mt-2 text-[11px] text-muted-foreground">
                Include tenant, namespace, and topic. Non-persistent topics can
                use:
              </p>
              <code className="px-1.5 py-0.5 mt-2 text-[12px] bg-neutral-800/70 text-neutral-300 rounded-sm">
                non-persistent://tenant/ns/topic
              </code>
              {error && (
                <p className="mt-2 text-xs text-destructive">{error}</p>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {mode.type === "edit" ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {!showDeleteConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-3 py-2 cursor-pointer text-sm bg-destructive text-white rounded-lg hover:bg-destructive/90 transition-colors"
                >
                  Delete
                </button>
              ) : (
                <>
                  <span className="text-muted-foreground">
                    Delete {formattedDialogTopic}?
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-3 py-2 cursor-pointer text-sm bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground rounded-lg border border-border"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="px-3 py-2 cursor-pointer text-sm bg-destructive text-white rounded-lg hover:bg-destructive/90 transition-colors"
                  >
                    Confirm
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">
              Topics are stored per host.
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-3 py-2 cursor-pointer text-sm bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground rounded-lg border border-border"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="px-3 py-2 cursor-pointer text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              {mode.type === "edit" ? "Save" : "Add"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
