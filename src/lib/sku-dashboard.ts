import "server-only";

import { getCostPriceMonitorData } from "@/lib/cost-price-monitor";
import {
  aggregateSkuDashboard,
  normalizeSkuDashboardFilters,
  shiftYear,
  type SkuDashboardCatalogItem,
  type SkuDashboardFilters,
  type SkuDashboardResult,
  type SkuDashboardRollupRow,
} from "@/lib/sku-dashboard-model";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

type CatalogSnapshot = { catalog: SkuDashboardCatalogItem[]; warnings: string[] };
let catalogCache: { expiresAt: number; promise: Promise<CatalogSnapshot> } | null = null;

async function loadCatalog(): Promise<CatalogSnapshot> {
  // Reuse the application's effective SKU cost and supplier rules.
  const monitor = await getCostPriceMonitorData({ exportAll: true, visibility: "all" });
  const bySku = new Map<string, SkuDashboardCatalogItem>();
  for (const group of monitor.rows) {
    for (const detail of group.skuDetails) {
      const sku = detail.sku.trim();
      if (!sku || bySku.has(sku)) continue;
      const cost = !detail.costCurrencySafe ? null : detail.effectiveLandedCost > 0
        ? detail.effectiveLandedCost
        : detail.effectivePurchasePrice > 0 ? detail.effectivePurchasePrice : null;
      bySku.set(sku, {
        sku,
        itemName: group.mainName || sku,
        variantName: detail.variantTitle,
        supplier: group.supplier || "Unmapped",
        category: group.category || "Uncategorized",
        unitCost: cost,
      });
    }
  }
  return {
    catalog: [...bySku.values()].sort((a, b) => a.itemName.localeCompare(b.itemName) || a.sku.localeCompare(b.sku)),
    warnings: monitor.warnings,
  };
}

async function getCatalog(): Promise<CatalogSnapshot> {
  if (!catalogCache || catalogCache.expiresAt < Date.now()) {
    const promise = loadCatalog();
    catalogCache = { expiresAt: Date.now() + 5 * 60_000, promise };
    promise.catch(() => {
      if (catalogCache?.promise === promise) catalogCache = null;
    });
  }
  return catalogCache.promise;
}

export async function getSkuDashboardData(input: Partial<SkuDashboardFilters> = {}): Promise<SkuDashboardResult> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) throw new Error("Sales database is not configured.");

  const [catalogSnapshot, latestResult] = await Promise.all([
    getCatalog(),
    supabase.from("sales_by_sku_day").select("sales_date").order("sales_date", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (latestResult.error) throw new Error(`Latest sales date: ${latestResult.error.message}`);
  const latestSalesDate = latestResult.data?.sales_date as string | undefined;
  if (!latestSalesDate) throw new Error("No SKU sales history is available yet.");

  const filters = normalizeSkuDashboardFilters(input, latestSalesDate);
  const skuSet = new Set(filters.skus);
  const catalog = catalogSnapshot.catalog;
  const catalogSkuSet = new Set(catalog.map((item) => item.sku));
  const needsScope = Boolean(filters.supplier || filters.category || skuSet.size);
  const scopedSkus = needsScope
    ? catalog.filter((item) =>
      (!filters.supplier || item.supplier === filters.supplier) &&
      (!filters.category || item.category === filters.category) &&
      (!skuSet.size || skuSet.has(item.sku)),
    ).map((item) => item.sku).concat(
      !filters.supplier && !filters.category ? filters.skus.filter((sku) => !catalogSkuSet.has(sku)) : [],
    )
    : null;

  const { data, error } = await supabase.rpc("sku_dashboard_monthly_rollup", {
    p_current_start: filters.start,
    p_current_end: filters.end,
    p_previous_start: shiftYear(filters.start, -1),
    p_previous_end: shiftYear(filters.end, -1),
    p_skus: scopedSkus,
  });
  if (error) throw new Error(`SKU sales rollup: ${error.message}`);
  const rollups = Array.isArray(data) ? data as SkuDashboardRollupRow[] : [];
  return aggregateSkuDashboard(filters, rollups, catalog, latestSalesDate, catalogSnapshot.warnings);
}
