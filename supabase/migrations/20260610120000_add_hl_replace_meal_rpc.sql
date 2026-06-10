create or replace function public.hl_replace_meal(
  p_list_id uuid,
  p_day text,
  p_type text,
  p_name text,
  p_recipe_meta jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_meal_id uuid;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if not public.hl_has_list_access(p_list_id, v_user_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  -- Serialize replacements for the same slot. The delete and insert below are
  -- one transaction, so an insert error rolls the delete back automatically.
  perform pg_advisory_xact_lock(
    hashtextextended(p_list_id::text || ':' || p_day || ':' || p_type, 0)
  );

  delete from public.hl_meals
  where list_id = p_list_id
    and day = p_day
    and type = p_type;

  insert into public.hl_meals (
    list_id,
    day,
    type,
    name,
    recipe_meta
  ) values (
    p_list_id,
    p_day,
    p_type,
    p_name,
    p_recipe_meta
  )
  returning id into v_meal_id;

  return v_meal_id;
end;
$$;

revoke all on function public.hl_replace_meal(uuid, text, text, text, jsonb) from public;
grant execute on function public.hl_replace_meal(uuid, text, text, text, jsonb) to authenticated;
