import { excelSupplierMap } from "@/lib/excel-supplier-map";
import { getPurchasingSetupData } from "@/lib/purchasing-setup";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

type ProductRelation =
  | {
      product_title: string | null;
      vendor: string | null;
      tags: string[] | null;
      product_image_url: string | null;
    }
  | {
      product_title: string | null;
      vendor: string | null;
      tags: string[] | null;
      product_image_url: string | null;
    }[]
  | null;

type VariantRow = {
  sku: string | null;
  variant_title: string | null;
  price: number | string | null;
  variant_image_url: string | null;
  item_status: string | null;
  products: ProductRelation;
};

type InventoryRow = {
  sku: string | null;
  on_hand: number | string | null;
};

type DemandIndexRow = {
  sku: string | null;
  total_sale: number | string | null;
  sold_30: number | string | null;
  first_sale_date: string | null;
  last_sale_date: string | null;
  selling_days: number | string | null;
  lifetime_daily_average: number | string | null;
  selling_day_average: number | string | null;
  demand_index_hm: number | string | null;
};

type SalesBySkuDayRow = {
  sku: string | null;
  sales_date: string | null;
  qty_sold: number | string | null;
};

type SalesStats = {
  total: number;
  sold30: number;
  firstSaleDate: string | null;
  lastSaleDate: string | null;
  sellingDays: number;
  lifetimeDailyAverage: number;
  sellingDayAverage: number;
  demandIndex: number;
};

export type DemandFormulaSettings = {
  lifetimeWeight: number;
  sellingDayWeight: number;
  recentFloorPercent: number;
  capAtSellingDayAverage: boolean;
};

type IncomingRow = {
  sku: string | null;
  active_incoming_qty: number | string | null;
  pending_approval_qty: number | string | null;
};

type ManualSupplierRow = {
  sku: string | null;
  supplier: string | null;
};

type DecisionControlRow = {
  sku: string | null;
  product_name_override: string | null;
  main_name_override: string | null;
  supplier_override: string | null;
  item_status_override: string | null;
  tags_override: string[] | null;
  demand_index_override: number | string | null;
  safety_days: number | string | null;
  lead_time_days: number | string | null;
  order_cycle_days: number | string | null;
  manual_rop_units: number | string | null;
  order_qty_mode?: string | null;
  target_coverage_days: number | string | null;
  hide_from_purchasing: boolean | null;
  hide_reason: string | null;
  note: string | null;
  planning_override_note?: string | null;
  planning_override_source?: string | null;
  updated_by?: string | null;
};

export type PurchasingDecisionLine = {
  sku: string;
  productName: string;
  shopifyProductName: string;
  mainName: string;
  itemStatus: string;
  shopifyItemStatus: string;
  tags: string[];
  supplier: string;
  supplierSetInSheet: boolean;
  supplierSource: "decision" | "manual" | "excel" | "shopify_vendor" | "setup" | "pending";
  onHandUnits: number;
  totalSale: number;
  demand30Days: number;
  firstSaleDate: string | null;
  lastSaleDate: string | null;
  sellingDays: number;
  lifetimeDailyAverage: number;
  sellingDayAverage: number;
  demandIndexHm: number;
  calculatedDemandIndexHm: number;
  demandIndexOverride: number | null;
  safetyDays: number;
  safetyIsManual: boolean;
  supplierSafetyDays: number | null;
  safetySource: "sku" | "supplier" | "default";
  leadTimeDays: number;
  leadTimeIsManual: boolean;
  supplierLeadTimeDays: number | null;
  leadTimeSource: "sku" | "supplier" | "default";
  orderCycleDays: number;
  orderCycleIsManual: boolean;
  planningDays: number;
  reorderPointUnits: number;
  ropUnits: number;
  ropUnitsRaw: number;
  ropUnitsRounded: number;
  orderQtyMode: "raw" | "rounded";
  manualRopUnits: number | null;
  coversSalesDuration: number | null;
  week: number;
  month: number;
  ropAlert: "order_now" | "watch" | "healthy" | "hidden";
  stockAlert: "dead_stock" | "heavy_overstock" | "overstock" | "healthy" | "under_target" | "hidden";
  stockPositionUnits: number;
  overstockUnits: number;
  overstockDays: number | null;
  totalCoverageAtOrder: number | null;
  targetCoverageDays: number | null;
  coming: number;
  pendingComing: number;
  unitPrice: number;
  inventoryValue: number;
  comingValue: number;
  imageUrl: string | null;
  hidden: boolean;
  hideReason: string;
  note: string;
};

export type PurchasingDecisionData = {
  mode: "supabase" | "baseline";
  controlsReady: boolean;
  demandFormula: DemandFormulaSettings;
  itemStatusOptions: string[];
  searchOptions: Array<{
    imageUrl: string | null;
    label: string;
    skuCount: number;
  }>;
  supplierFilterOptions: Array<{
    supplier: string;
    orderQty: number;
    onHandUnits: number;
    lineCount: number;
  }>;
  supplierOptions: string[];
  tagFilterOptions: Array<{
    label: string;
    value: string;
  }>;
  tagOptions: string[];
  lines: PurchasingDecisionLine[];
  totals: {
    skuCount: number;
    activeSkuCount: number;
    hiddenSkuCount: number;
    onHandUnits: number;
    overallOnHandUnits: number;
    comingUnits: number;
    inventoryValue: number;
    overallInventoryValue: number;
  };
};

const PAGE_SIZE = 1000;
const FETCH_RETRY_ATTEMPTS = 2;
const DEFAULT_SAFETY_DAYS = 14;
const DEFAULT_LEAD_TIME_DAYS = 60;
const DEFAULT_ORDER_CYCLE_DAYS = 30;
const excelSupplierBySku = new Map(excelSupplierMap.map((row) => [row.sku, row]));
const SUPPLIER_ALIASES: Record<string, string> = {
  "twins phuket": "SSTWINPHUKET001",
};

