alter table public.pricing_match_events
  add column if not exists quality_signal jsonb;

comment on column public.pricing_match_events.quality_signal is
  'Passive quality classification for pricing auto-match telemetry. Observation-only; not used for ranking.';
