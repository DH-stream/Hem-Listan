create table if not exists public.pricing_match_learning_summaries (
  id uuid primary key default gen_random_uuid(),
  chain text not null,
  store_id text null,
  store_key text generated always as (coalesce(store_id, '')) stored,
  normalized_query text not null,
  selected_product_id text not null,
  selected_product_name text null,
  good_count integer not null default 0,
  uncertain_count integer not null default 0,
  suspicious_count integer not null default 0,
  sample_count integer not null default 0,
  confidence_score numeric not null default 0,
  first_seen_at timestamptz null,
  last_seen_at timestamptz null,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pricing_match_learning_summaries_counts_check check (
    good_count >= 0
    and uncertain_count >= 0
    and suspicious_count >= 0
    and sample_count = good_count + uncertain_count + suspicious_count
  ),
  constraint pricing_match_learning_summaries_unique unique (
    chain,
    store_key,
    normalized_query,
    selected_product_id
  )
);

comment on table public.pricing_match_learning_summaries is
  'Passive aggregate of pricing_match_events quality signals. Informational only; live ranking must not read this table in this PR.';

create index if not exists pricing_match_learning_summaries_lookup_idx
  on public.pricing_match_learning_summaries (
    chain,
    store_key,
    normalized_query,
    confidence_score desc,
    sample_count desc
  );

create or replace function public.refresh_pricing_match_learning_summaries()
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.pricing_match_learning_summaries (
    chain,
    store_id,
    normalized_query,
    selected_product_id,
    selected_product_name,
    good_count,
    uncertain_count,
    suspicious_count,
    sample_count,
    confidence_score,
    first_seen_at,
    last_seen_at,
    version,
    updated_at
  )
  select
    chain,
    store_id,
    normalized_query,
    selected_product_id,
    (array_agg(selected_product_name order by created_at desc) filter (where selected_product_name is not null))[1],
    count(*) filter (where quality_signal->>'label' = 'good')::integer,
    count(*) filter (where quality_signal->>'label' = 'uncertain')::integer,
    count(*) filter (where quality_signal->>'label' = 'suspicious')::integer,
    count(*)::integer,
    case
      when count(*) = 0 then 0
      else (
        (count(*) filter (where quality_signal->>'label' = 'good'))::numeric
        - (count(*) filter (where quality_signal->>'label' = 'suspicious'))::numeric * 2
      ) / count(*)::numeric
    end,
    min(created_at),
    max(created_at),
    1,
    now()
  from public.pricing_match_events
  where quality_signal is not null
    and selected_product_id is not null
    and quality_signal->>'label' in ('good', 'uncertain', 'suspicious')
  group by chain, store_id, normalized_query, selected_product_id
  on conflict (chain, store_key, normalized_query, selected_product_id)
  do update set
    store_id = excluded.store_id,
    selected_product_name = excluded.selected_product_name,
    good_count = excluded.good_count,
    uncertain_count = excluded.uncertain_count,
    suspicious_count = excluded.suspicious_count,
    sample_count = excluded.sample_count,
    confidence_score = excluded.confidence_score,
    first_seen_at = excluded.first_seen_at,
    last_seen_at = excluded.last_seen_at,
    version = excluded.version,
    updated_at = now();
$$;

comment on function public.refresh_pricing_match_learning_summaries() is
  'Rebuilds passive pricing match learning summaries from raw quality_signal events. The conservative score is informational only and must not affect live ranking.';
