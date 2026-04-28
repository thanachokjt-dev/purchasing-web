import { excelSupplierMap } from "@/lib/excel-supplier-map";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

type ProductRelation =
  | {
      product_title: string | null;
      vendor: string | null;
      tags: string[] | null;
      product_type: string | null;
      product_image_url: string | null;
    }
  | {
      product_title: string | null;
      vendor: string | null;
      tags: string[] | null;
      product_type: string | null;
      product_image_url: string | null;
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
  tags_override: string[] | null;
  demand_index_override: number | string | null;
  safety_days: number | string | null;
  lead_time_days: number | string | null;
  order_cycle_days: number | string | null;
  manual_rop_units: number | string | null;
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
  tags: string[];
  supplier: string;
  supplierSource: "decision" | "manual" | "excel" | "shopify_vendor" | "pending";
  onHandUnits: number;
  totalSale: number;
  demandIndexHm: number;
  calculatedDemandIndexHm: number;
  demandIndexOverride: number | null;
  safetyDays: number;
  leadTimeDays: number;
  orderCycleDays: number;
  planningDays: number;
  ropUnits: number;
  ropUnitsRaw: number;
  ropUnitsRounded: number;
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
  supplierOptions: string[];
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

function harmonicMean(values: number[]) {
  const positive = values.filter((value) => value > 0);
  if (!positive.length) {
    return 0;
  }

  return positive.length / positive.reduce((sum, value) => sum + 1 / value, 0);
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
  const { data, error } = await supabase
    .from("purchasing_decision_controls")
    .select(
      "sku,product_name_override,main_name_override,supplier_override,tags_override,demand_index_override,safety_days,lead_time_days,order_cycle_days,manual_rop_units,target_coverage_days,hide_from_purchasing,hide_reason,note",
    );

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

function buildSalesBySku(rows: SalesRow[]) {
  const d7 = daysAgo(7);
  const d30 = daysAgo(30);
  const d90 = daysAgo(90);
  const bySku = new Map<
    string,
    { total: number; sold7: number; sold30: number; sold90: number }
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

    const existing = bySku.get(sku) ?? { total: 0, sold7: 0, sold30: 0, sold90: 0 };
    const qty = numeric(row.quantity);
    existing.total += qty;
    if (orderDate >= d90) {
      existing.sold90 += qty;
    }
    if (orderDate >= d30) {
      existing.sold30 += qty;
    }
    if (orderDate >= d7) {
      existing.sold7 += qty;
    }
    bySku.set(sku, existing);
  }

  return bySku;
}

function buildSalesBySkuFromSummary(rows: SalesSummaryRow[]) {
  const bySku = new Map<
    string,
    { total: number; sold7: number; sold30: number; sold90: number }
  >();

  for (const row of rows) {
    const sku = row.sku?.trim();
    if (!sku) {
      continue;
    }

    bySku.set(sku, {
      total: numeric(row.total_sale),
      sold7: numeric(row.sold_7),
      sold30: numeric(row.sold_30),
      sold90: numeric(row.sold_90),
    });
  }

  return bySku;
}

async function fetchSalesBySku(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("purchasing_sales_by_sku")
    .select("sku,total_sale,sold_7,sold_30,sold_90");

  if (!error) {
    return buildSalesBySkuFromSummary((data ?? []) as SalesSummaryRow[]);
  }

  const rawSalesRows = await fetchAll<SalesRow>("Sales lines", (from, to) =>
    supabase
      .from("sales_lines")
      .select("sku,quantity,order_date,financial_status,cancelled_at_shopify")
      .range(from, to),
  );

  return buildSalesBySku(rawSalesRows);
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
) {
  const override = compactText(control?.supplier_override);
  if (override) {
    return { supplier: override, source: "decision" as const };
  }

  const manual = manualSupplierBySku.get(sku);
  if (manual) {
    return { supplier: manual, source: "manual" as const };
  }

  const excel = excelSupplierBySku.get(sku);
  if (excel?.supplierName) {
    return { supplier: excel.supplierName, source: "excel" as const };
  }

  const vendor = compactText(firstProduct(row)?.vendor);
  if (vendor) {
    return { supplier: vendor, source: "shopify_vendor" as const };
  }

  return { supplier: "Unmapped", source: "pending" as const };
}

function ropStatus(hidden: boolean, onHand: number, coming: number, ropUnits: number) {
  if (hidden) {
    return "hidden" as const;
  }
  if (ropUnits > onHand + coming) {
    return "order_now" as const;
  }
  if (ropUnits > onHand) {
    return "watch" as const;
  }
  return "healthy" as const;
}

export async function getPurchasingDecisionData({
  limit = 120,
  q = "",
  supplier = "all",
  visibility = "active",
}: {
  limit?: number | null;
  q?: string;
  supplier?: string;
  visibility?: string;
} = {}): Promise<PurchasingDecisionData> {
  const supabase = getSupabaseServiceClient();

  if (!supabase) {
    return {
      mode: "baseline",
      controlsReady: false,
      supplierOptions: [],
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
  ] = await Promise.all([
    fetchAll<VariantRow>("Product variants", (from, to) =>
      supabase
        .from("product_variants")
        .select(
          "sku,variant_title,option1_value,option2_value,option3_value,price,variant_image_url,products(product_title,vendor,tags,product_type,product_image_url)",
        )
        .order("sku", { ascending: true })
        .range(from, to),
    ),
    fetchLatestInventoryRows(supabase),
    fetchSalesBySku(supabase),
    supabase
      .from("po_incoming_by_sku")
      .select("sku,active_incoming_qty,pending_approval_qty"),
    supabase.from("manual_supplier_mappings").select("sku,supplier"),
    fetchControls(supabase),
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
  const selectedVisibility = visibility.trim().toLowerCase();

  const allLines = variants.flatMap((row) => {
    const sku = row.sku?.trim();
    if (!sku) {
      return [];
    }

    const product = firstProduct(row);
    const control = controlResult.controls.get(sku);
    const lineSupplier = supplierForLine(sku, row, control, manualSupplierBySku);
    const shopifyProductName = productName(row);
    const resolvedProductName =
      compactText(control?.product_name_override) || shopifyProductName;
    const resolvedMainName =
      compactText(control?.main_name_override) || mainNameFromRow(row);
    const shopifyTags = product?.tags ?? [];
    const tags =
      control?.tags_override && control.tags_override.length
        ? control.tags_override
        : shopifyTags;
    const sales = salesBySku.get(sku) ?? {
      total: 0,
      sold7: 0,
      sold30: 0,
      sold90: 0,
    };
    const calculatedDemandIndexHm = harmonicMean([
      sales.sold7 / 7,
      sales.sold30 / 30,
      sales.sold90 / 90,
    ]);
    const demandIndexOverride = optionalNumber(control?.demand_index_override);
    const demandIndexHm = demandIndexOverride ?? calculatedDemandIndexHm;
    const safetyDays = optionalInteger(control?.safety_days) ?? DEFAULT_SAFETY_DAYS;
    const leadTimeDays =
      optionalInteger(control?.lead_time_days) ?? DEFAULT_LEAD_TIME_DAYS;
    const orderCycleDays =
      optionalInteger(control?.order_cycle_days) ?? DEFAULT_ORDER_CYCLE_DAYS;
    const planningDays = safetyDays + leadTimeDays + orderCycleDays;
    const ropUnitsRaw = Math.max(0, Math.ceil(demandIndexHm * planningDays));
    const ropUnitsRounded = roundUpToTen(ropUnitsRaw);
    const manualRopUnits = optionalInteger(control?.manual_rop_units);
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
        tags,
        supplier: lineSupplier.supplier,
        supplierSource: lineSupplier.source,
        onHandUnits,
        totalSale: sales.total,
        demandIndexHm,
        calculatedDemandIndexHm,
        demandIndexOverride,
        safetyDays,
        leadTimeDays,
        orderCycleDays,
        planningDays,
        ropUnits,
        ropUnitsRaw,
        ropUnitsRounded,
        manualRopUnits,
        coversSalesDuration,
        week: Math.ceil(ropUnits / 4),
        month: ropUnits,
        ropAlert: ropStatus(hidden, onHandUnits, incoming.active, ropUnits),
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

  const supplierOptions = Array.from(new Set(allLines.map((line) => line.supplier)))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  const filteredLines = allLines
    .filter((line) => {
      const matchesSupplier =
        selectedSupplier === "all" || line.supplier.toLowerCase() === selectedSupplier;
      const matchesVisibility =
        selectedVisibility === "all" ||
        (selectedVisibility === "hidden" ? line.hidden : !line.hidden);
      const matchesQuery =
        !query ||
        [
          line.sku,
          line.productName,
          line.mainName,
          line.supplier,
          line.tags.join(" "),
          line.hideReason,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);

      return matchesSupplier && matchesVisibility && matchesQuery;
    })
    .sort((a, b) => {
      const statusRank = { order_now: 0, watch: 1, healthy: 2, hidden: 3 };
      return (
        statusRank[a.ropAlert] - statusRank[b.ropAlert] ||
        b.ropUnits - a.ropUnits ||
        b.totalSale - a.totalSale ||
        a.sku.localeCompare(b.sku)
      );
    });
  const visibleLines = limit === null ? filteredLines : filteredLines.slice(0, limit);

  const activeLines = allLines.filter((line) => !line.hidden);
  return {
    mode: "supabase",
    controlsReady: controlResult.controlsReady,
    supplierOptions,
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
