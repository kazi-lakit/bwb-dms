# Vault — document management on SELISE Blocks

Vault is a React 19 single-page document-management application built with Vite.
It provides personal drives, sharing, trash, file versions, and account activation
on SELISE Blocks.

## Architecture

- The app uses the cookie-backed Blocks hosted OIDC flow from `beef-app-react`.
  `src/lib/blocks/client.ts` owns the one SDK client; `auth.ts` starts hosted login
  and completes the `/login/callback` browser route. No access or refresh token is
  stored in localStorage, sessionStorage, or a custom app cookie.
- `AuthProvider` validates the IAM session cookie through Blocks. A protected request
  retries once on a 401; if it still fails, the app returns to `/login`.
- Standard Blocks requests use the SDK HTTP client. Storage-specific DMS endpoints
  use the same credential-including request policy in `blocksFilesFetch`.
- The frontend talks directly to Blocks; there are no Next.js route handlers or a
  local auth backend.

## Setup

Create `.env.local` with the public browser configuration:

```bash
VITE_BLOCKS_API_URL=https://blocksapi.dev.slsblx.com
VITE_BLOCKS_PROJECT_KEY=<project tenant key>
VITE_BLOCKS_APP_DOMAIN=<your app domain>
VITE_BLOCKS_OIDC_CLIENT_ID=<public OIDC client id>
VITE_BLOCKS_OIDC_URL=<OIDC authority URL>
VITE_BLOCKS_OIDC_SCOPE=openid profile

# HTTPS local development
VITE_BLOCKS_DEV_HOST=dntdxj.dev.slsblx.com
VITE_BLOCKS_DEV_PORT=5173

# DMS storage: "local" (default) or "live"
VITE_BLOCKS_STORAGE_MODE=local
VITE_BLOCKS_STORAGE_API_URL=http://localhost:9000
```

Register `https://dntdxj.dev.slsblx.com:5173/login/callback` (and each deployed app
callback) on the Blocks OIDC client. Add `127.0.0.1 dntdxj.dev.slsblx.com` to your
hosts file, then create the local certificate before starting the app.

```bash
npm install
npm run cert
npm run dev:https
npm run build
```

## Structure

```text
src/App.tsx                 router and protected application shell
src/pages/                  login, callback, and activation pages
src/lib/blocks/client.ts    configured Blocks SDK client
src/lib/blocks/auth.ts      hosted OIDC, logout, and 401 handling
src/lib/blocks/http.ts      Blocks and DMS request helpers
src/components/             drive UI, providers, and controls
```