function numeric(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function optionalInteger(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : null;
}

function firstProduct(row: VariantRow) {
  return Array.isArray(row.products) ? row.products[0] : row.products;
}

function compactText(value: string | null | undefined) {
  return value?.trim() || "";
}

function daysAgo(days: number, now = new Date()) {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

function optionalNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function roundUpToTen(value: number) {
  if (value <= 0) {
    return 0;
  }

  return Math.ceil(value / 10) * 10;
}

function saleSpanDays(firstDate: string | null, lastDate: string | null) {
  if (!firstDate || !lastDate) {
    return 0;
  }

  const first = new Date(`${firstDate}T00:00:00Z`).getTime();
  const last = new Date(`${lastDate}T00:00:00Z`).getTime();
  if (!Number.isFinite(first) || !Number.isFinite(last) || last < first) {
    return 0;
  }

  return Math.max(1, Math.floor((last - first) / (24 * 60 * 60 * 1000)) + 1);
}

const DEFAULT_DEMAND_FORMULA: DemandFormulaSettings = {
  lifetimeWeight: 35,
  sellingDayWeight: 65,
  recentFloorPercent: 75,
  capAtSellingDayAverage: true,
};

function boundedNumber(
  value: number | string | null | undefined,
  fallback: number,
  min: number,
  max: number,
) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

function demandFormulaFromParams({
  capSelling,
  lifetimeWeight,
  recentFloor,
  sellingWeight,
}: {
  capSelling?: string;
  lifetimeWeight?: number | string | null;
  recentFloor?: number | string | null;
  sellingWeight?: number | string | null;
}): DemandFormulaSettings {
  return {
    lifetimeWeight: boundedNumber(
      lifetimeWeight,
      DEFAULT_DEMAND_FORMULA.lifetimeWeight,
      0,
      100,
    ),
    sellingDayWeight: boundedNumber(
      sellingWeight,
      DEFAULT_DEMAND_FORMULA.sellingDayWeight,
      0,
      100,
    ),
    recentFloorPercent: boundedNumber(
      recentFloor,
      DEFAULT_DEMAND_FORMULA.recentFloorPercent,
      0,
      200,
    ),
    capAtSellingDayAverage: capSelling !== "false",
  };
}

function averageDemandFromStats(stats: {
  total: number;
  firstSaleDate: string | null;
  lastSaleDate: string | null;
  sold30: number;
  sellingDays: number;
}, formula: DemandFormulaSettings) {
  const spanDays = saleSpanDays(stats.firstSaleDate, stats.lastSaleDate);
  const lifetimeDailyAverage = spanDays > 0 ? stats.total / spanDays : 0;
  const sellingDayAverage =
    stats.sellingDays > 0 ? stats.total / stats.sellingDays : 0;
  const saleDensity = spanDays > 0 ? stats.sellingDays / spanDays : 0;
  const slowMoverReliability = Math.min(
    1,
    saleDensity * 1.2,
    stats.sellingDays > 0 ? stats.sellingDays / 180 : 0,
    stats.total > 0 ? stats.total / 320 : 0,
  );
  const effectiveSellingWeight = formula.sellingDayWeight * slowMoverReliability;
  const effectiveLifetimeWeight =
    slowMoverReliability < 1 ? 100 - effectiveSellingWeight : formula.lifetimeWeight;
  const weightTotal = effectiveLifetimeWeight + effectiveSellingWeight;
  const weightedBase =
    weightTotal > 0
      ? (lifetimeDailyAverage * effectiveLifetimeWeight +
          sellingDayAverage * effectiveSellingWeight) /
        weightTotal
      : lifetimeDailyAverage || sellingDayAverage;
  const recentFloor = (stats.sold30 / 30) * (formula.recentFloorPercent / 100);
  const uncappedDemand = Math.max(weightedBase, recentFloor);
  const demandIndex =
    formula.capAtSellingDayAverage && sellingDayAverage > 0
      ? Math.min(uncappedDemand, sellingDayAverage)
      : uncappedDemand;

  return {
    demandIndex,
    lifetimeDailyAverage,
    sellingDayAverage,
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function warnOptionalReadFailure(label: string, error: unknown) {
  if (process.env.NODE_ENV !== "production") {
    console.warn(
      `[purchasing-decision] Optional ${label} read failed; continuing without it. ${errorMessage(error)}`,
    );
  }
}

async function fetchAll<T>(
  label: string,
  queryForRange: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
) {
  const rows: T[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    let data: unknown[] | null = null;
    let lastError: unknown = null;

    for (let attempt = 0; attempt <= FETCH_RETRY_ATTEMPTS; attempt += 1) {
      try {
        const result = await queryForRange(from, from + PAGE_SIZE - 1);
        data = result.data;
        lastError = result.error;

        if (!result.error) {
          break;
        }
      } catch (error) {
        lastError = error;
      }

      if (attempt < FETCH_RETRY_ATTEMPTS) {
        await sleep(150 * (attempt + 1));
      }
    }

    if (lastError) {
      throw new Error(`${label} query failed: ${errorMessage(lastError)}`);
    }

    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE_SIZE) {
      break;
    }
  }

  return rows;
}

async function fetchIncomingRows(supabase: SupabaseClient) {
  try {
    return await fetchAll<IncomingRow>("Incoming by SKU", (from, to) =>
      supabase
        .from("po_incoming_by_sku")
        .select("sku,active_incoming_qty,pending_approval_qty")
        .order("sku", { ascending: true })
        .range(from, to),
    );
  } catch (error) {
    warnOptionalReadFailure("po_incoming_by_sku", error);
    return [] as IncomingRow[];
  }
}

async function fetchManualSupplierRows(supabase: SupabaseClient) {
  try {
    return await fetchAll<ManualSupplierRow>("Manual supplier mappings", (from, to) =>
      supabase
        .from("manual_supplier_mappings")
        .select("sku,supplier")
        .order("sku", { ascending: true })
        .range(from, to),
    );
  } catch (error) {
    warnOptionalReadFailure("manual_supplier_mappings", error);
    return [] as ManualSupplierRow[];
  }
}

async function fetchCurrentInventoryRows(supabase: SupabaseClient) {
  try {
    return await fetchAll<InventoryRow>("Current inventory summary", (from, to) =>
      supabase
        .from("current_inventory_by_sku")
        .select("sku,on_hand")
        .order("sku", { ascending: true })
        .range(from, to),
    );
  } catch {
    const { data: latestInventoryDate, error } = await supabase
      .from("inventory_snapshots")
      .select("snapshot_date")
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(`Latest inventory query failed: ${error.message}`);
    }
    if (!latestInventoryDate?.snapshot_date) {
      return [] as InventoryRow[];
    }

    return fetchAll<InventoryRow>("Inventory", (from, to) =>
      supabase
        .from("inventory_snapshots")
        .select("sku,on_hand")
        .eq("snapshot_date", latestInventoryDate.snapshot_date)
        .range(from, to),
    );
  }
}

async function fetchControls(supabase: SupabaseClient) {
  let data: DecisionControlRow[];

  try {
    data = await fetchAll<DecisionControlRow>("Purchasing controls", (from, to) =>
      supabase
        .from("purchasing_decision_controls")
        .select(
          "sku,product_name_override,main_name_override,supplier_override,item_status_override,tags_override,demand_index_override,safety_days,lead_time_days,order_cycle_days,manual_rop_units,order_qty_mode,target_coverage_days,hide_from_purchasing,hide_reason,note,updated_by,planning_override_source,planning_override_note",
        )
        .order("sku", { ascending: true })
        .range(from, to),
    );
  } catch {
    try {
      data = await fetchAll<DecisionControlRow>("Purchasing controls", (from, to) =>
        supabase
          .from("purchasing_decision_controls")
          .select(
            "sku,product_name_override,main_name_override,supplier_override,item_status_override,tags_override,demand_index_override,safety_days,lead_time_days,order_cycle_days,manual_rop_units,target_coverage_days,hide_from_purchasing,hide_reason,note",
          )
          .order("sku", { ascending: true })
          .range(from, to),
      );
    } catch {
      return {
        controls: new Map<string, DecisionControlRow>(),
        controlsReady: false,
      };
    }
  }

  if (!data.length) {
    return {
      controls: new Map<string, DecisionControlRow>(),
      controlsReady: true,
    };
  }

  return {
    controls: new Map(
      data
        .filter((row) => row.sku?.trim())
        .map((row) => [row.sku!.trim(), row]),
    ),
    controlsReady: true,
  };
}

function buildStockBySku(rows: InventoryRow[]) {
  const bySku = new Map<string, number>();
  for (const row of rows) {
    const sku = row.sku?.trim();
    if (!sku) {
      continue;
    }
    bySku.set(sku, (bySku.get(sku) ?? 0) + numeric(row.on_hand));
  }
  return bySku;
}

function buildIncomingBySku(rows: IncomingRow[]) {
  const bySku = new Map<string, { active: number; pending: number }>();
  for (const row of rows) {
    const sku = row.sku?.trim();
    if (!sku) {
      continue;
    }
    bySku.set(sku, {
      active: numeric(row.active_incoming_qty),
      pending: numeric(row.pending_approval_qty),
    });
  }
  return bySku;
}

function buildManualSupplierBySku(rows: ManualSupplierRow[]) {
  const bySku = new Map<string, string>();
  for (const row of rows) {
    const sku = row.sku?.trim();
    const supplier = row.supplier?.trim();
    if (sku && supplier) {
      bySku.set(sku, supplier);
    }
  }
  return bySku;
}

function isDefaultDemandFormula(formula: DemandFormulaSettings) {
  return (
    formula.capAtSellingDayAverage === DEFAULT_DEMAND_FORMULA.capAtSellingDayAverage &&
    formula.lifetimeWeight === DEFAULT_DEMAND_FORMULA.lifetimeWeight &&
    formula.recentFloorPercent === DEFAULT_DEMAND_FORMULA.recentFloorPercent &&
    formula.sellingDayWeight === DEFAULT_DEMAND_FORMULA.sellingDayWeight
  );
}

function buildSalesBySkuFromDailySummary(
  rows: SalesBySkuDayRow[],
  formula: DemandFormulaSettings,
) {
  const d30 = daysAgo(30);
  const bySku = new Map<
    string,
    { total: number; sold30: number; firstSaleDate: string | null; lastSaleDate: string | null; saleDates: Set<string> }
  >();

  for (const row of rows) {
    const sku = row.sku?.trim();
    const orderDate = row.sales_date;
    if (!sku || !orderDate) {
      continue;
    }

    const existing = bySku.get(sku) ?? {
      total: 0,
      sold30: 0,
      firstSaleDate: null,
      lastSaleDate: null,
      saleDates: new Set<string>(),
    };
    const qty = numeric(row.qty_sold);
    existing.total += qty;
    if (orderDate >= d30) {
      existing.sold30 += qty;
    }
    existing.firstSaleDate =
      existing.firstSaleDate && existing.firstSaleDate < orderDate
        ? existing.firstSaleDate
        : orderDate;
    existing.lastSaleDate =
      existing.lastSaleDate && existing.lastSaleDate > orderDate
        ? existing.lastSaleDate
        : orderDate;
    existing.saleDates.add(orderDate);
    bySku.set(sku, existing);
  }

  return new Map(
    Array.from(bySku.entries()).map(([sku, stats]) => {
      const averages = averageDemandFromStats({
        total: stats.total,
        firstSaleDate: stats.firstSaleDate,
        lastSaleDate: stats.lastSaleDate,
        sold30: stats.sold30,
        sellingDays: stats.saleDates.size,
      }, formula);

      return [
        sku,
        {
          total: stats.total,
          sold30: stats.sold30,
          firstSaleDate: stats.firstSaleDate,
          lastSaleDate: stats.lastSaleDate,
          sellingDays: stats.saleDates.size,
          ...averages,
        } satisfies SalesStats,
      ];
    }),
  );
}

function buildSalesBySkuFromDemandSnapshot(
  rows: DemandIndexRow[],
  formula: DemandFormulaSettings,
) {
  const bySku = new Map<string, SalesStats>();
  const useStoredDefaultDemand = isDefaultDemandFormula(formula);

  for (const row of rows) {
    const sku = row.sku?.trim();
    if (!sku) {
      continue;
    }

    const total = numeric(row.total_sale);
    const sold30 = numeric(row.sold_30);
    const firstSaleDate = row.first_sale_date;
    const lastSaleDate = row.last_sale_date;
    const sellingDays = numeric(row.selling_days);
    const averages = useStoredDefaultDemand
      ? {
          demandIndex: numeric(row.demand_index_hm),
          lifetimeDailyAverage: numeric(row.lifetime_daily_average),
          sellingDayAverage: numeric(row.selling_day_average),
        }
      : averageDemandFromStats({
          firstSaleDate,
          lastSaleDate,
          sellingDays,
          sold30,
          total,
        }, formula);

    bySku.set(sku, {
      total,
      sold30,
      firstSaleDate,
      lastSaleDate,
      sellingDays,
      ...averages,
    });
  }

  return bySku;
}

async function fetchSalesBySku(
  supabase: SupabaseClient,
  formula: DemandFormulaSettings,
) {
  try {
    const demandRows = await fetchAll<DemandIndexRow>("Demand index snapshot", (from, to) =>
      supabase
        .from("demand_index_current")
        .select(
          "sku,total_sale,sold_30,first_sale_date,last_sale_date,selling_days,lifetime_daily_average,selling_day_average,demand_index_hm",
        )
        .order("sku", { ascending: true })
        .range(from, to),
    );

    if (!demandRows.length) {
      return fetchSalesBySkuFromDailySummary(supabase, formula);
    }

    return buildSalesBySkuFromDemandSnapshot(demandRows, formula);
  } catch {
    return fetchSalesBySkuFromDailySummary(supabase, formula);
  }
}

async function fetchSalesBySkuFromDailySummary(
  supabase: SupabaseClient,
  formula: DemandFormulaSettings,
) {
  try {
    const summaryRows = await fetchAll<SalesBySkuDayRow>("Daily sales summary", (from, to) =>
      supabase
        .from("sales_by_sku_day")
        .select("sku,sales_date,qty_sold")
        .order("sku", { ascending: true })
        .range(from, to),
    );

    return buildSalesBySkuFromDailySummary(summaryRows, formula);
  } catch {
    return new Map<string, SalesStats>();
  }
}


function tagsFromText(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function productName(row: VariantRow) {
  const product = firstProduct(row);
  const title = compactText(product?.product_title);
  const variant = compactText(row.variant_title);
  if (!variant || variant === "Default Title") {
    return title || compactText(row.sku);
  }
  return title ? `${title} / ${variant}` : variant;
}

function mainNameFromRow(row: VariantRow) {
  const product = firstProduct(row);
  return compactText(product?.product_title) || productName(row);
}

function supplierForLine(
  sku: string,
  row: VariantRow,
  control: DecisionControlRow | undefined,
  manualSupplierBySku: Map<string, string>,
  setupSupplierNames: Set<string>,
  setupSupplierAliases: Map<string, string>,
) {
  function setupSupplierName(value: string) {
    return setupSupplierAliases.get(value.toLowerCase()) ?? value;
  }

  const manual = manualSupplierBySku.get(sku);
  let fallback: { supplier: string; source: PurchasingDecisionLine["supplierSource"] };
  if (manual) {
    const supplier = setupSupplierName(manual);
    fallback = {
      supplier,
      source: setupSupplierNames.has(supplier.toLowerCase())
        ? ("setup" as const)
        : ("manual" as const),
    };
  } else {
    const excel = excelSupplierBySku.get(sku);
    const vendor = compactText(firstProduct(row)?.vendor);
    if (excel?.supplierName) {
      const supplier = setupSupplierName(excel.supplierName);
      fallback = {
        supplier,
        source: setupSupplierNames.has(supplier.toLowerCase())
          ? ("setup" as const)
          : ("excel" as const),
      };
    } else if (vendor) {
      const supplier = setupSupplierName(vendor);
      fallback = {
        supplier,
        source: setupSupplierNames.has(supplier.toLowerCase())
          ? ("setup" as const)
          : ("shopify_vendor" as const),
      };
    } else {
      fallback = { supplier: "Unmapped", source: "pending" as const };
    }
  }

  const override = compactText(control?.supplier_override);
  if (override && override.toLowerCase() !== fallback.supplier.toLowerCase()) {
    return { supplier: override, source: "decision" as const };
  }

  return fallback;
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
    const excelName = row.supplierName.trim();
    if (!excelName) {
      continue;
    }

    const excelKey = excelName.toLowerCase();
    const setupName = activeSupplierNames.find((supplier) => {
      const setupKey = supplier.toLowerCase();
      return setupKey.includes(excelKey) || excelKey.includes(setupKey);
    });
    if (setupName) {
      aliases.set(excelKey, setupName);
    }
  }

  return aliases;
}

function ropStatus(hidden: boolean, onHand: number, coming: number, reorderPointUnits: number) {
  if (hidden) {
    return "hidden" as const;
  }
  if (reorderPointUnits > onHand + coming) {
    return "order_now" as const;
  }
  if (reorderPointUnits > onHand) {
    return "watch" as const;
  }
  return "healthy" as const;
}

function stockStatus({
  demandIndex,
  hidden,
  overstockDays,
  overstockUnits,
  stockPosition,
  targetQty,
}: {
  demandIndex: number;
  hidden: boolean;
  overstockDays: number | null;
  overstockUnits: number;
  stockPosition: number;
  targetQty: number;
}) {
  if (hidden) {
    return "hidden" as const;
  }
  if (demandIndex <= 0 && stockPosition > 0) {
    return "dead_stock" as const;
  }
  if (stockPosition <= targetQty) {
    return "under_target" as const;
  }
  if (
    (overstockDays !== null && overstockDays >= 90) ||
    (targetQty > 0 && overstockUnits >= targetQty)
  ) {
    return "heavy_overstock" as const;
  }
  if (
    (overstockDays !== null && overstockDays >= 30) ||
    overstockUnits >= Math.max(10, targetQty * 0.25)
  ) {
    return "overstock" as const;
  }

  return "healthy" as const;
}

function matchesSelectedSupplier(
  line: PurchasingDecisionLine,
  selectedSupplier: string,
) {
  return (
    selectedSupplier === "all" ||
    (selectedSupplier === "__unset" && !line.supplierSetInSheet) ||
    (selectedSupplier === "__unmapped" &&
      !line.supplierSetInSheet &&
      line.supplierSource !== "setup") ||
    line.supplier.toLowerCase() === selectedSupplier
  );
}

const sizeOrder = new Map(
  ["xxs", "2xs", "xs", "s", "m", "l", "xl", "2xl", "3xl"].map((size, index) => [
    size,
    index,
  ]),
);

function normalizedSizeToken(value: string) {
  const normalized = value.toLowerCase().replace(/\b2xs\b/g, "xxs");
  const match = normalized.match(/(?:^|[\s/_-])(xxs|xs|s|m|l|xl|2xl|3xl)(?:$|[\s/_-])/);
  return match?.[1] ?? "";
}

function sizeRank(line: PurchasingDecisionLine) {
  const skuSize = normalizedSizeToken(line.sku);
  const productSize = normalizedSizeToken(line.productName);
  const shopifySize = normalizedSizeToken(line.shopifyProductName);
  const size = skuSize || productSize || shopifySize;
  return sizeOrder.get(size) ?? 99;
}

function productGroupName(line: PurchasingDecisionLine) {
  return line.productName
    .replace(/\s*\/\s*(?:2XS|XXS|XS|S|M|L|XL|2XL|3XL)\s*$/i, "")
    .trim()
    .toLowerCase();
}

function selectedAlertsFromParam(alert: string | string[]) {
  const allowedAlerts = new Set(["order_now", "watch", "healthy", "hidden"]);
  const selectedAlerts = (Array.isArray(alert) ? alert : [alert])
    .flatMap((value) => String(value).split(","))
    .map((value) => value.trim().toLowerCase())
    .filter((value) => allowedAlerts.has(value));

  return selectedAlerts.length ? new Set(selectedAlerts) : null;
}

function selectedStocksFromParam(stock: string | string[]) {
  const allowedStocks = new Set([
    "any_overstock",
    "dead_stock",
    "heavy_overstock",
    "overstock",
    "healthy",
    "under_target",
    "hidden",
  ]);
  const selectedStocks = (Array.isArray(stock) ? stock : [stock])
    .flatMap((value) => String(value).split(","))
    .map((value) => value.trim().toLowerCase())
    .filter((value) => allowedStocks.has(value));

  return selectedStocks.length ? new Set(selectedStocks) : null;
}

export async function getPurchasingDecisionData({
  limit = 120,
  q = "",
  supplier = "all",
  tag = "all",
  itemStatus = "all",
  alert = "all",
  capSelling = "true",
  lifetimeWeight = DEFAULT_DEMAND_FORMULA.lifetimeWeight,
  recentFloor = DEFAULT_DEMAND_FORMULA.recentFloorPercent,
  sellingWeight = DEFAULT_DEMAND_FORMULA.sellingDayWeight,
  stock = "all",
  round10 = "positive",
  visibility = "active",
}: {
  limit?: number | null;
  q?: string;
  supplier?: string;
  tag?: string;
  itemStatus?: string;
  alert?: string | string[];
  capSelling?: string;
  lifetimeWeight?: number | string | null;
  recentFloor?: number | string | null;
  sellingWeight?: number | string | null;
  stock?: string | string[];
  round10?: string;
  visibility?: string;
} = {}): Promise<PurchasingDecisionData> {
  const supabase = getSupabaseServiceClient();
  const demandFormula = demandFormulaFromParams({
    capSelling,
    lifetimeWeight,
    recentFloor,
    sellingWeight,
  });

  if (!supabase) {
    return {
      mode: "baseline",
      controlsReady: false,
      demandFormula,
      itemStatusOptions: [],
      searchOptions: [],
      supplierFilterOptions: [],
      supplierOptions: [],
      tagFilterOptions: [],
      tagOptions: [],
      lines: [],
      totals: {
        skuCount: 0,
        activeSkuCount: 0,
        hiddenSkuCount: 0,
        onHandUnits: 0,
        overallOnHandUnits: 0,
        comingUnits: 0,
        inventoryValue: 0,
        overallInventoryValue: 0,
      },
    };
  }

  const [
    variants,
    inventoryRows,
    salesBySku,
    incomingResult,
    manualSupplierResult,
    controlResult,
    setupData,
  ] = await Promise.all([
    fetchAll<VariantRow>("Product variants", (from, to) =>
      supabase
        .from("product_variants")
        .select(
          "sku,variant_title,price,variant_image_url,item_status,products(product_title,vendor,tags,product_image_url)",
        )
        .order("sku", { ascending: true })
        .range(from, to),
    ),
    fetchCurrentInventoryRows(supabase),
    fetchSalesBySku(supabase, demandFormula),
    fetchIncomingRows(supabase),
    fetchManualSupplierRows(supabase),
    fetchControls(supabase),
    getPurchasingSetupData(),
  ]);

  const stockBySku = buildStockBySku(inventoryRows);
  const incomingBySku = buildIncomingBySku(incomingResult);
  const manualSupplierBySku = buildManualSupplierBySku(manualSupplierResult);
  const query = q.trim().toLowerCase();
  const queryTerms = query
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const selectedSupplier = supplier.trim().toLowerCase();
  const selectedTag = tag.trim().toLowerCase();
  const selectedItemStatus = itemStatus.trim().toLowerCase();
  const selectedAlerts = selectedAlertsFromParam(alert);
  const selectedStocks = selectedStocksFromParam(stock);
  const selectedRound10 = ["all", "positive", "zero"].includes(round10)
    ? round10
    : "positive";
  const selectedVisibility = visibility.trim().toLowerCase();
  const activeSuppliers = setupData.suppliers.filter((item) => item.isActive);
  const activeSupplierNamesList = activeSuppliers.map((item) => item.supplierName);
  const activeSupplierNames = new Set(
    activeSupplierNamesList.map((item) => item.toLowerCase()),
  );
  const setupSupplierAliases = buildSupplierAliases(activeSupplierNamesList);
  const supplierDefaultByName = new Map(
    activeSuppliers.map((item) => [item.supplierName.toLowerCase(), item]),
  );
  const activeTagOptions = setupData.tags
    .filter((tag) => tag.isActive)
    .map((tag) => tag.tag);
  const activeTagSet = new Set(activeTagOptions.map((tag) => tag.toLowerCase()));

  const allLines = variants.flatMap((row) => {
    const sku = row.sku?.trim();
    if (!sku) {
      return [];
    }

    const product = firstProduct(row);
    const control = controlResult.controls.get(sku);
    const lineSupplier = supplierForLine(
      sku,
      row,
      control,
      manualSupplierBySku,
      activeSupplierNames,
      setupSupplierAliases,
    );
    const supplierDefault = supplierDefaultByName.get(lineSupplier.supplier.toLowerCase());
    const shopifyProductName = productName(row);
    const resolvedProductName =
      compactText(control?.product_name_override) || shopifyProductName;
    const resolvedMainName =
      compactText(control?.main_name_override) || mainNameFromRow(row);
    const shopifyItemStatus =
      compactText(row.item_status) || "Available";
    const itemStatus = compactText(control?.item_status_override) || shopifyItemStatus;
    const shopifyTags = product?.tags ?? [];
    const sourceTags =
      control?.tags_override && control.tags_override.length
        ? control.tags_override
        : shopifyTags;
    const tags = sourceTags.filter((tag) => activeTagSet.has(tag.toLowerCase()));
    const sales = salesBySku.get(sku) ?? {
      total: 0,
      sold30: 0,
      firstSaleDate: null,
      lastSaleDate: null,
      sellingDays: 0,
      lifetimeDailyAverage: 0,
      sellingDayAverage: 0,
      demandIndex: 0,
    };
    const calculatedDemandIndexHm = sales.demandIndex;
    const demand30Days = sales.sold30 / 30;
    const demandIndexOverride = optionalNumber(control?.demand_index_override);
    const demandIndexHm = demandIndexOverride ?? calculatedDemandIndexHm;
    const skuSafetyDays = optionalInteger(control?.safety_days);
    const safetyIsManual = skuSafetyDays !== null;
    const supplierSafetyDays =
      supplierDefault && supplierDefault.safetyDays > 0
        ? supplierDefault.safetyDays
        : null;
    const safetyMatchesSupplier =
      skuSafetyDays !== null &&
      supplierSafetyDays !== null &&
      skuSafetyDays === supplierSafetyDays;
    const safetyDays = skuSafetyDays ?? supplierSafetyDays ?? DEFAULT_SAFETY_DAYS;
    const safetySource =
      supplierSafetyDays !== null && (skuSafetyDays === null || safetyMatchesSupplier)
        ? "supplier"
        : skuSafetyDays !== null
          ? "sku"
          : "default";
    const skuLeadTimeDays = optionalInteger(control?.lead_time_days);
    const leadTimeIsManual = skuLeadTimeDays !== null;
    const supplierLeadTimeDays =
      supplierDefault && supplierDefault.leadTimeDays > 0
        ? supplierDefault.leadTimeDays
        : null;
    const leadMatchesSupplier =
      skuLeadTimeDays !== null &&
      supplierLeadTimeDays !== null &&
      skuLeadTimeDays === supplierLeadTimeDays;
    const leadTimeDays = skuLeadTimeDays ?? supplierLeadTimeDays ?? DEFAULT_LEAD_TIME_DAYS;
    const leadTimeSource =
      supplierLeadTimeDays !== null && (skuLeadTimeDays === null || leadMatchesSupplier)
        ? "supplier"
        : skuLeadTimeDays !== null
          ? "sku"
          : "default";
    const orderCycleDays =
      optionalInteger(control?.order_cycle_days) ?? DEFAULT_ORDER_CYCLE_DAYS;
    const orderCycleIsManual = optionalInteger(control?.order_cycle_days) !== null;
    const planningDays = safetyDays + leadTimeDays + orderCycleDays;
    const reorderPointUnits = Math.max(0, Math.ceil(demandIndexHm * (safetyDays + leadTimeDays)));
    const targetQty = Math.max(0, Math.ceil(demandIndexHm * planningDays));
    const manualRopUnits = optionalInteger(control?.manual_rop_units);
    const orderQtyMode = control?.order_qty_mode === "raw" ? "raw" : "rounded";
    const targetCoverageDays = optionalInteger(control?.target_coverage_days);
    const onHandUnits = stockBySku.get(sku) ?? 0;
    const incoming = incomingBySku.get(sku) ?? { active: 0, pending: 0 };
    const orderQtyRaw = Math.max(0, targetQty - onHandUnits - incoming.active);
    const orderQtyRounded = roundUpToTen(orderQtyRaw);
    const ropUnits = orderQtyRounded;
    const stockPositionUnits = onHandUnits + incoming.active;
    const overstockUnits = Math.max(0, stockPositionUnits - targetQty);
    const stockCoverageDays =
      demandIndexHm > 0 ? stockPositionUnits / demandIndexHm : null;
    const overstockDays =
      stockCoverageDays === null ? null : Math.max(0, stockCoverageDays - planningDays);
    const coversSalesDuration =
      demandIndexHm > 0 ? onHandUnits / demandIndexHm : null;
    const totalCoverageAtOrder =
      demandIndexHm > 0 ? (incoming.active + ropUnits) / demandIndexHm : null;
    const unitPrice = numeric(row.price);
    const hidden = Boolean(control?.hide_from_purchasing);

    return [
      {
        sku,
        productName: resolvedProductName,
        shopifyProductName,
        mainName: resolvedMainName,
        itemStatus,
        shopifyItemStatus,
        tags,
        supplier: lineSupplier.supplier,
        supplierSetInSheet: lineSupplier.source === "decision",
        supplierSource: lineSupplier.source,
        onHandUnits,
        totalSale: sales.total,
        demand30Days,
        firstSaleDate: sales.firstSaleDate,
        lastSaleDate: sales.lastSaleDate,
        sellingDays: sales.sellingDays,
        lifetimeDailyAverage: sales.lifetimeDailyAverage,
        sellingDayAverage: sales.sellingDayAverage,
        demandIndexHm,
        calculatedDemandIndexHm,
        demandIndexOverride,
        safetyDays,
        safetyIsManual,
        supplierSafetyDays,
        safetySource,
        leadTimeDays,
        leadTimeIsManual,
        supplierLeadTimeDays,
        leadTimeSource,
        orderCycleDays,
        orderCycleIsManual,
        planningDays,
        reorderPointUnits,
        ropUnits,
        ropUnitsRaw: targetQty,
        ropUnitsRounded: orderQtyRounded,
        orderQtyMode,
        manualRopUnits,
        coversSalesDuration,
        week: coversSalesDuration === null ? 0 : coversSalesDuration / 7,
        month: coversSalesDuration === null ? 0 : coversSalesDuration / 30,
        ropAlert: ropStatus(hidden, onHandUnits, incoming.active, reorderPointUnits),
        stockAlert: stockStatus({
          demandIndex: demandIndexHm,
          hidden,
          overstockDays,
          overstockUnits,
          stockPosition: stockPositionUnits,
          targetQty,
        }),
        stockPositionUnits,
        overstockUnits,
        overstockDays,
        totalCoverageAtOrder,
        targetCoverageDays,
        coming: incoming.active,
        pendingComing: incoming.pending,
        unitPrice,
        inventoryValue: onHandUnits * unitPrice,
        comingValue: incoming.active * unitPrice,
        imageUrl: compactText(row.variant_image_url) || compactText(product?.product_image_url) || null,
        hidden,
        hideReason: compactText(control?.hide_reason),
        note: compactText(control?.note),
      } satisfies PurchasingDecisionLine,
    ];
  });

  const supplierOptions = Array.from(
    new Set([
      ...activeSuppliers.map((item) => item.supplierName),
      ...allLines.map((line) => line.supplier).filter((item) => activeSupplierNames.has(item.toLowerCase())),
    ]),
  )
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  const supplierFilterOptions = supplierOptions
    .map((option) => {
      const optionKey = option.toLowerCase();
      const supplierLines = allLines.filter(
        (line) => !line.hidden && line.supplier.toLowerCase() === optionKey,
      );

      return {
        supplier: option,
        orderQty: supplierLines.reduce(
          (sum, line) => sum + (line.manualRopUnits ?? line.ropUnitsRounded),
          0,
        ),
        onHandUnits: supplierLines.reduce((sum, line) => sum + line.onHandUnits, 0),
        lineCount: supplierLines.length,
      };
    })
    .sort(
      (a, b) =>
        b.orderQty - a.orderQty ||
        b.onHandUnits - a.onHandUnits ||
        a.supplier.localeCompare(b.supplier),
    );

  const supplierScopedLines = (
    selectedSupplier === "all"
      ? allLines
      : allLines.filter((line) => matchesSelectedSupplier(line, selectedSupplier))
  );
  const tagOptionsForFilter = supplierScopedLines
    .flatMap((line) => line.tags)
    .filter((tag) => activeTagSet.has(tag.toLowerCase()));
  const hasUntaggedLines = supplierScopedLines.some((line) => line.tags.length === 0);
  const tagFilterOptions = [
    ...(hasUntaggedLines ? [{ label: "No tag selected", value: "__untagged" }] : []),
    ...Array.from(new Set(tagOptionsForFilter))
      .sort((a, b) => a.localeCompare(b))
      .map((tag) => ({ label: tag, value: tag })),
  ];
  const tagOptions = Array.from(
    new Set([...activeTagOptions, ...tagOptionsForFilter]),
  ).sort((a, b) => a.localeCompare(b));

  function matchesFiltersExceptQuery(line: PurchasingDecisionLine) {
    const matchesSupplier = matchesSelectedSupplier(line, selectedSupplier);
    const matchesTag =
      selectedTag === "all" ||
      (selectedTag === "__untagged" && line.tags.length === 0) ||
      line.tags.some((lineTag) => lineTag.toLowerCase() === selectedTag);
    const matchesItemStatus =
      selectedItemStatus === "all" ||
      line.itemStatus.toLowerCase() === selectedItemStatus;
    const matchesAlert =
      !selectedAlerts || selectedAlerts.has(line.ropAlert);
    const matchesStock =
      !selectedStocks ||
      selectedStocks.has(line.stockAlert) ||
      (selectedStocks.has("any_overstock") &&
        (line.stockAlert === "overstock" ||
          line.stockAlert === "heavy_overstock" ||
          line.stockAlert === "dead_stock"));
    const matchesVisibility =
      selectedVisibility === "all" ||
      (selectedVisibility === "hidden" ? line.hidden : !line.hidden);
    const effectiveRound10Qty = line.manualRopUnits ?? line.ropUnitsRounded;
    const matchesRound10 =
      selectedRound10 === "all" ||
      (selectedRound10 === "positive"
        ? effectiveRound10Qty > 0
        : effectiveRound10Qty === 0);

    return (
      matchesSupplier &&
      matchesTag &&
      matchesItemStatus &&
      matchesAlert &&
      matchesStock &&
      matchesRound10 &&
      matchesVisibility
    );
  }

  const searchOptionByMainName = new Map<
    string,
    { imageUrl: string | null; label: string; skuCount: number }
  >();
  for (const line of allLines.filter(matchesFiltersExceptQuery)) {
    const label = line.mainName.trim();
    if (!label) {
      continue;
    }

    const key = label.toLowerCase();
    const existing = searchOptionByMainName.get(key);
    searchOptionByMainName.set(key, {
      imageUrl: existing?.imageUrl ?? line.imageUrl,
      label: existing?.label ?? label,
      skuCount: (existing?.skuCount ?? 0) + 1,
    });
  }
  const searchOptions = Array.from(searchOptionByMainName.values())
    .sort((a, b) => a.label.localeCompare(b.label))
    .slice(0, 300);

  const filteredLines = allLines
    .filter((line) => {
      const matchesQuery =
        !queryTerms.length ||
        queryTerms.some((term) =>
          [
            line.sku,
            line.productName,
            line.mainName,
            line.itemStatus,
            line.supplier,
            line.tags.join(" "),
            line.hideReason,
          ]
            .join(" ")
            .toLowerCase()
            .includes(term),
        );

      return (
        matchesFiltersExceptQuery(line) &&
        matchesQuery
      );
    })
    .sort((a, b) => {
      const statusRank = { order_now: 0, watch: 1, healthy: 2, hidden: 3 };
      const stockRank = {
        dead_stock: 0,
        heavy_overstock: 1,
        overstock: 2,
        healthy: 3,
        under_target: 4,
        hidden: 5,
      };
      const stockSort =
        !selectedStocks
          ? 0
          : stockRank[a.stockAlert] - stockRank[b.stockAlert] ||
            b.overstockUnits - a.overstockUnits;
      return (
        stockSort ||
        a.mainName.localeCompare(b.mainName) ||
        productGroupName(a).localeCompare(productGroupName(b)) ||
        sizeRank(a) - sizeRank(b) ||
        statusRank[a.ropAlert] - statusRank[b.ropAlert] ||
        a.sku.localeCompare(b.sku)
      );
    });
  const visibleLines = limit === null ? filteredLines : filteredLines.slice(0, limit);

  const activeLines = allLines.filter((line) => !line.hidden);
  return {
    mode: "supabase",
    controlsReady: controlResult.controlsReady,
    demandFormula,
    itemStatusOptions: Array.from(
      new Set([
        "Available",
        "Discontinued",
        ...allLines.map((line) => line.itemStatus).filter(Boolean),
      ]),
    ).sort((a, b) => a.localeCompare(b)),
    searchOptions,
    supplierFilterOptions,
    supplierOptions,
    tagFilterOptions,
    tagOptions,
    lines: visibleLines,
    totals: {
      skuCount: allLines.length,
      activeSkuCount: activeLines.length,
      hiddenSkuCount: allLines.length - activeLines.length,
      onHandUnits: activeLines.reduce((sum, line) => sum + line.onHandUnits, 0),
      overallOnHandUnits: allLines.reduce((sum, line) => sum + line.onHandUnits, 0),
      comingUnits: activeLines.reduce((sum, line) => sum + line.coming, 0),
      inventoryValue: activeLines.reduce((sum, line) => sum + line.inventoryValue, 0),
      overallInventoryValue: allLines.reduce((sum, line) => sum + line.inventoryValue, 0),
    },
  };
}

export function decisionTagsText(tags: string[]) {
  return tags.join(", ");
}

export function parseDecisionTags(value: string) {
  return tagsFromText(value);
}
