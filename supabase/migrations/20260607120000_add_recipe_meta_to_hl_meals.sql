alter table public.hl_meals
  add column if not exists recipe_meta jsonb null;
