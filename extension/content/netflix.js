// Netflix → no reliable category (could be anime / K-drama / Thai BL / movie),
// so we send no category_hint and let you classify it in the Hanabi inbox.
__hanabi.watch(() => {
  if (!/\/watch\//.test(location.pathname)) return;
  const h = window.__hanabi;
  const title =
    h.text("[data-uia='video-title'] h4, .video-title h4, .ellipsize-text h4") ||
    h.cleanTitle(h.meta("og:title"));
  // Netflix shows season/episode as small spans under the title, e.g. "S1:E3 …".
  const sub = h.text("[data-uia='video-title'] span, .video-title span");
  const season = h.num(sub, /S(\d+)/i, /season\s*(\d+)/i);
  const episode = h.num(sub, /E(\d+)/i, /episode\s*(\d+)/i);
  if (!title) return;
  h.report({ title, season, episode, cover_url: h.meta("og:image") });
});
