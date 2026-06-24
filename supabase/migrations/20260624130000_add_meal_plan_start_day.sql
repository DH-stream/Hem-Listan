alter table public.hl_lists
  add column if not exists meal_plan_start_day text not null default 'monday';

alter table public.hl_lists
  drop constraint if exists hl_lists_meal_plan_start_day_check;

alter table public.hl_lists
  add constraint hl_lists_meal_plan_start_day_check
  check (meal_plan_start_day in ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'));

create or replace function public.hl_create_list(
  p_id uuid,
  p_owner_id uuid,
  p_name text,
  p_icon text default 'list',
  p_theme_color text default '#1a5319',
  p_category text default 'general',
  p_meal_plan_start_day text default 'monday'
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

  if v_user_id <> p_owner_id then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  insert into public.hl_lists (
    id,
    owner_id,
    name,
    icon,
    theme_color,
    category,
    meal_plan_start_day
  ) values (
    p_id,
    p_owner_id,
    p_name,
    coalesce(p_icon, 'list'),
    coalesce(p_theme_color, '#1a5319'),
    coalesce(p_category, 'general'),
    coalesce(p_meal_plan_start_day, 'monday')
  );

  return p_id;
end;
$$;

revoke all on function public.hl_create_list(uuid, uuid, text, text, text, text, text) from public;
grant execute on function public.hl_create_list(uuid, uuid, text, text, text, text, text) to authenticated;
