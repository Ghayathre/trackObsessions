-- Remember the player URL a title was last tracked from (e.g. the Netflix /watch
-- or Crunchyroll episode page) so the "Recently watched" page can jump straight
-- back into the source player. The extension already reports this as source_url;
-- we now persist it onto the title and keep it pointed at the latest episode.
--
-- authenticated keeps full table access (own rows via RLS), so it can read/write
-- this column automatically. anon was given an explicit column-list SELECT grant
-- that omits source_url, so public-profile pages can never read a private watch URL.
alter table public.titles add column if not exists source_url text default '';
