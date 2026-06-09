# Hanabi Browser Extension

Auto-tracks what you watch and read and pushes it to your Hanabi inbox.
Built as a plain **Manifest V3** extension — no build step, load it directly.

## How it connects to the web app

The extension talks to the Hanabi Supabase **`extension` Edge Function**:

```
POST https://yupganesyypaqhirgmbi.supabase.co/functions/v1/extension      → submit a detection
GET  https://yupganesyypaqhirgmbi.supabase.co/functions/v1/extension/ping  → verify the key
```

Auth is a per-user API key (`hnb_…`) sent in the `X-API-Key` header. The function
runs with `verify_jwt=false`, so no Supabase session/JWT is needed — just the key.

Detections become **suggestions** in your Hanabi inbox. If you turn on
**Auto-accept** in the web app's Settings *and* the title is confidently
classified, it's added to your collection automatically.

## Install (load unpacked)

1. Open `chrome://extensions` (or `edge://extensions`).
2. Enable **Developer mode**.
3. Click **Load unpacked** and select this `extension/` folder.

## Get your API key

1. Open the Hanabi web app → **Settings**.
2. Under **Hanabi extension keys**, click **Generate key** and copy the `hnb_…` value
   (shown once).
3. Click the Hanabi extension icon → paste the key → **Connect**.

The popup also has an **Auto-track** toggle: ON pushes titles instantly as you
browse; OFF shows a `+` badge and lets you confirm each one from the popup.

## Supported sites

| Site | Category |
|------|----------|
| Crunchyroll | Anime |
| HiAnime / Aniwatch | Anime |
| MangaDex | Manga |
| Mangago | Manga |
| Webtoons | Manga |
| DramaCool | K-Dramas |
| KissKH | K-Dramas (reclassify if needed) |
| Goodreads | Books |
| Netflix | Uncategorized — classify in the inbox |

## Structure

```
manifest.json        MV3 manifest
background.js         Service worker — receives detections, calls the API, badges the icon
popup.html/.css/.js   Key setup, connection status, auto-track toggle, confirm detections
lib/config.js         Endpoint + chrome.storage settings
lib/api.js            ping() / scan() against the Edge Function
content/common.js     Shared detector helpers (window.__hanabi)
content/<site>.js     Per-site title/episode/chapter detectors
```

Site detectors are best-effort DOM scrapers; if a site changes its markup,
tweak the selectors in the matching `content/<site>.js`.
