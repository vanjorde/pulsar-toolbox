"use client";
import type { Dispatch, SetStateAction } from "react";
import { toast } from "sonner";
import { formatJsonString } from "@/lib/json";
import type { SendResult } from "@/types/messaging";

export function SendMessagePanel({
  tenant,
  ns,
  topic,
  json,
  setTenant,
  setNs,
  setTopic,
  setJson,
  sending,
  ack,
  onSend,
}: {
  tenant: string;
  ns: string;
  topic: string;
  json: string;
  setTenant: Dispatch<SetStateAction<string>>;
  setNs: Dispatch<SetStateAction<string>>;
  setTopic: Dispatch<SetStateAction<string>>;
  setJson: Dispatch<SetStateAction<string>>;
  sending: boolean;
  ack: SendResult | null;
  onSend: () => Promise<void>;
}) {
  const formatJson = () => {
    const result = formatJsonString(json, 2);
    if (!result.ok) {
      toast.error(`Invalid JSON format: ${result.error}`);
      return;
    }
    setJson(result.value);
    toast.success("JSON formatted successfully");
  };

  const renderAck = () => {
    if (!ack) {
      return (
        <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
          No messages sent yet for this topic.
        </div>
      );
    }

    const timestamp = new Date(ack.timestamp).toLocaleString();

    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div>
            <div>{timestamp}</div>
          </div>
          <span
            className={`inline-flex items-center rounded-sm border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
              ack.succeeded
                ? "border-green-500/40 bg-green-500/15 text-green-300"
                : "border-red-500/40 bg-red-500/15 text-red-500"
            }`}
          >
            {ack.succeeded ? "Success" : "Failed"}
          </span>
        </div>
        <div className="text-sm text-foreground/90 leading-relaxed">
          {ack.message}
        </div>
        <pre className="max-h-48 overflow-y-auto rounded-lg border border-border bg-input p-3 text-xs text-foreground">
          {JSON.stringify(ack.response, null, 2)}
        </pre>
      </div>
    );
  };

  return (
    <div className="rounded-xl bg-card border border-border p-6 shadow-lg hover:shadow-xl transition-shadow xl:col-span-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-4">
        <div className="flex items-center gap-2 text-xl font-semibold text-foreground">
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
              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
            />
          </svg>
          Send Message
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Tenant
              </label>
              <input
                value={tenant}
                onChange={(event) => setTenant(event.target.value)}
                className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Namespace
              </label>
              <input
                value={ns}
                onChange={(event) => setNs(event.target.value)}
                className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Topic
              </label>
              <input
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              />
            </div>
          </div>
          <div className="relative">
            <textarea
              value={json}
              onChange={(event) => setJson(event.target.value)}
              rows={7}
              className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              placeholder="Enter JSON message..."
            />
            <button
              onClick={formatJson}
              className="absolute top-2 right-2 text-xs px-2 py-1 bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground rounded transition-colors"
              title="Format JSON (Ctrl+Shift+F)"
            >
              Format
            </button>
          </div>
          <button
            onClick={onSend}
            disabled={sending}
            className="cursor-pointer w-full px-4 py-2 bg-primary/60 border border-primary hover:bg-primary/70 disabled:opacity-50 text-white font-medium rounded-lg transition-all flex items-center justify-center gap-2"
          >
            {sending ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Sending...
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
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                </svg>
                Send Message
              </>
            )}
          </button>
        </div>

        <aside className="rounded-lg border border-border bg-muted/20 p-4 min-h-[220px]">
          <div className="text-sm font-semibold text-foreground mb-3">
            Last Response
          </div>
          {renderAck()}
        </aside>
      </div>
    </div>
  );
}
