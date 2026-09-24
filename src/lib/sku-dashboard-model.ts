export type SkuDashboardCatalogItem = {
  sku: string;
  itemName: string;
  variantName: string;
  supplier: string;
  category: string;
  unitCost: number | null;
};

export type SkuDashboardRollupRow = {
  period: "current" | "previous";
  sku: string;
  month_start: string;
  units: number | string;
  revenue: number | string;
};

export type SkuDashboardFilters = {
  start: string;
  end: string;
  supplier: string;
  category: string;
  skus: string[];
  compare: boolean;
};

export type SkuDashboardMonthlyPoint = {
  month: string;
  units: number;
  revenue: number;
  previousUnits: number;
  previousRevenue: number;
};

export type SkuDashboardSkuRow = {
  sku: string;
  itemName: string;
  variantName: string;
  supplier: string;
  category: string;
  units: number;
  revenue: number;
  previousUnits: number;
  previousRevenue: number;
  estimatedCogs: number | null;
};

export type SkuDashboardResult = {
  filters: SkuDashboardFilters;
  previousStart: string;
  previousEnd: string;
  comparisonAvailable: boolean;
  latestSalesDate: string | null;
  catalog: SkuDashboardCatalogItem[];
  monthly: SkuDashboardMonthlyPoint[];
  skus: SkuDashboardSkuRow[];
  summary: {
    units: number;
    revenue: number;
    activeSkus: number;
    averageMonthlyUnits: number;
    previousUnits: number;
    previousRevenue: number;
    coveredRevenue: number;
    costCoveragePercent: number;
    estimatedCogs: number | null;
    estimatedGrossProfit: number | null;
    estimatedGrossMarginPercent: number | null;
  };
  warnings: string[];
};

