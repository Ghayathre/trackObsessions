// Data-access layer over Supabase. Replaces the old axios `api` calls to FastAPI.
// RLS scopes every query to the signed-in user; inserts must carry user_id.
// Activity logging (previously done server-side in server.py) is replicated here best-effort.
import { supabase, supabasePublic } from "./supabase";
import { fetchDetail, searchMetadata } from "./metadata";

const TITLE_COLS =
  "id, user_id, category_id, title, status, progress, total, season, rating, notes, " +
  "cover_url, source, external_id, external_source, synopsis, year, country, created_at, updated_at";
const PUBLIC_TITLE_COLS =
  "id, category_id, title, status, progress, total, season, rating, cover_url, " +
  "external_source, synopsis, year, country, updated_at";

async function uid() {
  const { data } = await supabase.auth.getSession();
  const id = data?.session?.user?.id;
  if (!id) throw new Error("Not authenticated");
  return id;
}

function slugify(s) {
  return (s || "").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^[-_]+|[-_]+$/g, "").slice(0, 30) || "user";
}

function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

// Notify the app (e.g. the sidebar collection counts) that titles moved between
// collections or were added/removed, so listeners can reload without a refresh.
function notifyLibraryChanged() {
  try { window.dispatchEvent(new Event("hanabi:library-changed")); } catch { /* SSR / no window */ }
}

// Which external catalogue to search for a given collection.
// Default collections map by slug; custom ones fall back to their kind.
function searchKindFor(category) {
  switch (category?.slug) {
    case "anime": return "anime";
    case "manga": return "manga";
    case "books": return "books";
    case "kdramas":
    case "thai-bl": return "tv";
    default: return category?.kind === "reading" ? "manga" : "tv";
  }
}

// Look up a detected title in the matching catalogue and return the best match
// (cover, synopsis, total, year, country, external_id/source) or null. Never throws.
async function enrichForCategory(query, category) {
  try {
    const results = await searchMetadata(query, searchKindFor(category));
    if (!results.length) return null;
    const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
    const q = norm(query);
    return (
      results.find((r) => norm(r.title) === q) ||
      results.find((r) => norm(r.title).includes(q) || q.includes(norm(r.title))) ||
      results[0]
    );
  } catch {
    return null;
  }
}

// best-effort activity log; never throws
async function logActivity(entry) {
  try {
    const userId = await uid();
    await supabase.from("activity").insert({ extra: {}, ...entry, user_id: userId });
  } catch {
    /* ignore */
  }
}

// ---------------- Profiles ----------------
export async function getProfile(userId) {
  return unwrap(await supabase.from("profiles").select("*").eq("id", userId).single());
}

export async function updateProfile(patch) {
  const userId = await uid();
  const update = {};
  if (patch.auto_accept != null) update.auto_accept = !!patch.auto_accept;
  if (patch.profile_public != null) update.profile_public = !!patch.profile_public;
  if (patch.name != null && patch.name.trim()) update.name = patch.name.trim().slice(0, 60);
  if (patch.theme != null) update.theme = patch.theme;
  if (patch.style != null) update.style = (patch.style.trim().slice(0, 40)) || "default";
  if (patch.username != null) {
    const u = slugify(patch.username);
    if (!u) throw new Error("Invalid username");
    update.username = u;
  }
  if (Object.keys(update).length === 0) return getProfile(userId);
  const { data, error } = await supabase
    .from("profiles").update(update).eq("id", userId).select("*").single();
  if (error) {
    if (error.code === "23505") throw new Error("Username already taken");
    throw error;
  }
  return data;
}

// ---------------- Categories ----------------
export async function listCategories() {
  const userId = await uid();
  return unwrap(
    await supabase.from("categories_with_counts").select("*").eq("user_id", userId).order("created_at", { ascending: true }),
  );
}

export async function createCategory({ name, icon = "Hash", kind = "custom" }) {
  const userId = await uid();
  const slug = (name || "").toLowerCase().replace(/ /g, "-");
  const row = unwrap(
    await supabase.from("categories")
      .insert({ user_id: userId, slug, name, icon, kind, is_default: false })
      .select("*").single(),
  );
  return { ...row, count: 0 };
}

export async function deleteCategory(id) {
  // FK cascade removes titles + links
  return unwrap(await supabase.from("categories").delete().eq("id", id).select("id").maybeSingle());
}

