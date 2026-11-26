import { displayMerchant, dateHeading } from "../src/display";

jest.mock("../src/api", () => ({ api: jest.fn() }));
jest.mock("@expense-tracker/shared/dates", () => ({
  indiaToday: () => "2026-11-26",
}));

test("shows brands instead of bank-truncated merchant names", () => {
  expect(displayMerchant("FLIPKARTINTERNE")).toBe("Flipkart");
  expect(displayMerchant("FLIPKARTMINUTES")).toBe("Flipkart");
  expect(displayMerchant("swiggy@ybl")).toBe("Swiggy");
});

test("title-cases all-caps names and keeps bank acronyms", () => {
  expect(displayMerchant("ONESTO LABS PRI")).toBe("Onesto Labs Pri");
  expect(displayMerchant("ATM ICICI KORAMANGALA")).toBe(
    "ATM ICICI Koramangala",
  );
  expect(displayMerchant("Rahul K")).toBe("Rahul K");
  expect(displayMerchant("  ")).toBe("");
});

test("labels dates relative to today", () => {
  expect(dateHeading("2026-11-26")).toBe("Today");
  expect(dateHeading("2026-11-25")).toBe("Yesterday");
  expect(dateHeading("2026-11-22")).toMatch(/Sun.*22.*Nov/);
  expect(dateHeading("2025-03-01")).toMatch(/2025/);
});
