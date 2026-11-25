import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "../auth";

export type ErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "invalid_request"
  | "rate_limited"
  | "conflict"
  | "unavailable"
  | "server_error";
const statuses: Record<ErrorCode, number> = {
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  invalid_request: 400,
  rate_limited: 429,
  conflict: 409,
  unavailable: 503,
  server_error: 500,
};

/** Every API error has the same shape: {error: {code, message}}. */
export function apiError(
  code: ErrorCode,
  message: string,
  headers?: HeadersInit,
) {
  return NextResponse.json(
    { error: { code, message } },
    { status: statuses[code], headers },
  );
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

/** Session auth for /api/v1. Works with the web cookie and the Expo client's cookie header. */
export async function sessionUser(request: Request) {
  const active = await auth().api.getSession({ headers: request.headers });
  return active?.user ?? null;
}

export async function readJson(
  request: Request,
  limit = 256_000,
): Promise<unknown> {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > limit) throw new RangeError("Body too large");
  const body = await request.text();
  if (body.length > limit) throw new RangeError("Body too large");
  return body ? JSON.parse(body) : {};
}

export function invalid(error: z.ZodError) {
  return apiError(
    "invalid_request",
    error.issues
      .map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`)
      .join("; "),
  );
}

/** Opaque cursor helpers for keyset pagination. */
export function encodeCursor(parts: (string | number)[]) {
  return Buffer.from(JSON.stringify(parts)).toString("base64url");
}

export function decodeCursor(value: string | null): (string | number)[] | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    );
    return Array.isArray(parsed) ? (parsed as (string | number)[]) : null;
  } catch {
    return null;
  }
}

/** Wraps a handler so a session is required and unexpected errors never leak details. */
export function withUser<A extends unknown[]>(
  handler: (
    user: { id: string; name: string; email: string },
    request: Request,
    ...rest: A
  ) => Promise<Response>,
) {
  return async (request: Request, ...rest: A) => {
    try {
      const user = await sessionUser(request);
      if (!user) return apiError("unauthorized", "Sign in to continue.");
      return await handler(user, request, ...rest);
    } catch (error) {
      if (error instanceof SyntaxError)
        return apiError("invalid_request", "Send a valid JSON body.");
      if (error instanceof RangeError)
        return apiError("invalid_request", "The request body is too large.");
      console.error(
        "API request failed:",
        error instanceof Error ? error.message : "unknown error",
      );
      return apiError("server_error", "Something went wrong. Try again.");
    }
  };
}
