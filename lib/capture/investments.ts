import { and, asc, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "../db";
import { holdings, investmentTxns, navPrices } from "../db/schema";
import { sha256 } from "./crypto";
import type { Cas, CasHolding } from "./pdf/cas";
import { xirr, type CashFlow } from "./xirr";

function unitsText(units: number) {
  return units.toFixed(4);
}

/**
 * Upserts holdings and their transactions from a parsed CAS. Only ISINs,
 * scheme names, folios and numbers are stored: never PAN, names, addresses or emails.
 */
export async function saveCas(userId: string, cas: Cas) {
  return db().transaction(async (tx) => {
    let holdingsSaved = 0,
      txnsInserted = 0,
      txnsDuplicate = 0,
      review = 0;
    for (const item of cas.holdings) {
      const asOf =
        item.asOf || cas.periodTo || new Date().toISOString().slice(0, 10);
      const value =
        item.valuePaise ??
        (item.pricePaise !== undefined
          ? BigInt(Math.round(Number(item.pricePaise) * item.units))
          : 0n);
      const [existing] = await tx
        .select({ id: holdings.id, costPaise: holdings.costPaise })
        .from(holdings)
        .where(
          and(
            eq(holdings.userId, userId),
            eq(holdings.isin, item.isin),
            item.folio
              ? eq(holdings.folio, item.folio)
              : sql`${holdings.folio} is null`,
          ),
        );
      // Depository CAS has no cost: keep an earlier cost, else start from the current value.
      const costPaise = item.costPaise ?? existing?.costPaise ?? value;
      const values = {
        kind: item.kind,
        isin: item.isin,
        schemeCode: item.schemeCode ?? null,
        name: item.name.slice(0, 160),
        folio: item.folio ?? null,
        units: unitsText(item.units),
        costPaise,
        pricePaise: item.pricePaise ?? null,
        asOf,
        needsReview: item.needsReview,
      };
      const [saved] = existing
        ? await tx
            .update(holdings)
            .set({
              ...values,
              schemeCode: item.schemeCode ?? sql`${holdings.schemeCode}`,
            })
            .where(
              and(eq(holdings.userId, userId), eq(holdings.id, existing.id)),
            )
            .returning({ id: holdings.id })
        : await tx
            .insert(holdings)
            .values({ userId, ...values })
            .returning({ id: holdings.id });
      holdingsSaved++;
      if (item.needsReview) review++;
      for (const txn of item.txns) {
        const importHash = sha256(
          [
            userId,
            item.isin,
            item.folio ?? "",
            txn.date,
            txn.type,
            txn.units.toFixed(4),
            txn.amountPaise.toString(),
          ].join("|"),
        );
        const inserted = await tx
          .insert(investmentTxns)
          .values({
            userId,
            holdingId: saved.id,
            date: txn.date,
            type: txn.type,
            units: unitsText(txn.units),
            navPaise: txn.navPaise,
            amountPaise: txn.amountPaise,
            importHash,
          })
          .onConflictDoNothing({
            target: [investmentTxns.userId, investmentTxns.importHash],
          })
          .returning({ id: investmentTxns.id });
        if (inserted.length) txnsInserted++;
        else txnsDuplicate++;
      }
    }
    return { holdingsSaved, txnsInserted, txnsDuplicate, review };
  });
}

export type HoldingView = Awaited<
  ReturnType<typeof getPortfolio>
>["holdings"][number];

/** Current value uses the latest AMFI NAV for mutual funds, else the CAS price. */
export async function getPortfolio(userId: string) {
  const owned = await db()
    .select()
    .from(holdings)
    .where(eq(holdings.userId, userId))
    .orderBy(asc(holdings.kind), asc(holdings.name));
  const codes = [
    ...new Set(
      owned.flatMap((item) => (item.schemeCode ? [item.schemeCode] : [])),
    ),
  ];
  const latest = codes.length
    ? await db()
        .selectDistinctOn([navPrices.schemeCode], {
          schemeCode: navPrices.schemeCode,
          date: navPrices.date,
          navPaise: navPrices.navPaise,
        })
        .from(navPrices)
        .where(inArray(navPrices.schemeCode, codes))
        .orderBy(navPrices.schemeCode, desc(navPrices.date))
    : [];
  const navs = new Map(latest.map((row) => [row.schemeCode, row]));
  const txns = owned.length
    ? await db()
        .select()
        .from(investmentTxns)
        .where(eq(investmentTxns.userId, userId))
        .orderBy(asc(investmentTxns.date))
    : [];
  const today = new Date().toISOString().slice(0, 10);
  const allFlows: CashFlow[] = [];
  const list = owned.map((item) => {
    const units = Number(item.units);
    const nav = item.schemeCode ? navs.get(item.schemeCode) : undefined;
    const useNav = nav && (!item.asOf || nav.date >= item.asOf);
    const price = useNav ? nav.navPaise : item.pricePaise;
    const valuePaise =
      price !== null && price !== undefined
        ? Math.round(Number(price) * units)
        : Number(item.costPaise);
    const costPaise = Number(item.costPaise);
    const flows: CashFlow[] = txns
      .filter((txn) => txn.holdingId === item.id)
      .map((txn) => ({
        date: txn.date,
        amount:
          (["sell", "switch_out", "dividend"].includes(txn.type) ? 1 : -1) *
          Number(txn.amountPaise),
      }));
    if (!flows.length && costPaise)
      flows.push({ date: item.asOf, amount: -costPaise });
    flows.push({ date: useNav ? nav.date : today, amount: valuePaise });
    allFlows.push(...flows);
    return {
      id: item.id,
      kind: item.kind,
      name: item.name,
      isin: item.isin,
      folio: item.folio,
      units,
      costPaise,
      valuePaise,
      gainPaise: valuePaise - costPaise,
      xirr: xirr(flows),
      asOf: useNav ? nav.date : item.asOf,
      needsReview: item.needsReview,
      priceSource: useNav ? "AMFI NAV" : "CAS",
    };
  });
  const totals = list.reduce(
    (sum, item) => ({
      costPaise: sum.costPaise + item.costPaise,
      valuePaise: sum.valuePaise + item.valuePaise,
    }),
    { costPaise: 0, valuePaise: 0 },
  );
  const byKind = Object.entries(
    list.reduce<Record<string, number>>(
      (acc, item) => ({
        ...acc,
        [item.kind]: (acc[item.kind] ?? 0) + item.valuePaise,
      }),
      {},
    ),
  ).map(([kind, valuePaise]) => ({ kind, valuePaise }));
  return {
    holdings: list,
    totals: {
      ...totals,
      gainPaise: totals.valuePaise - totals.costPaise,
      xirr: xirr(allFlows),
    },
    byKind,
  };
}

/** Approximate monthly portfolio value: units held at each month end × the NAV on record. */
export async function getPortfolioHistory(userId: string, months = 6) {
  const owned = await db()
    .select({
      id: holdings.id,
      schemeCode: holdings.schemeCode,
      units: holdings.units,
      pricePaise: holdings.pricePaise,
      costPaise: holdings.costPaise,
    })
    .from(holdings)
    .where(eq(holdings.userId, userId));
  const codes = owned.flatMap((item) =>
    item.schemeCode ? [item.schemeCode] : [],
  );
  const prices = codes.length
    ? await db()
        .select()
        .from(navPrices)
        .where(
          and(
            inArray(navPrices.schemeCode, codes),
            isNotNull(navPrices.navPaise),
          ),
        )
        .orderBy(asc(navPrices.date))
    : [];
  const txns = await db()
    .select({
      holdingId: investmentTxns.holdingId,
      date: investmentTxns.date,
      units: investmentTxns.units,
    })
    .from(investmentTxns)
    .where(eq(investmentTxns.userId, userId));
  const now = new Date();
  return Array.from({ length: months }, (_, index) => {
    const end = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth() - (months - 1 - index) + 1,
        0,
      ),
    )
      .toISOString()
      .slice(0, 10);
    const value = owned.reduce((sum, item) => {
      const tracked = txns.filter((txn) => txn.holdingId === item.id);
      const units = tracked.length
        ? tracked
            .filter((txn) => txn.date <= end)
            .reduce((total, txn) => total + Number(txn.units), 0)
        : Number(item.units);
      const nav =
        [...prices]
          .reverse()
          .find((row) => row.schemeCode === item.schemeCode && row.date <= end)
          ?.navPaise ?? item.pricePaise;
      return sum + (nav ? Math.round(Number(nav) * units) : 0);
    }, 0);
    return { month: end.slice(0, 7), value };
  });
}

export async function investmentsValue(userId: string) {
  const portfolio = await getPortfolio(userId);
  return portfolio.totals.valuePaise;
}

export type { CasHolding };