// ---------------- Category links ----------------
export async function listLinks(categoryId) {
  return unwrap(
    await supabase.from("category_links").select("*").eq("category_id", categoryId).order("created_at", { ascending: true }),
  );
}

export async function createLink(categoryId, { url, label }) {
  const userId = await uid();
  let u = (url || "").trim();
  if (!u) throw new Error("url is required");
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  let lbl = (label || "").trim();
  if (!lbl) {
    const m = u.match(/^https?:\/\/([^/]+)/i);
    lbl = (m ? m[1] : u).slice(0, 60);
  }
  return unwrap(
    await supabase.from("category_links")
      .insert({ user_id: userId, category_id: categoryId, label: lbl.slice(0, 120), url: u.slice(0, 2000) })
      .select("*").single(),
  );
}

export async function deleteLink(id) {
  return unwrap(await supabase.from("category_links").delete().eq("id", id).select("id").maybeSingle());
}

// ---------------- Titles ----------------
export async function listTitles({ categoryId, status, q } = {}) {
  const userId = await uid();
  let query = supabase.from("titles").select(TITLE_COLS).eq("user_id", userId);
  if (categoryId) query = query.eq("category_id", categoryId);
  if (status) query = query.eq("status", status);
  if (q) query = query.ilike("title", `%${q.replace(/[%_]/g, (m) => "\\" + m)}%`);
  return unwrap(await query.order("updated_at", { ascending: false }));
}

export async function createTitle(payload) {
  const userId = await uid();
  const row = unwrap(
    await supabase.from("titles").insert({
      user_id: userId,
      category_id: payload.category_id,
      title: payload.title,
      status: payload.status || "watching",
      progress: payload.progress || 0,
      total: payload.total ?? null,
      season: payload.season ?? null,
      rating: payload.rating ?? null,
      notes: payload.notes || "",
      cover_url: payload.cover_url || "",
      source: payload.source || "manual",
      external_id: payload.external_id ?? null,
      external_source: payload.external_source ?? null,
      synopsis: payload.synopsis || "",
      year: payload.year || "",
      country: payload.country || "",
    }).select(TITLE_COLS).single(),
  );
  const cat = await supabase.from("categories").select("name").eq("id", row.category_id).maybeSingle();
  await logActivity({
    type: row.source === "extension" ? "extension_add" : "add",
    title: row.title, title_id: row.id, category_id: row.category_id,
    category_name: cat.data?.name || "",
  });
  notifyLibraryChanged();
  return row;
}

export async function updateTitle(id, patch) {
  const before = unwrap(await supabase.from("titles").select(TITLE_COLS).eq("id", id).single());
  const row = unwrap(await supabase.from("titles").update(patch).eq("id", id).select(TITLE_COLS).single());
  const cat = await supabase.from("categories").select("name").eq("id", row.category_id).maybeSingle();
  const catName = cat.data?.name || "";
  if ("status" in patch && patch.status !== before.status) {
    await logActivity({
      type: patch.status === "completed" ? "complete" : "status",
      title: row.title, title_id: row.id, category_id: row.category_id, category_name: catName,
      extra: { from: before.status, to: patch.status },
    });
  } else if ("progress" in patch && (patch.progress || 0) !== (before.progress || 0)) {
    await logActivity({
      type: "progress", title: row.title, title_id: row.id, category_id: row.category_id,
      category_name: catName, extra: { from: before.progress || 0, to: patch.progress },
    });
  }
  // Moving a title between collections changes per-collection counts.
  if ("category_id" in patch && patch.category_id !== before.category_id) notifyLibraryChanged();
  return row;
}

export async function deleteTitle(id) {
  const before = unwrap(await supabase.from("titles").select("title, category_id").eq("id", id).single());
  unwrap(await supabase.from("titles").delete().eq("id", id).select("id").maybeSingle());
  await logActivity({ type: "remove", title: before.title, title_id: id, category_id: before.category_id });
  notifyLibraryChanged();
  return { ok: true };
}

export async function refreshTitle(id) {
  const t = unwrap(await supabase.from("titles").select(TITLE_COLS).eq("id", id).single());
  if (!t.external_source || !t.external_id) {
    throw new Error("This title has no linked source to refresh from. Re-add it via search.");
  }
  const detail = await fetchDetail(t.external_source, t.external_id);
  if (!detail) throw new Error("Could not fetch fresh details right now");
  const update = {};
  Object.entries(detail).forEach(([k, v]) => { if (v !== null && v !== undefined && v !== "") update[k] = v; });
  return unwrap(await supabase.from("titles").update(update).eq("id", id).select(TITLE_COLS).single());
}

