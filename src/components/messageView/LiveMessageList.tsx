"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import clsx from "clsx";
import { makeMessageKey } from "@/lib/messages";
import { formatPayloadForDisplayWithFormat } from "@/lib/payload";
import { getPublishMs } from "@/lib/time";
import type { PulsarMessage } from "@/lib/pulsarService";
import type { MessageEntry } from "@/types/messaging";
import { useExpiringSet } from "@/hooks/useExpiringSet";
import { FiClipboard } from "react-icons/fi";
import { PayloadFormat } from "@/types/payload";

const APPEAR_MS = 600;
const SHIFT_MS = 450;

const formatBadgeClasses: Record<PayloadFormat, string> = {
  json: "border-sky-500/45 bg-sky-500/15 text-sky-300",
  xml: "border-purple-500/45 bg-purple-500/15 text-purple-300",
  text: "border-slate-500/40 bg-slate-500/15 text-slate-300",
};

const formatBadgeLabels: Record<PayloadFormat, string> = {
  json: "JSON",
  xml: "XML",
  text: "Text",
};

export function LiveMessageList({
  messages,
  isLive,
  isLoading = false,
}: {
  messages: PulsarMessage[];
  isLive: boolean;
  isLoading?: boolean;
}) {
  const messageEntries = useMemo<MessageEntry[]>(
    () =>
      messages.map((message, index) => ({
        key: makeMessageKey(message, index),
        message,
      })),
    [messages]
  );

  const orderedEntries = useMemo(() => {
    const sorted = [...messageEntries].sort((a, b) => {
      const aTs = getPublishMs(a.message) || 0;
      const bTs = getPublishMs(b.message) || 0;
      if (bTs === aTs) {
        return b.key.localeCompare(a.key);
      }
      return bTs - aTs;
    });

    const occurrences = new Map<string, number>();

    return sorted.map((entry) => {
      const count = (occurrences.get(entry.key) ?? 0) + 1;
      occurrences.set(entry.key, count);
      return {
        ...entry,
        instanceKey: `${entry.key}__${count}`,
      };
    });
  }, [messageEntries]);

  const seenKeysRef = useRef(new Set<string>());
  const shiftTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isShifting, setIsShifting] = useState(false);
  const {
    activeKeys: appearKeys,
    add: addAppearKeys,
    clear: clearAppearKeys,
  } = useExpiringSet(APPEAR_MS);

  const copyMessage = useCallback(async (text: string) => {
    try {
      if (
        typeof navigator !== "undefined" &&
        navigator.clipboard &&
        typeof navigator.clipboard.writeText === "function"
      ) {
        await navigator.clipboard.writeText(text);
      } else if (typeof document !== "undefined") {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "absolute";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      } else {
        throw new Error("Clipboard API is not available");
      }

      toast.success("Message copied to clipboard");
    } catch (error) {
      console.error("Failed to copy message", error);
      toast.error("Unable to copy message");
    }
  }, []);

  useEffect(() => {
    return () => {
      if (shiftTimeoutRef.current) {
        clearTimeout(shiftTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const currentKeys = orderedEntries.map((entry) => entry.instanceKey);
    const nextSeen = new Set(currentKeys);

    if (!isLive) {
      seenKeysRef.current = nextSeen;
      clearAppearKeys();
      setIsShifting(false);
      if (shiftTimeoutRef.current) {
        clearTimeout(shiftTimeoutRef.current);
        shiftTimeoutRef.current = null;
      }
      return;
    }

    const previous = seenKeysRef.current;
    const freshKeys = currentKeys.filter((key) => !previous.has(key));

    if (freshKeys.length > 0) {
      addAppearKeys(freshKeys);
      setIsShifting(true);

      if (shiftTimeoutRef.current) {
        clearTimeout(shiftTimeoutRef.current);
      }

      shiftTimeoutRef.current = setTimeout(() => {
        setIsShifting(false);
        shiftTimeoutRef.current = null;
      }, SHIFT_MS);
    } else if (shiftTimeoutRef.current == null) {
      setIsShifting(false);
    }

    seenKeysRef.current = nextSeen;
  }, [orderedEntries, isLive, addAppearKeys, clearAppearKeys]);

  return (
    <div
      className={clsx(
        "space-y-3 h-full pr-4 overflow-y-auto live-message-list",
        isShifting && "live-message-list--shift"
      )}
    >
      {isLoading && (
        <div className="flex items-center justify-center py-6 text-sm text-muted-foreground gap-2">
          <div className="w-4 h-4 border-2 border-muted-foreground/60 border-t-transparent rounded-full animate-spin" />
          Loading messages...
        </div>
      )}

      {orderedEntries.map(({ message, instanceKey }) => {
        const timestampMs = getPublishMs(message);
        const timestampLabel = timestampMs
          ? new Date(timestampMs).toLocaleString()
          : "-";

        const fmt = (v: unknown) =>
          v === null || typeof v === "undefined" || v === "" ? "-" : String(v);

        const id = (message as any)?.messageIdData as
          | {
              ledgerId?: number | string;
              entryId?: number | string;
              partition?: number;
              batchIndex?: number;
            }
          | undefined;

        const rawMessageId = (message as any)?.messageId;
        const base64Id = typeof rawMessageId === "string" ? rawMessageId : null;

        const hasParts =
          !!id &&
          (id.ledgerId !== undefined ||
            id.entryId !== undefined ||
            id.partition !== undefined ||
            id.batchIndex !== undefined);

        const bracket = hasParts
          ? `[ledgerId: ${fmt(id?.ledgerId)}, entryId: ${fmt(
              id?.entryId
            )}, partition: ${fmt(id?.partition)}, batchIndex: ${fmt(
              id?.batchIndex
            )}]`
          : "";

        const isNew = appearKeys.has(instanceKey);
        const payloadSource =
          (message as any)?.decoded ?? (message as any)?.payload ?? message;
        const { formatted: formattedPayload, format: payloadFormat } =
          formatPayloadForDisplayWithFormat(payloadSource, 2);

        return (
          <article
            key={instanceKey}
            data-new={isNew ? "true" : undefined}
            className={clsx(
              "group live-message-card p-4 bg-muted/50 border border-border rounded-lg transition-colors",
              "hover:bg-muted/70",
              isNew && "live-message-card--enter"
            )}
          >
            <div className="text-xs text-muted-foreground mb-2 flex items-start justify-between gap-3">
              <div className="flex flex-1 min-w-0 items-start gap-2">
                <span className="flex-1 min-w-0">
                  <strong className="font-semibold text-foreground">
                    MessageId:
                  </strong>{" "}
                  <span className="break-all">
                    {base64Id ? (
                      <>
                        <span className="text-foreground/90">{base64Id}</span>
                        {bracket && (
                          <>
                            {" "}
                            <span className="text-muted-foreground">
                              {bracket}
                            </span>
                          </>
                        )}
                      </>
                    ) : bracket ? (
                      <span className="text-muted-foreground">{bracket}</span>
                    ) : (
                      "(no id)"
                    )}
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-2 whitespace-nowrap">
                <span
                  className={clsx(
                    "inline-flex items-center rounded-sm border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                    formatBadgeClasses[payloadFormat]
                  )}
                >
                  {formatBadgeLabels[payloadFormat]}
                </span>
                {isLive && (
                  <span className="text-green-500 flex items-center gap-1 text-[11px] font-medium">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    Live
                  </span>
                )}
                <span className="text-[11px] uppercase tracking-wide">
                  {timestampLabel}
                </span>
              </div>
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => copyMessage(formattedPayload ?? "")}
                className="absolute group/copy opacity-0 group-hover:opacity-100 duration-500 inline-flex cursor-pointer right-2 top-2  items-center gap-1 rounded-md text-[11px] font-medium text-foreground hover:text-white shadow-sm transition-all"
              >
                <FiClipboard className="h-4 w-4 text-neutral-400 group-hover/copy:text-white transition-all" />
              </button>
              <pre className="text-sm bg-input border border-border rounded-md px-3 py-3 pr-12 overflow-x-auto text-foreground">
                {formattedPayload}
              </pre>
            </div>
          </article>
        );
      })}

      {!isLoading && messages.length === 0 && (
        <div className="text-center py-12">
          <svg
            className="w-12 h-12 text-muted-foreground mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
          <p className="text-sm text-muted-foreground">
            {isLive
              ? "Waiting for new messages..."
              : "No messages found. Try changing the start position or increasing the timeout."}
          </p>
        </div>
      )}
    </div>
  );
}
