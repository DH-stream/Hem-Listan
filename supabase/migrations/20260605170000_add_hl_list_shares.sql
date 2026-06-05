create table if not exists public.hl_list_shares (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  source_list_id uuid null references public.hl_lists(id) on delete set null,
  share_token text not null unique,
  title text not null,
  icon text,
  theme_color text,
  category text,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz null,
  revoked_at timestamptz null
);

alter table public.hl_list_shares enable row level security;

revoke all on table public.hl_list_shares from anon, authenticated;

create index if not exists hl_list_shares_source_list_id_idx
  on public.hl_list_shares (source_list_id);

create index if not exists hl_list_shares_owner_id_idx
  on public.hl_list_shares (owner_id);

create index if not exists hl_list_shares_active_expiry_idx
  on public.hl_list_shares (share_token, expires_at)
  where revoked_at is null;

create or replace function public.hl_create_list_share(
  p_source_list_id uuid,
  p_title text,
  p_icon text default null,
  p_theme_color text default null,
  p_category text default null,
  p_snapshot jsonb default '{}'::jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_share_token text;
  v_attempts int := 0;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if not exists (
    select 1
    from public.hl_lists l
    where l.id = p_source_list_id
      and l.owner_id = v_user_id
  ) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  loop
    v_share_token := rtrim(translate(encode(gen_random_bytes(18), 'base64'), '+/', '-_'), '=');

    begin
      insert into public.hl_list_shares (
        owner_id,
        source_list_id,
        share_token,
        title,
        icon,
        theme_color,
        category,
        snapshot
      ) values (
        v_user_id,
        p_source_list_id,
        v_share_token,
        coalesce(nullif(trim(p_title), ''), 'Delad lista'),
        nullif(trim(p_icon), ''),
        nullif(trim(p_theme_color), ''),
        nullif(trim(p_category), ''),
        coalesce(p_snapshot, '{}'::jsonb)
      );

      return v_share_token;
    exception
      when unique_violation then
        v_attempts := v_attempts + 1;
        if v_attempts >= 5 then
          raise;
        end if;
    end;
  end loop;
end;
$$;

revoke all on function public.hl_create_list_share(uuid, text, text, text, text, jsonb) from public;
grant execute on function public.hl_create_list_share(uuid, text, text, text, text, jsonb) to authenticated;

create or replace function public.hl_get_public_list_share(p_share_token text)
returns table (
  title text,
  icon text,
  theme_color text,
  category text,
  snapshot jsonb,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    s.title,
    s.icon,
    s.theme_color,
    s.category,
    s.snapshot,
    s.created_at
  from public.hl_list_shares s
  where s.share_token = p_share_token
    and s.revoked_at is null
    and (s.expires_at is null or s.expires_at > now())
  limit 1;
$$;

revoke all on function public.hl_get_public_list_share(text) from public;
grant execute on function public.hl_get_public_list_share(text) to anon, authenticated;
