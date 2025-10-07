"use client";
import * as React from "react";
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";
import { cn } from "@/lib/utils";

export const ResizablePanelGroup = PanelGroup;
export const ResizablePanel = Panel;

export function ResizableHandle({ className }: { className?: string }) {
  return (
    <PanelResizeHandle
      className={cn(
        "group relative data-[panel-group-direction=horizontal]:w-0.5 data-[panel-group-direction=vertical]:h-2",
        "bg-border",
        "flex items-center justify-center",
        className
      )}
    ></PanelResizeHandle>
  );
}
