"use client";
import { useEffect } from "react";

type ShortcutHandlers = {
  sendMessage: () => void;
  peekMessages: () => void;
};

interface UseDashboardHotkeysOptions {
  isTemplateOpen: boolean;
  isScenarioOpen: boolean;
  isSending: boolean;
  isPeeking: boolean;
  shortcuts: ShortcutHandlers;
}

export function useDashboardHotkeys({
  isTemplateOpen,
  isScenarioOpen,
  isSending,
  isPeeking,
  shortcuts,
}: UseDashboardHotkeysOptions) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTemplateOpen || isScenarioOpen) return;
      if (!(event.metaKey || event.ctrlKey)) return;
      const key = event.key.toLowerCase();
      if (key === "enter") {
        event.preventDefault();
        if (!isSending) shortcuts.sendMessage();
      }
      if (key === "r") {
        event.preventDefault();
        if (!isPeeking) shortcuts.peekMessages();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isTemplateOpen, isScenarioOpen, isSending, isPeeking, shortcuts]);
}
