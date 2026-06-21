// Shared helpers injected before each site detector. Exposes window.__hanabi.
// Detectors build a payload and call __hanabi.report(payload).
(function () {
  if (window.__hanabi) return;

  const Hanabi = {
    _lastKey: null,

    meta(prop) {
      const el = document.querySelector(
        `meta[property="${prop}"], meta[name="${prop}"]`
      );
      return el?.content?.trim() || "";
    },

    text(sel) {
      return document.querySelector(sel)?.textContent?.trim() || "";
    },

    // First integer matched by any of the given regexes against `str`.
    num(str, ...regexes) {
      if (!str) return null;
      for (const re of regexes) {
        const m = str.match(re);
        if (m) return parseInt(m[1], 10);
      }
      return null;
    },

    // Strip noisy site suffixes like " - Crunchyroll" / " | MangaDex".
    // The separator must be whitespace-padded so we only catch real delimiters
    // and never an intra-word hyphen — e.g. "Never-Ending Summer" or
    // "Spider-Man" must stay intact (a bare "-" rule chopped them to "Never").
    cleanTitle(t) {
      return (t || "")
        .replace(/\s+[|\-–—]\s+[^|\-–—]+$/, "")
        .replace(/watch\s+/i, "")
        .trim();
    },

    report(payload) {
      if (!payload || !payload.title) return;
      payload.title = this.cleanTitle(payload.title);
      if (!payload.title) return;
      payload.source_url = location.href;
      // Backend tracks one "progress" number (episode). For reading sites we
      // detect a chapter — mirror it into episode so progress still advances.
      if (payload.episode == null && payload.chapter != null) {
        payload.episode = payload.chapter;
      }

      const key = JSON.stringify([
        payload.title,
        payload.episode ?? null,
        payload.chapter ?? null,
        payload.season ?? null,
      ]);
      if (key === this._lastKey) return; // de-dupe repeat fires
      this._lastKey = key;

      try {
        chrome.runtime.sendMessage({ type: "HANABI_DETECTED", payload }, () => {
          void chrome.runtime.lastError; // swallow "no receiver" during reloads
        });
      } catch {
        /* extension context invalidated (reload) */
      }
    },

    // Run `detect` now, on load, and continuously thereafter. Some players
    // (Netflix) render the title/episode overlay late and only flash it briefly —
    // a one-shot probe misses it — so we re-probe on every tick and let report()
    // de-dupe. The overlay is caught the moment it appears (e.g. when controls show).
    watch(detect) {
      const run = () => {
        try {
          detect();
        } catch (e) {
          /* selectors may not be present yet */
        }
      };
      run();
      let last = location.href;
      setInterval(() => {
        if (location.href !== last) {
          last = location.href;
          this._lastKey = null; // new view → allow a fresh detection
        }
        run();
      }, 1500);
      window.addEventListener("load", run);
    },
  };

  window.__hanabi = Hanabi;
})();
