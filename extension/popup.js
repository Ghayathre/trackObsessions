// Popup UI. All network/storage work goes through the background worker.
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

render();
