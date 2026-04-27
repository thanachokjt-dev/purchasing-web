import {
  baselineMetrics,
  type BuyerReviewLine,
  type ComebackSignalLine,
  type DemandQualitySummary,
  type DemandInsightLine,
  type DemandLine,
  supplierSummaries,
  syncSources,
  thaiTshirtMatrix,
  topReorderLines,
  validationWarnings,
} from "@/lib/baseline-data";
import { excelSupplierMap } from "@/lib/excel-supplier-map";
import {
  excelIncomingPurchaseOrders,
  excelSupplierDetails,
} from "@/lib/excel-purchasing-context";
import { envStatus } from "@/lib/env";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

type SalesLineRow = {
  shopify_order_id: string | null;
  sku: string | null;
  product_name: string | null;
  variant_title: string | null;
  quantity: number | string | null;
  line_total: number | string | null;
  financial_status: string | null;
  cancelled_at_shopify: string | null;
};

type DemandHistoryRow = Pick<
  SalesLineRow,
  | "sku"
  | "product_name"
  | "variant_title"
  | "quantity"
  | "financial_status"
  | "cancelled_at_shopify"
> & {
  order_date: string | null;
};

type InventoryRow = {
  sku: string | null;
  on_hand: number | string | null;
};

type ProductVariantSupplierRow = {
  sku: string | null;
  products:
    | {
        vendor: string | null;
      }
    | {
        vendor: string | null;
      }[]
    | null;
};

type SupplierMapValue = {
  supplier: string | null;
  source: BuyerReviewLine["supplierSource"];
  supplierCode: string | null;
};

type ManualSupplierMappingRow = {
  sku: string | null;
  supplier: string | null;
};

type SupplierMapResult = {
  map: Map<string, SupplierMapValue>;
  manualMappingReady: boolean;
};

const DEFAULT_LEAD_TIME_DAYS = 60;
const DEFAULT_SAFETY_STOCK_DAYS = 14;
const DEFAULT_REBUILD_STOCK_DAYS = 30;
const PAGE_SIZE = 1000;
const DASHBOARD_HISTORY_LIMIT = 5000;
const excelSupplierBySku = new Map(
  excelSupplierMap.map((row) => [row.sku, row]),
);
const supplierDetailByCode = new Map(
  excelSupplierDetails.map((row) => [row.supplierCode, row]),
);
const supplierDetailByName = new Map(
  excelSupplierDetails.map((row) => [row.supplierName, row]),
);
const incomingBySku = new Map(
  excelIncomingPurchaseOrders.map((row) => [row.sku, row]),
);

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

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function daysAgo(days: number, now = new Date()) {
  return dateOnly(new Date(now.getTime() - days * 24 * 60 * 60 * 1000));
}

function daysBetween(sinceDate: string, until = new Date()) {
  const since = new Date(`${sinceDate}T00:00:00.000Z`).getTime();
  return Math.max(0, Math.floor((until.getTime() - since) / (24 * 60 * 60 * 1000)));
}

function productLabel(row: {
  product_name: string | null;
  variant_title: string | null;
}) {
  return [row.product_name, row.variant_title].filter(Boolean).join(" - ");
}

function isRefundedStatus(status: string | null | undefined) {
  return status === "REFUNDED" || status === "VOIDED";
}

function isCountableDemandLine(row: {
  sku: string | null;
  financial_status: string | null;
  cancelled_at_shopify: string | null;
}) {
  return Boolean(row.sku?.trim()) && !row.cancelled_at_shopify && !isRefundedStatus(row.financial_status);
}

function summarizeDemandQuality(
  rows: Array<{
    sku: string | null;
    financial_status: string | null;
    cancelled_at_shopify: string | null;
  }>,
  totalLines?: number | null,
): DemandQualitySummary {
  const missingSkuLines = rows.filter((row) => !row.sku?.trim()).length;
  const cancelledLines = rows.filter((row) => Boolean(row.cancelled_at_shopify)).length;
  const refundedLines = rows.filter((row) => isRefundedStatus(row.financial_status)).length;
  const countableLines = rows.filter(isCountableDemandLine).length;
  const sampledTotal = rows.length;
  const effectiveTotal = totalLines ?? sampledTotal;

  return {
    totalLines: effectiveTotal,
    countableLines,
    excludedLines: sampledTotal - countableLines,
    missingSkuLines,
    cancelledLines,
    refundedLines,
  };
}

