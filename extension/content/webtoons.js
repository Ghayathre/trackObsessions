// Webtoons → manga (web comics). Episode number is in the URL.
__hanabi.watch(() => {
  if (!/\/viewer/.test(location.pathname) && !location.search.includes("episode_no")) return;
  const h = window.__hanabi;
  const title =
    h.text(".subj_info .subj, .subj") ||
    h.cleanTitle(h.meta("og:title")) ||
    h.cleanTitle(document.title);
  const params = new URLSearchParams(location.search);
  const chapter =
    parseInt(params.get("episode_no"), 10) ||
    h.num(document.title, /episode\s*(\d+)/i, /#(\d+)/);
  h.report({
    title,
    chapter: Number.isFinite(chapter) ? chapter : null,
    cover_url: h.meta("og:image"),
    category_hint: "manga",
  });
});
