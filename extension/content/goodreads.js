// Goodreads → books. Fires on /book/show/ pages.
__hanabi.watch(() => {
  if (!/\/book\/show\//.test(location.pathname)) return;
  const h = window.__hanabi;
  const title =
    h.text("h1#bookTitle, h1[data-testid='bookTitle'], h1") ||
    h.cleanTitle(h.meta("og:title"));
  h.report({
    title,
    cover_url:
      document.querySelector("#coverImage, img.ResponsiveImage")?.src ||
      h.meta("og:image"),
    category_hint: "book",
  });
});
