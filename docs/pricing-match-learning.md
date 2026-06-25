# Pricing match learning loop

`pricing_match_events.quality_signal` is raw observation telemetry. It records whether an automatic pricing match looked good, uncertain, or suspicious after the match was already selected.

Raw events are observation-only. They must not change product ranking, provider search, price estimates, basket totals, basket estimate cache identity, shopping-row identity, UI totals, or completed-list pricing behavior.

`pricing_match_learning_summaries` aggregates repeated raw observations by `chain`, `store_id`, `normalized_query`, and `selected_product_id`. These summaries are still passive in this PR: they are for inspection and future calibration only, and live ranking must not read them until a later guarded-ranking PR explicitly wires that behavior.

The summary confidence score is conservative and informational. It should help identify repeated match patterns, but it must never be treated as truth from a single event.

Future learning should follow this guarded path:

```text
raw match event → quality signal → aggregated learning summary → guarded ranking influence
```

Guardrails for any future guarded-ranking work:

- Never use one event as truth.
- Require a minimum sample size before any ranking influence.
- Penalize suspicious matches only after repeated suspicious signals.
- Prefer good matches only when the same query/product pair has repeated good signals.
- Scope learning by chain/store when relevant.
- Keep package-plan matches separate from direct product-price matches when ranking logic needs that distinction.
- Never let learning override hard incompatibility checks.
- Never let learning bypass prepared-food/simple-ingredient penalties.
- Keep ranking changes behind an explicit, reviewable guarded-ranking PR; passive summaries alone are not a ranking input.
