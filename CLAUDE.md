# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Hanabi — a hobby/media tracker for K-dramas, Thai BLs, anime, manga, and books. Three independent parts:

- `frontend/` — React 19 SPA (the web app), deployed to Netlify.
- `supabase/` — the entire backend: Postgres schema (migrations), RLS policies, RPCs/triggers, and Edge Functions.
- `extension/` — a Manifest V3 browser extension that auto-tracks what you watch/read.

There is **no application server**. The old FastAPI + MongoDB backend (`backend/server.py`) was deleted; the frontend talks to Supabase directly via `@supabase/supabase-js`, and external catalogue lookups happen client-side. Ignore the `tests/`, `test_result.md`, and `*_testing.md` files — they are leftovers from the Emergent platform's testing protocol, not the current backend.

## Commands

Frontend (run from `frontend/`, package manager is **yarn 1.x**):

```bash
yarn install
yarn start      # craco dev server on http://localhost:3000
yarn build      # production build into frontend/build/
yarn test       # craco test (CRA/Jest); no app test suite is written yet
```

`frontend/.env` (gitignored) is required for the app to talk to Supabase:

```
REACT_APP_SUPABASE_URL=https://yupganesyypaqhirgmbi.supabase.co
REACT_APP_SUPABASE_ANON_KEY=sb_publishable_...   # publishable/anon key, safe to expose; RLS enforces access
```

Supabase project ref: `yupganesyypaqhirgmbi` (config in `supabase/config.toml`). Schema changes are SQL migrations under `supabase/migrations/` (timestamped); apply them via the Supabase MCP tools or the `supabase` CLI. Always `list_tables` / read existing migrations before changing schema.

## Architecture

### Data flow

The frontend never hand-writes Supabase queries in components. **All data access goes through `frontend/src/lib/db.js`** — categories, titles, links, suggestions, API keys, the `get_stats` RPC, AniList import, and public-profile reads. Components import functions from `db.js`; if you need a new query, add it there.

- `frontend/src/lib/supabase.js` exports **two clients**: `supabase` (carries the user session) and `supabasePublic` (session-less, runs as the `anon` role for public `/u/:username` pages). `supabasePublic` MUST keep its distinct `storageKey` — two GoTrue clients sharing a storage key corrupt the auth lock and break sign-in.
- `frontend/src/lib/metadata.js` does client-side metadata search/detail against external catalogues (Jikan, TVmaze, OpenLibrary, AniList). `db.js` calls into it to enrich titles on create/refresh.
- Auth state lives in `frontend/src/context/AuthContext.jsx`; theming/appearance in `ThemeContext.jsx`. Email/password auth only — **Google OAuth was intentionally removed**.

### Database & security

Tables: `profiles, categories, titles, category_links, suggestions, activity, api_keys`. RLS scopes every row to its owner (inserts must carry `user_id`). A `handle_new_user` trigger seeds a profile + 5 default categories on signup. `get_stats()` and `create_api_key()` are RPCs. Activity logging that the old server did is now replicated best-effort inside `db.js`.

**Column-grant gotcha (see migration `20260609182050`):** Supabase's default privileges grant `anon`+`authenticated` full-column SELECT, which silently defeats column-level GRANTs. To hide a column (e.g. private `notes` on public profiles) you must `revoke select` first, then re-grant the allowed columns. Public reads are served to the `anon` role only; `db.js` uses `PUBLIC_TITLE_COLS` (no `notes`) for public queries.

`titles` is in the realtime publication (migration `20260615120000`) — the app subscribes so progress updates (e.g. extension auto-advance) reflect live in the UI without a refresh. `db.js` also dispatches a `hanabi:library-changed` window event so the sidebar can re-count without a round-trip.

### Edge Functions (`supabase/functions/`)

- `extension` — the browser-extension ingestion endpoint. Authenticates by a per-user `X-API-Key` (`hnb_…`) instead of a Supabase JWT, so `verify_jwt = false` in `config.toml`. Submissions become `suggestions` (the inbox); ping at `GET .../functions/v1/extension/ping`.
- `detect-image` — **currently a stub** (`verify_jwt = true`); reimplementing image detection with a real LLM key is a TODO.

### Frontend conventions

- Build is **CRA + craco** (`craco.config.js`), not Vite. The `@/` import alias maps to `frontend/src/`.
- UI is **shadcn/ui** primitives (Radix + Tailwind) under `frontend/src/components/ui/`, styled with Tailwind (`tailwind.config.js`). `components.json` configures shadcn. Toasts use `sonner`.
- Routing is `react-router-dom` v7 in `App.js`: a `ProtectedLayout` (redirects to `/login` when signed out) wraps the app pages; `/u/:username` public-profile routes are outside it. Netlify rewrites all paths to `index.html` for SPA deep links (`netlify.toml`).
- Animation/companions: there's a whole ambient-visuals layer (`framer-motion`, `Companions`, `SootSprites`, `Fireflies`, `AmbientBackground`) driven by `lib/motion.js` and `data/motion.js` / `data/styles.js` / `data/themes.js`. These are decorative and self-contained.

### Extension (`extension/`)

Plain Manifest V3, **no build step** — load the folder unpacked in `chrome://extensions`. Per-site content scripts (`content/crunchyroll.js`, `hianime.js`, `mangadex.js`, `netflix.js`, etc.) detect what's playing → `background.js` service worker → `POST` to the `extension` Edge Function with the user's `X-API-Key`. The Supabase URL and web-app URL (`https://hana-bi.netlify.app`) are hardcoded in `extension/lib/config.js`. To support a new site, add a content script and register its match in `manifest.json` (`content_scripts` + `host_permissions`).
