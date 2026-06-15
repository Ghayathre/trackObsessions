// Netflix detection runs in two halves:
//   - content/netflix-inject.js (MAIN world) reads the episode straight from
//     Netflix's internal player metadata and postMessages it to this script.
//   - this script (isolated world) relays it to the background worker via
//     __hanabi.report(). No DOM scraping, so the episode can't be misread.
//
// We send no category_hint: Netflix mixes anime / K-dramas / Thai BLs / movies,
// so you classify each new title once in the Hanabi inbox.
window.addEventListener("message", (event) => {
  if (event.source !== window) return; // only messages from our own page injector
  const msg = event.data;
  if (!msg || msg.source !== "hanabi-netflix" || !msg.payload) return;

  const { title, season, episode } = msg.payload;
  window.__hanabi.report({ title, season, episode });
});
