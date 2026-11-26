import { describe, expect, it } from "vitest";
import { loadAlertFixtures } from "../fixtures/alerts/load";
import {
  isSenderAllowed,
  parseAlert,
  splitMessages,
} from "../../lib/capture/alerts";

const fixtures = loadAlertFixtures();
const receivedAt = new Date("2026-11-25T12:00:00+05:30");

describe("bank alert fixtures", () => {
  it("covers at least five alerts per bank and the UPI apps", () => {
    for (const file of [
      "sbi.txt",
      "hdfc.txt",
      "icici.txt",
      "axis.txt",
      "kotak.txt",
    ]) {
      expect(
        fixtures.filter((item) => item.file === file).length,
      ).toBeGreaterThanOrEqual(5);
    }
    expect(
      fixtures.filter((item) => item.file === "upi-apps.txt").length,
    ).toBeGreaterThanOrEqual(6);
  });

  it.each(
    fixtures.map(
      (item) =>
        [
          `${item.file}: ${item.text.slice(0, 48).replace(/\n/g, " ")}`,
          item,
        ] as const,
    ),
  )("%s", (_, item) => {
    const result = parseAlert(item.text, item.sender, receivedAt);
    const [kind, ...rest] = item.expect.split(" ");
    if (kind === "ignore") {
      expect(result).toEqual({ kind: "ignored", reason: rest.join(" ") });
      return;
    }
    expect(result.kind).toBe("parsed");
    if (result.kind !== "parsed") return;
    const fields = Object.fromEntries(
      [...item.expect.matchAll(/(\w+)=(.*?)(?=\s+\w+=|$)/g)].map((match) => [
        match[1],
        match[2],
      ]),
    );
    expect(result.row.type).toBe(kind);
    expect(result.row.amountPaise).toBe(Math.round(Number(rest[0]) * 100));
    expect(result.row.confidence).toBe(95);
    expect(result.row.last4).toBe(fields.last4);
    if (fields.ref) expect(result.row.refNo).toBe(fields.ref);
    if (fields.merchant) expect(result.row.merchant).toBe(fields.merchant);
    if (fields.date) expect(result.row.date).toBe(fields.date);
    expect(JSON.stringify({ ...result.row, refNo: undefined })).not.toMatch(
      /(?<!\d)\d{10,}(?!\d)|XX\d{4}|@/,
    );
  });
});

describe("alert helpers", () => {
  it("never takes the dispute or block footer as the merchant", () => {
    const named = parseAlert(
      "Rs 446.00 debited from ICICI Bank Acct XX3007 on 22-Nov-26 to ZOMATO. To dispute call 18002662 or SMS BLOCK 3007 to 9215676766.",
      "VM-ICICIB",
      receivedAt,
    );
    expect(named.kind === "parsed" && named.row.merchant).toBe("ZOMATO");
    for (const text of [
      "Rs 446.00 debited from ICICI Bank Acct XX3007 on 22-Nov-26. To dispute call 18002662 or SMS BLOCK 3007 to 9215676766.",
      "ICICI Bank Acct XX3007 debited with Rs 909.00 on 22-Nov-26. Call 18002662 for dispute or SMS BLOCK 3007 to 9215676766.",
    ]) {
      const result = parseAlert(text, "VM-ICICIB", receivedAt);
      expect(result.kind).toBe("parsed");
      if (result.kind === "parsed")
        expect(result.row.merchant).not.toMatch(/dispute|block|call/i);
    }
  });

  it("returns unknown for unrelated text", () => {
    expect(parseAlert("Lunch at 1?", "VM-FRIEND").kind).toBe("unknown");
  });

  it("matches sender IDs with operator and suffix prefixes", () => {
    expect(isSenderAllowed("VM-HDFCBK")).toBe(true);
    expect(isSenderAllowed("JD-SBIUPI-S")).toBe(true);
    expect(isSenderAllowed("VM-SPAMMR")).toBe(false);
    expect(isSenderAllowed("AD-HDFCBK", ["*-HDFCBK"])).toBe(true);
  });

  it("splits pasted messages on blank lines but keeps multi-line alerts whole", () => {
    expect(splitMessages("Sent Rs.1\nFrom A/C *1234\nTo X")).toHaveLength(1);
    expect(splitMessages("a Rs.1\n\nb Rs.2\n---\nc Rs.3")).toHaveLength(3);
    expect(splitMessages("Paid Rs.1 to A\nPaid Rs.2 to B")).toHaveLength(2);
  });
});
