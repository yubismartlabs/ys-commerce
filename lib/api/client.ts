/**
 * Typed client fetch helpers.
 *
 * Two problems this solves, both of which were spread across ~30 call sites:
 *  1. Pages did `if (!res.ok) throw new Error("Order not found.")`, so an
 *     expired session (401) was reported to the buyer as missing data.
 *  2. The server's actual `error.message` was discarded, so users saw generic
 *     copy ("Save failed.") instead of the reason the API gave.
 *
 * `ApiClientError.status` also lets the QueryClient retry policy recognise
 * client errors and stop hammering the API with doomed 4xx retries.
 */
export class ApiClientError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
  }

  /** True when the caller needs to (re-)authenticate. */
  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }
}

function defaultMessage(status: number): string {
  if (status === 401) return "Please sign in to continue.";
  if (status === 403) return "You don't have access to this.";
  if (status === 404) return "Not found.";
  if (status === 409) return "That conflicts with the current state.";
  if (status >= 500) return "Something went wrong on our side. Please retry.";
  return "Request failed.";
}

async function body(res: Response): Promise<{ data?: unknown; error?: { message?: string; code?: string } } | null> {
  return res.json().catch(() => null);
}

/** Read a standard `{ data }` envelope, throwing a typed error on failure. */
export async function readData<T>(res: Response): Promise<T> {
  const json = await body(res);
  if (!res.ok) {
    throw new ApiClientError(json?.error?.message ?? defaultMessage(res.status), res.status, json?.error?.code);
  }
  return json?.data as T;
}

/**
 * Read a full envelope (`{ data, pagination, meta }`). Use when the caller
 * needs pagination or facet metadata.
 */
export async function readEnvelope<T>(res: Response): Promise<{
  data: T;
  pagination?: { page: number; pageSize: number; total: number };
  meta?: Record<string, unknown>;
  [k: string]: unknown;
}> {
  const json = await body(res);
  if (!res.ok) {
    throw new ApiClientError(json?.error?.message ?? defaultMessage(res.status), res.status, json?.error?.code);
  }
  return (json ?? { data: null }) as { data: T };
}

/** GET + read `{ data }` in one call. */
export async function apiGet<T>(url: string, init?: RequestInit): Promise<T> {
  return readData<T>(await fetch(url, init));
}
