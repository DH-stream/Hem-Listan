import assert from "node:assert/strict";
import test from "node:test";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createIcaStoreSearchHandler } from "./api/ica/stores/search";
import { createIcaNearestStoreHandler } from "./api/ica/stores/nearest";

type TestResponse = ServerResponse & {
  status(statusCode: number): TestResponse;
  json(body: unknown): TestResponse;
  responseBody?: unknown;
};

const createResponse = () => {
  const response = {
    statusCode: 200,
    setHeader() {
      return response;
    },
    status(statusCode: number) {
      response.statusCode = statusCode;
      return response;
    },
    json(body: unknown) {
      response.responseBody = body;
      return response;
    },
    responseBody: undefined as unknown,
  };
  return response as unknown as TestResponse;
};

const createRequest = (url: string) => ({ url }) as IncomingMessage;

const getDebugStage = (body: unknown) =>
  (body as { debug?: { stage?: string } }).debug?.stage;

test("ICA store search healthcheck returns JSON without loading module", async () => {
  let loaded = false;
  const handler = createIcaStoreSearchHandler(async () => {
    loaded = true;
    throw new Error("should not load");
  });
  const response = createResponse();

  await handler(createRequest("/api/ica/stores/search?q=healthcheck"), response);

  assert.equal(response.statusCode, 200);
  assert.equal(loaded, false);
  assert.deepEqual(response.responseBody, {
    ok: true,
    stores: [],
    debug: {
      query: "healthcheck",
      upstreamUrl: "https://www.ica.se/butiker/",
      parsedStoreCount: 0,
      filteredStoreCount: 0,
      firstParsedStores: [],
      source: "ica_html",
      fallbackUsed: false,
      stage: "healthcheck",
    },
  });
});

test("ICA store search module load failure returns JSON debug", async () => {
  const handler = createIcaStoreSearchHandler(async () => {
    throw new Error("module exploded");
  });
  const response = createResponse();

  await handler(createRequest("/api/ica/stores/search?q=Karlstad"), response);

  assert.equal(response.statusCode, 200);
  assert.equal((response.responseBody as { error?: string }).error, "ICA store search module unavailable");
  assert.equal(getDebugStage(response.responseBody), "module_load_failed");
  assert.equal((response.responseBody as { debug?: { error?: string } }).debug?.error, "module exploded");
});

test("ICA store search failure returns JSON debug", async () => {
  const handler = createIcaStoreSearchHandler(async () => ({
    searchIcaStoresWithDebug: async () => {
      throw new Error("upstream blocked");
    },
  }));
  const response = createResponse();

  await handler(createRequest("/api/ica/stores/search?q=Borås"), response);

  assert.equal(response.statusCode, 200);
  assert.equal((response.responseBody as { error?: string }).error, "ICA store search unavailable");
  assert.equal(getDebugStage(response.responseBody), "search_failed");
  assert.equal((response.responseBody as { debug?: { error?: string } }).debug?.error, "upstream blocked");
});

test("ICA store search success returns fake module stores", async () => {
  const handler = createIcaStoreSearchHandler(async () => ({
    searchIcaStoresWithDebug: async (query: string) => ({
      stores: [
        {
          chain: "ica" as const,
          storeId: "1004888",
          label: "ICA Supermarket Karlstad",
          storeUrl: "https://handlaprivatkund.ica.se/stores/1004888",
        },
      ],
      debug: {
        query,
        upstreamUrl: "https://www.ica.se/butiker/",
        upstreamStatus: 200,
        htmlLength: 123,
        parsedStoreCount: 1,
        filteredStoreCount: 1,
        firstParsedStores: [],
        source: "ica_html" as const,
        fallbackUsed: false,
      },
    }),
  }));
  const response = createResponse();

  await handler(createRequest("/api/ica/stores/search?q=Karlstad"), response);

  assert.equal(response.statusCode, 200);
  assert.equal((response.responseBody as { stores?: Array<{ storeId: string }> }).stores?.[0]?.storeId, "1004888");
  assert.equal((response.responseBody as { debug?: { filteredStoreCount?: number } }).debug?.filteredStoreCount, 1);
});


test("ICA nearest store route ranks fake module stores", async () => {
  const handler = createIcaNearestStoreHandler(async () => ({
    findNearestIcaStoreWithDebug: async () => ({
      store: { chain: "ica" as const, storeId: "1004888", label: "ICA Nära Test" },
      stores: [{ chain: "ica" as const, storeId: "1004888", label: "ICA Nära Test" }],
      debug: {
        lat: 57.7,
        lng: 11.9,
        parsedStoreCount: 2,
        storesWithCoordinatesCount: 1,
        nearestDistanceKm: 1.2,
        fallbackUsed: false,
      },
    }),
  }));
  const response = createResponse();

  await handler(createRequest("/api/ica/stores/nearest?lat=57.7&lng=11.9"), response);

  assert.equal(response.statusCode, 200);
  assert.equal((response.responseBody as { store?: { storeId: string } }).store?.storeId, "1004888");
  assert.equal((response.responseBody as { debug?: { storesWithCoordinatesCount?: number } }).debug?.storesWithCoordinatesCount, 1);
});

test("ICA nearest store route returns no store when module has no coordinate matches", async () => {
  const handler = createIcaNearestStoreHandler(async () => ({
    findNearestIcaStoreWithDebug: async () => ({
      store: null,
      stores: [],
      debug: {
        lat: 57.7,
        lng: 11.9,
        parsedStoreCount: 1,
        storesWithCoordinatesCount: 0,
        nearestDistanceKm: null,
        fallbackUsed: false,
      },
    }),
  }));
  const response = createResponse();

  await handler(createRequest("/api/ica/stores/nearest?lat=57.7&lng=11.9"), response);

  assert.equal(response.statusCode, 200);
  assert.equal((response.responseBody as { store?: unknown }).store, null);
});
