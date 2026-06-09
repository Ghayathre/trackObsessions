// Hanabi browser-extension endpoint.
// Authenticated by X-API-Key (sha256 -> api_keys lookup) using the service-role client —
// there is no Supabase user session, so this function is deployed with verify_jwt = false.
// Ports extension_ping + extension_scan + auto-accept from the old FastAPI server.py.
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const HINT_MAP: Record<string, string> = {
  "anime": "anime",
  "manga": "manga",
  "kdrama": "kdramas",
  "korean drama": "kdramas",
  "thai bl": "thai-bl",
  "bl": "thai-bl",
  "book": "books",
  "novel": "books",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

async function sha256hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ilike treats % and _ as wildcards; escape them so the match is exact (case-insensitive).
function escapeLike(s: string): string {
  return s.replace(/[%_\\]/g, (m) => "\\" + m);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) return json({ detail: "Missing X-API-Key header" }, 401);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const hash = await sha256hex(apiKey);
  const { data: keyRec } = await admin
    .from("api_keys")
    .select("id, user_id, revoked")
    .eq("key_hash", hash)
    .maybeSingle();
  if (!keyRec || keyRec.revoked) return json({ detail: "Invalid API key" }, 401);

  const userId: string = keyRec.user_id;
  await admin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", keyRec.id);

  // ---- ping ----
  if (new URL(req.url).pathname.endsWith("/ping")) {
    const { data: au } = await admin.auth.admin.getUserById(userId);
    return json({ ok: true, user: { id: userId, email: au?.user?.email ?? null } });
  }

  // ---- scan ----
  if (req.method !== "POST") return json({ detail: "Method not allowed" }, 405);
  const payload = await req.json().catch(() => ({} as Record<string, unknown>));
  const title = String(payload.title ?? "").trim();
  if (!title) return json({ detail: "title is required" }, 400);

  const episode = payload.episode ?? null;
  const season = payload.season ?? null;
  const coverUrl = (payload.cover_url as string) || "";

  let catSlug: string | null = (payload.category_slug as string) ?? null;
  if (!catSlug && payload.category_hint) {
    const hint = String(payload.category_hint).toLowerCase();
    for (const [k, v] of Object.entries(HINT_MAP)) {
      if (hint.includes(k)) { catSlug = v; break; }
    }
  }

  // Dedup: existing pending suggestion with same title -> just update episode/season/cover.
  const { data: existing } = await admin
    .from("suggestions")
    .select("id")
    .eq("user_id", userId)
    .eq("title", title)
    .eq("status", "pending")
    .maybeSingle();
  if (existing) {
    const upd: Record<string, unknown> = {};
    if (episode !== null) upd.episode = episode;
    if (season !== null) upd.season = season;
    if (coverUrl) upd.cover_url = coverUrl;
    if (Object.keys(upd).length) await admin.from("suggestions").update(upd).eq("id", existing.id);
    return json({ ok: true, suggestion_id: existing.id, deduped: true });
  }

  const { data: sug, error: sugErr } = await admin
    .from("suggestions")
    .insert({
      user_id: userId,
      title,
      category_slug: catSlug,
      category_hint: (payload.category_hint as string) ?? null,
      season,
      episode,
      cover_url: coverUrl,
      source_url: (payload.source_url as string) ?? null,
      status: "pending",
    })
    .select("id")
    .single();
  if (sugErr || !sug) return json({ detail: "Could not create suggestion" }, 500);
  const suggestionId = sug.id;

  // Auto-accept policy: if the user opted in AND we resolved a category, convert to a title.
  const { data: profile } = await admin
    .from("profiles").select("auto_accept").eq("id", userId).maybeSingle();
  if (profile?.auto_accept && catSlug) {
    const { data: cat } = await admin
      .from("categories").select("id, name").eq("user_id", userId).eq("slug", catSlug).maybeSingle();
    if (cat) {
      const { data: et } = await admin
        .from("titles").select("id, progress")
        .eq("user_id", userId).eq("category_id", cat.id)
        .ilike("title", escapeLike(title)).maybeSingle();
      let titleId: string;
      if (et) {
        const tu: Record<string, unknown> = { source: "extension" };
        if (episode !== null) tu.progress = Math.max(et.progress ?? 0, Number(episode));
        if (season !== null) tu.season = season;
        await admin.from("titles").update(tu).eq("id", et.id);
        titleId = et.id;
      } else {
        const { data: nt } = await admin
          .from("titles").insert({
            user_id: userId, category_id: cat.id, title, status: "watching",
            progress: episode ?? 0, season, cover_url: coverUrl, source: "extension",
          }).select("id").single();
        titleId = nt!.id;
      }
      await admin.from("suggestions")
        .update({ status: "accepted", title_id: titleId, auto_accepted: true }).eq("id", suggestionId);
      await admin.from("activity").insert({
        user_id: userId, type: "extension_add", title, title_id: titleId,
        category_id: cat.id, category_name: cat.name, extra: { auto: true },
      });
      return json({ ok: true, suggestion_id: suggestionId, auto_accepted: true, title_id: titleId });
    }
  }

  return json({ ok: true, suggestion_id: suggestionId });
});
