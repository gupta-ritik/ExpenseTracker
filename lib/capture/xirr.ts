export type CashFlow = { date: string; amount: number };

const day = 86_400_000;

/**
 * Annualised internal rate of return for irregular cash flows. Investments are
 * negative, current value is positive. Newton's method with a bisection fallback.
 */
export function xirr(flows: CashFlow[]): number | null {
  const points = flows
    .filter((flow) => flow.amount !== 0)
    .map((flow) => ({
      t: Date.parse(flow.date + "T00:00:00Z"),
      amount: flow.amount,
    }));
  if (
    points.length < 2 ||
    !points.some((p) => p.amount > 0) ||
    !points.some((p) => p.amount < 0)
  )
    return null;
  const start = Math.min(...points.map((p) => p.t));
  const years = points.map((p) => ({
    years: (p.t - start) / day / 365,
    amount: p.amount,
  }));
  const npv = (rate: number) =>
    years.reduce((sum, p) => sum + p.amount / (1 + rate) ** p.years, 0);
  const slope = (rate: number) =>
    years.reduce(
      (sum, p) => sum - (p.years * p.amount) / (1 + rate) ** (p.years + 1),
      0,
    );
  let rate = 0.1;
  for (let i = 0; i < 100; i++) {
    const value = npv(rate);
    const derivative = slope(rate);
    if (
      !Number.isFinite(value) ||
      !Number.isFinite(derivative) ||
      derivative === 0
    )
      break;
    const next = rate - value / derivative;
    if (next <= -0.9999) break;
    if (Math.abs(next - rate) < 1e-9) return next;
    rate = next;
  }
  let low = -0.9999,
    high = 100;
  if (npv(low) * npv(high) > 0) return null;
  for (let i = 0; i < 300; i++) {
    const mid = (low + high) / 2;
    if (npv(low) * npv(mid) <= 0) high = mid;
    else low = mid;
    if (high - low < 1e-9) break;
  }
  return (low + high) / 2;
}
