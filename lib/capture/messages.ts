import { isSenderAllowed, parseAlert, type CaptureRow } from "./alerts";
import {
  aiEnabled,
  alertInstructions,
  alertSchema,
  groqJson,
  type GroqFailure,
} from "./groq";
import {
  finishJob,
  ingestRows,
  startJob,
  usageLogger,
  type IngestRow,
  type JobFields,
} from "./ingest";
import { captureDate, normalizeMerchant } from "./normalize";
import type { IncomingMessage } from "./adapters";

export type MessageOutcome = {
  status: "parsed" | "ignored" | "unknown" | "ai";
  reason?: string;
  row?: CaptureRow;
};

/** Groq fallback for one masked message. Confidence is capped at 70 so it always lands in review. */
async function aiParse(
  userId: string,
  message: IncomingMessage,
  fetchImpl?: typeof fetch,
): Promise<{ row?: IngestRow; failure?: GroqFailure }> {
  const result = await groqJson({
    feature: "alert",
    instructions: alertInstructions,
    content: message.text,
    schema: alertSchema,
    log: usageLogger(userId),
    fetchImpl,
  });
  if (!result.ok) return { failure: result.reason };
  const found = result.data.transaction;
  if (!found) return {};
  const amountPaise = Math.round(found.amount * 100);
  if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) return {};
  return {
    row: {
      type: found.type,
      amountPaise,
      date:
        found.date && /^\d{4}-\d{2}-\d{2}$/.test(found.date)
          ? found.date
          : captureDate(message.text, message.receivedAt),
      merchant: normalizeMerchant(found.merchant),
      confidence: Math.min(found.confidence, 70),
      last4: found.last4 ?? undefined,
      refNo: found.refNo ?? undefined,
      categoryHint: found.category ?? undefined,
    },
  };
}

/** Pure preview: masks and parses, never stores anything. */
export function previewMessages(messages: IncomingMessage[]): MessageOutcome[] {
  return messages.map((message) => {
    const result = parseAlert(message.text, message.sender, message.receivedAt);
    if (result.kind === "parsed") return { status: "parsed", row: result.row };
    if (result.kind === "ignored")
      return { status: "ignored", reason: result.reason };
    return {
      status: "unknown",
      reason: aiEnabled()
        ? "Will be parsed by AI and sent to review"
        : "Unrecognised format",
    };
  });
}

/**
 * Parses alerts and ingests them. Raw text only lives in memory for the duration
 * of this call. Unknown formats from bank senders (or pasted by the user) go to
 * Groq when it is configured; personal SMS from other senders never do.
 */
export async function captureMessages(input: {
  userId: string;
  source: "sms" | "email";
  messages: IncomingMessage[];
  trustedSender?: boolean;
  job?: JobFields;
  fetchImpl?: typeof fetch;
}) {
  const jobId = await startJob(input.userId, input.source, input.job);
  const rows: IngestRow[] = [];
  let ignored = 0,
    unknown = 0,
    aiRetry = 0;
  for (const message of input.messages) {
    const result = parseAlert(message.text, message.sender, message.receivedAt);
    if (result.kind === "parsed") {
      rows.push(result.row);
      continue;
    }
    if (result.kind === "ignored") {
      ignored++;
      continue;
    }
    const eligible = input.trustedSender || isSenderAllowed(message.sender);
    if (!eligible || !aiEnabled()) {
      unknown++;
      continue;
    }
    const parsed = await aiParse(input.userId, message, input.fetchImpl);
    if (parsed.row) rows.push(parsed.row);
    else if (parsed.failure === "rate_limited" || parsed.failure === "timeout")
      aiRetry++;
    else unknown++;
  }
  const result = await ingestRows({
    userId: input.userId,
    source: input.source,
    rows,
    jobId,
    job: input.job,
    ignored: ignored + unknown + aiRetry,
  });
  if (aiRetry)
    await finishJob(input.userId, jobId, {
      status: "needs_ai_retry",
      error: `${aiRetry} message(s) were not parsed because Groq was rate limited. Send them again later.`,
    });
  return { ...result, ignored, unknown, aiRetry };
}
