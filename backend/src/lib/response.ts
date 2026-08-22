import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";

// Access-Control-Allow-Origin is deliberately NOT set here — with more than one
// allowed origin (e.g. the deployed dev domain AND localhost:5173 for local
// development) a single static value can't correctly satisfy both, since the browser
// requires this header to exactly match the request's own Origin. See api.ts's
// handler, which sets it once centrally after resolving the caller's actual Origin
// against ALLOWED_ORIGINS.
const CORS_HEADERS = {
  "Access-Control-Allow-Headers": "Authorization,Content-Type",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
};

export function json(
  statusCode: number,
  body: unknown
): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    body: JSON.stringify(body),
  };
}

export class HttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

export function errorResponse(err: unknown): APIGatewayProxyStructuredResultV2 {
  if (err instanceof HttpError) {
    return json(err.statusCode, { error: err.message });
  }
  console.error(err);
  return json(500, { error: "Internal server error" });
}
