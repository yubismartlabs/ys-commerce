"use client";

import { useSyncExternalStore } from "react";

/** No-op subscription: this hook only needs a mount/unmount-stable identity. */
const subscribe = () => () => {};

/**
 * False during SSR and the first client render, true afterwards.
 *
 * Zustand's `persist` rehydrates from localStorage *after* the first render, so
 * any component that branches on persisted state (e.g. "is the cart empty?")
 * must not branch on it during SSR — the server would render the empty state
 * and the client the populated one, producing a hydration mismatch plus a
 * visible flash. Gate on this instead.
 *
 * `useSyncExternalStore` is used rather than the usual `useEffect`+`useState`
 * because the latter trips react-hooks/set-state-in-effect and forces an extra
 * render pass. The server snapshot guarantees the hydration-safe first paint.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true, // client snapshot after hydration
    () => false, // server snapshot
  );
}
