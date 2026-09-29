/** Keep separately entered size rows, but place equivalent product names together. */
export function groupQuotePrintRows<T extends { productName: string }>(rows: T[]): T[][] {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const name = row.productName.normalize("NFKC")
      .replace(/\s*(?:\/|[-–—])\s*/g, " ")
      .replace(/\s+/g, " ").trim().toLowerCase();
    const group = groups.get(name) ?? [];
    group.push(row);
    groups.set(name, group);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, group]) => group);
}
