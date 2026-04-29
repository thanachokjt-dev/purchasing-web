import { excelSupplierMap } from "@/lib/excel-supplier-map";
import { getPurchasingSetupData } from "@/lib/purchasing-setup";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

type ProductRelation =
  | {
      product_title: string | null;
      vendor: string | null;
      tags: string[] | null;
      product_type: string | null;
      product_image_url: string | null;
      status: string | null;
    }
  | {
      product_title: string | null;
      vendor: string | null;
      tags: string[] | null;
      product_type: string | null;
      product_image_url: string | null;
      status: string | null;
    }[]
  | null;

type VariantRow = {
  sku: string | null;
  variant_title: string | null;
  option1_value: string | null;
  option2_value: string | null;
  option3_value: string | null;
  price: number | string | null;
  variant_image_url: string | null;
  item_status: string | null;
  effective_status: string | null;
  products: ProductRelation;
};

type InventoryRow = {
  sku: string | null;
  on_hand: number | string | null;
};

type SalesRow = {
  sku: string | null;
  quantity: number | string | null;
  order_date: string | null;
  financial_status: string | null;
  cancelled_at_shopify: string | null;
};

type SalesSummaryRow = {
  sku: string | null;
  total_sale: number | string | null;
  sold_7: number | string | null;
  sold_30: number | string | null;
  sold_90: number | string | null;
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
  supplierSafetyDays: number | null;
  safetySource: "sku" | "supplier" | "default";
  leadTimeDays: number;
  supplierLeadTimeDays: number | null;
  leadTimeSource: "sku" | "supplier" | "default";
  orderCycleDays: number;
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
  supplierFilterOptions: Array<{
    supplier: string;
    orderQty: number;
    onHandUnits: number;
    lineCount: number;
  }>;
  supplierOptions: string[];
  tagOptions: string[];
  lines: PurchasingDecisionLine[];
  totals: {
    skuCount: number;
    activeSkuCount: number;
    hiddenSkuCount: number;
    onHandUnits: number;
    comingUnits: number;
    inventoryValue: number;
  };
};

const PAGE_SIZE = 1000;
const DEFAULT_SAFETY_DAYS = 14;
const DEFAULT_LEAD_TIME_DAYS = 60;
const DEFAULT_ORDER_CYCLE_DAYS = 30;
const excelSupplierBySku = new Map(excelSupplierMap.map((row) => [row.sku, row]));

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

function isRefundedStatus(status: string | null | undefined) {
  return status === "REFUNDED" || status === "VOIDED";
}

function isCountableDemandLine(row: SalesRow) {
  return Boolean(row.sku?.trim()) && !row.cancelled_at_shopify && !isRefundedStatus(row.financial_status);
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

async function fetchAll<T>(
  label: string,
  queryForRange: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
) {
  const rows: T[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await queryForRange(from, from + PAGE_SIZE - 1);
    if (error) {
      throw new Error(`${label} query failed: ${error.message}`);
    }

    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE_SIZE) {
      break;
    }
  }

  return rows;
}

