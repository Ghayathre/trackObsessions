# Hanabi Auth Testing Playbook

## Authentication modes supported
1. **Email/password** (JWT in httpOnly `access_token` cookie). Admin auto-seeded:
   - email: `admin@hanabi.app`
   - password: `hanabi123`
2. **Emergent Google OAuth** (also issues the same `access_token` cookie via
   `POST /api/auth/google/session`). Frontend hits
   `https://auth.emergentagent.com/?redirect=<window.location.origin>/auth/callback`,
   then `/auth/callback` (or the synchronous AppRoutes check for `#session_id=`)
   exchanges the `session_id` for our cookie.

## Verifying email/password
```bash
curl -c /tmp/c.txt -X POST $BASE/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@hanabi.app","password":"hanabi123"}'
curl -b /tmp/c.txt $BASE/api/auth/me
```

## Verifying Google OAuth path (mock)
The Google session-data call goes to:
`GET https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data`
with header `X-Session-ID: <id>`. In tests, you can mock this with a recorded
session response, or do a smoke test that:
  1. POSTs `/api/auth/google/session` with `{ "session_id": "invalid" }` → expect 401.
  2. Verifies that on success the `access_token` cookie is set and `/api/auth/me`
     returns a user with `google_linked: true`.

## Frontend selectors
- `data-testid="login-google"` and `data-testid="register-google"` open Emergent OAuth.
- `/auth/callback` handles the redirect and `#session_id=` fragment.
- `AuthCallback` uses a `useRef` flag to avoid double-processing under StrictMode.

## Files of interest
- Backend route: `POST /api/auth/google/session` in `/app/backend/server.py`.
- Frontend page: `/app/frontend/src/pages/AuthCallback.jsx`.
- Synchronous fragment trap: `AppRoutes()` in `/app/frontend/src/App.js`.
- AuthContext skip-/me when hash has `session_id=`: `/app/frontend/src/context/AuthContext.jsx`.
