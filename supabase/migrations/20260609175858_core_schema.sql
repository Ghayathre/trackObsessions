-- ============ Hanabi core schema ============
-- Mirrors the former MongoDB collections. All user-owned tables reference auth.users.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique,
  name text,
  theme text not null default 'tokyo-twilight',
  style text not null default 'default',
  auto_accept boolean not null default false,
  profile_public boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  slug text,
  name text not null,
  icon text default 'Sparkles',
  kind text not null default 'video',
  minutes_per_unit integer,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.titles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  title text not null,
  status text not null default 'watching',
  progress integer not null default 0,
  total integer,
  season integer,
  rating numeric,
  notes text default '',
  cover_url text default '',
  source text default 'manual',
  external_id text,
  external_source text,
  synopsis text default '',
  year text default '',
  country text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.category_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  label text,
  url text,
  created_at timestamptz not null default now()
);

create table public.suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  category_slug text,
  category_hint text,
  season integer,
  episode integer,
  cover_url text default '',
  source_url text,
  status text not null default 'pending',
  title_id uuid references public.titles (id) on delete set null,
  auto_accepted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null,
  title text default '',
  title_id uuid,
  category_id uuid,
  category_name text default '',
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text,
  prefix text,
  key_hash text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked boolean not null default false
);

create index categories_user_slug_idx       on public.categories (user_id, slug);
create index titles_user_category_idx        on public.titles (user_id, category_id);
create index titles_user_updated_idx         on public.titles (user_id, updated_at desc);
create index category_links_user_cat_idx     on public.category_links (user_id, category_id);
create index suggestions_user_status_idx     on public.suggestions (user_id, status);
create index activity_user_created_idx       on public.activity (user_id, created_at desc);
create index api_keys_key_hash_idx           on public.api_keys (key_hash);

grant select on public.profiles to anon;
grant select, insert, update on public.profiles to authenticated;

grant select on public.categories to anon;
grant select, insert, update, delete on public.categories to authenticated;

grant select (id, user_id, category_id, title, status, progress, total, season, rating,
              cover_url, source, external_id, external_source, synopsis, year, country,
              created_at, updated_at) on public.titles to anon;
grant select, insert, update, delete on public.titles to authenticated;

grant select, insert, update, delete on public.category_links to authenticated;
grant select, insert, update, delete on public.suggestions to authenticated;
grant select, insert on public.activity to authenticated;

grant select (id, user_id, label, prefix, created_at, last_used_at, revoked) on public.api_keys to authenticated;
grant insert, update, delete on public.api_keys to authenticated;
