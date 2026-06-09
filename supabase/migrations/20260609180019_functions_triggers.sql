create extension if not exists pgcrypto with schema extensions;

create or replace function public.hanabi_slugify(base text)
returns text language sql immutable set search_path = '' as $$
  select coalesce(
    nullif(left(trim(both '-_' from regexp_replace(lower(coalesce(base, '')), '[^a-z0-9_-]+', '-', 'g')), 30), ''),
    'user');
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_base text;
  v_candidate text;
  v_name text;
  i int := 2;
begin
  v_name := coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1));
  v_base := public.hanabi_slugify(v_name);
  v_candidate := v_base;
  while exists (select 1 from public.profiles where username = v_candidate) loop
    v_candidate := v_base || '-' || i;
    i := i + 1;
  end loop;

  insert into public.profiles (id, username, name)
  values (new.id, v_candidate, v_name);

  insert into public.categories (user_id, slug, name, icon, kind, minutes_per_unit, is_default)
  values
    (new.id, 'kdramas', 'K-Dramas', 'Clapperboard', 'video',   60, true),
    (new.id, 'thai-bl', 'Thai BLs', 'Heart',        'video',   45, true),
    (new.id, 'anime',   'Anime',    'Sparkles',     'video',   24, true),
    (new.id, 'manga',   'Manga',    'BookOpen',     'reading',  8, true),
    (new.id, 'books',   'Books',    'Library',      'reading',  3, true);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger titles_set_updated_at
  before update on public.titles
  for each row execute function public.set_updated_at();

create trigger suggestions_set_updated_at
  before update on public.suggestions
  for each row execute function public.set_updated_at();

create or replace function public.get_stats()
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_total int;
  v_watching int;
  v_completed int;
  v_plan int;
  v_pending int;
  v_total_minutes bigint := 0;
  v_by_category jsonb;
  v_recent jsonb;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select count(*) into v_total     from public.titles where user_id = v_uid;
  select count(*) into v_watching  from public.titles where user_id = v_uid and status = 'watching';
  select count(*) into v_completed from public.titles where user_id = v_uid and status = 'completed';
  select count(*) into v_plan      from public.titles where user_id = v_uid and status = 'plan';
  select count(*) into v_pending   from public.suggestions where user_id = v_uid and status = 'pending';

  with cat_minutes as (
    select c.id, c.slug, c.name, c.kind,
           coalesce(c.minutes_per_unit,
                    case c.kind when 'video' then 40 when 'reading' then 5 when 'custom' then 20 else 30 end) as mpu,
           count(t.id) as cnt,
           coalesce(sum(
             case when t.status = 'completed' and t.total is not null then t.total
                  else coalesce(t.progress, 0) end
           ), 0) as units
    from public.categories c
    left join public.titles t on t.category_id = c.id and t.user_id = v_uid
    where c.user_id = v_uid
    group by c.id, c.slug, c.name, c.kind, c.minutes_per_unit
    order by min(c.created_at)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', id, 'slug', slug, 'name', name, 'kind', kind,
           'count', cnt, 'minutes', units * mpu, 'hours', round((units * mpu) / 60.0, 1))), '[]'::jsonb),
         coalesce(sum(units * mpu), 0)
    into v_by_category, v_total_minutes
  from cat_minutes;

  select coalesce(jsonb_agg(r), '[]'::jsonb) into v_recent from (
    select id, user_id, category_id, title, status, progress, total, season, rating,
           cover_url, source, external_id, external_source, synopsis, year, country,
           created_at, updated_at
    from public.titles where user_id = v_uid
    order by updated_at desc limit 8
  ) r;

  return jsonb_build_object(
    'total', v_total,
    'watching', v_watching,
    'completed', v_completed,
    'plan', v_plan,
    'pending_suggestions', v_pending,
    'minutes', v_total_minutes,
    'hours', round(v_total_minutes / 60.0, 1),
    'by_category', v_by_category,
    'recent', v_recent
  );
end;
$$;

create or replace function public.create_api_key(p_label text default 'Hanabi extension')
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_raw text;
  v_hash text;
  v_id uuid;
  v_created timestamptz;
  v_label text := coalesce(nullif(p_label, ''), 'Hanabi extension');
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  v_raw := 'hnb_' || translate(encode(extensions.gen_random_bytes(28), 'base64'), '+/=', '');
  v_hash := encode(extensions.digest(v_raw, 'sha256'), 'hex');
  insert into public.api_keys (user_id, label, prefix, key_hash)
  values (v_uid, v_label, left(v_raw, 10), v_hash)
  returning id, created_at into v_id, v_created;
  return jsonb_build_object('id', v_id, 'label', v_label, 'prefix', left(v_raw, 10),
                            'key', v_raw, 'created_at', v_created);
end;
$$;

grant execute on function public.get_stats() to authenticated;
grant execute on function public.create_api_key(text) to authenticated;
