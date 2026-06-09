-- Supabase default privileges granted anon+authenticated full-column SELECT, defeating the
-- column grants. Revoke the blanket SELECT and re-grant only the safe columns.

-- api_keys: never expose key_hash. anon has no business reading keys at all.
revoke select on public.api_keys from anon, authenticated;
grant select (id, user_id, label, prefix, created_at, last_used_at, revoked)
  on public.api_keys to authenticated;

-- titles: anon (public-profile pages) must not read `notes`. Authenticated keeps full access
-- (they only ever see their OWN rows via RLS below).
revoke select on public.titles from anon;
grant select (id, user_id, category_id, title, status, progress, total, season, rating,
              cover_url, source, external_id, external_source, synopsis, year, country,
              created_at, updated_at) on public.titles to anon;

-- Split the consolidated read policies so the PUBLIC read path is anon-only. A signed-in user
-- can only read their own rows (closing the cross-user notes leak); public profile pages use
-- the session-less anon client.
drop policy "profiles: read"   on public.profiles;
create policy "profiles: read own" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "profiles: read public" on public.profiles
  for select to anon using (profile_public = true);

drop policy "categories: read" on public.categories;
create policy "categories: read own" on public.categories
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "categories: read public" on public.categories
  for select to anon
  using (exists (select 1 from public.profiles p where p.id = categories.user_id and p.profile_public));

drop policy "titles: read" on public.titles;
create policy "titles: read own" on public.titles
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "titles: read public" on public.titles
  for select to anon
  using (exists (select 1 from public.profiles p where p.id = titles.user_id and p.profile_public));
