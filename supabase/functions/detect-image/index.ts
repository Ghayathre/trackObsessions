// Image detection (snap-to-add) — STUB after the Supabase migration.
// The original used GPT-4o vision via emergentintegrations (server.py:79-110, _gpt5_detect).
// TODO: reimplement with a customer-owned OpenAI/Anthropic key, then look up the poster
// from Jikan/TVmaze/OpenLibrary as the old /detect/image endpoint did.
// verify_jwt stays true: the React app calls this with its Supabase session.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  return new Response(
    JSON.stringify({
      error: "not_implemented",
      detail:
        "Image detection is temporarily unavailable after the Supabase migration. " +
        "It will be reimplemented with a dedicated LLM key.",
      // shape-compatible defaults so the UI can render gracefully
      title: "",
      type: "unknown",
      characters: [],
      confident: false,
      cover_url: "",
    }),
    { status: 501, headers: { ...cors, "Content-Type": "application/json" } },
  );
});