// ---------------- Stats / activity ----------------
export async function getStats() {
  return unwrap(await supabase.rpc("get_stats"));
}

export async function listActivity(limit = 50) {
  const userId = await uid();
  const lim = Math.min(Math.max(limit, 1), 200);
  return unwrap(
    await supabase.from("activity").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(lim),
  );
}

// ---------------- Suggestions ----------------
export async function listSuggestions(status = "pending") {
  const userId = await uid();
  let query = supabase.from("suggestions").select("*").eq("user_id", userId);
  if (status) query = query.eq("status", status);
  return unwrap(await query.order("created_at", { ascending: false }).limit(100));
}

export async function actOnSuggestion(id, action, categoryId) {
  const userId = await uid();
  const sug = unwrap(await supabase.from("suggestions").select("*").eq("id", id).single());
  if (action === "reject") {
    unwrap(await supabase.from("suggestions").update({ status: "rejected" }).eq("id", id).select("id").single());
    return { ok: true };
  }
  if (action !== "accept") throw new Error("Unknown action");

  // resolve category: explicit override -> suggestion's slug -> first category
  const CAT_COLS = "id, name, slug, kind";
  let cat = null;
  if (categoryId) cat = (await supabase.from("categories").select(CAT_COLS).eq("id", categoryId).maybeSingle()).data;
  if (!cat && sug.category_slug) {
    cat = (await supabase.from("categories").select(CAT_COLS).eq("user_id", userId).eq("slug", sug.category_slug).maybeSingle()).data;
  }
  if (!cat) {
    cat = (await supabase.from("categories").select(CAT_COLS).eq("user_id", userId).order("created_at").limit(1).maybeSingle()).data;
  }
  if (!cat) throw new Error("No category available");

  // Enrich from the matching catalogue (cover, synopsis, total, year, country, external link).
  const meta = await enrichForCategory(sug.title, cat);

  const esc = sug.title.replace(/[%_\\]/g, (m) => "\\" + m);
  const existing = (await supabase.from("titles").select("id, progress, external_source")
    .eq("user_id", userId).eq("category_id", cat.id).ilike("title", esc).maybeSingle()).data;

  let titleId;
  if (existing) {
    const update = { source: "extension" };
    if (sug.episode != null) update.progress = Math.max(existing.progress || 0, sug.episode);
    if (sug.season != null) update.season = sug.season;
    // Backfill metadata only if this title was never linked to a source.
    if (meta && !existing.external_source) {
      Object.assign(update, {
        cover_url: meta.cover_url || sug.cover_url || "",
        total: meta.total ?? null, synopsis: meta.synopsis || "",
        year: meta.year || "", country: meta.country || "",
        external_id: meta.external_id ?? null, external_source: meta.external_source ?? null,
      });
    }
    unwrap(await supabase.from("titles").update(update).eq("id", existing.id).select("id").single());
    titleId = existing.id;
  } else {
    const row = unwrap(await supabase.from("titles").insert({
      user_id: userId, category_id: cat.id, title: sug.title, status: "watching",
      progress: sug.episode || 0, season: sug.season ?? null,
      cover_url: meta?.cover_url || sug.cover_url || "",
      total: meta?.total ?? null, synopsis: meta?.synopsis || "",
      year: meta?.year || "", country: meta?.country || "",
      external_id: meta?.external_id ?? null, external_source: meta?.external_source ?? null,
      source: "extension",
    }).select("id").single());
    titleId = row.id;
  }
  unwrap(await supabase.from("suggestions").update({ status: "accepted", title_id: titleId }).eq("id", id).select("id").single());
  await logActivity({ type: "extension_add", title: sug.title, title_id: titleId, category_id: cat.id, category_name: cat.name });
  notifyLibraryChanged();
  return { ok: true, title_id: titleId };
}

// ---------------- API keys ----------------
export async function listApiKeys() {
  const userId = await uid();
  // never select key_hash (authenticated has no column grant on it)
  return unwrap(
    await supabase.from("api_keys")
      .select("id, label, prefix, created_at, last_used_at, revoked")
      .eq("user_id", userId).order("created_at", { ascending: false }),
  );
}

