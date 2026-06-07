import assert from "node:assert/strict";
import test from "node:test";
import type { IncomingMessage, ServerResponse } from "node:http";
import healthHandler from "./api/health";
import importRecipeHandler from "./api/import-recipe";

type TestResponse = ServerResponse & {
  status(statusCode: number): TestResponse;
  json(body: unknown): TestResponse;
  responseBody?: unknown;
};

function createResponse() {
  const headers = new Map<string, string>();
  const response = {
    statusCode: 200,
    setHeader(name: string, value: string | number | readonly string[]) {
      headers.set(name.toLowerCase(), String(value));
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

  return { response: response as unknown as TestResponse, headers };
}

test("health route responds independently of the recipe importer", () => {
  const { response } = createResponse();

  healthHandler({} as IncomingMessage, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.responseBody, { ok: true });
});

test("recipe route initializes and dynamically loads the importer", async () => {
  const { response, headers } = createResponse();
  const request = {
    method: "POST",
    headers: { "x-hl-request-id": "api-test-request" },
    body: { url: "not a url" },
  } as unknown as IncomingMessage & { body: { url: string } };

  await importRecipeHandler(request, response);

  assert.equal(response.statusCode, 400);
  assert.equal(headers.get("x-hl-request-id"), "api-test-request");
  assert.deepEqual(response.responseBody, {
    error: "Ange en giltig receptlänk.",
    code: "invalid_url",
    attemptedMethods: [],
    canRetryWithAi: false,
  });
});
