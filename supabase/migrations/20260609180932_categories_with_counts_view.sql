-- View exposing each category with its title count. security_invoker so the caller's RLS
-- applies to BOTH the categories and the counted titles (works for owner + public profiles).
create view public.categories_with_counts
  with (security_invoker = true) as
  select c.id, c.user_id, c.slug, c.name, c.icon, c.kind, c.minutes_per_unit,
         c.is_default, c.created_at,
         (select count(*) from public.titles t where t.category_id = c.id)::int as count
  from public.categories c;

grant select on public.categories_with_counts to anon, authenticated;