export async function createApiKey(label) {
  return unwrap(await supabase.rpc("create_api_key", { p_label: label || "Hanabi extension" }));
}

export async function revokeApiKey(id) {
  return unwrap(await supabase.from("api_keys").update({ revoked: true }).eq("id", id).select("id").single());
}

// ---------------- AniList import (client-side) ----------------
const ANILIST_STATUS_MAP = {
  CURRENT: "watching", REPEATING: "watching", PLANNING: "plan",
  COMPLETED: "completed", DROPPED: "dropped", PAUSED: "on_hold",
};

export async function importAnilist({ username, type = "ANIME", categoryId }) {
  const userId = await uid();
  const al = (username || "").trim();
  const mediaType = type.toUpperCase();
  if (!al || !["ANIME", "MANGA"].includes(mediaType) || !categoryId) {
    throw new Error("username, type (ANIME|MANGA) and category are required");
  }
  const query = `query ($userName: String, $type: MediaType) {
    MediaListCollection(userName: $userName, type: $type) {
      lists { entries { status progress score
        media { id title { romaji english } episodes chapters coverImage { large } } } } } }`;
  const r = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables: { userName: al, type: mediaType } }),
  });
  if (r.status === 404) throw new Error("AniList user not found");
  const body = await r.json().catch(() => ({}));
  if (!r.ok || body.errors) throw new Error(body.errors?.[0]?.message || `AniList error (${r.status})`);
  const lists = body.data?.MediaListCollection?.lists || [];

  let imported = 0, skipped = 0;
  for (const lst of lists) {
    for (const e of lst.entries || []) {
      const m = e.media || {};
      const title = m.title?.english || m.title?.romaji;
      if (!title) { skipped++; continue; }
      const extId = `al-${m.id}`;
      const dup = (await supabase.from("titles").select("id")
        .eq("user_id", userId).eq("category_id", categoryId).eq("external_id", extId).maybeSingle()).data;
      if (dup) { skipped++; continue; }
      const { error } = await supabase.from("titles").insert({
        user_id: userId, category_id: categoryId, title,
        status: ANILIST_STATUS_MAP[e.status] || "plan",
        progress: parseInt(e.progress || 0, 10),
        total: mediaType === "ANIME" ? m.episodes : m.chapters,
        rating: e.score ? Number(e.score) / 10 : null,
        cover_url: m.coverImage?.large || "",
        source: "anilist", external_id: extId,
      });
      if (error) { skipped++; continue; }
      imported++;
    }
  }
  if (imported) {
    const cat = await supabase.from("categories").select("name").eq("id", categoryId).maybeSingle();
    await logActivity({
      type: "add", title: `AniList import (${imported})`, category_id: categoryId,
      category_name: cat.data?.name || "", extra: { source: "anilist", count: imported },
    });
    notifyLibraryChanged();
  }
  return { imported, skipped };
}

// ---------------- Public profile (anon client; notes never exposed) ----------------
export async function getPublicProfile(username) {
  const profile = (await supabasePublic.from("profiles")
    .select("id, username, name, theme, style, created_at").eq("username", username).maybeSingle()).data;
  if (!profile) { const e = new Error("not found"); e.status = 404; throw e; }
  const categories = unwrap(
    await supabasePublic.from("categories_with_counts").select("*").eq("user_id", profile.id).order("created_at", { ascending: true }),
  );
  const { count } = await supabasePublic.from("titles").select("id", { count: "exact", head: true }).eq("user_id", profile.id);
  return { user: profile, categories, total: count || 0 };
}

export async function getPublicTitles(userId, categoryId) {
  let query = supabasePublic.from("titles").select(PUBLIC_TITLE_COLS).eq("user_id", userId);
  if (categoryId) query = query.eq("category_id", categoryId);
  return unwrap(await query.order("updated_at", { ascending: false }).limit(500));
}

// ---------------- Image detection (stub edge function) ----------------
export async function detectImage(file) {
  // The detect-image edge function is currently a stub; the UI handles the not_implemented payload.
  const { data, error } = await supabase.functions.invoke("detect-image", {
    body: await file.arrayBuffer(),
    headers: { "Content-Type": file.type },
  });
  if (error) {
    // surface the function's JSON body if present
    try { return await error.context.json(); } catch { throw error; }
  }
  return data;
}
