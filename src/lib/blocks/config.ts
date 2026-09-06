export const blocksConfig = {
  apiUrl: import.meta.env.VITE_BLOCKS_API_URL!,
  appDomain: import.meta.env.VITE_BLOCKS_APP_DOMAIN,
  projectKey: import.meta.env.VITE_BLOCKS_PROJECT_KEY!,
  oidc: {
    clientId: import.meta.env.VITE_BLOCKS_OIDC_CLIENT_ID!,
    url: import.meta.env.VITE_BLOCKS_OIDC_URL!,
    scope: import.meta.env.VITE_BLOCKS_OIDC_SCOPE || "openid profile",
  },
};

export const BLOCKS_API_URL = blocksConfig.apiUrl;
export const BLOCKS_PROJECT_KEY = blocksConfig.projectKey;

/**
 * The DMS/storage service (`/files/*`, `/directory/*`, `/objects/*`) has two homes for
 * this project:
 *  - "local" — a standalone local instance (`VITE_BLOCKS_STORAGE_API_URL`,
 *    default `http://localhost:9000`), base path `/api`.
 *  - "live" — fronted by the main Blocks gateway, same host as IAM
 *    (`VITE_BLOCKS_API_URL`), base path `/data/v4`.
 * Toggle with `VITE_BLOCKS_STORAGE_MODE` — defaults to "local".
 */
const STORAGE_MODE = import.meta.env.VITE_BLOCKS_STORAGE_MODE === "live" ? "live" : "local";

export const BLOCKS_STORAGE_API_URL =
  STORAGE_MODE === "live" ? BLOCKS_API_URL : import.meta.env.VITE_BLOCKS_STORAGE_API_URL || "http://localhost:9000";

export const BLOCKS_STORAGE_BASE_PATH = STORAGE_MODE === "live" ? "/data/v4" : "/api";
