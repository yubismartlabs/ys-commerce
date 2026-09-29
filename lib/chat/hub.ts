// In-memory SSE fan-out. Single-instance only (dev / single replica):
// every app server holds its own hub, so sticky sessions or an external
// bus (Redis) is required before horizontal scaling.
export type HubEvent = { type: string; [k: string]: unknown };

const hubs = new Map<string, Set<ReadableStreamDefaultController>>();

export function subscribe(conversationId: string, controller: ReadableStreamDefaultController): () => void {
  let set = hubs.get(conversationId);
  if (!set) {
    set = new Set();
    hubs.set(conversationId, set);
  }
  set.add(controller);
  return () => {
    set!.delete(controller);
    if (set!.size === 0) hubs.delete(conversationId);
  };
}

export function publish(conversationId: string, event: HubEvent): void {
  const set = hubs.get(conversationId);
  if (!set || set.size === 0) return;
  const payload = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
  for (const c of set) {
    try {
      c.enqueue(payload);
    } catch {
      set.delete(c);
    }
  }
}

// Simple per-user rate limiter (30 events/min) for message + typing POSTs.
const hits = new Map<string, number[]>();

export function rateLimited(key: string, max = 30, windowMs = 60000): boolean {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) {
    hits.set(key, arr);
    return true;
  }
  arr.push(now);
  hits.set(key, arr);
  if (hits.size > 10000) hits.clear();
  return false;
}
