import type {
  BaseRecord,
  CreateParams,
  CreateResponse,
  DataProvider,
  DeleteOneParams,
  DeleteOneResponse,
  GetListParams,
  GetListResponse,
  GetOneParams,
  GetOneResponse,
  HttpError,
  UpdateParams,
  UpdateResponse,
} from "@refinedev/core";

/**
 * Refine DataProvider backed by our versioned REST API (/api/v1/admin/*).
 *
 * Conventions:
 * - list:  ?page=&pageSize=&status=&q=  -> { data, pagination: { total } }
 * - errors: { error: { code, message } } -> Refine HttpError
 * - create/update/delete only exist for coupons; other resources use bespoke pages
 */

const API = "/api/v1/admin";

const resourcePath: Record<string, string> = {
  vendors: "vendors",
  products: "products",
  orders: "orders",
  disputes: "disputes",
  coupons: "coupons",
  notifications: "notifications",
  emails: "emails",
};

function pathFor(resource: string): string {
  const p = resourcePath[resource];
  if (!p) throw { message: `No API mapping for resource "${resource}"`, statusCode: 500 } as HttpError;
  return `${API}/${p}`;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw {
      message: json?.error?.message ?? `Request failed (${res.status})`,
      statusCode: res.status,
    } as HttpError;
  }
  return (json?.data ?? json) as T;
}

const notAllowed = (op: string, resource: string): HttpError =>
  ({ message: `${op} is not supported for "${resource}"`, statusCode: 405 }) as HttpError;

export const dataProvider: DataProvider = {
  getApiUrl: () => API,

  getList: async <TData extends BaseRecord = BaseRecord>({
    resource,
    pagination,
    filters,
  }: GetListParams): Promise<GetListResponse<TData>> => {
    const params = new URLSearchParams();
    params.set("page", String(pagination?.currentPage ?? 1));
    params.set("pageSize", String(pagination?.pageSize ?? 20));
    for (const f of filters ?? []) {
      if (!("field" in f)) continue;
      if (f.operator === "eq" && f.value !== undefined && f.value !== "") {
        params.set(f.field, String(f.value));
      }
      if (f.operator === "contains" && f.field === "q" && f.value) {
        params.set("q", String(f.value));
      }
    }
    const res = await fetch(`${pathFor(resource)}?${params.toString()}`);
    const raw = await res.json().catch(() => null);
    if (!res.ok) {
      throw {
        message: raw?.error?.message ?? `Request failed (${res.status})`,
        statusCode: res.status,
      } as HttpError;
    }
    return { data: raw.data as TData[], total: raw.pagination?.total ?? raw.data.length };
  },

  getOne: async <TData extends BaseRecord = BaseRecord>({
    resource,
    id,
  }: GetOneParams): Promise<GetOneResponse<TData>> => {
    const data = await request<TData>(`${pathFor(resource)}/${id}`);
    return { data };
  },

  update: async <TData extends BaseRecord = BaseRecord, TVariables = object>({
    resource,
    id,
    variables,
  }: UpdateParams<TVariables>): Promise<UpdateResponse<TData>> => {
    const data = await request<TData>(`${pathFor(resource)}/${id}`, {
      method: "PATCH",
      body: JSON.stringify(variables),
    });
    return { data };
  },

  create: async <TData extends BaseRecord = BaseRecord, TVariables = object>({
    resource,
    variables,
  }: CreateParams<TVariables>): Promise<CreateResponse<TData>> => {
    if (resource !== "coupons") throw notAllowed("Create", resource);
    const data = await request<TData>(pathFor(resource), {
      method: "POST",
      body: JSON.stringify(variables),
    });
    return { data };
  },

  deleteOne: async <TData extends BaseRecord = BaseRecord, TVariables = object>({
    resource,
    id,
  }: DeleteOneParams<TVariables>): Promise<DeleteOneResponse<TData>> => {
    if (resource !== "coupons") throw notAllowed("Delete", resource);
    const res = await fetch(`${pathFor(resource)}/${id}`, { method: "DELETE" });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      throw {
        message: json?.error?.message ?? `Request failed (${res.status})`,
        statusCode: res.status,
      } as HttpError;
    }
    return { data: { id } as TData };
  },
};
