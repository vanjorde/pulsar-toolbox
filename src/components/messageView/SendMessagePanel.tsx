"use client";
import clsx from "clsx";
import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { toast } from "sonner";
import { formatPayloadForDisplay, formatPayloadString } from "@/lib/payload";
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
  isCollapsed = false,
  onToggleCollapse,
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
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const collapsibleRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number>(0);

  useEffect(() => {
    const measureHeight = () => {
      if (contentRef.current) {
        setContentHeight(contentRef.current.scrollHeight);
      }
    };

    measureHeight();
    window.addEventListener("resize", measureHeight);
    return () => window.removeEventListener("resize", measureHeight);
  }, [tenant, ns, topic, json, ack]);

  useEffect(() => {
    const node = collapsibleRef.current;
    if (!node) {
      return;
    }

    if (isCollapsed) {
      node.setAttribute("inert", "");
    } else {
      node.removeAttribute("inert");
    }
  }, [isCollapsed]);

  const formatPayload = () => {
    const result = formatPayloadString(json, 2);
    if (!result.ok) {
      const formatLabel =
        result.format === "json"
          ? "JSON"
          : result.format === "xml"
          ? "XML"
          : "payload";
      toast.error(`Unable to format ${formatLabel}: ${result.error}`);
      return;
    }

    setJson(result.value);

    if (result.format === "json") {
      toast.success("JSON payload formatted successfully");
    } else if (result.format === "xml") {
      toast.success("XML payload formatted successfully");
    } else {
      toast.info("Plain text payload left unchanged");
    }
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
          {formatPayloadForDisplay(ack.response, 2)}
        </pre>
      </div>
    );
  };

  return (
    <div
      className={clsx(
        "rounded-xl bg-card border border-border shadow-lg hover:shadow-xl transition-shadow xl:col-span-2",
        "p-4"
      )}
      data-state={isCollapsed ? "collapsed" : "expanded"}
    >
      <div
        className={clsx(
          "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between",
          "transition-all duration-300 ease-in-out",
          !isCollapsed && "mb-4"
        )}
      >
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
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="cursor-pointer inline-flex h-9 w-9 items-center justify-center self-end sm:self-auto rounded-lg text-muted-foreground transition-colors hover:text-foreground"
            aria-expanded={!isCollapsed}
            aria-label={
              isCollapsed ? "Expand send panel" : "Collapse send panel"
            }
          >
            <svg
              className={clsx(
                "h-6 w-6 transition-transform duration-300 ease-in-out",
                isCollapsed && "-rotate-90"
              )}
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.08 1.04l-4.25 4.25a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}
      </div>

      <div
        ref={collapsibleRef}
        className={clsx(
          "overflow-hidden transition-all duration-300 ease-in-out",
          isCollapsed && "pointer-events-none"
        )}
        style={{
          height: isCollapsed ? "0px" : `${contentHeight}px`,
          opacity: isCollapsed ? 0 : 1,
        }}
        aria-hidden={isCollapsed}
      >
        <div ref={contentRef}>
          <div className="grid gap-6 xl:grid-cols-2">
            <div className="space-y-4">
              <div className="grid grid-cols-1 px-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Tenant
                  </label>
                  <input
                    type="text"
                    value={tenant}
                    onChange={(e) => setTenant(e.target.value)}
                    className="
                      w-full px-3 py-2 rounded-lg bg-input text-foreground
                      border border-border ring-primary transition-all
                    "
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Namespace
                  </label>
                  <input
                    value={ns}
                    onChange={(event) => setNs(event.target.value)}
                    className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground ring-primary transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Topic
                  </label>
                  <input
                    value={topic}
                    onChange={(event) => setTopic(event.target.value)}
                    className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground ring-primary transition-all"
                  />
                </div>
              </div>
              <div className="relative px-1">
                <textarea
                  value={json}
                  onChange={(event) => setJson(event.target.value)}
                  rows={7}
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground font-mono text-sm resize-none ring-primary transition-all"
                  placeholder="Enter message payload..."
                />
                <button
                  onClick={formatPayload}
                  className="absolute cursor-pointer top-2 right-2 text-xs px-2 py-1 bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground rounded transition-colors"
                >
                  Format
                </button>
              </div>
              <div className="px-1">
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
            </div>

            <aside className="rounded-lg border border-border bg-muted/20 p-4 min-h-[220px]">
              <div className="text-sm font-semibold text-foreground mb-3">
                Last Response
              </div>
              {renderAck()}
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
