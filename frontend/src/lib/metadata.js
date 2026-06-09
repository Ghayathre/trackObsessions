// Client-side metadata search + detail fetch against public catalogues.
// Ported from the old FastAPI server.py (metadata_search / _fetch_one_detail).
// These APIs are public and CORS-friendly, so we call them straight from the browser.

function stripHtml(s) {
  return s ? s.replace(/<[^>]+>/g, "") : "";
}

async function getJson(url, params) {
  const u = new URL(url);
  if (params) Object.entries(params).forEach(([k, v]) => v != null && u.searchParams.set(k, v));
  const r = await fetch(u.toString());
  if (!r.ok) throw new Error(`Request failed (${r.status})`);
  return r.json();
}

// kind: anime | manga | tv | books
export async function searchMetadata(q, kind = "anime") {
  if (!q || q.trim().length < 1) return [];
  try {
    if (kind === "anime" || kind === "manga") {
      const data = (await getJson(`https://api.jikan.moe/v4/${kind}`, { q, limit: 8 })).data || [];
      return data.map((d) => {
        const aired = d.aired || d.published || {};
        const studios = d.studios || [];
        return {
          title: d.title,
          cover_url: d.images?.jpg?.image_url || "",
          external_id: String(d.mal_id),
          external_source: `jikan-${kind}`,
          total: kind === "anime" ? d.episodes : d.chapters,
          synopsis: d.synopsis || "",
          year: (aired.from || "").slice(0, 4),
          country: studios[0]?.name || (kind === "anime" ? "Japan" : ""),
          source: "jikan",
        };
      });
    }
    if (kind === "tv") {
      const arr = (await getJson("https://api.tvmaze.com/search/shows", { q })) || [];
      return arr.slice(0, 12).map((row) => {
        const s = row.show || {};
        const img = s.image || {};
        return {
          title: s.name,
          cover_url: img.original || img.medium || "",
          external_id: `tvmaze-${s.id}`,
          external_source: "tvmaze",
          total: s.runtime,
          synopsis: stripHtml(s.summary || ""),
          year: (s.premiered || "").slice(0, 4),
          country: s.network?.country?.name || "",
          source: "tvmaze",
        };
      });
    }
    if (kind === "books") {
      const docs = (await getJson("https://openlibrary.org/search.json", { q, limit: 8 })).docs || [];
      return docs.map((d) => ({
        title: d.title,
        cover_url: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg` : "",
        external_id: d.key || "",
        external_source: "openlibrary",
        total: d.number_of_pages_median,
        synopsis: (d.author_name || [""])[0],
        year: String(d.first_publish_year || ""),
        country: "",
        source: "openlibrary",
      }));
    }
    return [];
  } catch (e) {
    return [];
  }
}

// Returns a partial title patch (fields to merge), or null. Used by "Refresh details".
export async function fetchDetail(externalSource, externalId) {
  if (!externalSource || !externalId) return null;
  try {
    if (externalSource === "jikan-anime" || externalSource === "jikan-manga") {
      const kind = externalSource.split("-")[1];
      const d = (await getJson(`https://api.jikan.moe/v4/${kind}/${externalId}`)).data || {};
      const aired = d.aired || d.published || {};
      const studios = d.studios || [];
      return {
        title: d.title || d.title_english,
        cover_url: d.images?.jpg?.image_url || "",
        total: kind === "anime" ? d.episodes : d.chapters,
        synopsis: d.synopsis || "",
        year: (aired.from || "").slice(0, 4),
        country: studios[0]?.name || (kind === "anime" ? "Japan" : ""),
      };
    }
    if (externalSource === "tvmaze") {
      const tid = externalId.replace("tvmaze-", "");
      const s = await getJson(`https://api.tvmaze.com/shows/${tid}`);
      let epCount = null;
      try {
        const eps = await getJson(`https://api.tvmaze.com/shows/${tid}/episodes`);
        epCount = Array.isArray(eps) ? eps.length : null;
      } catch { /* ignore */ }
      const img = s.image || {};
      return {
        title: s.name,
        cover_url: img.original || img.medium || "",
        total: epCount,
        synopsis: stripHtml(s.summary || ""),
        year: (s.premiered || "").slice(0, 4),
        country: s.network?.country?.name || "",
      };
    }
    if (externalSource === "openlibrary") {
      const path = externalId.startsWith("/") ? externalId : `/works/${externalId}`;
      const d = await getJson(`https://openlibrary.org${path}.json`);
      let description = d.description;
      if (description && typeof description === "object") description = description.value || "";
      const covers = d.covers || [];
      return {
        title: d.title,
        cover_url: covers.length ? `https://covers.openlibrary.org/b/id/${covers[0]}-L.jpg` : "",
        synopsis: description || "",
        year: String(d.first_publish_date || "").slice(0, 4),
      };
    }
  } catch {
    return null;
  }
  return null;
}
