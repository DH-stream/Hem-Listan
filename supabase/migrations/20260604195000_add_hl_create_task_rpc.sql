create or replace function public.hl_create_task(
  p_id uuid,
  p_list_id uuid,
  p_text text,
  p_checked boolean default false,
  p_notes text default null,
  p_type text default 'task',
  p_url text default null,
  p_progress integer default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if not exists (
    select 1
    from public.hl_lists l
    where l.id = p_list_id
      and l.owner_id = v_user_id
  ) and not exists (
    select 1
    from public.hl_list_members lm
    where lm.list_id = p_list_id
      and lm.user_id = v_user_id
  ) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  insert into public.hl_tasks (
    id,
    list_id,
    text,
    checked,
    notes,
    type,
    url,
    progress
  ) values (
    p_id,
    p_list_id,
    p_text,
    coalesce(p_checked, false),
    p_notes,
    coalesce(p_type, 'task'),
    p_url,
    p_progress
  );

  return p_id;
end;
$$;

revoke all on function public.hl_create_task(uuid, uuid, text, boolean, text, text, text, integer) from public;
grant execute on function public.hl_create_task(uuid, uuid, text, boolean, text, text, text, integer) to authenticated;
