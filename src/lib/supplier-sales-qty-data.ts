import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { excelSupplierMap } from "@/lib/excel-supplier-map";
import { getPurchasingSetupData } from "@/lib/purchasing-setup";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

const PAGE_SIZE = 1000;
const CHUNK_SIZE = 80;
const SUPPLIER_ALIASES: Record<string, string> = {
  "twins phuket": "SSTWINPHUKET001",
};

type SalesBySkuDayRow = {
  qty_sold: number | string | null;
  sales_date: string | null;
  sku: string | null;
};

type DecisionControlRow = {
  sku: string | null;
  supplier_override: string | null;
  tags_override?: string[] | null;
};

type ManualSupplierRow = {
  sku: string | null;
  supplier: string | null;
};

type ProductRelation = {
  tags?: string[] | null;
  vendor: string | null;
};

type VariantRow = {
  products: ProductRelation | ProductRelation[] | null;
  sku: string | null;
};

export type SupplierSalesQtyComparisonRow = {
  averageMonthlyQty: number | null;
  comparisonTotalQty: number;
  diffQty: number | null;
  monthlyQty: Array<number | null>;
  totalQty: number;
  year: number;
  yoyPercent: number | null;
  yoyStatus: "percent" | "new" | "none";
};

export type SupplierSalesQtyComparisonGroup = {
  isGrandTotal?: boolean;
  rows: SupplierSalesQtyComparisonRow[];
  supplier: string;
};

export type SupplierTagSalesQtyComparisonGroup = SupplierSalesQtyComparisonGroup & {
  tag: string;
};

export type SupplierSalesQtyComparisonData = {
  currentEndDate: string;
  currentLabel: string;
  currentStartDate: string;
  currentYear: number;
  previousEndDate: string;
  previousLabel: string;
  previousStartDate: string;
  previousYear: number;
  supplierGroups: SupplierSalesQtyComparisonGroup[];
  source: "sales_by_sku_day";
  warnings: string[];
};

export type SupplierTagSalesQtyComparisonData = Omit<SupplierSalesQtyComparisonData, "supplierGroups"> & {
  tagGroups: SupplierTagSalesQtyComparisonGroup[];
};

type PeriodSkuQty = {
  currentMonthly: Array<number | null>;
  previousComparisonMonthly: number[];
  previousMonthly: Array<number | null>;
};

type SupplierAccumulator = {
  currentMonthly: Array<number | null>;
  previousComparisonMonthly: number[];
  previousMonthly: Array<number | null>;
  skus: Set<string>;
  supplier: string;
};

type SupplierTagAccumulator = SupplierAccumulator & {
  tag: string;
};

const excelSupplierBySku = new Map(excelSupplierMap.map((row) => [row.sku, row.supplierName]));

function compactText(value: string | null | undefined) {
  return value?.trim() || "";
}

function numeric(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function firstProduct(row: VariantRow | undefined) {
  const product = row ? row.products : null;
  return Array.isArray(product) ? product[0] : product;
}

function chunkItems<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function fetchAll<T>(
  label: string,
  queryForRange: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
  warnings: string[],
) {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await queryForRange(from, from + PAGE_SIZE - 1);
    if (error) {
      warnings.push(`${label}: ${error.message}`);
      return rows;
    }
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE_SIZE) {
      return rows;
    }
  }
}

function bangkokDateParts(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Bangkok",
    year: "numeric",
  }).formatToParts(value);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return {
    day: Number(part("day")),
    month: Number(part("month")),
    year: Number(part("year")),
  };
}

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function sameMonthDayInYear(source: string, year: number) {
  const [, monthValue, dayValue] = source.split("-").map(Number);
  const day = Math.min(dayValue, daysInMonth(year, monthValue));
  return dateKey(year, monthValue, day);
}

function latestAvailableAnchor(today: Date, latestSalesDate: string | null) {
  const todayParts = bangkokDateParts(today);
  const todayKey = dateKey(todayParts.year, todayParts.month, todayParts.day);
  if (!latestSalesDate) {
    return todayKey;
  }

  const latestYear = Number(latestSalesDate.slice(0, 4));
  return latestYear < todayParts.year ? latestSalesDate : todayKey;
}

function buildPeriods(anchorDate: string) {
  const currentYear = Number(anchorDate.slice(0, 4));
  const previousYear = currentYear - 1;
  return {
    currentEndDate: anchorDate,
    currentStartDate: `${currentYear}-01-01`,
    currentYear,
    previousEndDate: sameMonthDayInYear(anchorDate, previousYear),
    previousStartDate: `${previousYear}-01-01`,
    previousYear,
  };
}

