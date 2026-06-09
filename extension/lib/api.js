// Thin client for the Hanabi `extension` Supabase Edge Function.
// Auth is by X-API-Key (the user's hnb_… key); the function runs with
// verify_jwt=false, so no Supabase anon key / JWT is required.
import { getSettings } from "./config.js";

async function request(path, { method = "GET", body } = {}) {
  const { apiKey, endpoint } = await getSettings();
  if (!apiKey) throw new Error("No API key set. Paste your Hanabi key in the popup.");

  const res = await fetch(endpoint + path, {
    method,
    headers: {
      "X-API-Key": apiKey,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON response */
  }
  if (!res.ok) {
    const msg = data?.detail || data?.error || `Request failed (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return data;
}

// Validates the API key and returns { ok, user: { id, email } }.
export function ping() {
  return request("/ping");
}

// Pushes a detected title. Returns { ok, suggestion_id, ... }.
// payload: { title, episode?, season?, chapter?, cover_url?, category_hint?, category_slug?, source_url? }
export function scan(payload) {
  return request("", { method: "POST", body: payload });
}
