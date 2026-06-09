-- Enable RLS + owner/public policies. (The public-read policies here are later replaced by
-- anon-only versions in 20260609182050_tighten_column_grants_and_public_read.sql.)
alter table public.profiles       enable row level security;
alter table public.categories     enable row level security;
alter table public.titles         enable row level security;
alter table public.category_links enable row level security;
alter table public.suggestions    enable row level security;
alter table public.activity       enable row level security;
alter table public.api_keys       enable row level security;

create policy "profiles: read own" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "profiles: read public" on public.profiles
  for select to anon, authenticated using (profile_public = true);
create policy "profiles: insert own" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);
create policy "profiles: update own" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "categories: read own" on public.categories
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "categories: read public" on public.categories
  for select to anon, authenticated
  using (exists (select 1 from public.profiles p where p.id = categories.user_id and p.profile_public));
create policy "categories: insert own" on public.categories
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "categories: update own" on public.categories
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "categories: delete own" on public.categories
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "titles: read own" on public.titles
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "titles: read public" on public.titles
  for select to anon, authenticated
  using (exists (select 1 from public.profiles p where p.id = titles.user_id and p.profile_public));
create policy "titles: insert own" on public.titles
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "titles: update own" on public.titles
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "titles: delete own" on public.titles
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "links: read own" on public.category_links
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "links: insert own" on public.category_links
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "links: update own" on public.category_links
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "links: delete own" on public.category_links
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "suggestions: read own" on public.suggestions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "suggestions: insert own" on public.suggestions
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "suggestions: update own" on public.suggestions
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "suggestions: delete own" on public.suggestions
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "activity: read own" on public.activity
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "activity: insert own" on public.activity
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "api_keys: read own" on public.api_keys
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "api_keys: insert own" on public.api_keys
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "api_keys: update own" on public.api_keys
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "api_keys: delete own" on public.api_keys
  for delete to authenticated using ((select auth.uid()) = user_id);
