import type {
  ApiError,
  EntryInput,
  Page,
} from "@expense-tracker/shared/schemas";
import type { Currency } from "@expense-tracker/shared/money";
import { apiBaseUrl, auth } from "./auth";

export type Transaction = EntryInput & {
  id: string;
  merchant: string | null;
  source: string;
  confidence: number | null;
};
export type Budget = {
  id: string;
  name: string;
  limitPaise: number;
  spentPaise: number;
  percent: number;
};
export type Dashboard = {
  currency: Currency;
  expensePaise: number;
  incomePaise: number;
  netPaise: number;
  balancePaise: number;
  netWorthPaise: number;
  reviewCount: number;
  budgets: Budget[];
  latest: Transaction[];
};
export type Account = { id: string; name: string };
export type Category = Account & { type: "expense" | "income" };
export type Device = {
  id: string;
  name: string;
  kind: string;
  revokedAt: string | null;
};

export class RequestError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function request<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(apiBaseUrl + path, {
    method,
    credentials: "omit",
    headers: {
      Cookie: await auth.getCookie(),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = (payload as ApiError | null)?.error;
    throw new RequestError(
      response.status,
      error?.code ?? "http_error",
      error?.message ?? "The server could not complete the request.",
    );
  }
  return payload as T;
}

export function api<T>(path: string, method?: string, body?: unknown) {
  return request<T>("/api/v1" + path, method, body);
}

export function page<T>(path: string, cursor?: string | null, search?: string) {
  const query = new URLSearchParams();
  if (cursor) query.set("cursor", cursor);
  if (search) query.set("search", search);
  return api<Page<T>>(path + "?" + query.toString());
}

export function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Try again.";
}
