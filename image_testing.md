# Image Detection Testing Playbook

## TEST AGENT PROMPT – IMAGE INTEGRATION RULES
Follow these rules exactly. Do not overcomplicate.

### Image Handling Rules
- Always use base64-encoded images for all tests and requests.
- Accepted formats: JPEG, PNG, WEBP only.
- Do not use SVG, BMP, HEIC, or other formats.
- Do not upload blank, solid-color, or uniform-variance images.
- Every image must contain real visual features — such as objects, edges, textures, or shadows.
- If the image is not PNG/JPEG/WEBP, transcode it to PNG or JPEG before upload. Always re-detect and update the MIME after transformations.
- If the image is animated (e.g., GIF, APNG, WEBP animation), extract the first frame only.
- Resize large images to reasonable bounds (avoid oversized payloads).

## Endpoint under test
`POST /api/detect/image` (auth required)
- multipart/form-data with field `image` (jpg/png/webp, up to 5MB)
- Returns JSON: `{ title, type, characters, confident, raw, ... }`
  - `title` (str) — show/book name
  - `type` (str) — one of: anime, kdrama, thai-bl, manga, book, tv, unknown
  - `characters` (list[str]) — visible characters/actors
  - `confident` (bool) — model's own confidence that title + characters match
  - `synopsis` (optional str) — short context line
- Model used: openai/gpt-5.4 (vision)

## Smoke test
1. Send a small JPEG of a clearly recognisable show (e.g. a screenshot of Squid Game subtitles + Player 456).
2. Expect HTTP 200 + JSON with title resembling "Squid Game", type ∈ {kdrama, tv}, confident=true.
3. Send a blank white PNG → response should still parse, with confident=false.
