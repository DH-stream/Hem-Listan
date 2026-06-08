create table if not exists public.hl_recipes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  meal_name text null,
  source_url text null,
  source_domain text null,
  image_url text null,
  ingredients jsonb not null default '[]'::jsonb,
  instructions jsonb null,
  user_rating text null check (user_rating in ('liked', 'disliked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz null
);

create unique index if not exists hl_recipes_owner_source_url_unique
  on public.hl_recipes(owner_id, source_url)
  where source_url is not null;

alter table public.hl_recipes enable row level security;

drop policy if exists "hl_recipes_select_own" on public.hl_recipes;
create policy "hl_recipes_select_own" on public.hl_recipes for select using (auth.uid() = owner_id);
drop policy if exists "hl_recipes_insert_own" on public.hl_recipes;
create policy "hl_recipes_insert_own" on public.hl_recipes for insert with check (auth.uid() = owner_id);
drop policy if exists "hl_recipes_update_own" on public.hl_recipes;
create policy "hl_recipes_update_own" on public.hl_recipes for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists "hl_recipes_delete_own" on public.hl_recipes;
create policy "hl_recipes_delete_own" on public.hl_recipes for delete using (auth.uid() = owner_id);

create table if not exists public.hl_recipe_url_feedback (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  source_url text not null,
  source_domain text null,
  recipe_title text null,
  rating text not null check (rating in ('liked', 'disliked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, source_url)
);

alter table public.hl_recipe_url_feedback enable row level security;

drop policy if exists "hl_recipe_url_feedback_select_own" on public.hl_recipe_url_feedback;
create policy "hl_recipe_url_feedback_select_own" on public.hl_recipe_url_feedback for select using (auth.uid() = owner_id);
drop policy if exists "hl_recipe_url_feedback_insert_own" on public.hl_recipe_url_feedback;
create policy "hl_recipe_url_feedback_insert_own" on public.hl_recipe_url_feedback for insert with check (auth.uid() = owner_id);
drop policy if exists "hl_recipe_url_feedback_update_own" on public.hl_recipe_url_feedback;
create policy "hl_recipe_url_feedback_update_own" on public.hl_recipe_url_feedback for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists "hl_recipe_url_feedback_delete_own" on public.hl_recipe_url_feedback;
create policy "hl_recipe_url_feedback_delete_own" on public.hl_recipe_url_feedback for delete using (auth.uid() = owner_id);
