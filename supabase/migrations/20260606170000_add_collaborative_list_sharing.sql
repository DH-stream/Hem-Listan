create table if not exists public.hl_list_members (
  list_id uuid not null references public.hl_lists(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  primary key (list_id, user_id)
);

alter table public.hl_list_members
  add column if not exists role text default 'member',
  add column if not exists created_at timestamptz default now();

update public.hl_list_members set role = 'member' where role is null;
update public.hl_list_members set created_at = now() where created_at is null;
alter table public.hl_list_members alter column role set default 'member';
alter table public.hl_list_members alter column role set not null;
alter table public.hl_list_members alter column created_at set default now();
alter table public.hl_list_members alter column created_at set not null;

create unique index if not exists hl_list_members_list_user_uidx
  on public.hl_list_members(list_id, user_id);

alter table public.hl_list_members drop constraint if exists hl_list_members_role_check;
alter table public.hl_list_members
  add constraint hl_list_members_role_check check (role in ('owner', 'member'));

insert into public.hl_list_members (list_id, user_id, role)
select l.id, l.owner_id, 'owner'
from public.hl_lists l
on conflict (list_id, user_id) do update set role = 'owner';

create or replace function public.hl_add_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.hl_list_members (list_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (list_id, user_id) do update set role = 'owner';
  return new;
end;
$$;

drop trigger if exists hl_lists_add_owner_membership on public.hl_lists;
create trigger hl_lists_add_owner_membership
after insert or update of owner_id on public.hl_lists
for each row execute function public.hl_add_owner_membership();

create table if not exists public.hl_list_invites (
  id uuid primary key default extensions.gen_random_uuid(),
  list_id uuid not null references public.hl_lists(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  accepted_at timestamptz null,
  accepted_by uuid null references auth.users(id) on delete set null
);

alter table public.hl_list_invites
  add column if not exists accepted_by uuid null references auth.users(id) on delete set null;

create index if not exists hl_list_members_user_id_idx on public.hl_list_members(user_id);
create index if not exists hl_list_invites_list_id_idx on public.hl_list_invites(list_id);
create index if not exists hl_list_invites_valid_token_idx
  on public.hl_list_invites(token) where accepted_at is null;

create or replace function public.hl_has_list_access(p_list_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_user_id is not null and exists (
    select 1 from public.hl_lists l
    where l.id = p_list_id and l.owner_id = p_user_id
    union all
    select 1 from public.hl_list_members lm
    where lm.list_id = p_list_id and lm.user_id = p_user_id
  );
$$;

create or replace function public.hl_can_manage_list(p_list_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_user_id is not null and exists (
    select 1 from public.hl_lists l
    where l.id = p_list_id and l.owner_id = p_user_id
    union all
    select 1 from public.hl_list_members lm
    where lm.list_id = p_list_id and lm.user_id = p_user_id and lm.role = 'owner'
  );
$$;

revoke all on function public.hl_has_list_access(uuid, uuid) from public;
revoke all on function public.hl_can_manage_list(uuid, uuid) from public;
grant execute on function public.hl_has_list_access(uuid, uuid) to authenticated;
grant execute on function public.hl_can_manage_list(uuid, uuid) to authenticated;

create or replace function public.hl_create_list_invite(p_list_id uuid)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_token text;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not public.hl_can_manage_list(p_list_id, v_user_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  loop
    v_token := rtrim(translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/', '-_'), '=');
    begin
      insert into public.hl_list_invites (list_id, created_by, token)
      values (p_list_id, v_user_id, v_token);
      return v_token;
    exception when unique_violation then
      -- Retry the cryptographically random token collision.
    end;
  end loop;
end;
$$;

create or replace function public.hl_accept_list_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_invite public.hl_list_invites%rowtype;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_invite
  from public.hl_list_invites i
  where i.token = p_token
    and (
      (i.accepted_at is null and (i.expires_at is null or i.expires_at > now()))
      or i.accepted_by = v_user_id
    )
  for update;

  if not found then
    raise exception 'invite_not_found_or_expired' using errcode = 'P0002';
  end if;

  if v_invite.accepted_by = v_user_id then
    return v_invite.list_id;
  end if;

  insert into public.hl_list_members (list_id, user_id, role)
  values (v_invite.list_id, v_user_id, case when v_invite.created_by = v_user_id then 'owner' else 'member' end)
  on conflict (list_id, user_id) do nothing;

  update public.hl_list_invites
  set accepted_at = now(), accepted_by = v_user_id
  where id = v_invite.id;
  return v_invite.list_id;
end;
$$;

revoke all on function public.hl_create_list_invite(uuid) from public;
revoke all on function public.hl_accept_list_invite(text) from public;
grant execute on function public.hl_create_list_invite(uuid) to authenticated;
grant execute on function public.hl_accept_list_invite(text) to authenticated;

alter table public.hl_list_members enable row level security;
alter table public.hl_list_invites enable row level security;

create policy "Members can read accessible memberships"
on public.hl_list_members for select to authenticated
using (public.hl_has_list_access(list_id));

create policy "Owners can manage memberships"
on public.hl_list_members for all to authenticated
using (public.hl_can_manage_list(list_id))
with check (public.hl_can_manage_list(list_id));

create policy "Owners can read invites"
on public.hl_list_invites for select to authenticated
using (public.hl_can_manage_list(list_id));

create policy "Owners can delete invites"
on public.hl_list_invites for delete to authenticated
using (public.hl_can_manage_list(list_id));

create policy "Members can read shared lists"
on public.hl_lists for select to authenticated
using (public.hl_has_list_access(id));

create policy "Members can read shared tasks"
on public.hl_tasks for select to authenticated
using (public.hl_has_list_access(list_id));
create policy "Members can create shared tasks"
on public.hl_tasks for insert to authenticated
with check (public.hl_has_list_access(list_id));
create policy "Members can update shared tasks"
on public.hl_tasks for update to authenticated
using (public.hl_has_list_access(list_id))
with check (public.hl_has_list_access(list_id));
create policy "Members can delete shared tasks"
on public.hl_tasks for delete to authenticated
using (public.hl_has_list_access(list_id));

create policy "Members can read shared meals"
on public.hl_meals for select to authenticated
using (public.hl_has_list_access(list_id));
create policy "Members can create shared meals"
on public.hl_meals for insert to authenticated
with check (public.hl_has_list_access(list_id));
create policy "Members can update shared meals"
on public.hl_meals for update to authenticated
using (public.hl_has_list_access(list_id))
with check (public.hl_has_list_access(list_id));
create policy "Members can delete shared meals"
on public.hl_meals for delete to authenticated
using (public.hl_has_list_access(list_id));
