// Shopify location IDs, not name matching: never combine warehouse and retail.
export const stockCountLocationIds = {
  warehouse: "108167495977",
  retail: "90925007145",
} as const;

export function summarizeStockCountInventory(rows: Array<{ sku: string | null; on_hand: number | string | null }>) {
  const quantities: Record<string, number | null> = Object.create(null);
  for (const row of rows) {
    if (!row.sku) continue;
    const qty = row.on_hand === null ? null : Number(row.on_hand);
    if (qty === null || !Number.isFinite(qty)) {
      quantities[row.sku] = null;
    } else if (!(row.sku in quantities)) {
      quantities[row.sku] = qty;
    } else if (quantities[row.sku] !== null) {
      quantities[row.sku] = (quantities[row.sku] ?? 0) + qty;
    }
  }
  return quantities;
}
