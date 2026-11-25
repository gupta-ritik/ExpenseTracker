import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  maskCaptureText,
  lastFour,
  sanitizeMerchant,
} from "../../lib/capture/mask";
import {
  normalizeAmount,
  normalizeDate,
  normalizeMerchant,
  similarMerchant,
} from "../../lib/capture/normalize";
import { categorize, rulePattern } from "../../lib/capture/categorize";
import {
  captureFingerprint,
  captureHash,
  isDuplicate,
  type ExistingRow,
} from "../../lib/capture/dedupe";
import {
  decryptSecret,
  encryptSecret,
  newToken,
  sha256,
} from "../../lib/capture/crypto";
import { alertSchema, groqJson } from "../../lib/capture/groq";

const key = Buffer.alloc(32, 7).toString("base64");

describe("mask", () => {
  it.each([
    ["A/c no. 123456789012 debited", "A/c no. ****9012 debited"],
    ["Card 4111 1111 1111 1234 spent", "Card ****1234 spent"],
    ["Account number: 50100012345678", "Account number: ****5678"],
    ["AC X1234 debited", "AC ****1234 debited"],
    ["PAN ABCDE1234F linked", "PAN [PAN] linked"],
    ["Aadhaar 1234 5678 9012 verified", "Aadhaar [ID] verified"],
    ["Aadhaar 123456789012", "Aadhaar [ID]"],
    ["Call +91 98765 43210 now", "Call [PHONE] now"],
    ["Call 9876543210", "Call [PHONE]"],
    ["Mail a.b@example.com today", "Mail [EMAIL] today"],
    ["OTP is 482913. Do not share", "[CODE]. Do not share"],
    ["482913 is your OTP", "[CODE] is your OTP"],
    ["Verification code: 1234", "[CODE]"],
    ["Card 4111111111111234 used", "Card ****1234 used"],
    ["Number 4111111111111234 used", "Number [NUMBER] used"],
    ["Investor Name: A Person\nFolio 1", "[PERSONAL DETAILS]\nFolio 1"],
    ["POS 412345XXXXXX5678 HPCL", "POS ****5678 HPCL"],
  ])("%s", (input, output) => expect(maskCaptureText(input)).toBe(output));

  it("keeps labelled payment references, which are needed for dedupe", () => {
    expect(maskCaptureText("UPI Ref No 433012345678")).toBe(
      "UPI Ref No 433012345678",
    );
    expect(maskCaptureText("UPI/P2M/433512345678/UBER")).toBe(
      "UPI/P2M/433512345678/UBER",
    );
    expect(maskCaptureText("Refno 433012345678.")).toBe("Refno 433012345678.");
    expect(maskCaptureText("RRN: 433012345678")).toBe("RRN: 433012345678");
    expect(maskCaptureText("to 919876543210 now")).toBe("to [ID] now");
  });

  it("keeps merchant VPAs but masks phone-number VPAs", () => {
    expect(maskCaptureText("to swiggy@icici")).toBe("to swiggy@icici");
    expect(maskCaptureText("to 9876543210@ybl")).toBe("to [PHONE]@ybl");
  });

  it("handles Devanagari digits and zero-width characters", () => {
    expect(maskCaptureText("A/c ९८७६५४३२१०१२")).toBe("A/c ****1012");
    expect(maskCaptureText("PAN AB​CDE1234F")).toBe("PAN [PAN]");
  });

  it("extracts last four and sanitizes merchants", () => {
    expect(lastFour("XX1234")).toBe("1234");
    expect(lastFour("12")).toBeUndefined();
    expect(sanitizeMerchant("SHOP ABCDE1234F 9876543210")).toBe("SHOP");
  });
});

describe("normalize", () => {
  it.each([
    ["Rs. 1,23,456.50", 12_345_650],
    ["INR 499", 49_900],
    ["₹ 10.5", 1050],
    ["1,299.00 DR", 129_900],
    ["abc", null],
  ])("amount %s", (input, paise) =>
    expect(normalizeAmount(input as string)).toBe(paise),
  );

  it.each([
    ["on 25-11-26 at", "2026-11-25"],
    ["on 25/11/2026", "2026-11-25"],
    ["25-Nov-26", "2026-11-25"],
    ["25Nov26", "2026-11-25"],
    ["01-NOV-26", "2026-11-01"],
    ["2026-11-23:14:22:10", "2026-11-23"],
    ["25 Nov 2026 10:00", "2026-11-25"],
    ["no date", null],
  ])("date %s", (input, date) =>
    expect(normalizeDate(input, new Date("2026-11-25T12:00:00+05:30"))).toBe(
      date,
    ),
  );

  it("cleans merchants", () => {
    expect(normalizeMerchant("UPI/swiggy@okaxis")).toBe("SWIGGY");
    expect(normalizeMerchant("rapido@ybl")).toBe("RAPIDO");
    expect(normalizeMerchant("ATM MG ROAD BANGALORE")).toBe("MG ROAD");
    expect(normalizeMerchant("ZOMATO REF NO 123456")).toBe("ZOMATO");
    expect(normalizeMerchant("NEFT/AXISCN0123456789/ACME SALARY")).toBe(
      "ACME SALARY",
    );
  });

  it("compares merchants loosely across sources", () => {
    expect(
      similarMerchant("SWIGGY", "UPI/433012345678/SWIGGY/swiggy@icici/Payment"),
    ).toBe(true);
    expect(similarMerchant("SWIGGY INSTAMART", "Swiggy Instamart")).toBe(true);
    expect(similarMerchant("SWIGGY", "ZOMATO")).toBe(false);
  });
});

