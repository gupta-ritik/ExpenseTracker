import { timingSafeEqual } from "node:crypto";
import { format, isValid, parse } from "date-fns";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "../db";
import { holdings, navPrices } from "../db/schema";
import { captureEnvironment } from "../env";
import { rupeesToPaiseBig } from "./pdf/cas";

export const amfiNavUrl = "https://www.amfiindia.com/spages/NAVAll.txt";

export type NavRow = {
  schemeCode: string;
  isins: string[];
  date: string;
  navPaise: bigint;
};

/** Parses AMFI's semicolon-separated NAVAll.txt. */
export function parseNavAll(text: string): NavRow[] {
  const rows: NavRow[] = [];
  for (const line of text.split(/\r?\n/)) {
    const parts = line.split(";");
    if (parts.length < 6 || !/^\d+$/.test(parts[0].trim())) continue;
    const [code, isinGrowth, isinReinvest, , nav, when] = parts.map((part) =>
      part.trim(),
    );
    const navValue = Number(nav);
    const date = parse(when, "dd-MMM-yyyy", new Date());
    if (!Number.isFinite(navValue) || navValue <= 0 || !isValid(date)) continue;
    rows.push({
      schemeCode: code,
      isins: [isinGrowth, isinReinvest].filter((item) =>
        /^IN[A-Z0-9]{10}$/.test(item),
      ),
      date: format(date, "yyyy-MM-dd"),
      navPaise: rupeesToPaiseBig(nav),
    });
  }
  return rows;
}

/**
 * Fills missing scheme codes from ISINs, then upserts NAVs only for schemes
 * someone actually holds.
 */
export async function updateNavs(fetchImpl: typeof fetch = fetch) {
  const response = await fetchImpl(amfiNavUrl, {
    headers: { accept: "text/plain" },
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) throw new Error(`AMFI responded with ${response.status}`);
  const rows = parseNavAll(await response.text());
  const byIsin = new Map(
    rows.flatMap((row) =>
      row.isins.map((isin) => [isin, row.schemeCode] as const),
    ),
  );
  const unmapped = await db()
    .select({ id: holdings.id, isin: holdings.isin })
    .from(holdings)
    .where(
      and(isNull(holdings.schemeCode), inArray(holdings.kind, ["mf", "etf"])),
    );
  let mapped = 0;
  for (const item of unmapped) {
    const code = byIsin.get(item.isin);
    if (!code) continue;
    await db()
      .update(holdings)
      .set({ schemeCode: code })
      .where(eq(holdings.id, item.id));
    mapped++;
  }
  const held = new Set(
    (
      await db()
        .selectDistinct({ code: holdings.schemeCode })
        .from(holdings)
        .where(or(eq(holdings.kind, "mf"), eq(holdings.kind, "etf")))
    ).flatMap((row) => (row.code ? [row.code] : [])),
  );
  const wanted = rows.filter((row) => held.has(row.schemeCode));
  for (let offset = 0; offset < wanted.length; offset += 500) {
    await db()
      .insert(navPrices)
      .values(
        wanted
          .slice(offset, offset + 500)
          .map(({ schemeCode, date, navPaise }) => ({
            schemeCode,
            date,
            navPaise,
          })),
      )
      .onConflictDoUpdate({
        target: [navPrices.schemeCode, navPrices.date],
        set: { navPaise: sql`excluded."navPaise"` },
      });
  }
  return {
    schemesInFile: rows.length,
    schemesHeld: held.size,
    schemesUpdated: wanted.length,
    schemeCodesMapped: mapped,
  };
}

/** Constant-time check of `Authorization: Bearer <CRON_SECRET>`. */
export function cronAuthorized(
  header: string | null,
  env: Record<string, string | undefined> = process.env,
) {
  const secret = captureEnvironment(env).CRON_SECRET;
  const given = /^Bearer\s+(.+)$/.exec(header ?? "")?.[1]?.trim();
  if (!secret || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
