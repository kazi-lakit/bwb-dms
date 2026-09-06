import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { existsSync, readFileSync } from "node:fs";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const host = env.VITE_BLOCKS_DEV_HOST || "localhost";
  const port = Number(env.VITE_BLOCKS_DEV_PORT) || 5173;
  const keyPath = new URL("./.cert/dev-key.pem", import.meta.url);
  const certPath = new URL("./.cert/dev-cert.pem", import.meta.url);
  const hasCertificate = existsSync(keyPath) && existsSync(certPath);
  // Lets an existing Next-era `.env.local` keep working during the migration. Only
  // browser-safe values are exposed; OIDC client secrets are deliberately omitted.
  const publicEnv = {
    VITE_BLOCKS_API_URL: env.VITE_BLOCKS_API_URL || env.NEXT_PUBLIC_BLOCKS_API_URL || env.BLOCKS_API_URL,
    VITE_BLOCKS_PROJECT_KEY: env.VITE_BLOCKS_PROJECT_KEY || env.NEXT_PUBLIC_BLOCKS_PROJECT_KEY || env.BLOCKS_PROJECT_KEY,
    VITE_BLOCKS_APP_DOMAIN: env.VITE_BLOCKS_APP_DOMAIN || host,
    VITE_BLOCKS_OIDC_CLIENT_ID: env.VITE_BLOCKS_OIDC_CLIENT_ID || env.BLOCKS_OIDC_CLIENT_ID,
    VITE_BLOCKS_OIDC_URL: env.VITE_BLOCKS_OIDC_URL || env.BLOCKS_API_URL,
    VITE_BLOCKS_OIDC_SCOPE: env.VITE_BLOCKS_OIDC_SCOPE || "openid profile",
    VITE_BLOCKS_STORAGE_MODE: env.VITE_BLOCKS_STORAGE_MODE || env.NEXT_PUBLIC_BLOCKS_STORAGE_MODE,
    VITE_BLOCKS_STORAGE_API_URL: env.VITE_BLOCKS_STORAGE_API_URL || env.NEXT_PUBLIC_BLOCKS_STORAGE_API_URL,
  };

  return {
    plugins: [react()],
    resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
    define: Object.fromEntries(Object.entries(publicEnv).map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)])),
    server: {
      host: true,
      port,
      strictPort: true,
      https: hasCertificate ? { key: readFileSync(keyPath), cert: readFileSync(certPath) } : undefined,
      allowedHosts: host === "localhost" ? undefined : [host],
      ws: {
        host,
        port,
        clientPort: port,
        protocol: hasCertificate ? "wss" : "ws",
      },
    },
  };
});
