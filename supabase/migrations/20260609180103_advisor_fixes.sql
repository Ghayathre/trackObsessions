-- Trigger function should not be a public RPC
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Covering indexes for foreign keys (cascade-delete performance)
create index api_keys_user_idx        on public.api_keys (user_id);
create index titles_category_idx      on public.titles (category_id);
create index category_links_cat_idx   on public.category_links (category_id);
create index suggestions_title_idx    on public.suggestions (title_id);

-- Consolidate dual SELECT policies into one each (own OR public)
drop policy "profiles: read own"    on public.profiles;
drop policy "profiles: read public" on public.profiles;
create policy "profiles: read" on public.profiles
  for select to anon, authenticated
  using ((select auth.uid()) = id or profile_public = true);

drop policy "categories: read own"    on public.categories;
drop policy "categories: read public" on public.categories;
create policy "categories: read" on public.categories
  for select to anon, authenticated
  using ((select auth.uid()) = user_id
         or exists (select 1 from public.profiles p where p.id = categories.user_id and p.profile_public));

drop policy "titles: read own"    on public.titles;
drop policy "titles: read public" on public.titles;
create policy "titles: read" on public.titles
  for select to anon, authenticated
  using ((select auth.uid()) = user_id
         or exists (select 1 from public.profiles p where p.id = titles.user_id and p.profile_public));
