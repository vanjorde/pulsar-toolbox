"use client";
import { useCallback } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { SidebarSectionProps } from "@/types/sidebar";

const STORAGE_PREFIX = "pulsar.sidebar.";

export function SidebarSection({
  title,
  storageKey,
  defaultHeight = 1,
  minHeight = 160,
  actions,
  children,
  borderTop = true,
  className = "",
  contentClassName = "overflow-hidden",
}: SidebarSectionProps) {
  const [collapsed, setCollapsed] = useLocalStorage<boolean>(
    `${STORAGE_PREFIX}${storageKey}.collapsed`,
    false
  );

  const handleToggle = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, [setCollapsed]);

  const weight = Math.max(defaultHeight, 0.5);
  const minPx = Math.max(minHeight, 120);

  const containerStyle: CSSProperties = collapsed
    ? { flex: "0 0 auto" }
    : {
        flexGrow: weight,
        flexShrink: 1,
        flexBasis: 0,
        minHeight: `${minPx}px`,
      };

  return (
    <div
      className={`relative flex flex-col bg-card/60 ${
        borderTop ? "border-t border-border" : "border-border border-t-0"
      } ${className}`}
      style={containerStyle}
    >
      <div className="flex items-center justify-between px-4 py-3 select-none">
        <button
          type="button"
          onClick={handleToggle}
          className="cursor-pointer flex items-center gap-2 text-sm font-semibold text-foreground"
          aria-expanded={!collapsed}
        >
          <svg
            className={`h-3 w-3 transition-transform ${
              collapsed ? "rotate-0" : "rotate-90"
            }`}
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M7.293 14.707a1 1 0 01-.083-1.32l.083-.094L10.586 10 7.293 6.707a1 1 0 011.32-1.497l.094.083 4 4a1 1 0 01.083 1.32l-.083.094-4 4a1 1 0 01-1.497-.083z"
              clipRule="evenodd"
            />
          </svg>
          <span>{title}</span>
        </button>
        {actions && !collapsed && (
          <div className="flex items-center gap-2">{actions}</div>
        )}
      </div>

      {!collapsed && (
        <div className={`flex-1 min-h-0 ${contentClassName}`}>{children}</div>
      )}
    </div>
  );
}
