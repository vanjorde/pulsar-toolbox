"use client";
import type { PropsWithChildren } from "react";

export function PanelOverlay({ children }: PropsWithChildren) {
  return (
    <div className="absolute inset-0 z-40 bg-black/85 flex items-center justify-center">
      {children}
    </div>
  );
}
