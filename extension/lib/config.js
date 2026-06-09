// Central config + chrome.storage helpers shared by the popup and background worker.
// Content scripts do NOT import this — they only message the background worker,
// so the API key lives in exactly one place.

export const DEFAULT_ENDPOINT =
  "https://yupganesyypaqhirgmbi.supabase.co/functions/v1/extension";

// Where users generate their API key (Hanabi web app → Settings).
// The popup's "Open Hanabi Settings" button opens `${this}/settings`.
export const DEFAULT_WEB_APP_URL = "https://hana-bi.netlify.app";

const KEYS = {
  apiKey: "hanabi.apiKey",
  endpoint: "hanabi.endpoint",
  webAppUrl: "hanabi.webAppUrl",
  autoTrack: "hanabi.autoTrack",
  email: "hanabi.email",
};

export async function getSettings() {
  const v = await chrome.storage.local.get(Object.values(KEYS));
  return {
    apiKey: v[KEYS.apiKey] || "",
    endpoint: v[KEYS.endpoint] || DEFAULT_ENDPOINT,
    webAppUrl: v[KEYS.webAppUrl] || DEFAULT_WEB_APP_URL,
    autoTrack: v[KEYS.autoTrack] ?? false,
    email: v[KEYS.email] || "",
  };
}

export async function setSettings(patch) {
  const mapped = {};
  for (const [k, storageKey] of Object.entries(KEYS)) {
    if (k in patch) mapped[storageKey] = patch[k];
  }
  await chrome.storage.local.set(mapped);
}
