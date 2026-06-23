create table if not exists public.pricing_match_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid null references auth.users(id) on delete set null,
  anonymous_installation_id uuid null,
  chain text not null,
  store_id text null,
  normalized_query text not null,
  selected_product_id text null,
  selected_product_name text null,
  confidence text not null,
  score numeric null,
  score_reasons jsonb not null default '[]'::jsonb,
  score_breakdown jsonb null,
  candidate_snapshot jsonb not null default '[]'::jsonb,
  approximate_price numeric null,
  result_type text not null,
  constraint pricing_match_events_has_actor check (
    user_id is not null
    or anonymous_installation_id is not null
  ),
  constraint pricing_match_events_result_type_check check (result_type in ('auto_match')),
  constraint pricing_match_events_confidence_check check (confidence in ('high', 'medium', 'low', 'none'))
);

create index if not exists pricing_match_events_user_created_idx
  on public.pricing_match_events (user_id, created_at desc)
  where user_id is not null;

create index if not exists pricing_match_events_anon_created_idx
  on public.pricing_match_events (anonymous_installation_id, created_at desc)
  where anonymous_installation_id is not null;

alter table public.pricing_match_events enable row level security;

drop policy if exists "pricing_match_events_insert_authenticated" on public.pricing_match_events;
drop policy if exists "pricing_match_events_insert_anonymous" on public.pricing_match_events;

revoke insert, update, delete on public.pricing_match_events from anon, authenticated;
