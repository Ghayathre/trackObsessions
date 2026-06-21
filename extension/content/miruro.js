// Miruro → anime.
// Miruro is a SPA that updates the page title and on-page controls when you
// switch episodes/shows but does NOT reliably update the URL — so the URL's
// ?ep= (and the path slug) can be STALE and must not be trusted for the episode.
// Instead we read both signals live from the DOM:
//   - title   ← document.title ("Watch {Name} · Miruro"), which the SPA keeps current
//   - episode ← the player's "Report - Episode N" control / the "EP N" comment
//     button, both of which reflect the episode actually playing.
__hanabi.watch(() => {
  if (!/\/watch/.test(location.pathname)) return;
  const h = window.__hanabi;

  const episode = liveEpisode();
  if (episode == null) return; // wait until the episode is known (never an undetected card)

  // Title from document.title; strip "Watch " prefix and the "· Miruro" suffix.
  let title = (document.title || "")
    .replace(/^\s*Watch\s+/i, "")
    .replace(/\s*[·|\-–—]\s*Miruro\s*$/i, "")
    .trim();
  if (!title || /^miruro$/i.test(title)) return; // title not painted yet

  h.report({
    title,
    episode,
    cover_url: h.meta("og:image"),
    category_hint: "anime",
  });
});

// The episode actually playing, read from live on-page controls (not the URL,
// which Miruro leaves stale). The "Report - Episode N" control is current-episode
// specific (the episode LIST also shows numbers, so we never just grab the first
// "Episode N" on the page); the compact "EP N" comment button is a fallback.
function liveEpisode() {
  for (const el of document.querySelectorAll("h1,h2,h3,h4,h5,button,a,div,span,p")) {
    const t = (el.textContent || "").replace(/\s+/g, " ").trim();
    if (t.length > 60) continue; // skip big containers / the episode-list blocks
    const m = t.match(/Report\b[^\d]*?Episode\s*(\d+)/i);
    if (m) return parseInt(m[1], 10);
  }
  for (const el of document.querySelectorAll("button,span,a")) {
    const m = (el.textContent || "").trim().match(/^EP\.?\s*(\d+)$/i);
    if (m) return parseInt(m[1], 10);
  }
  return null;
}
