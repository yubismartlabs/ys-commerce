"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Which My YS sidebar groups the buyer has folded away.
 *
 * `useSyncExternalStore` rather than `useEffect` + `useState`, for the reason
 * spelled out in `lib/hooks/use-hydrated.ts`: the read must be safe during SSR
 * (where localStorage does not exist) and must not cause a cascading render.
 * The server snapshot is "{}" — nothing collapsed — so the first paint matches
 * the server and the stored choice is applied on hydration.
 */

const KEY = "ys-myys-collapsed";

/** Cached so getSnapshot returns an identical string between renders. */
let cache: string | null = null;
const listeners = new Set<() => void>();

function readSnapshot(): string {
  if (cache !== null) return cache;
  try {
    cache = localStorage.getItem(KEY) ?? "{}";
  } catch {
    cache = "{}";
  }
  return cache;
}

function emit() {
  for (const l of listeners) l();
}

function write(next: string) {
  cache = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // Private mode or quota: the in-memory choice still applies for this page.
  }
  emit();
}

function subscribe(listener: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    // Another tab changed it; drop the cache so we read their value.
    cache = null;
    listener();
  };
  listeners.add(listener);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function parse(raw: string): Record<string, boolean> {
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? (v as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

export function useCollapsedGroups(): [Record<string, boolean>, (title: string) => void] {
  const raw = useSyncExternalStore(subscribe, readSnapshot, () => "{}");
  const toggle = useCallback((title: string) => {
    const next = { ...parse(readSnapshot()), [title]: !parse(readSnapshot())[title] };
    write(JSON.stringify(next));
  }, []);
  return [parse(raw), toggle];
}