function summarizeDemand(rows: SalesLineRow[]): DemandLine[] {
  const bySku = new Map<
    string,
    {
      sku: string;
      product: string;
      quantity: number;
      revenue: number;
      orders: Set<string>;
    }
  >();

  for (const row of rows) {
    if (!isCountableDemandLine(row)) {
      continue;
    }

    const sku = row.sku?.trim();
    if (!sku) {
      continue;
    }

    const existing =
      bySku.get(sku) ??
      {
        sku,
        product: productLabel(row) || sku,
        quantity: 0,
        revenue: 0,
        orders: new Set<string>(),
      };

    existing.quantity += numeric(row.quantity);
    existing.revenue += numeric(row.line_total);
    if (row.shopify_order_id) {
      existing.orders.add(row.shopify_order_id);
    }
    bySku.set(sku, existing);
  }

  return Array.from(bySku.values())
    .map((row) => ({
      sku: row.sku,
      product: row.product,
      quantity: row.quantity,
      orderCount: row.orders.size,
      revenue: row.revenue,
    }))
    .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
    .slice(0, 8);
}

function formatBangkokWindow(sinceAt?: string | null, untilAt?: string | null) {
  if (!sinceAt || !untilAt) {
    return "No Shopify sales sync window yet";
  }

  const formatter = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  });

  return `${formatter.format(new Date(sinceAt))} - ${formatter.format(
    new Date(untilAt),
  )} ICT`;
}

function addMinutes(value: string, minutes: number) {
  return new Date(new Date(value).getTime() + minutes * 60 * 1000).toISOString();
}

async function fetchDemandHistoryRows(supabase: SupabaseClient) {
  const rows: DemandHistoryRow[] = [];
  const since = daysAgo(90);

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("sales_lines")
      .select(
        "sku, product_name, variant_title, quantity, order_date, financial_status, cancelled_at_shopify",
      )
      .gte("order_date", since)
      .order("order_date", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Demand history query failed: ${error.message}`);
    }

    rows.push(...((data ?? []) as DemandHistoryRow[]));

    if (!data || data.length < PAGE_SIZE || rows.length >= DASHBOARD_HISTORY_LIMIT) {
      break;
    }
  }

  return rows.slice(0, DASHBOARD_HISTORY_LIMIT);
}

function chunkItems<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function stockoutSkus(inventoryRows: InventoryRow[]) {
  const stockBySku = new Map<string, number>();

  for (const row of inventoryRows) {
    const sku = row.sku?.trim();
    if (!sku) {
      continue;
    }
    stockBySku.set(sku, (stockBySku.get(sku) ?? 0) + numeric(row.on_hand));
  }

  return Array.from(stockBySku.entries())
    .filter(([, stock]) => stock <= 0)
    .map(([sku]) => sku);
}

async function fetchSalesRowsForSkusSince(
  supabase: SupabaseClient,
  since: string,
  skus: string[],
) {
  const rows: DemandHistoryRow[] = [];
  const chunks = chunkItems(skus, 80);

  for (const chunk of chunks) {
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from("sales_lines")
        .select(
          "sku, product_name, variant_title, quantity, order_date, financial_status, cancelled_at_shopify",
        )
        .gte("order_date", since)
        .in("sku", chunk)
        .order("order_date", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        throw new Error(`Sales history query failed: ${error.message}`);
      }

      rows.push(...((data ?? []) as DemandHistoryRow[]));

      if (
        !data ||
        data.length < PAGE_SIZE ||
        rows.length >= DASHBOARD_HISTORY_LIMIT
      ) {
        break;
      }
    }

    if (rows.length >= DASHBOARD_HISTORY_LIMIT) {
      break;
    }
  }

  return rows.slice(0, DASHBOARD_HISTORY_LIMIT);
}

async function fetchLatestInventoryRows(
  supabase: SupabaseClient,
  snapshotDate?: string | null,
) {
  if (!snapshotDate) {
    return [] as InventoryRow[];
  }

  const rows: InventoryRow[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("inventory_snapshots")
      .select("sku, on_hand")
      .eq("snapshot_date", snapshotDate)
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Inventory query failed: ${error.message}`);
    }

    rows.push(...((data ?? []) as InventoryRow[]));

    if (!data || data.length < PAGE_SIZE) {
      break;
    }
  }

  return rows;
}

