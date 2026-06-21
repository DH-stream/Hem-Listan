# Willys and Coop provider spike

Date: 2026-06-21

Goal: determine whether Willys or Coop can support the existing basket pricing flow: list item query -> product search -> normalized product prices -> basket estimate. This spike is documentation-only and does not change any existing pricing behavior.

## Summary

| Chain | Search without login | Prices returned | Store required | Session/auth required | Server-side fetch risk | Recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| Willys | Yes | Yes | Not for the tested search endpoint | No login and no explicit cookie/session in the tested requests | Low based on direct `curl` from this server environment | Build next |
| Coop | Page loads without login; product API call not confirmed | Not confirmed from API; search page HTML does not include product JSON | Likely yes or defaulted (`defaultStoreId: 251300`) | Public page exposes API settings/subscription key, but direct API attempts returned 404 | Medium/high until endpoint shape is confirmed; possible API proxy or route mismatch rather than WAF | Pause / needs deeper API discovery |

## Willys

### Tested endpoints and commands

- Search page HTML: `GET https://www.willys.se/sok?q=banan`
- JSON product search: `GET https://www.willys.se/search?q=banan`
- Repeated JSON searches with URL-encoded `q` for `banan`, `mjölk`, `pasta`, `ägg`, and `kaffe`.
- Tested with only a browser-like user agent, for example:

```bash
curl -L -sS -A 'Mozilla/5.0' 'https://www.willys.se/search?q=banan'
```

### Result

`https://www.willys.se/search?q=banan` returned `200 OK` with `content-type: application/json;charset=UTF-8` and a top-level `results` array. No login redirect, CAPTCHA page, WAF challenge, or explicit store-selection failure was observed from this environment.

### Example response shape

Trimmed example from `GET https://www.willys.se/search?q=banan`:

```json
{
  "results": [
    {
      "name": "Banan Klass 1",
      "code": "100254920_KG",
      "price": "18,80 kr",
      "priceValue": 18.8,
      "priceNoUnit": "18,80",
      "priceUnit": "kr/kg",
      "comparePrice": "18,80 kr",
      "comparePriceUnit": "kg",
      "productLine2": "ca: 180g",
      "displayVolume": "ca: 180g",
      "online": true,
      "outOfStock": false,
      "image": {
        "url": "https://assets.axfood.se/image/upload/f_auto,t_200/07311042002499_C1N1_s01"
      },
      "thumbnail": {
        "url": "https://assets.axfood.se/image/upload/f_auto,t_100/07311042002499_C1N1_s01"
      }
    }
  ]
}
```

### Field coverage for the basket pricing model

- Product search: yes, via `GET /search?q=...`.
- Product name: yes, `name`.
- Price: yes, `price`, `priceNoUnit`, and numeric `priceValue`.
- Unit label: yes, `priceUnit`, `comparePrice`, `comparePriceUnit`, plus `productLine2`/`displayVolume`.
- Product URL: not returned as a full URL in the observed JSON. A provider could likely derive a stable URL from `code` only after confirming Willys product URL patterns. This should be verified before implementation.
- Image: yes, `image.url` and `thumbnail.url`.
- Store selection: not required for the tested search endpoint. No store id, postal code, or selected-store cookie was sent.
- Cookies/session/auth: no login or explicit session/auth header was required for the tested JSON requests.
- Vercel/server-side fetch: likely viable. Direct server-side `curl` from this environment returned JSON for all tested queries without browser automation.
- WAF/bot protection: no WAF challenge observed in this environment.

### Common product query smoke results

| Query | Result count | First result | First price | Unit / compare unit | Image returned |
| --- | ---: | --- | --- | --- | --- |
| `banan` | 10 | Banan Klass 1 | 18,80 kr | kr/kg; compare kg | Yes |
| `mjölk` | 10 | Mellanmjölk Längre Hållbarhet 1,5% | 15,90 kr | kr/st; compare l | Yes |
| `pasta` | 10 | Fusilli Pasta | 8,42 kr | kr/st; compare kg | Yes |
| `ägg` | 10 | Ägg 24p Frigående Inomhus Medium | 59,90 kr | kr/st; compare st | Yes |
| `kaffe` | 10 | Mellanrost Classic Bryggkaffe | 73,90 kr | kr/st; compare kg | Yes |

### Recommendation

Build Willys next, behind an explicit chain option and without changing existing ICA or City Gross behavior. The only material open question is product URL derivation; the pricing estimate itself can be supported by the returned name, numeric price, unit labels, and image.

## Coop

### Tested endpoints and commands

