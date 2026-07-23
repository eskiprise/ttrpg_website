import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN ?? "*",
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