function summarizeDemandInsights(
  rows: DemandHistoryRow[],
  inventoryRows: InventoryRow[],
): DemandInsightLine[] {
  const cutoffs = {
    d7: daysAgo(7),
    d30: daysAgo(30),
    d60: daysAgo(60),
    d90: daysAgo(90),
  };
  const stockBySku = new Map<string, number>();

  for (const row of inventoryRows) {
    const sku = row.sku?.trim();
    if (!sku) {
      continue;
    }
    stockBySku.set(sku, (stockBySku.get(sku) ?? 0) + numeric(row.on_hand));
  }

  const bySku = new Map<
    string,
    {
      sku: string;
      product: string;
      sold7: number;
      sold30: number;
      sold60: number;
      sold90: number;
    }
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

    const existing =
      bySku.get(sku) ??
      {
        sku,
        product: productLabel(row) || sku,
        sold7: 0,
        sold30: 0,
        sold60: 0,
        sold90: 0,
      };
    const qty = numeric(row.quantity);

    if (orderDate >= cutoffs.d90) {
      existing.sold90 += qty;
    }
    if (orderDate >= cutoffs.d60) {
      existing.sold60 += qty;
    }
    if (orderDate >= cutoffs.d30) {
      existing.sold30 += qty;
    }
    if (orderDate >= cutoffs.d7) {
      existing.sold7 += qty;
    }

    bySku.set(sku, existing);
  }

  const targetDays = DEFAULT_LEAD_TIME_DAYS + DEFAULT_SAFETY_STOCK_DAYS;

  return Array.from(bySku.values())
    .map((row) => {
      const ads30 = row.sold30 / 30;
      const stockOnHand = stockBySku.get(row.sku) ?? 0;
      const coverageDays = ads30 > 0 ? stockOnHand / ads30 : null;
      const reorderPoint = Math.ceil(ads30 * targetDays);
      const suggestedQty = Math.max(0, reorderPoint - stockOnHand);
      const status: DemandInsightLine["status"] =
        suggestedQty > 0
          ? "order_now"
          : coverageDays !== null && coverageDays <= targetDays + 14
            ? "watch"
            : "healthy";

      return {
        ...row,
        ads30,
        stockOnHand,
        coverageDays,
        reorderPoint,
        suggestedQty,
        status,
      };
    })
    .filter((row) => row.sold30 > 0)
    .sort((a, b) => b.suggestedQty - a.suggestedQty || b.sold30 - a.sold30)
    .slice(0, 10);
}

function confidenceForQuietDays(quietDays: number) {
  if (quietDays <= 30) {
    return 1;
  }
  if (quietDays <= 90) {
    return 0.85;
  }
  if (quietDays <= 180) {
    return 0.7;
  }
  return 0.6;
}

