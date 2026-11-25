import { api, page, RequestError } from "../src/api";

jest.mock("../src/auth", () => ({
  apiBaseUrl: "https://ledger.example",
  auth: { getCookie: jest.fn(async () => "better-auth.session_token=mock") },
}));

const originalFetch = global.fetch;
const fetchMock = jest.fn();
beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock;
});
afterAll(() => {
  global.fetch = originalFetch;
});

test("sends the Expo session cookie and encodes pagination and search", async () => {
  const response = { items: [], nextCursor: "next" };
  fetchMock.mockResolvedValue({ ok: true, json: async () => response });
  await expect(page("/transactions", "a+/=", "tea & coffee")).resolves.toEqual(
    response,
  );
  expect(fetchMock).toHaveBeenCalledWith(
    "https://ledger.example/api/v1/transactions?cursor=a%2B%2F%3D&search=tea+%26+coffee",
    expect.objectContaining({
      credentials: "omit",
      headers: { Cookie: "better-auth.session_token=mock" },
    }),
  );
});

test("serializes an API write and reads a structured API error", async () => {
  fetchMock.mockResolvedValue({
    ok: false,
    status: 401,
    json: async () => ({
      error: { code: "unauthorized", message: "Sign in again." },
    }),
  });
  await expect(
    api("/review/test", "POST", { action: "approve" }),
  ).rejects.toMatchObject({
    name: "Error",
    status: 401,
    code: "unauthorized",
    message: "Sign in again.",
  } satisfies Partial<RequestError>);
  expect(fetchMock).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({ method: "POST", body: '{"action":"approve"}' }),
  );
});
