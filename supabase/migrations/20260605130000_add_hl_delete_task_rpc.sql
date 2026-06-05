create or replace function public.hl_delete_task(p_task_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_list_id uuid;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select t.list_id
    into v_list_id
  from public.hl_tasks t
  where t.id = p_task_id;

  if v_list_id is null then
    raise exception 'task_not_found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.hl_lists l
    where l.id = v_list_id
      and l.owner_id = v_user_id
  ) and not exists (
    select 1
    from public.hl_list_members lm
    where lm.list_id = v_list_id
      and lm.user_id = v_user_id
  ) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  delete from public.hl_tasks t
  where t.id = p_task_id
    and t.list_id = v_list_id;

  return p_task_id;
end;
$$;

revoke all on function public.hl_delete_task(uuid) from public;
grant execute on function public.hl_delete_task(uuid) to authenticated;
