"use client";
import clsx from "clsx";
import { useState, type ComponentProps, type ReactNode } from "react";
import { LiveControls } from "@/components/messageView/LiveControls";
import { LiveMessageList } from "@/components/messageView/LiveMessageList";
import { MessageReaderPanel } from "@/components/messageView/MessageReaderPanel";
import { SendMessagePanel } from "@/components/messageView/SendMessagePanel";

interface DashboardMainContentProps {
  hasOverlay: boolean;
  headingLabel: string | null | undefined;
  serviceUrl: string | null | undefined;
  liveControls: ComponentProps<typeof LiveControls>;
  sendMessage: ComponentProps<typeof SendMessagePanel>;
  showLivePanel: boolean;
  livePanel: ComponentProps<typeof LiveMessageList>;
  readerPanel: ComponentProps<typeof MessageReaderPanel>;
  overlays?: ReactNode;
}

export function DashboardMainContent({
  hasOverlay,
  headingLabel,
  serviceUrl,
  liveControls,
  sendMessage,
  showLivePanel,
  livePanel,
  readerPanel,
  overlays,
}: DashboardMainContentProps) {
  const [isSendPanelCollapsed, setIsSendPanelCollapsed] = useState(false);

  return (
    <section
      className="relative flex h-full min-h-0 overflow-hidden"
      data-overlay-active={hasOverlay || undefined}
    >
      <div
        className={clsx(
          "mx-auto flex h-full w-full max-w-6xl flex-col min-h-0",
          "px-6 pt-6 pb-2"
        )}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mt-2 mb-6 gap-4">
          <div>
            <div className="text-xs text-muted-foreground">
              <div>{serviceUrl || ""}</div>
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">
              {headingLabel || "Select a topic"}
            </h2>
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <span>Ctrl/Cmd + Enter: Send</span>
              <span className={showLivePanel ? "hidden" : ""}>
                Ctrl/Cmd + R: Read
              </span>
            </div>
          </div>

          <div className="absolute top-2 right-2 z-30 ">
            <LiveControls {...liveControls} />
          </div>
        </div>

        <div className="flex-1 min-h-0">
          <div className="grid h-full grid-cols-1 gap-3 grid-rows-[auto_minmax(0,1fr)]">
            <SendMessagePanel
              {...sendMessage}
              isCollapsed={isSendPanelCollapsed}
              onToggleCollapse={() =>
                setIsSendPanelCollapsed((previous) => !previous)
              }
            />

            {showLivePanel ? (
              <div className="rounded-xl bg-card border border-border p-4 shadow-lg hover:shadow-xl transition-shadow xl:col-span-2 h-full min-h-0 flex flex-col">
                <div className="flex items-center justify-between mb-4 shrink-0">
                  <h3 className="text-xl font-semibold text-foreground flex items-center gap-2">
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
                    Messages
                  </h3>
                </div>
                <div className="flex-1 min-h-0">
                  <LiveMessageList {...livePanel} />
                </div>
              </div>
            ) : (
              <MessageReaderPanel {...readerPanel} />
            )}
          </div>
        </div>
      </div>
      {overlays}
    </section>
  );
}