async function fetchLatestInventoryRows(supabase: SupabaseClient) {
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

async function fetchControls(supabase: SupabaseClient) {
  const query = await supabase
    .from("purchasing_decision_controls")
    .select(
      "sku,product_name_override,main_name_override,supplier_override,item_status_override,tags_override,demand_index_override,safety_days,lead_time_days,order_cycle_days,manual_rop_units,order_qty_mode,target_coverage_days,hide_from_purchasing,hide_reason,note",
    );
  let data: unknown[] | null = query.data;
  let error = query.error;

  if (error) {
    const fallback = await supabase
      .from("purchasing_decision_controls")
      .select(
        "sku,product_name_override,main_name_override,supplier_override,tags_override,demand_index_override,safety_days,lead_time_days,order_cycle_days,manual_rop_units,target_coverage_days,hide_from_purchasing,hide_reason,note",
      );
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    return {
      controls: new Map<string, DecisionControlRow>(),
      controlsReady: false,
    };
  }

  return {
    controls: new Map(
      ((data ?? []) as DecisionControlRow[])
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

function buildSalesBySku(rows: SalesRow[], formula: DemandFormulaSettings) {
  const d30 = daysAgo(30);
  const bySku = new Map<
    string,
    { total: number; sold30: number; firstSaleDate: string | null; lastSaleDate: string | null; saleDates: Set<string> }
  >();

  for (const row of rows) {
    if (!isCountableDemandLine(row)) {
      continue;
    }

    const sku = row.sku?.trim();
    const orderDate = row.order_date;
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
    const qty = numeric(row.quantity);
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

function buildSalesBySkuFromSummary(
  rows: SalesSummaryRow[],
  formula: DemandFormulaSettings,
) {
  const bySku = new Map<string, SalesStats>();

  for (const row of rows) {
    const sku = row.sku?.trim();
    if (!sku) {
      continue;
    }

    const total = numeric(row.total_sale);
    const sold30 = numeric(row.sold_30);
    const averages = averageDemandFromStats({
      firstSaleDate: null,
      lastSaleDate: null,
      sellingDays: 0,
      sold30,
      total,
    }, formula);
    bySku.set(sku, {
      total,
      sold30,
      firstSaleDate: null,
      lastSaleDate: null,
      sellingDays: 0,
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
    const rawSalesRows = await fetchAll<SalesRow>("Sales lines", (from, to) =>
      supabase
        .from("sales_lines")
        .select("sku,quantity,order_date,financial_status,cancelled_at_shopify")
        .range(from, to),
    );

    return buildSalesBySku(rawSalesRows, formula);
  } catch {
    const { data, error } = await supabase
      .from("purchasing_sales_by_sku")
      .select("sku,total_sale,sold_7,sold_30,sold_90");

    if (error) {
      return new Map<string, SalesStats>();
    }

    return buildSalesBySkuFromSummary((data ?? []) as SalesSummaryRow[], formula);
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
) {
  const override = compactText(control?.supplier_override);
  if (override) {
    return { supplier: override, source: "decision" as const };
  }

  const manual = manualSupplierBySku.get(sku);
  if (manual) {
    return {
      supplier: manual,
      source: setupSupplierNames.has(manual.toLowerCase())
        ? ("setup" as const)
        : ("manual" as const),
    };
  }

  const excel = excelSupplierBySku.get(sku);
  if (excel?.supplierName) {
    return { supplier: excel.supplierName, source: "excel" as const };
  }

  const vendor = compactText(firstProduct(row)?.vendor);
  if (vendor) {
    return {
      supplier: vendor,
      source: setupSupplierNames.has(vendor.toLowerCase())
        ? ("setup" as const)
        : ("shopify_vendor" as const),
    };
  }

  return { supplier: "Unmapped", source: "pending" as const };
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

function matchesSelectedSupplier(
  line: PurchasingDecisionLine,
  selectedSupplier: string,
) {
  return (
    selectedSupplier === "all" ||
    (selectedSupplier === "__unset" && !line.supplierSetInSheet) ||
    (selectedSupplier === "__unmapped" && line.supplierSource === "pending") ||
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
      supplierFilterOptions: [],
      supplierOptions: [],
      tagOptions: [],
      lines: [],
      totals: {
        skuCount: 0,
        activeSkuCount: 0,
        hiddenSkuCount: 0,
        onHandUnits: 0,
        comingUnits: 0,
        inventoryValue: 0,
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
          "sku,variant_title,option1_value,option2_value,option3_value,price,variant_image_url,item_status,effective_status,products(product_title,vendor,tags,product_type,product_image_url,status)",
        )
        .order("sku", { ascending: true })
        .range(from, to),
    ),
    fetchLatestInventoryRows(supabase),
    fetchSalesBySku(supabase, demandFormula),
    supabase
      .from("po_incoming_by_sku")
      .select("sku,active_incoming_qty,pending_approval_qty"),
    supabase.from("manual_supplier_mappings").select("sku,supplier"),
    fetchControls(supabase),
    getPurchasingSetupData(),
  ]);

  const stockBySku = buildStockBySku(inventoryRows);
  const incomingBySku = incomingResult.error
    ? new Map<string, { active: number; pending: number }>()
    : buildIncomingBySku((incomingResult.data ?? []) as IncomingRow[]);
  const manualSupplierBySku = manualSupplierResult.error
    ? new Map<string, string>()
    : buildManualSupplierBySku((manualSupplierResult.data ?? []) as ManualSupplierRow[]);
  const query = q.trim().toLowerCase();
  const selectedSupplier = supplier.trim().toLowerCase();
  const selectedTag = tag.trim().toLowerCase();
  const selectedItemStatus = itemStatus.trim().toLowerCase();
  const selectedAlerts = selectedAlertsFromParam(alert);
  const selectedVisibility = visibility.trim().toLowerCase();
  const activeSuppliers = setupData.suppliers.filter((item) => item.isActive);
  const activeSupplierNames = new Set(
    activeSuppliers.map((item) => item.supplierName.toLowerCase()),
  );
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
    const planningDays = safetyDays + leadTimeDays + orderCycleDays;
    const reorderPointUnits = Math.max(0, Math.ceil(demandIndexHm * (safetyDays + leadTimeDays)));
    const ropUnitsRaw = Math.max(0, Math.ceil(demandIndexHm * planningDays));
    const ropUnitsRounded = roundUpToTen(ropUnitsRaw);
    const manualRopUnits = optionalInteger(control?.manual_rop_units);
    const orderQtyMode = control?.order_qty_mode === "raw" ? "raw" : "rounded";
    const targetCoverageDays = optionalInteger(control?.target_coverage_days);
    const ropUnits = manualRopUnits ?? ropUnitsRounded;
    const onHandUnits = stockBySku.get(sku) ?? 0;
    const incoming = incomingBySku.get(sku) ?? { active: 0, pending: 0 };
    const coversSalesDuration =
      demandIndexHm > 0 ? onHandUnits / demandIndexHm : null;
    const totalCoverageAtOrder =
      demandIndexHm > 0 ? (onHandUnits + incoming.active) / demandIndexHm : null;
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
        supplierSetInSheet: Boolean(compactText(control?.supplier_override)),
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
        supplierSafetyDays,
        safetySource,
        leadTimeDays,
        supplierLeadTimeDays,
        leadTimeSource,
        orderCycleDays,
        planningDays,
        reorderPointUnits,
        ropUnits,
        ropUnitsRaw,
        ropUnitsRounded,
        orderQtyMode,
        manualRopUnits,
        coversSalesDuration,
        week: Math.ceil(ropUnits / 4),
        month: ropUnits,
        ropAlert: ropStatus(hidden, onHandUnits, incoming.active, reorderPointUnits),
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
        orderQty: supplierLines.reduce((sum, line) => sum + line.ropUnits, 0),
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

  const tagOptionsForSelection = (
    selectedSupplier === "all"
      ? allLines
      : allLines.filter((line) => matchesSelectedSupplier(line, selectedSupplier))
  )
    .flatMap((line) => line.tags)
    .filter((tag) => activeTagSet.has(tag.toLowerCase()));
  const tagOptions = Array.from(new Set(tagOptionsForSelection)).sort((a, b) =>
    a.localeCompare(b),
  );

  const filteredLines = allLines
    .filter((line) => {
      const matchesSupplier = matchesSelectedSupplier(line, selectedSupplier);
      const matchesTag =
        selectedTag === "all" ||
        line.tags.some((lineTag) => lineTag.toLowerCase() === selectedTag);
      const matchesItemStatus =
        selectedItemStatus === "all" ||
        line.itemStatus.toLowerCase() === selectedItemStatus;
      const matchesAlert =
        !selectedAlerts || selectedAlerts.has(line.ropAlert);
      const matchesVisibility =
        selectedVisibility === "all" ||
        (selectedVisibility === "hidden" ? line.hidden : !line.hidden);
      const matchesQuery =
        !query ||
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
          .includes(query);

      return (
        matchesSupplier &&
        matchesTag &&
        matchesItemStatus &&
        matchesAlert &&
        matchesVisibility &&
        matchesQuery
      );
    })
    .sort((a, b) => {
      const statusRank = { order_now: 0, watch: 1, healthy: 2, hidden: 3 };
      return (
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
    supplierFilterOptions,
    supplierOptions,
    tagOptions,
    lines: visibleLines,
    totals: {
      skuCount: allLines.length,
      activeSkuCount: activeLines.length,
      hiddenSkuCount: allLines.length - activeLines.length,
      onHandUnits: activeLines.reduce((sum, line) => sum + line.onHandUnits, 0),
      comingUnits: activeLines.reduce((sum, line) => sum + line.coming, 0),
      inventoryValue: activeLines.reduce((sum, line) => sum + line.inventoryValue, 0),
    },
  };
}

export function decisionTagsText(tags: string[]) {
  return tags.join(", ");
}

export function parseDecisionTags(value: string) {
  return tagsFromText(value);
}
