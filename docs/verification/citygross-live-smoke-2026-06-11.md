# City Gross live pricing smoke — 2026-06-11

The smoke test called Hem-Listan's local `POST /api/pricing/basket` endpoint. The running server performed the City Gross request; the smoke client did not call City Gross directly.

## Commands

```sh
npm test
npx tsc --noEmit
npm run build
npx --yes --package=node@24 --package=tsx node --use-env-proxy --import tsx server.ts
PRICING_BASE_URL=http://127.0.0.1:3000 npm run smoke:pricing
```

Node 24's `--use-env-proxy` was required only because the verification sandbox routes outbound HTTPS through its configured proxy.

## Live output

```text
First basket request: HTTP 200 (1098 ms)
Matched items: 6/6
ägg → GARANT Ägg 24P Frigående Inomhus → 59.95 kr → medium
ägg → GARANT Ägg 24P Frigående Inomhus → 59.95 kr → medium
mjölk → GARANT Mjölk Längre Hållbarhet → 17.5 kr → medium
pasta → GARANT Gemelli → 14.1 kr → medium
kaffe → LÖFBERGS Originalet Mellanrost → 65.25 kr → low
banan → Banan Eko → 21.95 kr → medium
approximateTotalSek: 238.7 kr

Second basket request (cache check): HTTP 200 (15 ms)
Matched items: 6/6
ägg → GARANT Ägg 24P Frigående Inomhus → 59.95 kr → medium
ägg → GARANT Ägg 24P Frigående Inomhus → 59.95 kr → medium
mjölk → GARANT Mjölk Längre Hållbarhet → 17.5 kr → medium
pasta → GARANT Gemelli → 14.1 kr → medium
kaffe → LÖFBERGS Originalet Mellanrost → 65.25 kr → low
banan → Banan Eko → 21.95 kr → medium
approximateTotalSek: 238.7 kr
```

The second identical request returned the same results in 15 ms instead of 1098 ms, consistent with the process-local server cache being warm. The automated deduplication test separately verifies that equivalent normalized basket items invoke the upstream search once.
