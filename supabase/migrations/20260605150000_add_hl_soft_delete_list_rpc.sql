alter table public.hl_lists
  add column if not exists deleted_at timestamptz;

create or replace function public.hl_soft_delete_list(p_list_id uuid)
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

  update public.hl_lists
  set deleted_at = now()
  where id = p_list_id
    and owner_id = v_user_id;

  if not found then
    raise exception 'list_not_found_or_not_allowed' using errcode = '42501';
  end if;

  return p_list_id;
end;
$$;

revoke all on function public.hl_soft_delete_list(uuid) from public;
grant execute on function public.hl_soft_delete_list(uuid) to authenticated;