function buildSupplierAliases(activeSupplierNames: string[]) {
  const aliases = new Map<string, string>();
  for (const supplier of activeSupplierNames) {
    aliases.set(supplier.toLowerCase(), supplier);
  }
  for (const [alias, supplier] of Object.entries(SUPPLIER_ALIASES)) {
    if (activeSupplierNames.some((name) => name.toLowerCase() === supplier.toLowerCase())) {
      aliases.set(alias, supplier);
    }
  }
  for (const row of excelSupplierMap) {
    const excelName = compactText(row.supplierName);
    if (!excelName) {
      continue;
    }
    const excelKey = excelName.toLowerCase();
    const setupName = activeSupplierNames.find((supplier) => {
      const setupKey = supplier.toLowerCase();
      return setupKey.includes(excelKey) || excelKey.includes(setupKey);
    });
    aliases.set(excelKey, setupName ?? aliases.get(excelKey) ?? excelName);
  }
  return aliases;
}

function canonicalSupplier(value: string, aliases: Map<string, string>) {
  return aliases.get(value.toLowerCase()) ?? value;
}

function resolvedSupplier({
  aliases,
  control,
  manualSupplier,
  shopifyVendor,
  sku,
}: {
  aliases: Map<string, string>;
  control: DecisionControlRow | undefined;
  manualSupplier: string | undefined;
  shopifyVendor: string;
  sku: string;
}) {
  const override = compactText(control?.supplier_override);
  if (override) {
    return canonicalSupplier(override, aliases);
  }
  const supplier =
    compactText(manualSupplier) ||
    compactText(excelSupplierBySku.get(sku)) ||
    compactText(shopifyVendor);
  return supplier ? canonicalSupplier(supplier, aliases) : "Unmapped";
}

function primaryReportingTag({
  activeTagSet,
  control,
  shopifyTags,
}: {
  activeTagSet: Set<string>;
  control: DecisionControlRow | undefined;
  shopifyTags: string[];
}) {
  const savedTag = (control?.tags_override ?? []).map(compactText).find((tag) => tag && activeTagSet.has(tag.toLowerCase()));
  if (savedTag) {
    return savedTag;
  }

  const fallbackTag = shopifyTags.map(compactText).find((tag) => tag && activeTagSet.has(tag.toLowerCase()));
  return fallbackTag || "Untagged";
}

async function latestSalesDate(supabase: SupabaseClient, warnings: string[]) {
  const { data, error } = await supabase
    .from("sales_by_sku_day")
    .select("sales_date")
    .order("sales_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    warnings.push(`Latest sales date: ${error.message}`);
    return null;
  }

  return typeof data?.sales_date === "string" ? data.sales_date : null;
}

async function fetchPeriodRows(
  supabase: SupabaseClient,
  label: string,
  startDate: string,
  endDate: string,
  warnings: string[],
) {
  return fetchAll<SalesBySkuDayRow>(
    label,
    (from, to) =>
      supabase
        .from("sales_by_sku_day")
        .select("sku,sales_date,qty_sold")
        .gte("sales_date", startDate)
        .lte("sales_date", endDate)
        .order("sku", { ascending: true })
        .range(from, to),
    warnings,
  );
}