function summarizeComebackSignals(
  rows: DemandHistoryRow[],
  inventoryRows: InventoryRow[],
): ComebackSignalLine[] {
  const stockBySku = new Map<string, number>();
  for (const row of inventoryRows) {
    const sku = row.sku?.trim();
    if (!sku) {
      continue;
    }
    stockBySku.set(sku, (stockBySku.get(sku) ?? 0) + numeric(row.on_hand));
  }

  const bySku = new Map<
    string,
    {
      sku: string;
      product: string;
      historicalSold: number;
      sold30: number;
      lastSoldDate: string;
      monthly: Map<string, number>;
    }
  >();
  const d30 = daysAgo(30);

  for (const row of rows) {
    if (!isCountableDemandLine(row)) {
      continue;
    }

    const sku = row.sku?.trim();
    const orderDate = row.order_date;
    if (!sku || !orderDate) {
      continue;
    }

    const monthKey = orderDate.slice(0, 7);
    const existing =
      bySku.get(sku) ??
      {
        sku,
        product: productLabel(row) || sku,
        historicalSold: 0,
        sold30: 0,
        lastSoldDate: orderDate,
        monthly: new Map<string, number>(),
      };
    const qty = numeric(row.quantity);

    existing.historicalSold += qty;
    existing.monthly.set(monthKey, (existing.monthly.get(monthKey) ?? 0) + qty);
    if (orderDate >= d30) {
      existing.sold30 += qty;
    }
    if (orderDate > existing.lastSoldDate) {
      existing.lastSoldDate = orderDate;
    }
    bySku.set(sku, existing);
  }

  const targetDays =
    DEFAULT_LEAD_TIME_DAYS + DEFAULT_SAFETY_STOCK_DAYS + DEFAULT_REBUILD_STOCK_DAYS;

  return Array.from(bySku.values())
    .map((row) => {
      const stockOnHand = stockBySku.get(row.sku) ?? 0;
      const bestMonthSold = Math.max(...Array.from(row.monthly.values()));
      const quietDays = daysBetween(row.lastSoldDate);
      const confidence = confidenceForQuietDays(quietDays);
      const demandIndex = (bestMonthSold / 30) * confidence;
      const targetQty = Math.ceil(demandIndex * targetDays);
      const suggestedQty = Math.max(0, targetQty - stockOnHand);

      return {
        sku: row.sku,
        product: row.product,
        lastSoldDate: row.lastSoldDate,
        quietDays,
        historicalSold: row.historicalSold,
        bestMonthSold,
        demandIndex,
        stockOnHand,
        confidence,
        targetQty,
        suggestedQty,
      };
    })
    .filter(
      (row) =>
        row.stockOnHand <= 0 &&
        row.historicalSold >= 10 &&
        row.quietDays >= 60 &&
        row.suggestedQty > 0,
    )
    .sort(
      (a, b) =>
        b.suggestedQty - a.suggestedQty ||
        b.quietDays - a.quietDays ||
        b.historicalSold - a.historicalSold,
    )
    .slice(0, 10);
}

function priorityRank(priority: BuyerReviewLine["priority"]) {
  return priority === "critical" ? 0 : priority === "high" ? 1 : 2;
}

function productVendor(row: ProductVariantSupplierRow) {
  const product = Array.isArray(row.products) ? row.products[0] : row.products;
  return product?.vendor?.trim() || null;
}

function supplierForSku(sku: string, supplierMap: Map<string, SupplierMapValue>) {
  const mapped = supplierMap.get(sku);
  return {
    supplier: mapped?.supplier ?? null,
    supplierSource: mapped?.source ?? ("pending" as const),
    supplierCode: mapped?.supplierCode ?? null,
  };
}

function supplierTerms(supplier: string | null, supplierCode: string | null) {
  const detail =
    (supplierCode ? supplierDetailByCode.get(supplierCode) : undefined) ??
    (supplier ? supplierDetailByName.get(supplier) : undefined);

  return {
    currency: detail?.currency || null,
    moq: detail?.moq || null,
    paymentTerms: detail?.paymentTerms || null,
    safetyDays:
      typeof detail?.safetyDays === "number" && Number.isFinite(detail.safetyDays)
        ? detail.safetyDays
        : null,
    supplierLeadTimeDays:
      typeof detail?.leadTimeDays === "number" &&
      Number.isFinite(detail.leadTimeDays) &&
      detail.leadTimeDays > 0
        ? detail.leadTimeDays
        : null,
  };
}

function incomingForSku(sku: string) {
  return (
    incomingBySku.get(sku) ?? {
      activeIncomingQty: 0,
      pendingApprovalQty: 0,
    }
  );
}