const numeric = (value: number | string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function isDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function shiftYear(value: string, years: number): string {
  const year = Number(value.slice(0, 4)) + years;
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

export function dateSpanDays(start: string, end: string): number {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) + 1;
}

export function defaultDateRange(latestSalesDate: string): { start: string; end: string } {
  const last = new Date(`${latestSalesDate}T00:00:00Z`);
  last.setUTCDate(last.getUTCDate() - 179);
  return { start: last.toISOString().slice(0, 10), end: latestSalesDate };
}

export function normalizeSkuDashboardFilters(
  input: Partial<SkuDashboardFilters>,
  latestSalesDate: string,
): SkuDashboardFilters {
  const defaults = defaultDateRange(latestSalesDate);
  const start = input.start || defaults.start;
  const end = input.end || defaults.end;
  if (!isDateKey(start) || !isDateKey(end) || start > end || end > latestSalesDate || dateSpanDays(start, end) > 366) {
    throw new Error("Choose a valid date range of up to 366 days, ending no later than the latest sales date.");
  }
  return {
    start,
    end,
    supplier: input.supplier?.trim() || "",
    category: input.category?.trim() || "",
    skus: [...new Set(input.skus?.map((sku) => sku.trim()).filter(Boolean) ?? [])].slice(0, 100),
    compare: input.compare !== false,
  };
}

export function aggregateSkuDashboard(
  filters: SkuDashboardFilters,
  rollups: SkuDashboardRollupRow[],
  catalog: SkuDashboardCatalogItem[],
  latestSalesDate: string | null,
  warnings: string[] = [],
): SkuDashboardResult {
  const previousStart = shiftYear(filters.start, -1);
  const previousEnd = shiftYear(filters.end, -1);
  // Historical sync starts in 2025; the handful of Dec 2024 lines are not a full baseline.
  const comparisonAvailable = filters.compare && previousStart >= "2025-01-01";
  const catalogBySku = new Map(catalog.map((item) => [item.sku, item]));
  const bySku = new Map<string, SkuDashboardSkuRow>();
  const monthly = new Map<string, SkuDashboardMonthlyPoint>();
  const firstMonth = `${filters.start.slice(0, 7)}-01`;
  const lastMonth = `${filters.end.slice(0, 7)}-01`;
  for (let cursor = firstMonth; cursor <= lastMonth;) {
    monthly.set(cursor, { month: cursor, units: 0, revenue: 0, previousUnits: 0, previousRevenue: 0 });
    const next = new Date(`${cursor}T00:00:00Z`);
    next.setUTCMonth(next.getUTCMonth() + 1);
    cursor = next.toISOString().slice(0, 10);
  }

  for (const row of rollups) {
    if (row.period === "previous" && !comparisonAvailable) continue;
    const item = catalogBySku.get(row.sku) ?? {
      sku: row.sku, itemName: row.sku, variantName: "", supplier: "Unmapped", category: "Uncategorized", unitCost: null,
    };
    const skuRow = bySku.get(row.sku) ?? {
      sku: row.sku,
      itemName: item.itemName,
      variantName: item.variantName,
      supplier: item.supplier,
      category: item.category,
      units: 0,
      revenue: 0,
      previousUnits: 0,
      previousRevenue: 0,
      estimatedCogs: item.unitCost === null ? null : 0,
    };
    const units = numeric(row.units);
    const revenue = numeric(row.revenue);
    const monthKey = row.period === "previous" ? shiftYear(row.month_start, 1) : row.month_start;
    const month = monthly.get(monthKey);
    if (row.period === "current") {
      skuRow.units += units;
      skuRow.revenue += revenue;
      if (skuRow.estimatedCogs !== null && item.unitCost !== null) skuRow.estimatedCogs += units * item.unitCost;
      if (month) {
        month.units += units;
        month.revenue += revenue;
      }
    } else {
      skuRow.previousUnits += units;
      skuRow.previousRevenue += revenue;
      if (month) {
        month.previousUnits += units;
        month.previousRevenue += revenue;
      }
    }
    bySku.set(row.sku, skuRow);
  }

  const skus = [...bySku.values()].sort((a, b) => b.units - a.units || a.sku.localeCompare(b.sku));
  const units = skus.reduce((sum, row) => sum + row.units, 0);
  const revenue = skus.reduce((sum, row) => sum + row.revenue, 0);
  const coveredRevenue = skus.reduce((sum, row) => sum + (row.estimatedCogs === null ? 0 : row.revenue), 0);
  const coveredRows = skus.filter((row) => row.estimatedCogs !== null && row.units !== 0);
  const estimatedCogs = coveredRows.length ? coveredRows.reduce((sum, row) => sum + (row.estimatedCogs ?? 0), 0) : null;
  const estimatedGrossProfit = estimatedCogs === null ? null : coveredRevenue - estimatedCogs;
  return {
    filters,
    previousStart,
    previousEnd,
    comparisonAvailable,
    latestSalesDate,
    catalog: [...catalog, ...skus.filter((row) => !catalogBySku.has(row.sku)).map((row) => ({
      sku: row.sku, itemName: row.itemName, variantName: row.variantName,
      supplier: row.supplier, category: row.category, unitCost: null,
    }))],
    monthly: [...monthly.values()],
    skus,
    summary: {
      units,
      revenue,
      activeSkus: skus.filter((row) => row.units > 0).length,
      averageMonthlyUnits: units / (dateSpanDays(filters.start, filters.end) / 30.4375),
      previousUnits: comparisonAvailable ? skus.reduce((sum, row) => sum + row.previousUnits, 0) : 0,
      previousRevenue: comparisonAvailable ? skus.reduce((sum, row) => sum + row.previousRevenue, 0) : 0,
      coveredRevenue,
      costCoveragePercent: revenue > 0 ? Math.max(0, Math.min(100, (coveredRevenue / revenue) * 100)) : 0,
      estimatedCogs,
      estimatedGrossProfit,
      estimatedGrossMarginPercent: estimatedGrossProfit !== null && coveredRevenue > 0
        ? (estimatedGrossProfit / coveredRevenue) * 100 : null,
    },
    warnings,
  };
}