async function fetchRowsForSkus<T>(
  label: string,
  skus: string[],
  queryForChunk: (chunk: string[], from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
  warnings: string[],
) {
  const rows: T[] = [];
  for (const chunk of chunkItems(skus, CHUNK_SIZE)) {
    rows.push(...(await fetchAll<T>(label, (from, to) => queryForChunk(chunk, from, to), warnings)));
  }
  return rows;
}

function emptyMonthlyQty() {
  return Array.from({ length: 12 }, () => 0);
}

function emptyOptionalMonthlyQty() {
  return Array.from({ length: 12 }, (): number | null => null);
}

function monthIndexFromDate(value: string | null) {
  if (!value) {
    return -1;
  }
  const month = Number(value.slice(5, 7));
  return Number.isInteger(month) && month >= 1 && month <= 12 ? month - 1 : -1;
}

function addPeriodRows(rows: SalesBySkuDayRow[], target: Map<string, PeriodSkuQty>, key: "currentMonthly" | "previousMonthly") {
  for (const row of rows) {
    const sku = compactText(row.sku);
    const monthIndex = monthIndexFromDate(row.sales_date);
    if (!sku || monthIndex < 0) {
      continue;
    }
    const existing =
      target.get(sku) ?? {
        currentMonthly: emptyOptionalMonthlyQty(),
        previousComparisonMonthly: emptyMonthlyQty(),
        previousMonthly: emptyOptionalMonthlyQty(),
      };
    existing[key][monthIndex] = (existing[key][monthIndex] ?? 0) + numeric(row.qty_sold);
    target.set(sku, existing);
  }
}

function addComparisonRows(rows: SalesBySkuDayRow[], target: Map<string, PeriodSkuQty>) {
  for (const row of rows) {
    const sku = compactText(row.sku);
    const monthIndex = monthIndexFromDate(row.sales_date);
    if (!sku || monthIndex < 0) {
      continue;
    }
    const existing =
      target.get(sku) ?? {
        currentMonthly: emptyOptionalMonthlyQty(),
        previousComparisonMonthly: emptyMonthlyQty(),
        previousMonthly: emptyOptionalMonthlyQty(),
      };
    existing.previousComparisonMonthly[monthIndex] += numeric(row.qty_sold);
    target.set(sku, existing);
  }
}

function totalMonthly(monthly: Array<number | null>) {
  return monthly.reduce<number>((sum, value) => sum + (value ?? 0), 0);
}

function actualMonthCount(monthly: Array<number | null>) {
  return monthly.filter((value) => value !== null).length;
}

function averageMonthly(monthly: Array<number | null>, totalQty: number) {
  const months = actualMonthCount(monthly);
  return months > 0 ? totalQty / months : null;
}

function visibleMonthly(monthly: Array<number | null>, cutoffMonth: number) {
  return monthly.map((value, index) => (index < cutoffMonth ? value : null));
}

function sumVisibleMonthlyFromGroups(
  groups: SupplierSalesQtyComparisonGroup[],
  rowIndex: number,
) {
  return Array.from({ length: 12 }, (_, monthIndex): number | null => {
    let hasActualMonth = false;
    let total = 0;
    for (const group of groups) {
      const value = group.rows[rowIndex]?.monthlyQty[monthIndex] ?? null;
      if (value !== null) {
        hasActualMonth = true;
        total += value;
      }
    }
    return hasActualMonth ? total : null;
  });
}

function yearRow({
  comparisonTotal,
  currentComparisonTotal,
  monthly,
  previousComparisonTotal,
  showComparison,
  year,
}: {
  comparisonTotal: number;
  currentComparisonTotal: number;
  monthly: Array<number | null>;
  previousComparisonTotal: number;
  showComparison: boolean;
  year: number;
}): SupplierSalesQtyComparisonRow {
  const totalQty = totalMonthly(monthly);
  if (!showComparison) {
    return {
      averageMonthlyQty: averageMonthly(monthly, totalQty),
      comparisonTotalQty: comparisonTotal,
      diffQty: null,
      monthlyQty: monthly,
      totalQty,
      year,
      yoyPercent: null,
      yoyStatus: "none",
    };
  }

  const diffQty = currentComparisonTotal - previousComparisonTotal;
  return {
    averageMonthlyQty: averageMonthly(monthly, totalQty),
    comparisonTotalQty: currentComparisonTotal,
    diffQty,
    monthlyQty: monthly,
    totalQty,
    year,
    yoyPercent: previousComparisonTotal > 0 ? diffQty / previousComparisonTotal : null,
    yoyStatus: previousComparisonTotal > 0 ? "percent" : currentComparisonTotal > 0 ? "new" : "none",
  };
}

export async function getSupplierSalesQtyComparisonData(
  today = new Date(),
): Promise<SupplierSalesQtyComparisonData> {
  const warnings: string[] = [];
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    const periods = buildPeriods(latestAvailableAnchor(today, null));
    return {
      ...periods,
      currentLabel: "Qty YTD",
      previousLabel: "Qty Same Period LY",
      supplierGroups: [],
      source: "sales_by_sku_day",
      warnings: ["Supabase service client is not configured."],
    };
  }

  const latestDate = await latestSalesDate(supabase, warnings);
  const periods = buildPeriods(latestAvailableAnchor(today, latestDate));
  const previousFullYearEndDate = `${periods.previousYear}-12-31`;
  const [currentRows, previousRows, previousComparisonRows] = await Promise.all([
    fetchPeriodRows(supabase, "Current period sales quantity", periods.currentStartDate, periods.currentEndDate, warnings),
    fetchPeriodRows(supabase, "Previous year sales quantity", periods.previousStartDate, previousFullYearEndDate, warnings),
    fetchPeriodRows(supabase, "Previous comparison period sales quantity", periods.previousStartDate, periods.previousEndDate, warnings),
  ]);

  const skuQty = new Map<string, PeriodSkuQty>();
  addPeriodRows(currentRows, skuQty, "currentMonthly");
  addPeriodRows(previousRows, skuQty, "previousMonthly");
  addComparisonRows(previousComparisonRows, skuQty);

  const skus = [...skuQty.keys()].sort((a, b) => a.localeCompare(b));
  const [variantRows, controlRows, manualSupplierRows, setupData] = await Promise.all([
    fetchRowsForSkus<VariantRow>(
      "Product variants",
      skus,
      (chunk, from, to) =>
        supabase
          .from("product_variants")
          .select("sku,products(vendor)")
          .in("sku", chunk)
          .order("sku", { ascending: true })
          .range(from, to),
      warnings,
    ),
    fetchRowsForSkus<DecisionControlRow>(
      "Purchasing decision controls",
      skus,
      (chunk, from, to) =>
        supabase
          .from("purchasing_decision_controls")
          .select("sku,supplier_override")
          .in("sku", chunk)
          .order("sku", { ascending: true })
          .range(from, to),
      warnings,
    ),
    fetchRowsForSkus<ManualSupplierRow>(
      "Manual supplier mappings",
      skus,
      (chunk, from, to) =>
        supabase
          .from("manual_supplier_mappings")
          .select("sku,supplier")
          .in("sku", chunk)
          .order("sku", { ascending: true })
          .range(from, to),
      warnings,
    ),
    getPurchasingSetupData(),
  ]);

  const variantsBySku = new Map(
    variantRows
      .map((row) => [compactText(row.sku), row] as const)
      .filter(([sku]) => Boolean(sku)),
  );
  const controlsBySku = new Map(
    controlRows
      .map((row) => [compactText(row.sku), row] as const)
      .filter(([sku]) => Boolean(sku)),
  );
  const manualSupplierBySku = new Map(
    manualSupplierRows
      .map((row) => [compactText(row.sku), compactText(row.supplier)] as const)
      .filter(([sku, supplier]) => Boolean(sku && supplier)),
  );
  const supplierAliases = buildSupplierAliases(setupData.suppliers.filter((supplier) => supplier.isActive).map((supplier) => supplier.supplierName));
  const bySupplier = new Map<string, SupplierAccumulator>();

  for (const [sku, qty] of skuQty) {
    const variant = variantsBySku.get(sku);
    const product = firstProduct(variant);
    const supplier = resolvedSupplier({
      aliases: supplierAliases,
      control: controlsBySku.get(sku),
      manualSupplier: manualSupplierBySku.get(sku),
      shopifyVendor: compactText(product?.vendor),
      sku,
    });
    const existing =
      bySupplier.get(supplier) ??
      {
        currentMonthly: emptyOptionalMonthlyQty(),
        previousComparisonMonthly: emptyMonthlyQty(),
        previousMonthly: emptyOptionalMonthlyQty(),
        skus: new Set<string>(),
        supplier,
      };

    for (let index = 0; index < 12; index += 1) {
      existing.currentMonthly[index] = (existing.currentMonthly[index] ?? 0) + (qty.currentMonthly[index] ?? 0);
      existing.previousMonthly[index] = (existing.previousMonthly[index] ?? 0) + (qty.previousMonthly[index] ?? 0);
      existing.previousComparisonMonthly[index] += qty.previousComparisonMonthly[index];
    }
    existing.skus.add(sku);
    bySupplier.set(supplier, existing);
  }

  const cutoffMonth = Number(periods.currentEndDate.slice(5, 7));
  const supplierGroups: SupplierSalesQtyComparisonGroup[] = [...bySupplier.values()]
    .map((supplier) => {
      const previousMonthly = supplier.previousMonthly;
      const currentMonthly = visibleMonthly(supplier.currentMonthly, cutoffMonth);
      const previousComparisonMonthly = visibleMonthly(supplier.previousComparisonMonthly, cutoffMonth);
      const previousComparisonTotal = totalMonthly(previousComparisonMonthly);
      const currentComparisonTotal = totalMonthly(currentMonthly);
      return {
        rows: [
          yearRow({
            comparisonTotal: previousComparisonTotal,
            currentComparisonTotal,
            monthly: previousMonthly,
            previousComparisonTotal,
            showComparison: false,
            year: periods.previousYear,
          }),
          yearRow({
            comparisonTotal: currentComparisonTotal,
            currentComparisonTotal,
            monthly: currentMonthly,
            previousComparisonTotal,
            showComparison: true,
            year: periods.currentYear,
          }),
        ],
        supplier: supplier.supplier,
      };
    })
    .sort((a, b) => b.rows[1].totalQty - a.rows[1].totalQty || b.rows[0].totalQty - a.rows[0].totalQty || a.supplier.localeCompare(b.supplier));

  if (supplierGroups.length > 0) {
    const grandPreviousComparison = emptyMonthlyQty();
    for (const supplier of bySupplier.values()) {
      for (let index = 0; index < 12; index += 1) {
        grandPreviousComparison[index] += supplier.previousComparisonMonthly[index];
      }
    }
    const previousMonthly = sumVisibleMonthlyFromGroups(supplierGroups, 0);
    const currentMonthly = sumVisibleMonthlyFromGroups(supplierGroups, 1);
    const previousComparisonMonthly = visibleMonthly(grandPreviousComparison, cutoffMonth);
    const previousComparisonTotal = totalMonthly(previousComparisonMonthly);
    const currentComparisonTotal = totalMonthly(currentMonthly);
    supplierGroups.push({
      isGrandTotal: true,
      rows: [
        yearRow({
          comparisonTotal: previousComparisonTotal,
          currentComparisonTotal,
          monthly: previousMonthly,
          previousComparisonTotal,
          showComparison: false,
          year: periods.previousYear,
        }),
        yearRow({
          comparisonTotal: currentComparisonTotal,
          currentComparisonTotal,
          monthly: currentMonthly,
          previousComparisonTotal,
          showComparison: true,
          year: periods.currentYear,
        }),
      ],
      supplier: "Grand Total",
    });
  }

  return {
    ...periods,
    currentLabel: "Qty YTD",
    previousLabel: "Qty Same Period LY",
    supplierGroups,
    source: "sales_by_sku_day",
    warnings,
  };
}

