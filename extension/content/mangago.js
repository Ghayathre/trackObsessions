// Mangago → manga
__hanabi.watch(() => {
  const h = window.__hanabi;
  const doct = document.title;
  const title =
    h.text(".w-title h1, h1") || h.cleanTitle(h.meta("og:title")) || h.cleanTitle(doct);
  const chapter = h.num(doct, /ch\.?\s*([\d.]+)/i, /chapter\s*([\d.]+)/i);
  h.report({
    title: title.replace(/\s*ch(apter)?\.?\s*[\d.]+.*$/i, "").trim() || title,
    chapter,
    cover_url: h.meta("og:image"),
    category_hint: "manga",
  });
});
