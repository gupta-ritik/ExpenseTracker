import { apiError, ok, readJson } from "../../../../lib/api/http";
import { readSmsPayload } from "../../../../lib/capture/adapters";
import { captureMessages } from "../../../../lib/capture/messages";
import { authenticateIngest, rateLimit } from "../../../../lib/capture/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Token-authenticated SMS webhook for the mobile app, iPhone Shortcuts and SMS
 * forwarders. Not covered by the session middleware. Raw text is parsed in
 * memory and discarded; only the parsed result is stored.
 */
export async function POST(request: Request) {
  try {
    const token = await authenticateIngest(
      request.headers.get("authorization"),
    );
    if (!token)
      return apiError(
        "unauthorized",
        "Send a valid ingest token as a Bearer token.",
      );
    if (!(await rateLimit(`ingest:${token.id}`, 60))) {
      return apiError("rate_limited", "Up to 60 requests a minute per token.", {
        "retry-after": "60",
      });
    }
    const payload = readSmsPayload(await readJson(request));
    if (!payload)
      return apiError(
        "invalid_request",
        "Send {text, sender, receivedAt} or {messages: [...]} with up to 100 messages.",
      );
    // Accept a batch whose items were all unusable, so the sender drops them
    // instead of retrying the same batch forever.
    if (!payload.messages.length)
      return ok({
        received: 0,
        skipped: payload.skipped ?? 0,
        inserted: 0,
        duplicates: 0,
        review: 0,
        ignored: 0,
        unknown: 0,
        aiRetry: 0,
      });
    const result = await captureMessages({
      userId: token.userId,
      source: "sms",
      messages: payload.messages,
    });
    const body = {
      jobId: result.jobId,
      received: payload.messages.length,
      skipped: payload.skipped ?? 0,
      inserted: result.inserted,
      duplicates: result.duplicates,
      review: result.review,
      ignored: result.ignored,
      unknown: result.unknown,
      aiRetry: result.aiRetry,
    };
    return ok(
      payload.format === "message487"
        ? { status: "accepted", event_id: payload.eventId, ...body }
        : body,
    );
  } catch (error) {
    if (error instanceof SyntaxError)
      return apiError("invalid_request", "Send a valid JSON body.");
    if (error instanceof RangeError)
      return apiError("invalid_request", "The request body is too large.");
    console.error(
      "SMS ingest failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    return apiError(
      "server_error",
      "The messages could not be saved. Try again.",
    );
  }
}