describe("categorize", () => {
  const categories = [
    { id: "food", name: "Food", type: "expense" as const },
    { id: "groceries", name: "Groceries", type: "expense" as const },
    { id: "transport", name: "Transport", type: "expense" as const },
    { id: "fuel", name: "Fuel", type: "expense" as const },
    { id: "other", name: "Other", type: "expense" as const },
    { id: "salary", name: "Salary", type: "income" as const },
    { id: "refund", name: "Refund", type: "income" as const },
    { id: "interest", name: "Interest", type: "income" as const },
    { id: "other-in", name: "Other", type: "income" as const },
    { id: "shopping", name: "Shopping", type: "expense" as const },
  ];
  it.each([
    ["SWIGGY", "expense", "food"],
    ["ZOMATO", "expense", "food"],
    ["UBER INDIA", "expense", "transport"],
    ["BLINKIT", "expense", "groceries"],
    ["HPCL PETROL PUMP", "expense", "fuel"],
    ["AMAZON", "expense", "shopping"],
    ["ACME TECHNOLOGIES SALARY", "income", "salary"],
    ["SB INT PD", "income", "interest"],
    ["AMAZON REFUND", "income", "refund"],
    ["UNKNOWN SHOP", "expense", "other"],
  ])("%s", (merchant, type, id) => {
    expect(
      categorize({ merchant, type: type as "expense" | "income" }, categories)
        ?.categoryId,
    ).toBe(id);
  });

  it("prefers the user's merchant rules", () => {
    const rules = [{ pattern: rulePattern("Swiggy"), categoryId: "groceries" }];
    expect(
      categorize({ merchant: "SWIGGY", type: "expense" }, categories, rules),
    ).toEqual({ categoryId: "groceries", matched: "rule" });
  });

  it("only accepts model hints that name the user's own categories", () => {
    expect(
      categorize({ merchant: "X", type: "expense", hint: "Food" }, categories)
        ?.matched,
    ).toBe("hint");
    expect(
      categorize(
        { merchant: "X", type: "expense", hint: "'; drop table" },
        categories,
      )?.categoryId,
    ).toBe("other");
  });
});

describe("dedupe", () => {
  const base = {
    type: "expense" as const,
    amountPaise: 49_900,
    date: "2026-11-25",
    merchant: "SWIGGY",
    last4: "1234",
  };
  const existing = (patch: Partial<ExistingRow>): ExistingRow => ({
    ...base,
    id: "a",
    note: "SWIGGY",
    refNo: null,
    confidence: 95,
    ...patch,
  });

  it("treats the same reference as a duplicate", () => {
    expect(
      isDuplicate(
        { ...base, refNo: "433112345678", amountPaise: 1 },
        existing({ refNo: "433112345678" }),
      ),
    ).toBe(true);
  });
  it("finds the reference inside a CSV narration", () => {
    expect(
      isDuplicate(
        { ...base, refNo: "433112345678" },
        existing({
          merchant: "",
          last4: null,
          note: "UPI/433112345678/SWIGGY/swiggy@icici",
        }),
      ),
    ).toBe(true);
  });
  it("matches on last4, amount, type, date ±1 day and merchant", () => {
    expect(isDuplicate(base, existing({ date: "2026-11-24" }))).toBe(true);
    expect(isDuplicate(base, existing({ date: "2026-11-27" }))).toBe(false);
    expect(isDuplicate(base, existing({ amountPaise: 50_000 }))).toBe(false);
    expect(isDuplicate(base, existing({ last4: "9999" }))).toBe(false);
    expect(
      isDuplicate(base, existing({ merchant: "ZOMATO", note: "ZOMATO" })),
    ).toBe(false);
    expect(isDuplicate(base, existing({ type: "income" }))).toBe(false);
  });
  it("keeps different references apart", () => {
    expect(
      isDuplicate(
        { ...base, refNo: "1111111111" },
        existing({ refNo: "2222222222" }),
      ),
    ).toBe(false);
  });
  it("hashes deterministically per user", () => {
    expect(captureFingerprint("u", { ...base, refNo: "r1" })).toBe(
      "u|1234|49900|expense|2026-11-25|R1|SWIGGY",
    );
    expect(captureHash("u", base)).toMatch(/^[0-9a-f]{64}$/);
    expect(captureHash("u", base)).not.toBe(captureHash("v", base));
  });
});

