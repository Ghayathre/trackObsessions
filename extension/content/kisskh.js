// KissKH → Asian dramas (defaults to a K-drama hint; reclassify in the inbox).
// KissKH is an Angular SPA whose page <title> stays live across navigation and
// carries BOTH the show and the episode, e.g.
//   "Never-Ending Summer (2026) Episode 1 | kisskh"
// The og tags are generic and the ?ep= query param is an internal DB id (not the
// episode number), so document.title is the source of truth; the path's
// "/Episode-N" is only a cross-check.
__hanabi.watch(() => {
  if (!/\/(Drama|Movie|Anime|Episode)/i.test(location.pathname)) return;
  const h = window.__hanabi;

  // Strip the " | kisskh" suffix, then split the show from the "Episode N" tail.
  const raw = (document.title || "").replace(/\s*\|\s*kisskh\s*$/i, "").trim();
  if (!raw || /^kisskh$/i.test(raw)) return; // title not painted yet

  const title = raw.replace(/\s*Episode\s*\d+.*$/i, "").trim();
  if (!title) return;

  // Episode from the live title; fall back to the "/Episode-N" path segment.
  let episode =
    h.num(raw, /Episode\s*(\d+)/i) ??
    h.num(location.pathname, /Episode-(\d+)/i);

  // For an episodic page we must have a number — if it isn't parsed yet, wait
  // rather than raise an "undetected episode" inbox card. A movie (no "Episode"
  // anywhere) legitimately has no number and is reported as-is.
  const episodic = /Episode/i.test(raw) || /\/Episode-/i.test(location.pathname);
  if (episodic && episode == null) return;

  // KissKH's og:image is a generic PWA icon, not a poster — skip it (enrichment
  // pulls a real cover on accept). Only keep an absolute, non-icon image.
  const og = h.meta("og:image");
  const cover = /^https?:\/\//.test(og) && !/\/icons?\//i.test(og) ? og : "";

  h.report({
    title,
    episode,
    cover_url: cover,
    category_hint: "kdrama",
  });
});
