// KissKH → Asian dramas (defaults to K-drama hint; reclassify in the inbox).
__hanabi.watch(() => {
  const h = window.__hanabi;
  const raw =
    h.text("h1, .title") ||
    h.cleanTitle(h.meta("og:title")) ||
    h.cleanTitle(document.title);
  const episode = h.num(raw, /episode\s*(\d+)/i, /\bep\.?\s*(\d+)/i);
  const title = raw.replace(/\s*episode\s*\d+.*$/i, "").trim();
  h.report({
    title,
    episode,
    cover_url: h.meta("og:image"),
    category_hint: "kdrama",
  });
});
