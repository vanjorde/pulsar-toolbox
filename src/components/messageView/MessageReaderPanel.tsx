"use client";
import type { Dispatch, SetStateAction } from "react";
import { LiveMessageList } from "@/components/messageView/LiveMessageList";
import type { PulsarMessage } from "@/lib/pulsarWs";

export function MessageReaderPanel({
  start,
  setStart,
  limit,
  setLimit,
  timeoutMs,
  setTimeoutMs,
  peeking,
  onPeek,
  onCancel,
  messages,
}: {
  start: "earliest" | "latest";
  setStart: Dispatch<SetStateAction<"earliest" | "latest">>;
  limit: number;
  setLimit: Dispatch<SetStateAction<number>>;
  timeoutMs: number;
  setTimeoutMs: Dispatch<SetStateAction<number>>;
  peeking: boolean;
  onPeek: () => void;
  onCancel: () => void;
  messages: PulsarMessage[];
}) {
  return (
    <div className="rounded-xl bg-card border border-border p-6 shadow-lg hover:shadow-xl transition-shadow xl:col-span-2 h-full min-h-[24rem] flex flex-col">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
          <svg
            className="w-5 h-5 text-primary"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          Message Reader
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-foreground">
              Start:
            </label>
            <select
              value={start}
              onChange={(event) =>
                setStart(event.target.value as "earliest" | "latest")
              }
              className="px-2 py-1 bg-input border border-border rounded text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-all"
            >
              <option value="latest">latest</option>
              <option value="earliest">earliest</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-foreground">
              Limit:
            </label>
            <input
              type="number"
              value={limit}
              min={1}
              onChange={(event) =>
                setLimit(
                  Math.max(1, Number.parseInt(event.target.value || "1", 10))
                )
              }
              className="w-20 px-2 py-1 bg-input border border-border rounded text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-all"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-foreground">
              Timeout (ms):
            </label>
            <input
              type="number"
              value={timeoutMs}
              min={500}
              step={100}
              onChange={(event) =>
                setTimeoutMs(
                  Math.max(100, Number.parseInt(event.target.value || "0", 10))
                )
              }
              className="w-24 px-2 py-1 bg-input border border-border rounded text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-all"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onPeek}
              disabled={peeking}
              className="cursor-pointer px-4 py-1 bg-green-500/60 border border-green-500 hover:bg-green-600 disabled:opacity-50 text-white font-medium rounded-lg transition-all flex items-center gap-2"
            >
              {peeking ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Reading...
                </>
              ) : (
                <>
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
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                  Read Messages
                </>
              )}
            </button>
            {peeking && (
              <button
                onClick={onCancel}
                className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground text-sm font-medium rounded-lg transition-all"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>

      <LiveMessageList messages={messages} isLive={false} isLoading={peeking} />
    </div>
  );
}
