// Catalogue search for the manual-add flow. Mirrors the web app's metadata.js
// (Jikan for anime/manga, TVmaze for tv, OpenLibrary for books). These public
// APIs are CORS-friendly and listed in host_permissions.

async function getJson(url, params) {
  const u = new URL(url);
  if (params) {
    Object.entries(params).forEach(([k, v]) => v != null && u.searchParams.set(k, v));
  }
  const r = await fetch(u.toString());
  if (!r.ok) throw new Error(`Request failed (${r.status})`);
  return r.json();
}

const stripHtml = (s) => (s ? s.replace(/<[^>]+>/g, "") : "");

// kind: "anime" | "manga" | "tv" | "books" → [{ title, cover_url }]
export async function searchTitles(q, kind) {
  if (!q || q.trim().length < 2) return [];
  try {
    if (kind === "anime" || kind === "manga") {
      const data = (await getJson(`https://api.jikan.moe/v4/${kind}`, { q, limit: 8 })).data || [];
      return data
        .filter((d) => d.title)
        .map((d) => ({ title: d.title, cover_url: d.images?.jpg?.image_url || "" }));
    }
    if (kind === "tv") {
      const arr = (await getJson("https://api.tvmaze.com/search/shows", { q })) || [];
      return arr
        .map((row) => row.show)
        .filter((s) => s?.name)
        .slice(0, 8)
        .map((s) => ({ title: s.name, cover_url: s.image?.medium || s.image?.original || "" }));
    }
    if (kind === "books") {
      const docs = (await getJson("https://openlibrary.org/search.json", { q, limit: 8 })).docs || [];
      return docs
        .filter((d) => d.title)
        .map((d) => ({
          title: d.title,
          cover_url: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : "",
        }));
    }
    return [];
  } catch {
    return [];
  }
}

// Manual-add media types → search catalogue + the hint the Edge Function maps to a slug.
export const MEDIA_TYPES = [
  { value: "anime", label: "Anime", kind: "anime", hint: "anime" },
  { value: "manga", label: "Manga", kind: "manga", hint: "manga" },
  { value: "kdrama", label: "K-Drama", kind: "tv", hint: "kdrama" },
  { value: "thai-bl", label: "Thai BL", kind: "tv", hint: "thai bl" },
  { value: "book", label: "Book", kind: "books", hint: "book" },
];
