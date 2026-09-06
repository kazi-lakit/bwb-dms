import { BLOCKS_API_URL, BLOCKS_PROJECT_KEY, BLOCKS_STORAGE_API_URL, BLOCKS_STORAGE_BASE_PATH } from "./config";
import { blocksClient } from "./client";
import { withSessionRefresh } from "./auth";
import { toast } from "@/lib/toast-store";

export class BlocksApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown) {
    super(`Blocks API error ${status}`);
    this.status = status;
    this.body = body;
  }
}

function extractErrorMessage(errors: unknown): string {
  if (Array.isArray(errors)) {
    return errors.filter((e) => typeof e === "string").join("; ");
  }
  if (errors && typeof errors === "object") {
    return Object.entries(errors as Record<string, unknown>)
      .filter(([, value]) => typeof value === "string" && value.length > 0)
      .map(([key, value]) => `${key}: ${value as string}`)
      .join("; ");
  }
  return "";
}

/**
 * Many Blocks responses are HTTP 200 but carry a business-level failure —
 * `{isSuccess:false, errors:{...}}` (e.g. `/files/get-file` returning `{"access":
 * "forbidden"}` with every data field null). `!res.ok` never catches this since the
 * HTTP status is fine. Surface it as a toast and throw so callers see it as a failure
 * too, instead of quietly getting a body full of nulls.
 */
function assertBusinessSuccess(body: unknown): void {
  if (!body || typeof body !== "object") return;
  const { isSuccess, errors } = body as { isSuccess?: boolean; errors?: unknown };
  if (isSuccess !== false) return;
  const message = extractErrorMessage(errors) || "Something went wrong.";
  toast.error(message);
  throw new BlocksApiError(200, errors);
}

/**
 * Calls a Blocks gateway route through the shared SDK. The browser carries the HttpOnly
 * IAM cookie; the SDK adds `x-blocks-key` and includes credentials on every request.
 */
export async function blocksFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const body = await withSessionRefresh(() => blocksClient.http.request<T>(path, {
    method: init.method,
    body: init.body ? JSON.parse(init.body as string) : undefined,
    headers: init.headers,
    auth: true,
  }));
  assertBusinessSuccess(body);
  return body;
}

/**
 * Same as blocksFetch, but for the DMS `/files/*`, `/directory/*`, and `/objects/*`
 * routes, which return flat bodies. Host and base path switch together via
 * `VITE_BLOCKS_STORAGE_MODE` (see config.ts): "local" hits a standalone instance
 * at `BLOCKS_STORAGE_API_URL` under `/api`; "live" hits the main Blocks gateway under
 * `/data/v4`, same host as IAM.
 */
export async function blocksFilesFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const body = await withSessionRefresh(async () => {
    const res = await fetch(`${BLOCKS_STORAGE_API_URL}${BLOCKS_STORAGE_BASE_PATH}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        "x-blocks-key": BLOCKS_PROJECT_KEY,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });
    if (!res.ok) throw new BlocksApiError(res.status, await res.json().catch(() => null));
    return res.json() as Promise<T>;
  });
  assertBusinessSuccess(body);
  return body;
}

/**
 * The Data Gateway (`/data/v4/gateway`) — one endpoint, standard GraphQL body
 * `{ query, variables }`. Same host as the rest of the Blocks API (`BLOCKS_API_URL`),
 * not the local storage service. Used for the BlxDrive schema (blocks-data-gateway-crud).
 */
export async function blocksGatewayFetch<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const body = await blocksFetch<{ data?: T; errors?: { message: string }[] }>("/data/v4/gateway", {
    method: "POST",
    body: JSON.stringify({ query, variables }),
  });
  if (body.errors?.length) {
    throw new BlocksApiError(200, body.errors);
  }
  return body.data as T;
}
