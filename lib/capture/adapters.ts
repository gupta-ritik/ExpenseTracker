import { z } from "zod";

export type IncomingMessage = {
  text: string;
  sender: string;
  receivedAt: Date;
};

const text = z.string().min(1).max(2000);
const sender = z.string().max(64).default("");
const when = z.union([z.number(), z.string()]).optional();

function toDate(value: string | number | undefined) {
  if (value === undefined || value === "") return new Date();
  const date =
    typeof value === "number" || /^\d{10,13}$/.test(value)
      ? new Date(Number(value) < 1e12 ? Number(value) * 1000 : Number(value))
      : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

/** Our own format: one message, or a batch from the mobile app. */
const single = z.object({ text, sender, receivedAt: when });
/**
 * Batch items are checked one by one. A single bad item must not reject the
 * whole batch: the phone keeps a rejected batch queued, so one message would
 * block every later alert.
 */
const batch = z.object({ messages: z.array(z.unknown()).min(1).max(100) });
const lenientItem = z.object({
  text: z.string().transform((value) => value.trim().slice(0, 2000)),
  sender: z
    .string()
    .default("")
    .transform((value) => value.slice(0, 64)),
  receivedAt: when.catch(undefined),
});
/** "Incoming SMS to URL forwarder" (bogkonstantin) default template. */
const forwarder = z.object({
  from: z.string().max(64),
  text,
  receivedStamp: when,
  sentStamp: when,
  sim: z.unknown().optional(),
});
/** Message487: flat event with message_type "sms". */
const message487 = z.object({
  message_type: z.literal("sms"),
  sender: z.string().max(64).optional(),
  text,
  occurred_at: z.string().optional(),
  event_id: z.string().max(80).optional(),
});

export type ParsedPayload = {
  messages: IncomingMessage[];
  format: "batch" | "single" | "forwarder" | "message487";
  eventId?: string;
  /** Batch items that were empty or malformed and were dropped. */
  skipped?: number;
};

/** Accepts every supported payload shape and returns plain messages. Anything else is rejected. */
export function readSmsPayload(body: unknown): ParsedPayload | null {
  const asBatch = batch.safeParse(body);
  if (asBatch.success) {
    const messages = asBatch.data.messages.flatMap((raw) => {
      const item = lenientItem.safeParse(raw);
      if (!item.success || !item.data.text) return [];
      return [
        {
          text: item.data.text,
          sender: item.data.sender,
          receivedAt: toDate(item.data.receivedAt),
        },
      ];
    });
    return {
      format: "batch",
      messages,
      skipped: asBatch.data.messages.length - messages.length,
    };
  }
  const asM487 = message487.safeParse(body);
  if (asM487.success)
    return {
      format: "message487",
      eventId: asM487.data.event_id,
      messages: [
        {
          text: asM487.data.text,
          sender: asM487.data.sender ?? "",
          receivedAt: toDate(asM487.data.occurred_at),
        },
      ],
    };
  const asForwarder = forwarder.safeParse(body);
  if (asForwarder.success)
    return {
      format: "forwarder",
      messages: [
        {
          text: asForwarder.data.text,
          sender: asForwarder.data.from,
          receivedAt: toDate(
            asForwarder.data.receivedStamp ?? asForwarder.data.sentStamp,
          ),
        },
      ],
    };
  const asSingle = single.safeParse(body);
  if (asSingle.success)
    return {
      format: "single",
      messages: [
        {
          text: asSingle.data.text,
          sender: asSingle.data.sender,
          receivedAt: toDate(asSingle.data.receivedAt),
        },
      ],
    };
  return null;
}
