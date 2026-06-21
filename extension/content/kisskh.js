// KissKH → Asian dramas (defaults to a K-drama hint; reclassify in the inbox).
// KissKH is an Angular SPA. Its watch URLs look like
//   /Drama/Never-Ending-Summer--2026-/Episode-2?id=…&ep=…
// and the page <title> carries the show + episode ("… Episode 2 | kisskh").
// Two hazards we guard against:
//   1. We must fire ONLY on a real episode page (/Episode-N) — never on a
//      browse/detail page like /Drama/Some-Show, or merely clicking into a show
//      would track it.
//   2. document.title can lag a step behind navigation (still showing the show
//      you came from). So we only report when the title's show matches the URL
//      slug; otherwise it's stale and we wait. The episode number comes from the
//      path route (reliable), confirmed against the title.
__hanabi.watch(() => {
  const route = location.pathname.match(/\/(Drama|Movie|Anime)\/([^/]+)\/Episode-(\d+)/i);
  if (!route) return; // not an episode page → don't track
  const type = route[1].toLowerCase();
  const slug = route[2];
  const episode = parseInt(route[3], 10);

  // KissKH hosts anime as well as Asian dramas — route it by the path segment
  // (/Anime/… vs /Drama|Movie/…) so anime doesn't land in the K-drama collection.
  const hint = type === "anime" ? "anime" : "kdrama";

  const h = window.__hanabi;
  const raw = (document.title || "").replace(/\s*\|\s*kisskh\s*$/i, "").trim();
  if (!raw || /^kisskh$/i.test(raw)) return; // title not painted yet

  const title = raw.replace(/\s*Episode\s*\d+.*$/i, "").trim();
  if (!title) return;

  // Stale-title guard: the document title's show must be the same as the URL
  // slug, and its episode (if present) must match the route. If not, the SPA
  // hasn't repainted the title yet — wait for the next tick rather than track
  // the wrong show.
  const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  const a = norm(title);
  const b = norm(slug);
  if (!(a === b || a.includes(b) || b.includes(a))) return;
  const titleEp = h.num(raw, /Episode\s*(\d+)/i);
  if (titleEp != null && titleEp !== episode) return; // title still on a different episode

  // KissKH appends a disambiguating year, e.g. "Never-Ending Summer (2026)";
  // drop it for a clean, catalogue-searchable name.
  const cleanTitle = title.replace(/\s*\(\d{4}\)\s*$/, "").trim();

  // KissKH's og:image is a generic PWA icon, not a poster — skip it (enrichment
  // pulls a real cover on accept). Only keep an absolute, non-icon image.
  const og = h.meta("og:image");
  const cover = /^https?:\/\//.test(og) && !/\/icons?\//i.test(og) ? og : "";

  h.report({
    title: cleanTitle,
    episode,
    cover_url: cover,
    category_hint: hint,
  });
});
