# Hanabi — Hobby Tracker (PRD)

## Problem Statement (original)
> i want to make a website where people can track their hobbies. Eg: kdramas, thai BLs, mangas, animes, books and can add more and remove any if they want. So it should be able to employ my current extension called hanabi so that it's easy for the extension to be in the background and scan the screen and ask questions. Example: I'm watching 'Weak Hero' 'Season 1' then the extension must pop a question asking whether it wants me to add weak hero to the list of kdramas I'm watching and then if it sees that I am on episode 2 then it should add that too. Overall for user experience, it should be sleek and super cool animated one. The user should be able to theme the website themselves but we need to have our own big theme library.

## User Choices
- Auth: email/password (JWT cookie)
- Extension: user already has Hanabi extension → website exposes API key + REST endpoint
- Theme library: generous (14 themes)
- Pre-seed categories: K-Dramas, Thai BLs, Anime, Manga, Books
- Metadata: free public APIs (Jikan + Open Library)

## Architecture
- **Backend**: FastAPI + MongoDB (motor). JWT auth in httpOnly cookies + Authorization Bearer for clients. Hashed API keys (SHA-256) for extension via `X-API-Key`.
- **Frontend**: React + Tailwind + shadcn/ui + Framer-ready, themed via CSS variables on `<html class="theme-…">`. Cabinet Grotesk (display) + Figtree (body). 14 themes.
- **Extension contract**: `POST /api/extension/scan` with `X-API-Key` → creates pending Suggestion; user accepts/rejects from in-app Hanabi Inbox.

## Implemented (v1 — 2026-02)
- Email/password auth (register/login/logout/me/theme) with 7-day cookie
- 5 default categories auto-seeded per user; add/delete custom categories
- Titles: CRUD with status (watching/completed/plan/on_hold/dropped), progress, season, rating, notes, cover_url
- Dashboard stats bento + recent updated grid
- Category page with status filters + search
- Metadata search (Jikan anime/manga, Open Library books) integrated into Add Title dialog
- Hanabi Inbox (slide-over sheet) — list, accept (creates/updates title), reject
- API keys management — generate (revealed once), list, revoke
- Extension endpoints: `/api/extension/ping`, `/api/extension/scan` with category hint mapping
- 14 themes: Tokyo Twilight (default), Sakura, Matcha, Midnight Cyber, Vaporwave, Monochrome, Dracula, Honey, Ember, Forest, Arctic, Mocha, Stardust, Studio Sky
- Theme persistence per user (server) + localStorage fallback
- Sonner toasts, sidebar with pending-suggestion badge

## Backlog
### P1
- OAuth/Google sign-in (in addition to email/password)
- Auto-add policies (skip inbox if confidence high)
- Bulk import (MAL/AniList/Goodreads) into a category
- Per-category statistics + hours watched estimate
- Activity timeline page

### P2
- Public profile pages / shareable lists
- Friends & cross-recs
- Mobile PWA install + native share target
- Custom theme builder (pick accent + radius + font)
- Tags, favorites, smart lists

## Test Credentials
- Admin: `admin@hanabi.app` / `hanabi123` (auto-seeded)
- See `/app/memory/test_credentials.md`
