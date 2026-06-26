alter table public.hl_tasks
  add column if not exists scheduled_date date,
  add column if not exists log_date date,
  add column if not exists logged_at timestamptz;

create or replace function public.hl_create_task(
  p_id uuid,
  p_list_id uuid,
  p_text text,
  p_checked boolean default false,
  p_notes text default null,
  p_type text default 'task',
  p_url text default null,
  p_progress integer default null,
  p_scheduled_date date default null,
  p_log_date date default null,
  p_logged_at timestamptz default null
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
    select 1 from public.hl_lists l
    where l.id = p_list_id and l.owner_id = v_user_id
  ) and not exists (
    select 1 from public.hl_list_members lm
    where lm.list_id = p_list_id and lm.user_id = v_user_id
  ) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  insert into public.hl_tasks (
    id, list_id, text, checked, notes, type, url, progress,
    scheduled_date, log_date, logged_at
  ) values (
    p_id, p_list_id, p_text, coalesce(p_checked, false), p_notes,
    coalesce(p_type, 'task'), p_url, p_progress,
    p_scheduled_date, p_log_date, p_logged_at
  );

  return p_id;
end;
$$;

revoke all on function public.hl_create_task(uuid, uuid, text, boolean, text, text, text, integer, date, date, timestamptz) from public;
grant execute on function public.hl_create_task(uuid, uuid, text, boolean, text, text, text, integer, date, date, timestamptz) to authenticated;

create or replace function public.hl_update_task(
  p_task_id uuid,
  p_checked boolean default null,
  p_text text default null,
  p_notes text default null,
  p_progress integer default null,
  p_url text default null,
  p_scheduled_date date default null,
  p_log_date date default null,
  p_logged_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_list_id uuid;
  v_has_updated_at boolean;
  v_sql text;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select t.list_id into v_list_id from public.hl_tasks t where t.id = p_task_id;
  if v_list_id is null then
    raise exception 'task_not_found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.hl_lists l
    where l.id = v_list_id and l.owner_id = v_user_id
  ) and not exists (
    select 1 from public.hl_list_members lm
    where lm.list_id = v_list_id and lm.user_id = v_user_id
  ) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'hl_tasks' and column_name = 'updated_at'
  ) into v_has_updated_at;

  v_sql := 'update public.hl_tasks set '
    || 'checked = coalesce($1, checked), '
    || 'text = coalesce($2, text), '
    || 'notes = coalesce($3, notes), '
    || 'progress = coalesce($4, progress), '
    || 'url = coalesce($5, url), '
    || 'scheduled_date = coalesce($6, scheduled_date), '
    || 'log_date = coalesce($7, log_date), '
    || 'logged_at = coalesce($8, logged_at)';

  if v_has_updated_at then
    v_sql := v_sql || ', updated_at = now()';
  end if;

  v_sql := v_sql || ' where id = $9';
  execute v_sql using p_checked, p_text, p_notes, p_progress, p_url, p_scheduled_date, p_log_date, p_logged_at, p_task_id;
  return p_task_id;
end;
$$;

revoke all on function public.hl_update_task(uuid, boolean, text, text, integer, text, date, date, timestamptz) from public;
grant execute on function public.hl_update_task(uuid, boolean, text, text, integer, text, date, date, timestamptz) to authenticated;
