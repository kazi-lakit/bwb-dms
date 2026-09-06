import { blocksClient } from "./client";

const RETURN_TO_KEY = "vault-return-to";
export const SESSION_EXPIRED_EVENT = "blocks:session-expired";

export function startLogin(returnTo = "/drive") {
  sessionStorage.setItem(RETURN_TO_KEY, returnTo);
  return blocksClient.auth.idp.redirectToProvider();
}

export async function completeLogin(callbackUrl: string) {
  const returnTo = sessionStorage.getItem(RETURN_TO_KEY) || "/drive";
  sessionStorage.removeItem(RETURN_TO_KEY);
  const result = await blocksClient.auth.idp.callback(callbackUrl);
  if (result?.error) return { ok: false, returnTo, message: result.error_description || result.error };
  return { ok: true, returnTo };
}

/** Retry once for a transient cookie propagation failure, then report an expired session. */
export async function withSessionRefresh<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (!(error instanceof Error && "status" in error && error.status === 401)) throw error;
    try {
      return await fn();
    } catch (retryError) {
      if (retryError instanceof Error && "status" in retryError && retryError.status === 401) {
        window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
      }
      throw retryError;
    }
  }
}

export async function endSession() {
  await blocksClient.auth.logout();
}

/**
 * This tenant's AuthController requires the wire-format `organization_id` rather
 * than the SDK convenience method's camelCase `organizationId` payload.
 */
export async function switchOrganizationSession(organizationId: string) {
  const response = await blocksClient.auth.json<Record<string, unknown>>("/iam/v4/auth/switch-org", {
    body: { organization_id: organizationId },
  });
  if (response.error || response.isSuccess === false || response.success === false) {
    const message = response.error_description || response.message || response.error;
    throw new Error(typeof message === "string" ? message : "Couldn't switch organization.");
  }
  return response;
}
