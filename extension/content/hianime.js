// HiAnime / Aniwatch → anime
__hanabi.watch(() => {
  if (!/\/watch\//.test(location.pathname)) return;
  const h = window.__hanabi;
  const title =
    h.text("h2.film-name a, .film-name") || h.cleanTitle(h.meta("og:title"));
  const active = document.querySelector(".ssl-item.ep-item.active, .ss-list a.active");
  const episode =
    (active && parseInt(active.getAttribute("data-number"), 10)) ||
    h.num(active?.title || document.title, /episode\s*(\d+)/i, /\bep\.?\s*(\d+)/i);
  h.report({
    title,
    episode: Number.isFinite(episode) ? episode : null,
    cover_url: h.meta("og:image"),
    category_hint: "anime",
  });
});
