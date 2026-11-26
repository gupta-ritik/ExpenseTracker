import { describe, expect, it } from "vitest";
import { readSmsPayload } from "../../lib/capture/adapters";
import { runWithinBudget } from "../../lib/capture/budget";

describe("SMS batches from the phone", () => {
  it("keeps good messages when one item is malformed, empty or too long", () => {
    const payload = readSmsPayload({
      messages: [
        {
          sender: "VM-HDFCBK",
          text: "Rs 10 debited",
          receivedAt: 1764000000000,
        },
        { sender: "VM-HDFCBK", text: "   " },
        { sender: "VM-HDFCBK" },
        { sender: "VM-HDFCBK", text: "x".repeat(5000), receivedAt: "garbage" },
        42,
      ],
    });
    expect(payload?.format).toBe("batch");
    expect(payload?.messages.map((item) => item.text.length)).toEqual([
      13, 2000,
    ]);
    expect(payload?.skipped).toBe(3);
    expect(payload?.messages[1].receivedAt).toBeInstanceOf(Date);
  });

  it("accepts a batch whose items are all unusable, with nothing to save", () => {
    const payload = readSmsPayload({ messages: [{ text: "" }, null] });
    expect(payload?.messages).toEqual([]);
    expect(payload?.skipped).toBe(2);
  });

  it("still rejects bodies that are not a batch at all", () => {
    expect(readSmsPayload({ messages: [] })).toBeNull();
    expect(readSmsPayload({ hello: "world" })).toBeNull();
  });
});

describe("AI time budget", () => {
  it("runs work concurrently and skips what would start after the budget", async () => {
    let clock = 0;
    let running = 0;
    let peak = 0;
    const { results, skipped } = await runWithinBudget(
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      async (item) => {
        running++;
        peak = Math.max(peak, running);
        await Promise.resolve();
        clock += 3000; // every call "takes" 3 s of the budget
        running--;
        return item * 10;
      },
      { budgetMs: 10_000, concurrency: 4, now: () => clock },
    );
    expect(peak).toBe(4);
    const done = results.filter((value) => value !== undefined);
    expect(done.length + skipped.length).toBe(10);
    expect(skipped.length).toBeGreaterThan(0);
    expect(done).toContain(10);
  });

  it("does nothing for an empty list", async () => {
    const result = await runWithinBudget([], async () => 1, { budgetMs: 1 });
    expect(result).toEqual({ results: [], skipped: [] });
  });
});
