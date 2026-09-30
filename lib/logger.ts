/**
 * Structured logging.
 *
 * Replaces ad-hoc `console.log` for anything operational. Emits one JSON object
 * per line, which is what log shippers and error trackers can actually parse —
 * a sentence with values interpolated into it is not machine-readable, so a
 * dashboard cannot reliably filter or aggregate on it.
 *
 * Deliberately dependency-free. A logging library is a fine thing to want and
 * also a supply-chain surface on the request path; this is small enough to own.
 */

type Level = "debug" | "info" | "warn" | "error";

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function threshold(): number {
  const raw = (process.env.LOG_LEVEL ?? "info").toLowerCase() as Level;
  return LEVELS[raw] ?? LEVELS.info;
}

export type Fields = Record<string, unknown>;

function emit(level: Level, message: string, fields?: Fields) {
  if (LEVELS[level] < threshold()) return;

  // Errors carry a stack; pass the object itself to get one, and let JSON
  // serialization keep whatever enumerable detail it has.
  const record = {
    level,
    time: new Date().toISOString(),
    msg: message,
    ...(fields ?? {}),
  };

  const line = JSON.stringify(record, (_k, v) => {
    if (v instanceof Error) return { name: v.name, message: v.message, stack: v.stack };
    return v;
  });

  // Warnings and errors go to stderr so a platform can separate them.
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  debug: (msg: string, fields?: Fields) => emit("debug", msg, fields),
  info: (msg: string, fields?: Fields) => emit("info", msg, fields),
  warn: (msg: string, fields?: Fields) => emit("warn", msg, fields),
  error: (msg: string, fields?: Fields) => emit("error", msg, fields),

  /**
   * Wrap a request handler so an unexpected throw is logged with its context
   * before it propagates. Without this, an unhandled route error surfaces as a
   * bare stack trace with no request id, path, or user to correlate against.
   */
  async request<T>(req: Request, run: () => Promise<T>): Promise<T> {
    const startedAt = Date.now();
    const url = new URL(req.url);
    const context: Fields = { method: req.method, path: url.pathname };
    try {
      const result = await run();
      const status = result instanceof Response ? result.status : undefined;
      log.info("request", { ...context, status, durationMs: Date.now() - startedAt });
      return result;
    } catch (e) {
      log.error("request failed", { ...context, durationMs: Date.now() - startedAt, err: e });
      throw e;
    }
  },
};
