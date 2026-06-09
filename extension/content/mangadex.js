// MangaDex → manga. Fires on /chapter/ and /title/ pages.
__hanabi.watch(() => {
  const h = window.__hanabi;
  const doct = document.title; // e.g. "Vol. 1 Ch. 12 - <Manga> - MangaDex"
  let title = "";
  let chapter = null;

  if (/\/chapter\//.test(location.pathname)) {
    chapter = h.num(doct, /ch\.?\s*([\d.]+)/i, /chapter\s*([\d.]+)/i);
    // Manga name is the segment after the chapter info.
    const m = doct.match(/-\s*(.+?)\s*-\s*MangaDex/i);
    title = m ? m[1] : h.cleanTitle(doct);
  } else if (/\/title\//.test(location.pathname)) {
    title = h.text("h1, [class*='title'] span") || h.cleanTitle(h.meta("og:title"));
  } else {
    return;
  }

  h.report({
    title,
    chapter,
    cover_url: h.meta("og:image"),
    category_hint: "manga",
  });
});
