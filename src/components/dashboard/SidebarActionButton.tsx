"use client";
import type { ButtonHTMLAttributes } from "react";

export function SidebarActionButton({ className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`cursor-pointer text-xs px-2 py-1 rounded-md border border-border text-foreground hover:bg-muted/40 transition-colors ${className}`.trim()}
      {...props}
    />
  );
}
