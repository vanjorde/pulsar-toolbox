"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export function useExpiringSet(durationMs: number) {
  const [entries, setEntries] = useState<Record<string, number>>({});
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  const add = useCallback(
    (keys: string[]) => {
      if (!keys.length) return;
      setEntries((prev) => {
        const next = { ...prev };
        const now = Date.now();
        let changed = false;
        for (const key of keys) {
          next[key] = now + durationMs;
          changed = true;
        }
        return changed ? next : prev;
      });
    },
    [durationMs]
  );

  const clear = useCallback(() => {
    setEntries({});
  }, []);

  useEffect(() => {
    const timers = timersRef.current;
    for (const existing of timers.values()) {
      clearTimeout(existing);
    }
    timers.clear();

    const now = Date.now();
    for (const [key, expiresAt] of Object.entries(entries)) {
      const remaining = Math.max(0, expiresAt - now);
      const timer = setTimeout(() => {
        setEntries((prev) => {
          if (!(key in prev)) return prev;
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }, remaining);
      timers.set(key, timer);
    }

    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
    };
  }, [entries]);

  const activeKeys = useMemo(() => new Set(Object.keys(entries)), [entries]);

  return {
    activeKeys,
    add,
    clear,
  } as const;
}
