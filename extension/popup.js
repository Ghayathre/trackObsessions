// Popup UI. Storage + scan submission go through the background worker;
// catalogue search for manual-add runs here in the popup.
import { searchTitles, MEDIA_TYPES } from "./lib/search.js";

const $ = (id) => document.getElementById(id);

function send(msg) {
  return new Promise((resolve) =>
    chrome.runtime.sendMessage(msg, (res) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
      } else {
        resolve(res || { ok: false, error: "No response" });
      }
    })
  );
}

function flash(el, text, kind) {
  el.textContent = text;
  el.className = "msg " + (kind || "");
  el.hidden = !text;
}

function setDot(state) {
  const dot = $("status-dot");
  dot.className = "dot " + (state || "");
  dot.title = state === "ok" ? "Connected" : state === "err" ? "Error" : "Not connected";
}

async function getActiveTabId() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id ?? null;
}

let tabId = null;
let webAppUrl = "";

async function render() {
  tabId = await getActiveTabId();
  const res = await send({ type: "GET_STATE", tabId });
  const s = res.settings || {};
  webAppUrl = s.webAppUrl || "";

  if (!s.hasKey) {
    $("setup").hidden = false;
    $("connected").hidden = true;
    setDot("");
    return;
  }

  $("setup").hidden = true;
  $("connected").hidden = false;
  $("email").textContent = s.email || "your account";
  $("auto-track").checked = !!s.autoTrack;
  setDot(s.email ? "ok" : "");

  const det = res.detection;
  $("detection").hidden = !det;
  $("no-detection").hidden = !!det;
  if (det) {
    const extra =
      det.chapter != null ? ` · ch ${det.chapter}` :
      det.episode != null ? ` · ep ${det.episode}` : "";
    $("det-title").textContent = det.title + extra;
  }
}

// ---- Setup ----
$("save-key").addEventListener("click", async () => {
  const key = $("key-input").value.trim();
  if (!key) return flash($("setup-msg"), "Paste your key first.", "err");
  flash($("setup-msg"), "Connecting…", "");
  await send({ type: "SAVE_KEY", apiKey: key });
  const test = await send({ type: "TEST_CONNECTION" });
  if (test.ok) {
    flash($("setup-msg"), "", "");
    await render();
  } else {
    await send({ type: "SAVE_KEY", apiKey: "" }); // clear bad key
    flash($("setup-msg"), test.error || "Could not connect.", "err");
  }
});

$("open-settings").addEventListener("click", async () => {
  if (webAppUrl) {
    chrome.tabs.create({ url: webAppUrl + "/settings" });
  } else {
    const url = prompt(
      "Enter your Hanabi web app address (e.g. https://your-hanabi.netlify.app):"
    );
    if (url) {
      await send({ type: "SET_WEB_APP_URL", url });
      webAppUrl = url.trim().replace(/\/+$/, "");
      chrome.tabs.create({ url: webAppUrl + "/settings" });
    }
  }
});

// ---- Connected ----
$("auto-track").addEventListener("change", (e) =>
  send({ type: "SET_AUTO_TRACK", value: e.target.checked })
);

$("add-now").addEventListener("click", async () => {
  flash($("conn-msg"), "Adding…", "");
  const res = await send({ type: "SCAN_NOW", tabId });
  if (res.ok) {
    flash($("conn-msg"), res.res?.auto_accepted ? "Added to your collection!" : "Sent to your inbox!", "ok");
    $("detection").hidden = true;
    $("no-detection").hidden = false;
  } else {
    flash($("conn-msg"), res.error || "Couldn't add.", "err");
  }
});

$("test").addEventListener("click", async () => {
  flash($("conn-msg"), "Testing…", "");
  const res = await send({ type: "TEST_CONNECTION" });
  if (res.ok) {
    setDot("ok");
    $("email").textContent = res.email || "your account";
    flash($("conn-msg"), "Connected ✓", "ok");
  } else {
    setDot("err");
    flash($("conn-msg"), res.error || "Connection failed.", "err");
  }
});

$("forget").addEventListener("click", async () => {
  await send({ type: "SAVE_KEY", apiKey: "" });
  $("key-input").value = "";
  flash($("conn-msg"), "", "");
  await render();
});

// ---- Manual add (with catalogue autocomplete) ----
let manualSelected = null;
let searchTimer = null;

function currentType() {
  return MEDIA_TYPES.find((m) => m.value === $("manual-type").value) || MEDIA_TYPES[0];
}

function renderResults(results) {
  const box = $("manual-results");
  box.innerHTML = "";
  if (!results.length) {
    box.innerHTML = '<div class="empty">No matches — you can still add the title you typed.</div>';
    box.hidden = false;
    return;
  }
  for (const r of results) {
    const item = document.createElement("div");
    item.className = "result-item";
    const img = document.createElement("img");
    img.alt = "";
    if (r.cover_url) img.src = r.cover_url;
    const span = document.createElement("div");
    span.className = "r-title";
    span.textContent = r.title;
    item.append(img, span);
    item.addEventListener("click", () => {
      manualSelected = r;
      $("manual-query").value = r.title;
      box.hidden = true;
    });
    box.appendChild(item);
  }
  box.hidden = false;
}

async function runSearch() {
  const q = $("manual-query").value.trim();
  if (q.length < 2) {
    $("manual-results").hidden = true;
    return;
  }
  const box = $("manual-results");
  box.innerHTML = '<div class="empty">Searching…</div>';
  box.hidden = false;
  const results = await searchTitles(q, currentType().kind);
  renderResults(results);
}

function onManualInput() {
  manualSelected = null; // typing invalidates a prior pick
  clearTimeout(searchTimer);
  if ($("manual-query").value.trim().length < 2) {
    $("manual-results").hidden = true;
    return;
  }
  searchTimer = setTimeout(runSearch, 350);
}

async function manualAdd() {
  const title = (manualSelected?.title || $("manual-query").value).trim();
  if (!title) return flash($("conn-msg"), "Type or pick a title first.", "err");

  const payload = { title, cover_url: manualSelected?.cover_url || "", category_hint: currentType().hint };
  const ep = parseInt($("manual-episode").value, 10);
  if (Number.isFinite(ep)) payload.episode = ep;

  flash($("conn-msg"), "Adding…", "");
  const res = await send({ type: "SCAN_NOW", payload });
  if (res.ok) {
    flash($("conn-msg"), res.res?.auto_accepted ? "Added to your collection!" : "Sent to your inbox!", "ok");
    $("manual-query").value = "";
    $("manual-episode").value = "";
    manualSelected = null;
    $("manual-results").hidden = true;
    $("manual").open = false;
  } else {
    flash($("conn-msg"), res.error || "Couldn't add.", "err");
  }
}

function initManual() {
  const sel = $("manual-type");
  sel.innerHTML = "";
  for (const m of MEDIA_TYPES) {
    const opt = document.createElement("option");
    opt.value = m.value;
    opt.textContent = m.label;
    sel.appendChild(opt);
  }
  $("manual-query").addEventListener("input", onManualInput);
  sel.addEventListener("change", () => {
    if ($("manual-query").value.trim().length >= 2) runSearch();
  });
  $("manual-add").addEventListener("click", manualAdd);
}

initManual();
render();