function buildBuyerReviewLine(
  line: Omit<
    BuyerReviewLine,
    | "activeIncomingQty"
    | "pendingApprovalQty"
    | "netSuggestedQty"
    | "supplierCode"
    | "currency"
    | "moq"
    | "paymentTerms"
    | "safetyDays"
    | "supplierLeadTimeDays"
  > & {
    supplierCode: string | null;
  },
): BuyerReviewLine {
  const incoming = incomingForSku(line.sku);
  const terms = supplierTerms(line.supplier, line.supplierCode);
  const activeIncomingQty = incoming.activeIncomingQty;
  const pendingApprovalQty = incoming.pendingApprovalQty;

  return {
    ...line,
    activeIncomingQty,
    pendingApprovalQty,
    netSuggestedQty: Math.max(0, line.suggestedQty - activeIncomingQty),
    ...terms,
  };
}

function buildBuyerReviewQueue(
  demandInsights: DemandInsightLine[],
  comebackSignals: ComebackSignalLine[],
  supplierMap: Map<string, SupplierMapValue>,
): BuyerReviewLine[] {
  const queue = new Map<string, BuyerReviewLine>();

  for (const line of demandInsights) {
    if (line.status !== "order_now" && line.status !== "watch") {
      continue;
    }

    const priority: BuyerReviewLine["priority"] =
      line.status === "order_now" && line.stockOnHand <= 0
        ? "critical"
        : line.status === "order_now"
          ? "high"
          : "watch";

    const supplier = supplierForSku(line.sku, supplierMap);

    queue.set(line.sku, buildBuyerReviewLine({
      sku: line.sku,
      product: line.product,
      priority,
      reason:
        priority === "critical"
          ? "No stock with active 30-day demand"
          : priority === "high"
            ? "Below reorder point"
            : "Coverage is nearing reorder point",
      suggestedQty: line.suggestedQty,
      stockOnHand: line.stockOnHand,
      coverageDays: line.coverageDays,
      sold30: line.sold30,
      demandIndex: line.ads30,
      source: "reorder",
      supplier: supplier.supplier,
      supplierSource: supplier.supplierSource,
      supplierCode: supplier.supplierCode,
    }));
  }

  for (const line of comebackSignals) {
    const existing = queue.get(line.sku);
    const supplier = supplierForSku(line.sku, supplierMap);
    const comebackLine = buildBuyerReviewLine({
      sku: line.sku,
      product: line.product,
      priority: "critical",
      reason: `OOS comeback; last sold ${line.quietDays}d ago`,
      suggestedQty: line.suggestedQty,
      stockOnHand: line.stockOnHand,
      coverageDays: null,
      sold30: null,
      demandIndex: line.demandIndex,
      source: "comeback",
      supplier: supplier.supplier,
      supplierSource: supplier.supplierSource,
      supplierCode: supplier.supplierCode,
    });

    if (!existing || comebackLine.suggestedQty > existing.suggestedQty) {
      queue.set(line.sku, comebackLine);
    }
  }

  return Array.from(queue.values())
    .sort(
      (a, b) =>
        priorityRank(a.priority) - priorityRank(b.priority) ||
        b.netSuggestedQty - a.netSuggestedQty ||
        b.demandIndex - a.demandIndex,
    )
    .slice(0, 12);
}