describe("encryption and tokens", () => {
  it("round-trips with AES-256-GCM and rejects tampering", () => {
    const sealed = encryptSecret("app password", key);
    expect(sealed).not.toContain("app password");
    expect(decryptSecret(sealed, key)).toBe("app password");
    expect(encryptSecret("x", key)).not.toBe(encryptSecret("x", key));
    const parts = sealed.split(".");
    parts[3] = Buffer.from("other").toString("base64url");
    expect(() => decryptSecret(parts.join("."), key)).toThrow();
    expect(() =>
      decryptSecret(sealed, Buffer.alloc(32, 8).toString("base64")),
    ).toThrow();
  });
  it("creates opaque tokens", () => {
    expect(newToken()).toMatch(/^et_[A-Za-z0-9_-]{43}$/);
    expect(sha256("a")).toHaveLength(64);
  });
});

describe("groq client", () => {
  const env = {
    GROQ_API_KEY: "gsk_test",
    GROQ_MODEL: "small",
    GROQ_MODEL_LARGE: "large",
  };
  const reply = (
    content: unknown,
    status = 200,
    headers: Record<string, string> = {},
  ) =>
    new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content:
                typeof content === "string" ? content : JSON.stringify(content),
            },
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      }),
      { status, headers },
    );
  const options = (fetchImpl: typeof fetch, log = vi.fn(async () => {})) => ({
    feature: "alert",
    instructions: "",
    content: "Card 4111111111111234 PAN ABCDE1234F spent Rs 10",
    schema: alertSchema,
    env,
    fetchImpl,
    log,
    sleep: vi.fn(async () => {}),
  });

  it("is disabled without a key", async () => {
    expect(await groqJson({ ...options(vi.fn()), env: {} })).toEqual({
      ok: false,
      reason: "disabled",
    });
  });

  it("validates JSON, masks the content and logs usage", async () => {
    const fetchImpl = vi.fn(async () =>
      reply({
        transaction: {
          type: "expense",
          amount: 10,
          merchant: "X",
          confidence: 80,
        },
      }),
    );
    const log = vi.fn(async () => {});
    const result = await groqJson(
      options(fetchImpl as unknown as typeof fetch, log),
    );
    expect(result.ok).toBe(true);
    const sent = JSON.parse(
      (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1]
        .body as string,
    );
    expect(sent.temperature).toBe(0);
    expect(sent.model).toBe("small");
    expect(JSON.stringify(sent)).not.toMatch(/4111111111111234|ABCDE1234F/);
    expect(log).toHaveBeenCalledWith({
      feature: "alert",
      model: "small",
      inputTokens: 10,
      outputTokens: 5,
      ok: true,
    });
  });

  it("rejects invalid JSON and schema violations", async () => {
    expect(
      await groqJson(
        options(
          vi.fn(async () => reply("not json")) as unknown as typeof fetch,
        ),
      ),
    ).toEqual({ ok: false, reason: "invalid" });
    expect(
      await groqJson(
        options(
          vi.fn(async () =>
            reply({ transaction: { type: "steal", amount: -1 } }),
          ) as unknown as typeof fetch,
        ),
      ),
    ).toEqual({ ok: false, reason: "invalid" });
    expect(
      await groqJson({
        ...options(
          vi.fn(async () => reply({ userId: "x" })) as unknown as typeof fetch,
        ),
        schema: z.object({ rows: z.array(z.number()) }),
      }),
    ).toEqual({ ok: false, reason: "invalid" });
  });

  it("retries 429 with retry-after and gives up after three tries", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response("", { status: 429, headers: { "retry-after": "2" } }),
    );
    const opts = options(fetchImpl as unknown as typeof fetch);
    expect(await groqJson(opts)).toEqual({ ok: false, reason: "rate_limited" });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(opts.sleep).toHaveBeenNthCalledWith(1, 2000);
    expect(opts.sleep).toHaveBeenNthCalledWith(2, 2000);
    expect(opts.log).toHaveBeenCalledWith(
      expect.objectContaining({ ok: false }),
    );
  });

  it("recovers when a retry succeeds", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 429 }))
      .mockResolvedValueOnce(reply({ transaction: null }));
    expect(
      await groqJson(options(fetchImpl as unknown as typeof fetch)),
    ).toEqual({ ok: true, data: { transaction: null } });
  });

  it("reports timeouts", async () => {
    const fetchImpl = vi.fn(async () => {
      throw Object.assign(new Error("aborted"), { name: "AbortError" });
    });
    expect(
      await groqJson(options(fetchImpl as unknown as typeof fetch)),
    ).toEqual({ ok: false, reason: "timeout" });
  });
});
