"use client";
import { useEffect, useState } from "react";

export function useLocalStorage<T>(key: string, initial: T) {
  const [state, setState] = useState<T>(() => {
    if (typeof window === "undefined") return initial as T;
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : (initial as T);
    } catch {
      return initial as T;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {}
  }, [key, state]);
  return [state, setState] as const;
}
