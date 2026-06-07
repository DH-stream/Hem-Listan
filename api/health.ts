import type { IncomingMessage, ServerResponse } from "node:http";

type ApiResponse = ServerResponse & {
  status(statusCode: number): ApiResponse;
  json(body: unknown): ApiResponse;
};

export default function handler(_req: IncomingMessage, res: ApiResponse) {
  return res.status(200).json({ ok: true });
}
