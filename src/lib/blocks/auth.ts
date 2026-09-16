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

/**
 * Refreshes the cookie-backed IAM session via the OIDC token endpoint. The hosted IdP flow
 * (`startLogin`/`completeLogin` above) has IAM set both the access and refresh token as
 * Secure, httpOnly cookies — this app never sees either token string, matching AGENTS.md's
 * "do not persist Blocks tokens in browser storage." `credentials: "include"` (baked into
 * every SDK request) sends the existing httpOnly refresh-token cookie to IAM; on success IAM
 * replaces the httpOnly access-token cookie via `Set-Cookie` on the response, so nothing here
 * needs to read or store the new token either. Resolves `false` — without throwing — if the
 * refresh token is itself missing, expired, or revoked; that's the caller's cue to log out
 * rather than retry.
 *
 * `refreshInFlight` dedupes concurrent 401s (e.g. several requests racing on an expired
 * access token) behind a single refresh call instead of one per caller.
 */
let refreshInFlight: Promise<boolean> | null = null;
function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = blocksClient.auth.oidc
      .refreshToken()
      .then((response) => !response.error && Boolean(response.access_token ?? response.accessToken))
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

function is401(error: unknown): boolean {
  return error instanceof Error && "status" in error && (error as { status?: number }).status === 401;
}

/**
 * Wraps a Blocks API call so an expired access token is recovered transparently: on a 401,
 * mint a new access token from the refresh token (`refreshSession` above) and retry the call
 * once. If the refresh token has also expired/is invalid, or the retried call still 401s, the
 * session is unrecoverable — dispatch `SESSION_EXPIRED_EVENT` so `AuthProvider` logs the user
 * out (see its listener), and surface the original error to the caller.
 */
export async function withSessionRefresh<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (!is401(error)) throw error;

    if (!(await refreshSession())) {
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
      throw error;
    }

    try {
      return await fn();
    } catch (retryError) {
      if (is401(retryError)) window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
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
