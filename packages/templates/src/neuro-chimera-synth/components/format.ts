const msFormat0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const msFormat1 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const msFormat2 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "1,420ms", "3.8ms", "0.42ms": grouping for large values, more decimals for small ones. */
export function formatMs(ms: number): string {
  if (!Number.isFinite(ms)) return "—";
  if (ms >= 100) return `${msFormat0.format(ms)}ms`;
  if (ms >= 1) return `${msFormat1.format(ms)}ms`;
  return `${msFormat2.format(ms)}ms`;
}