async function fetchSupplierMapForSkus(
  supabase: SupabaseClient,
  skus: string[],
): Promise<SupplierMapResult> {
  const uniqueSkus = Array.from(new Set(skus.filter(Boolean)));
  const supplierMap = new Map<string, SupplierMapValue>();
  let manualMappingReady = true;

  if (uniqueSkus.length) {
    const { data, error } = await supabase
      .from("manual_supplier_mappings")
      .select("sku, supplier")
      .in("sku", uniqueSkus);

    if (error) {
      manualMappingReady = false;
    } else {
      for (const row of (data ?? []) as ManualSupplierMappingRow[]) {
        const sku = row.sku?.trim();
        const supplier = row.supplier?.trim();
        if (!sku || !supplier) {
          continue;
        }

        supplierMap.set(sku, {
          supplier,
          source: "manual",
          supplierCode: null,
        });
      }
    }
  }

  for (const sku of uniqueSkus) {
    if (supplierMap.has(sku)) {
      continue;
    }

    const excelSupplier = excelSupplierBySku.get(sku);
    if (!excelSupplier) {
      continue;
    }

    supplierMap.set(sku, {
      supplier: excelSupplier.supplierName,
      source: "excel",
      supplierCode: excelSupplier.supplierCode,
    });
  }

  for (const line of topReorderLines) {
    if (supplierMap.has(line.sku)) {
      continue;
    }

    supplierMap.set(line.sku, {
      supplier: line.supplier,
      source: "excel",
      supplierCode: null,
    });
  }

  for (const chunk of chunkItems(uniqueSkus, 80)) {
    const { data, error } = await supabase
      .from("product_variants")
      .select("sku, products(vendor)")
      .in("sku", chunk);

    if (error) {
      throw new Error(`Supplier mapping query failed: ${error.message}`);
    }

    for (const row of (data ?? []) as ProductVariantSupplierRow[]) {
      const sku = row.sku?.trim();
      if (!sku || supplierMap.has(sku)) {
        continue;
      }

      supplierMap.set(sku, {
        supplier: productVendor(row),
        source: productVendor(row) ? "shopify_vendor" : "pending",
        supplierCode: null,
      });
    }
  }

  return {
    map: supplierMap,
    manualMappingReady,
  };
}

