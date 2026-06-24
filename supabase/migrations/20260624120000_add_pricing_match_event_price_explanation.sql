alter table public.pricing_match_events
  add column if not exists price_explanation jsonb null;