export async function getSupplierTagSalesQtyComparisonData(
  today = new Date(),
): Promise<SupplierTagSalesQtyComparisonData> {
  const warnings: string[] = [];
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    const periods = buildPeriods(latestAvailableAnchor(today, null));
    return {
      ...periods,
      currentLabel: "Qty YTD",
      previousLabel: "Qty Same Period LY",
      source: "sales_by_sku_day",
      tagGroups: [],
      warnings: ["Supabase service client is not configured."],
    };
  }

  const latestDate = await latestSalesDate(supabase, warnings);
  const periods = buildPeriods(latestAvailableAnchor(today, latestDate));
  const previousFullYearEndDate = `${periods.previousYear}-12-31`;
  const [currentRows, previousRows, previousComparisonRows] = await Promise.all([
    fetchPeriodRows(supabase, "Current period sales quantity by tags", periods.currentStartDate, periods.currentEndDate, warnings),
    fetchPeriodRows(supabase, "Previous year sales quantity by tags", periods.previousStartDate, previousFullYearEndDate, warnings),
    fetchPeriodRows(supabase, "Previous comparison period sales quantity by tags", periods.previousStartDate, periods.previousEndDate, warnings),
  ]);

  const skuQty = new Map<string, PeriodSkuQty>();
  addPeriodRows(currentRows, skuQty, "currentMonthly");
  addPeriodRows(previousRows, skuQty, "previousMonthly");
  addComparisonRows(previousComparisonRows, skuQty);

  const skus = [...skuQty.keys()].sort((a, b) => a.localeCompare(b));
  const [variantRows, controlRows, manualSupplierRows, setupData] = await Promise.all([
    fetchRowsForSkus<VariantRow>(
      "Product variants for tags",
      skus,
      (chunk, from, to) =>
        supabase
          .from("product_variants")
          .select("sku,products(vendor,tags)")
          .in("sku", chunk)
          .order("sku", { ascending: true })
          .range(from, to),
      warnings,
    ),
    fetchRowsForSkus<DecisionControlRow>(
      "Purchasing decision controls for tags",
      skus,
      (chunk, from, to) =>
        supabase
          .from("purchasing_decision_controls")
          .select("sku,supplier_override,tags_override")
          .in("sku", chunk)
          .order("sku", { ascending: true })
          .range(from, to),
      warnings,
    ),
    fetchRowsForSkus<ManualSupplierRow>(
      "Manual supplier mappings for tags",
      skus,
      (chunk, from, to) =>
        supabase
          .from("manual_supplier_mappings")
          .select("sku,supplier")
          .in("sku", chunk)
          .order("sku", { ascending: true })
          .range(from, to),
      warnings,
    ),
    getPurchasingSetupData(),
  ]);

  const variantsBySku = new Map(
    variantRows
      .map((row) => [compactText(row.sku), row] as const)
      .filter(([sku]) => Boolean(sku)),
  );
  const controlsBySku = new Map(
    controlRows
      .map((row) => [compactText(row.sku), row] as const)
      .filter(([sku]) => Boolean(sku)),
  );
  const manualSupplierBySku = new Map(
    manualSupplierRows
      .map((row) => [compactText(row.sku), compactText(row.supplier)] as const)
      .filter(([sku, supplier]) => Boolean(sku && supplier)),
  );
  const activeTags = setupData.tags.filter((tag) => tag.isActive).map((tag) => tag.tag);
  const activeTagSet = new Set(activeTags.map((tag) => tag.toLowerCase()));
  const supplierAliases = buildSupplierAliases(setupData.suppliers.filter((supplier) => supplier.isActive).map((supplier) => supplier.supplierName));
  const bySupplierTag = new Map<string, SupplierTagAccumulator>();

  for (const [sku, qty] of skuQty) {
    const variant = variantsBySku.get(sku);
    const product = firstProduct(variant);
    const control = controlsBySku.get(sku);
    const supplier = resolvedSupplier({
      aliases: supplierAliases,
      control,
      manualSupplier: manualSupplierBySku.get(sku),
      shopifyVendor: compactText(product?.vendor),
      sku,
    });
    const tag = primaryReportingTag({
      activeTagSet,
      control,
      shopifyTags: product?.tags ?? [],
    });
    const key = `${supplier.toLowerCase()}\u0000${tag.toLowerCase()}`;
    const existing =
      bySupplierTag.get(key) ??
      {
        currentMonthly: emptyOptionalMonthlyQty(),
        previousComparisonMonthly: emptyMonthlyQty(),
        previousMonthly: emptyOptionalMonthlyQty(),
        skus: new Set<string>(),
        supplier,
        tag,
      };

    for (let index = 0; index < 12; index += 1) {
      existing.currentMonthly[index] = (existing.currentMonthly[index] ?? 0) + (qty.currentMonthly[index] ?? 0);
      existing.previousMonthly[index] = (existing.previousMonthly[index] ?? 0) + (qty.previousMonthly[index] ?? 0);
      existing.previousComparisonMonthly[index] += qty.previousComparisonMonthly[index];
    }
    existing.skus.add(sku);
    bySupplierTag.set(key, existing);
  }

  const cutoffMonth = Number(periods.currentEndDate.slice(5, 7));
  const tagGroups: SupplierTagSalesQtyComparisonGroup[] = [...bySupplierTag.values()]
    .map((group) => {
      const previousMonthly = group.previousMonthly;
      const currentMonthly = visibleMonthly(group.currentMonthly, cutoffMonth);
      const previousComparisonMonthly = visibleMonthly(group.previousComparisonMonthly, cutoffMonth);
      const previousComparisonTotal = totalMonthly(previousComparisonMonthly);
      const currentComparisonTotal = totalMonthly(currentMonthly);
      return {
        rows: [
          yearRow({
            comparisonTotal: previousComparisonTotal,
            currentComparisonTotal,
            monthly: previousMonthly,
            previousComparisonTotal,
            showComparison: false,
            year: periods.previousYear,
          }),
          yearRow({
            comparisonTotal: currentComparisonTotal,
            currentComparisonTotal,
            monthly: currentMonthly,
            previousComparisonTotal,
            showComparison: true,
            year: periods.currentYear,
          }),
        ],
        supplier: group.supplier,
        tag: group.tag,
      };
    })
    .sort(
      (a, b) =>
        a.supplier.localeCompare(b.supplier) ||
        b.rows[1].totalQty - a.rows[1].totalQty ||
        b.rows[0].totalQty - a.rows[0].totalQty ||
        a.tag.localeCompare(b.tag),
    );

  return {
    ...periods,
    currentLabel: "Qty YTD",
    previousLabel: "Qty Same Period LY",
    source: "sales_by_sku_day",
    tagGroups,
    warnings,
  };
}
