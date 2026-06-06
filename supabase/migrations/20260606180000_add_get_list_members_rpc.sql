create or replace function public.hl_get_list_members(p_list_id uuid)
returns table (
  user_id uuid,
  role text,
  display_name text,
  avatar_url text,
  avatar_path text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if not public.hl_has_list_access(p_list_id, auth.uid()) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  return query
  select
    lm.user_id,
    lm.role,
    p.display_name,
    p.avatar_url,
    p.avatar_path
  from public.hl_list_members lm
  left join public.hl_profiles p on p.user_id = lm.user_id
  where lm.list_id = p_list_id
  order by case when lm.role = 'owner' then 0 else 1 end, lm.created_at, lm.user_id;
end;
$$;

revoke all on function public.hl_get_list_members(uuid) from public;
grant execute on function public.hl_get_list_members(uuid) to authenticated;
