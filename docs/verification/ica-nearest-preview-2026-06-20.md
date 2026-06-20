# ICA nearest-store preview verification — 2026-06-20

Verification was run against a locally built preview server (`npm run build`, `npm start`) on June 20, 2026.

## Environment note

The app server uses Node `fetch`. In this container, Node `fetch` does not use the configured HTTP(S) proxy and outbound requests fail with `ENETUNREACH`. Direct `curl` to the same upstream hosts succeeds through the proxy, so the preview calls below verify JSON fallback behavior but cannot verify successful live geocoding/pricing selection from this container.

## Commands

```sh
npm run build
npm start
python - <<'PY'
import json, time, urllib.request
urls = [
('/api/location/reverse?lat=57.8700&lng=11.9800','reverse_kungalv'),
('/api/ica/stores/nearest?lat=57.8700&lng=11.9800','nearest_kungalv_first'),
('/api/ica/stores/nearest?lat=57.8700&lng=11.9800','nearest_kungalv_repeat'),
('/api/ica/stores/nearest?lat=57.7210&lng=12.9401','nearest_boras_first'),
('/api/ica/stores/nearest?lat=57.7210&lng=12.9401','nearest_boras_repeat'),
]
for path,label in urls:
    t=time.time()
    with urllib.request.urlopen('http://localhost:3000'+path, timeout=8) as r:
        data=json.loads(r.read())
        print(label, r.status, round((time.time()-t)*1000), data)
PY
```

## Results

| Call | HTTP status | Selected store | userPlaceQuery | candidateCount | geocodeAttemptCount | geocodedCandidateCount | priceProbeCount | skippedBecauseNoPriceCount | selectedDistanceKm | totalMs | reverseGeocodeMs | citySearchMs | geocodeMs | priceProbeMs | geocodeCacheHitCount | priceCapabilityCacheHitCount | timedOut | error |
|---|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|
| `/api/location/reverse?lat=57.8700&lng=11.9800` | 200 | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | `fetch failed` (`reverse_geocode_failed`) |
| `/api/ica/stores/nearest?lat=57.8700&lng=11.9800` | 200 | none | n/a | 0 | 0 | 0 | 0 | 0 | null | 37 | 0 | 0 | 0 | 0 | 0 | 0 | false | `fetch failed` |
| repeat `/api/ica/stores/nearest?lat=57.8700&lng=11.9800` | 200 | none | n/a | 0 | 0 | 0 | 0 | 0 | null | 41 | 0 | 0 | 0 | 0 | 0 | 0 | false | `fetch failed` |
| `/api/ica/stores/nearest?lat=57.7210&lng=12.9401` | 200 | none | n/a | 0 | 0 | 0 | 0 | 0 | null | 40 | 0 | 0 | 0 | 0 | 0 | 0 | false | `fetch failed` |
| repeat `/api/ica/stores/nearest?lat=57.7210&lng=12.9401` | 200 | none | n/a | 0 | 0 | 0 | 0 | 0 | null | 37 | 0 | 0 | 0 | 0 | 0 | 0 | false | `fetch failed` |

## Follow-up needed

Run the same calls in the deployed preview/Vercel environment, where server-side `fetch` has direct outbound internet access, before merging. The local verification confirms that endpoint responses remain JSON and do not become opaque 500s under upstream fetch failure.
