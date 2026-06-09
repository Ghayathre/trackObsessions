// Crunchyroll → anime
__hanabi.watch(() => {
  if (!/\/watch\//.test(location.pathname)) return;
  const h = window.__hanabi;
  const og = h.meta("og:title");
  const doct = document.title;
  const series =
    h.text("h4.show-title-link, a.show-title-link") ||
    h.cleanTitle(og) ||
    h.cleanTitle(doct);
  const episode = h.num(
    og || doct,
    /episode\s*(\d+)/i,
    /\bE(\d+)\b/i,
    /\bep\.?\s*(\d+)/i
  );
  const season = h.num(og || doct, /season\s*(\d+)/i, /\bS(\d+)\b/);
  h.report({
    title: series,
    episode,
    season,
    cover_url: h.meta("og:image"),
    category_hint: "anime",
  });
});
