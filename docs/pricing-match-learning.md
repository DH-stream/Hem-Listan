# Pricing match learning loop

`pricing_match_events.quality_signal` is raw observation telemetry. It records whether an automatic pricing match looked good, uncertain, or suspicious after the match was already selected.

This telemetry is intentionally observation-only in this PR. It must not change product ranking, provider search, price estimates, basket totals, basket estimate cache identity, shopping-row identity, UI totals, or completed-list pricing behavior.

Future learning should follow this guarded path:

```text
raw match event → quality signal → aggregated learning summary → guarded ranking influence
```

Before ranking consumes these signals, a follow-up PR should aggregate repeated observations into stable query/product preferences, for example in a `pricing_match_learning_summaries` table scoped by `chain`, `store_id`, `normalized_query`, and `product_id`. Suggested summary fields are `good_count`, `uncertain_count`, `suspicious_count`, `first_seen_at`, `last_seen_at`, `sample_count`, `confidence_score`, and `version`.

Guardrails for that future ranking work:

- Never use one event as truth.
- Require a minimum sample size.
- Penalize suspicious matches only after repeated suspicious signals.
- Prefer good matches only when the same query/product pair has repeated good signals.
- Scope learning by chain/store when relevant.
- Keep package-plan matches separate from direct product-price matches.
- Never let learning override hard incompatibility checks.
- Never let learning bypass prepared-food/simple-ingredient penalties.
