/**
 * Runs `work` over `items` a few at a time and stops starting new work once
 * `budgetMs` has passed. Items not started come back as `skipped`, so a caller
 * waiting on a fixed timeout (the phone waits 35 s) always gets an answer.
 */
export async function runWithinBudget<T, R>(
  items: readonly T[],
  work: (item: T) => Promise<R>,
  {
    concurrency = 4,
    budgetMs,
    now = Date.now,
  }: { concurrency?: number; budgetMs: number; now?: () => number },
): Promise<{ results: (R | undefined)[]; skipped: T[] }> {
  const deadline = now() + budgetMs;
  const results: (R | undefined)[] = new Array(items.length);
  const skipped: T[] = [];
  let next = 0;
  async function lane() {
    while (next < items.length) {
      const index = next++;
      if (now() >= deadline) {
        skipped.push(items[index]);
        continue;
      }
      results[index] = await work(items[index]);
    }
  }
  await Promise.all(
    Array.from(
      { length: Math.max(1, Math.min(concurrency, items.length)) },
      lane,
    ),
  );
  return { results, skipped };
}
