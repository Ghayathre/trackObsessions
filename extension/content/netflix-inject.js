// Runs in the PAGE's MAIN world (see manifest "world": "MAIN") so it can read
// Netflix's internal player state — which the isolated content scripts cannot see.
// It pulls the currently-playing show/season/episode straight from the player
// metadata (no DOM overlay, so it can't misread the number) and hands it to the
// isolated-world relay (netflix.js) via window.postMessage.
(function () {
  const TAG = "hanabi-netflix";

  // Read {title, season, episode, type} from Netflix's player metadata, or null
  // if nothing is playing / metadata isn't ready yet.
  function read() {
    try {
      if (!/\/watch\//.test(location.pathname)) return null;
      const vp = window.netflix?.appContext?.state?.playerApp?.getAPI?.()?.videoPlayer;
      if (!vp) return null;

      const ids = vp.getAllPlayerSessionIds?.() || [];
      const sid = ids.find((i) => /watch/.test(i)) || ids[0];
      if (!sid) return null;

      const movieId = vp.getVideoPlayerBySessionId(sid)?.getMovieId?.();
      if (!movieId) return null;

      const video = vp.getVideoMetadata(movieId)?._metadataObject?.video;
      if (!video || !video.title) return null;

      // Map the currently-playing video id to its season/episode sequence numbers.
      let season = null;
      let episode = null;
      const cur = video.currentEpisode;
      for (const s of (video.seasons || [])) {
        for (const e of (s.episodes || [])) {
          if (e.id === cur || e.episodeId === cur) {
            season = s.seq ?? null;
            episode = e.seq ?? null;
          }
        }
      }
      return { title: video.title, season, episode, type: video.type };
    } catch {
      return null; // player not initialised yet, or Netflix changed its internals
    }
  }

  let lastKey = null;
  function tick() {
    const d = read();
    if (!d) return;
    // Only emit once we have a real episode number. Movies (no episode) are skipped
    // so they never create an "undetected episode" card in the Hanabi inbox.
    if (d.episode == null) return;

    const key = `${d.title}|${d.season}|${d.episode}`;
    if (key === lastKey) return; // de-dupe; episode changes (autoplay) re-fire
    lastKey = key;

    window.postMessage(
      { source: TAG, payload: { title: d.title, season: d.season, episode: d.episode } },
      "*",
    );
  }

  // Poll: metadata appears a moment after the player boots, and the episode
  // changes when autoplay rolls to the next one — re-reading catches both.
  setInterval(tick, 1500);
  tick();
})();
