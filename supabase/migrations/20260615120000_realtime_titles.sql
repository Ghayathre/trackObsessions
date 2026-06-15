-- Live-update the web app when a title changes server-side (the extension edge
-- function advances `progress` with the service-role client, so the browser never
-- sees it without a refresh). Add `titles` to the Realtime publication and emit the
-- full old row on UPDATE/DELETE so the client can filter events by user_id.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'titles'
  ) then
    alter publication supabase_realtime add table public.titles;
  end if;
end $$;

alter table public.titles replica identity full;