export async function getDashboardData() {
  const supabase = getSupabaseServiceClient();

  if (!supabase) {
    return {
      mode: "baseline" as const,
      env: envStatus(),
      metrics: baselineMetrics,
      syncSources,
      supplierSummaries,
      demandLines: [] as DemandLine[],
      demandInsights: [] as DemandInsightLine[],
      comebackSignals: [] as ComebackSignalLine[],
      buyerReviewQueue: [] as BuyerReviewLine[],
      manualSupplierMappingReady: false,
      demandQuality: {
        totalLines: 0,
        countableLines: 0,
        excludedLines: 0,
        missingSkuLines: 0,
        cancelledLines: 0,
        refundedLines: 0,
      } satisfies DemandQualitySummary,
      demandWindowLabel: "Excel baseline only",
      topReorderLines,
      thaiTshirtMatrix,
      validationWarnings,
      lastSyncAt: "Excel baseline from 2026-04-26",
    };
  }

  const [
    { count: variantCount },
    { count: inventoryCount },
    { count: salesLineCount },
    { data: latestProductSync },
    { data: latestDailySalesSync },
    { data: latestInventoryDate },
  ] = await Promise.all([
    supabase
      .from("product_variants")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("inventory_snapshots")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("sales_lines")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("sync_runs")
      .select(
        "started_at, finished_at, status, variants_seen, inventory_rows_seen, pages_seen",
      )
      .eq("source", "shopify_products_inventory")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("sync_runs")
      .select(
        "started_at, finished_at, status, sales_lines_seen, pages_seen, since_at, until_at",
      )
      .eq("source", "shopify_orders_sales_lines")
      .eq("status", "completed")
      .in("mode", ["manual", "cron"])
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("inventory_snapshots")
      .select("snapshot_date")
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const salesQuery = supabase
    .from("sales_lines")
    .select(
      "shopify_order_id, sku, product_name, variant_title, quantity, line_total, financial_status, cancelled_at_shopify",
    )
    .limit(5000);

  const syncedFrom = latestDailySalesSync?.started_at
    ? addMinutes(latestDailySalesSync.started_at, -5)
    : null;
  const syncedUntil = latestDailySalesSync?.finished_at
    ? addMinutes(latestDailySalesSync.finished_at, 5)
    : null;

  const [latestDemandResult, historyDemandRows, inventoryRows] =
    await Promise.all([
      syncedFrom && syncedUntil
        ? salesQuery.gte("synced_at", syncedFrom).lte("synced_at", syncedUntil)
        : salesQuery,
      fetchDemandHistoryRows(supabase),
      fetchLatestInventoryRows(supabase, latestInventoryDate?.snapshot_date),
    ]);
  const comebackRows = await fetchSalesRowsForSkusSince(
    supabase,
    "2025-01-01",
    stockoutSkus(inventoryRows),
  );

  const demandRows = (latestDemandResult.data ?? []) as SalesLineRow[];
  const orderCount = new Set(
    demandRows.map((row) => row.shopify_order_id).filter(Boolean),
  ).size;
  const skuCount = new Set(demandRows.map((row) => row.sku).filter(Boolean)).size;
  const demandLines = summarizeDemand(demandRows);
  const demandQuality = summarizeDemandQuality(
    historyDemandRows,
    salesLineCount,
  );
  const demandBySku = new Map(demandLines.map((line) => [line.sku, line]));
  const demandInsights = summarizeDemandInsights(
    historyDemandRows,
    inventoryRows,
  );
  const comebackSignals = summarizeComebackSignals(comebackRows, inventoryRows);
  const supplierMap = await fetchSupplierMapForSkus(
    supabase,
    [
      ...demandInsights.map((line) => line.sku),
      ...comebackSignals.map((line) => line.sku),
    ],
  );
  const buyerReviewQueue = buildBuyerReviewQueue(
    demandInsights,
    comebackSignals,
    supplierMap.map,
  );

  const liveTopReorderLines = topReorderLines.map((line) => {
    const live = demandBySku.get(line.sku);
    return live ? { ...line, demandIndex: live.quantity } : line;
  });

  const liveSyncSources = syncSources.map((source) =>
    source.name === "Shopify products" && typeof variantCount === "number"
      ? {
          ...source,
          rows: `${variantCount.toLocaleString("en-US")} variants in Supabase`,
        }
      : source.name === "Shopify inventory" && typeof inventoryCount === "number"
        ? {
            ...source,
            rows: `${inventoryCount.toLocaleString(
              "en-US",
            )} location rows in Supabase`,
          }
      : source.name === "Shopify sales lines"
          ? {
              ...source,
              rows: `${(salesLineCount ?? demandRows.length).toLocaleString(
                "en-US",
              )} sales lines in Supabase`,
            }
          : source,
  );

  return {
    mode: "supabase" as const,
    env: envStatus(),
    metrics: baselineMetrics.map((metric) =>
      metric.label === "Sales lines"
        ? {
            ...metric,
            value: (salesLineCount ?? demandRows.length).toLocaleString("en-US"),
            detail: `2025-to-date in Supabase; latest window has ${orderCount.toLocaleString(
              "en-US",
            )} orders, ${skuCount.toLocaleString(
              "en-US",
            )} SKUs sold`,
          }
        : metric.label === "Product variants" && typeof variantCount === "number"
          ? { ...metric, value: variantCount.toLocaleString("en-US") }
          : metric.label === "Inventory snapshots" &&
              typeof inventoryCount === "number"
            ? {
                ...metric,
                value: inventoryCount.toLocaleString("en-US"),
                detail: "location-level inventory rows in Supabase",
              }
            : metric,
    ),
    syncSources: liveSyncSources,
    supplierSummaries,
    demandLines,
    demandInsights,
    comebackSignals,
    buyerReviewQueue,
    manualSupplierMappingReady: supplierMap.manualMappingReady,
    demandQuality,
    demandWindowLabel: formatBangkokWindow(
      latestDailySalesSync?.since_at,
      latestDailySalesSync?.until_at,
    ),
    topReorderLines: liveTopReorderLines,
    thaiTshirtMatrix,
    validationWarnings,
    lastSyncAt: latestProductSync
      ? `Last Shopify sync ${latestProductSync.status} - ${
          latestProductSync.variants_seen ?? 0
        } variants - ${
          latestProductSync.inventory_rows_seen ?? 0
        } inventory rows - ${latestProductSync.pages_seen ?? 0} pages`
      : "Supabase connected, no Shopify sync run yet",
  };
}
