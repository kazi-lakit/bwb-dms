# Vault frontend

This is a Vite + React 19 single-page application. Use React Router for navigation
and the Blocks SDK/cookie-backed OIDC flow in `src/lib/blocks/`; do not add a local
authentication backend or persist Blocks tokens in browser storage.

## Deployment (Docker / Blocks OS)

The app builds and runs in a container via the standard Blocks OS convention
(same setup as `beef-app-react` — see its CLAUDE.md deployment notes).

- **`Dockerfile`** — multi-stage: a `node:22-alpine` builder stage runs `npm ci` then
  `npm run build:${ci_build}` (the `ci_build` build-arg selects the environment,
  e.g. `dev`), then copies the output into `nginxinc/nginx-unprivileged:1.29-alpine`,
  serving on port 8080 via `nginx.conf` (plain SPA config: gzip +
  `try_files $uri $uri/ /index.html`).
- Vite's default `dist/` output is what gets copied (`COPY --from=builder /app/dist`).
- **`set-env.cjs`** + `package.json`'s `build:dev`/`build:stg`/`build:prod` scripts:
  each sets `BUILD_ENV`, runs `set-env.cjs` (copies `.env.${BUILD_ENV}` to `.env`),
  then `tsc -b && vite build`. **Local-build caveat:** unlike beef-app-react (whose
  local env file is `.env`), this repo's local env file is `.env.local`, which Vite
  ranks *above* `.env` — so running `npm run build:dev` locally bakes your
  `.env.local` values, not `.env.dev`'s. The Docker build is unaffected
  (`.dockerignore` excludes `.env.local`); don't run `build:*` locally expecting
  deployed values.
- **`.env.dev`** is tracked in git (un-ignored in `.gitignore` alongside
  `.env.example`) so fresh CI checkouts can build. It still has a placeholder
  `VITE_BLOCKS_APP_DOMAIN` — replace it with the real deployed domain and register
  `https://<deployed-domain>/login/callback` as a redirect URI on the OIDC client
  before the first deploy. If updating via `blocks auth oidc-clients save`, resend
  every field — it replaces, not merges.
