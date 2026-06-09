// Hanabi background service worker.
// - Receives detections from content scripts.
// - Auto-track ON  → pushes to Hanabi immediately.
// - Auto-track OFF → remembers the latest detection per tab and badges the icon;
//   the user confirms from the popup.
// - Serves popup requests (state, save key, test connection, scan now).
import { ping, scan } from "./lib/api.js";
import { getSettings, setSettings } from "./lib/config.js";

// tabId -> latest detection payload not yet pushed
const pending = new Map();

function setBadge(tabId, on) {
  if (typeof tabId !== "number") return;
  chrome.action.setBadgeBackgroundColor({ color: "#FB7185" }).catch(() => {});
  chrome.action.setBadgeText({ tabId, text: on ? "+" : "" }).catch(() => {});
}

function notify(title, message) {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icons/icon48.png",
    title,
    message,
  }).catch(() => {});
}

async function pushScan(payload) {
  const res = await scan(payload);
  return res;
}

async function handleDetected(payload, tabId) {
  if (!payload?.title) return;
  const { apiKey, autoTrack } = await getSettings();
  if (!apiKey) return; // not configured yet — stay quiet

  if (autoTrack) {
    try {
      await pushScan(payload);
      notify("Tracked in Hanabi", labelFor(payload));
    } catch (e) {
      notify("Hanabi: couldn't track", e.message || "Unknown error");
    }
  } else {
    pending.set(tabId, payload);
    setBadge(tabId, true);
  }
}

function labelFor(p) {
  const bits = [p.title];
  if (p.chapter != null) bits.push(`ch ${p.chapter}`);
  else if (p.episode != null) bits.push(`ep ${p.episode}`);
  return bits.join(" · ");
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      switch (msg?.type) {
        case "HANABI_DETECTED":
          await handleDetected(msg.payload, sender.tab?.id);
          sendResponse({ ok: true });
          break;

        case "GET_STATE": {
          const s = await getSettings();
          const tabId = msg.tabId;
          sendResponse({
            ok: true,
            settings: { ...s, hasKey: !!s.apiKey },
            detection: tabId != null ? pending.get(tabId) || null : null,
          });
          break;
        }

        case "SAVE_KEY":
          await setSettings({ apiKey: (msg.apiKey || "").trim() });
          sendResponse({ ok: true });
          break;

        case "SET_AUTO_TRACK":
          await setSettings({ autoTrack: !!msg.value });
          sendResponse({ ok: true });
          break;

        case "SET_WEB_APP_URL":
          await setSettings({ webAppUrl: (msg.url || "").trim().replace(/\/+$/, "") });
          sendResponse({ ok: true });
          break;

        case "TEST_CONNECTION": {
          const res = await ping();
          const email = res?.user?.email || "";
          await setSettings({ email });
          sendResponse({ ok: true, email });
          break;
        }

        case "SCAN_NOW": {
          const payload = msg.payload || (msg.tabId != null ? pending.get(msg.tabId) : null);
          if (!payload) throw new Error("Nothing detected on this page yet.");
          const res = await pushScan(payload);
          if (msg.tabId != null) {
            pending.delete(msg.tabId);
            setBadge(msg.tabId, false);
          }
          sendResponse({ ok: true, res });
          break;
        }

        default:
          sendResponse({ ok: false, error: "Unknown message" });
      }
    } catch (e) {
      sendResponse({ ok: false, error: e.message || String(e) });
    }
  })();
  return true; // keep the channel open for the async response
});

// Tidy up badge state when tabs close/navigate away.
chrome.tabs.onRemoved.addListener((tabId) => pending.delete(tabId));
