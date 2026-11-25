import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "../../../../lib/auth";

export const runtime = "nodejs";

export function GET(request: Request) {
  return toNextJsHandler(auth()).GET(request);
}

export function POST(request: Request) {
  return toNextJsHandler(auth()).POST(request);
}