- Search page HTML: `GET https://www.coop.se/handla/sok/?q=banan`
- Home page/settings discovery: `GET https://www.coop.se/`
- Ecommerce JS bundle: `GET https://www.coop.se/Assets/apps/coopse/dist/coopse.script.ecommerceApp.1b0b40d6.js`
- Direct API attempts based on public `window.coopSettings.serviceAccess` values:
  - `POST https://external.api.coop.se/ecommerce/v1/search/products?storeId=251300&api-version=v1`
  - `POST https://external.api.coop.se/ecommerce/search/products?storeId=251300&api-version=v1`
  - `POST https://www.coop.se/api/search/products?storeId=251300&api-version=v1`

Example direct API request body attempted:

```json
{
  "query": "banan",
  "resultsOptions": {
    "skip": 0,
    "take": 4,
    "sortBy": [],
    "facets": []
  },
  "relatedResultsOptions": {
    "skip": 0,
    "take": 16
  }
}
```

### Result

`https://www.coop.se/handla/sok/?q=banan` returned `200 OK` HTML without requiring login. The page did not include product result JSON in the server-rendered HTML. It did expose client settings including:

- `serviceAccess.hybrisApiUrl`: `https://external.api.coop.se/ecommerce`
- `serviceAccess.hybrisApiSubscriptionKey`: a public subscription key embedded in the page
- `serviceAccess.hybrisApiVersion`: `v1`
- `ecommerce.defaultStoreId`: `251300`
- `ecommerce.search.url`: `/handla/sok/`
- `ecommerce.enableAiSearch`: `true`

The downloaded ecommerce JS bundle contains product search calls shaped like `post("/search/products", body, { params: ... })`, with request bodies containing `query`, `resultsOptions`, and `relatedResultsOptions`. However, the direct endpoint attempts above returned `404 Not Found`, not product data.

### Field coverage for the basket pricing model

- Product search: likely possible in the browser app, but the direct endpoint shape was not confirmed.
- Product name: not confirmed from API.
- Price: not confirmed from API.
- Unit label: not confirmed from API.
- Product URL: not confirmed from API.
- Image: not confirmed from API.
- Store selection: likely required or defaulted. The page text says Coop needs a postal code to show the right assortment and products, and the app settings include `defaultStoreId: 251300`.
- Cookies/session/auth: no login was required to load the search page, but direct API access may depend on Coop's frontend proxy/client configuration. Public subscription keys are present in page settings, but were not sufficient with the attempted URL shapes.
- Vercel/server-side fetch: not confirmed. Direct server-side requests reached Coop and returned normal `404` responses rather than a WAF challenge, but did not produce usable product data.
- WAF/bot protection: no explicit WAF/CAPTCHA challenge was observed. The blocker appears to be endpoint discovery or required proxy parameters rather than bot protection.

### Common product query smoke results

The five common product queries were only confirmed for the public search page loading path, not for structured product results:

| Query | Search page without login | Structured products/prices returned |
| --- | --- | --- |
| `banan` | Yes | Not confirmed |
| `mjölk` | Not separately confirmed after API blocker | Not confirmed |
| `pasta` | Not separately confirmed after API blocker | Not confirmed |
| `ägg` | Not separately confirmed after API blocker | Not confirmed |
| `kaffe` | Not separately confirmed after API blocker | Not confirmed |

### Recommendation

Pause Coop implementation until the product search API route and required params are confirmed. It does not appear immediately blocked by WAF, but the current spike did not prove that server-side code can get normalized product names/prices/images. A follow-up Coop-only spike should inspect browser network traffic or reproduce the frontend's local API proxy behavior exactly.

## Proposed follow-up PR plan for Willys

1. Add a `GroceryChainId` value for Willys without changing existing ICA or City Gross IDs or behavior.
2. Add a Willys provider search helper that calls `GET https://www.willys.se/search?q=<query>` and normalizes `name`, `priceValue`, `priceUnit`, `comparePrice`, `comparePriceUnit`, `image.url`, `thumbnail.url`, `code`, and stock/online flags.
3. Add an API route for Willys basket search/pricing that mirrors existing provider patterns but keeps pricing cache identity and basket matching identity unchanged except for the new chain/provider namespace.
4. Add tests using recorded Willys response fixtures for the five smoke queries and edge cases such as missing image, missing numeric price, out-of-stock, and kg-priced products.
5. Add a minimal Willys chain option in `PricingSourceSheet` only after the provider route and tests are in place.
6. Defer full UI, store selection, and product URL linking until product URL patterns and any store-specific price behavior are confirmed.
