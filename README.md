# Hanabi — hobby tracker

Track K-dramas, Thai BLs, anime, manga, and books. React frontend on a **Supabase** backend
(Postgres + Row-Level Security + Supabase Auth + Edge Functions). The old FastAPI/MongoDB
backend has been removed.

## Architecture

- **Frontend** — React 19 (CRA + craco) in `frontend/`. Talks to Supabase directly via
  `@supabase/supabase-js`:
  - `src/lib/supabase.js` — the client (and a session-less `supabasePublic` for public pages).
  - `src/lib/db.js` — all data operations (categories, titles, suggestions, api keys, stats RPC,
    AniList import, public profiles).
  - `src/lib/metadata.js` — client-side metadata search/detail (Jikan / TVmaze / OpenLibrary).
- **Database** — Postgres, migrations in `supabase/migrations/` (applied to the project below).
  Tables: `profiles, categories, titles, category_links, suggestions, activity, api_keys`.
  RLS scopes every row to its owner; public-profile reads are served to the `anon` role only
  (notes are never exposed). `get_stats()` and `create_api_key()` are RPCs; a `handle_new_user`
  trigger seeds a profile + 5 default categories on signup.
- **Edge Functions** — `supabase/functions/`:
  - `extension` — browser-extension endpoint (X-API-Key auth, `verify_jwt = false`).
  - `detect-image` — currently a stub (TODO: reimplement with a dedicated LLM key).

## Supabase project

- Project ref: `yupganesyypaqhirgmbi` · URL: `https://yupganesyypaqhirgmbi.supabase.co`
- Region: `eu-west-2` · Org: Ghayathre's Org

## Frontend setup

```bash
cd frontend
corepack yarn install        # or: yarn install
corepack yarn start          # dev server on http://localhost:3000
```

Create `frontend/.env` (gitignored) with the publishable (anon) credentials — safe to expose,
RLS enforces access:

```
REACT_APP_SUPABASE_URL=https://yupganesyypaqhirgmbi.supabase.co
REACT_APP_SUPABASE_ANON_KEY=sb_publishable_w-x9VX-VQSmH7SGeYZqsCQ_8Uvtvb2X
```

## Auth notes

- Email/password only (Google OAuth was removed). To make registration log users in
  immediately, disable **Confirm email** in the Supabase dashboard
  (Authentication → Providers → Email). If it stays on, registration shows a
  "check your email" message and users sign in after confirming.

## Browser extension

The extension should POST scans to the Edge Function:

```
POST https://yupganesyypaqhirgmbi.supabase.co/functions/v1/extension
Header: X-API-Key: <key generated in Settings>
Body:   { title, category_hint?, season?, episode?, cover_url?, source_url? }
Ping:   GET .../functions/v1/extension/ping
```

(The extension's own repo must be updated to point at this URL.)
