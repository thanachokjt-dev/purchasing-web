import {
  poPortalItems,
  poPortalOrders,
  poPortalSuppliers,
  type PoPortalItem,
} from "@/lib/po-portal-data";
import { excelSupplierMap } from "@/lib/excel-supplier-map";
import {
  matrixItemFamily,
  matrixItemSize,
  matrixProductName,
  matrixSectionLabel,
  matrixSectionName,
  type MatrixFamily,
} from "@/lib/po-size-matrix";
import { sortPoPayments } from "@/lib/po-payments";
import { firstPaymentByStableSequence } from "@/lib/po-duration";
import { getLatestClosedPoUnitCostBySkus } from "@/lib/latest-closed-po-cost";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

// final_payment is payment follow-up, not physical inbound stock.
// Incoming stock only counts unreceived lines still expected to arrive.
const PHYSICAL_INCOMING_STATUSES = new Set(["inpro", "delivery"]);
const PENDING_STATUSES = new Set(["waiting_for_approve"]);
const WORKBENCH_ORDER_STATUSES = new Set([
  "draft",
  "waiting_for_approve",
  "follow_up",
  "inpro",
  "delivery",
  "final_payment",
]);
const CLOSED_ORDER_STATUSES = new Set(["closed"]);
const PAGE_SIZE = 1000;
const PO_LOOKUP_BATCH_SIZE = 50;
const RECEIPT_LOOKUP_BATCH_SIZE = 100;

type PoPortalQueryError = {
  code?: string;
  details?: string;
  hint?: string;
  message?: string;
} | null;

type PoPortalSupplierRow = {
  supplier_code: string | null;
  supplier_name: string | null;
  currency: string | null;
  payment_terms: string | null;
};

type PoPortalMetricsRow = {
  active_incoming_total: number | string | null;
  item_count: number | string | null;
  open_paid_amount_thb: number | string | null;
  ordered_total: number | string | null;
  pending_approval_total: number | string | null;
  planned_amount_thb: number | string | null;
  po_count: number | string | null;
  received_total: number | string | null;
  supplier_count: number | string | null;
};

type PoSupplierPipelineSummaryRow = {
  incoming_qty: number | string | null;
  line_count: number | string | null;
  outstanding_qty: number | string | null;
  paid_amount_thb: number | string | null;
  payment_terms: string | null;
  planned_amount_thb: number | string | null;
  po_count: number | string | null;
  supplier_code: string | null;
  supplier_name: string | null;
  total_qty: number | string | null;
};

type PoIncomingEtaReconciliationRow = {
  pipeline_item_count: number | string | null;
  pipeline_po_count: number | string | null;
  scheduled_eta_qty: number | string | null;
  scheduled_item_count: number | string | null;
  scheduled_po_count: number | string | null;
  total_incoming_pipeline_qty: number | string | null;
  unscheduled_eta_qty: number | string | null;
  unscheduled_item_count: number | string | null;
  unscheduled_po_count: number | string | null;
  updated_at: string | null;
};

type PoIncomingEtaDailyRow = {
  detail_payload?: unknown;
  eta_date: string | null;
  item_count: number | string | null;
  po_count: number | string | null;
  supplier_code: string | null;
  supplier_name: string | null;
  total_incoming_qty: number | string | null;
};

type PoIncomingEtaUnscheduledRow = {
  eta_date: string | null;
  eta_source: string | null;
  incoming_qty: number | string | null;
  latest_supplier_comment: string | null;
  line_status: string | null;
  po_detail_href: string | null;
  po_id: string | null;
  po_reference: string | null;
  po_status: string | null;
  product_name: string | null;
  sku: string | null;
  supplier_code: string | null;
  supplier_name: string | null;
};

type PoPaymentTimelineEventRow = {
  amount_original?: number | string | null;
  amount_thb: number | string | null;
  currency: string | null;
  event_date: string | null;
  exchange_rate?: number | string | null;
  latest_supplier_comment: string | null;
  payment_id: string | null;
  payment_label: string | null;
  payment_status: string | null;
  payment_type: string | null;
  po_detail_href: string | null;
  po_id: string | null;
  po_reference: string | null;
  series: string | null;
  supplier_code: string | null;
  supplier_name: string | null;
};

type PoChartPoDetailRow = {
  actual_received_date?: string | null;
  header_purpose?: string | null;
  po_id: string | null;
  quotation_reference?: string | null;
  source_payload?: unknown;
  supplier_invoice_no?: string | null;
};

type PoIncomingReceivedHistoryRow = {
  actual_received_date?: string | null;
  active_incoming_qty: number | string | null;
  estimated_arrived_date?: string | null;
  estimated_delivery_date?: string | null;
  po_date: string | null;
  po_id: string | null;
  po_title: string | null;
  quotation_reference?: string | null;
  rqq_id: string | null;
  source_payload?: unknown;
  supplier_code: string | null;
  supplier_invoice_no?: string | null;
  supplier_name_snapshot: string | null;
  total_items: number | string | null;
  total_outstanding_qty: number | string | null;
  total_qty: number | string | null;
  total_received_qty: number | string | null;
  work_status: string | null;
};

type PoReceiptItemRow = {
  id: string;
  po_id: string | null;
};

type PoPaymentSequenceRow = {
  id: string;
  po_id: string | null;
  payment_date: string | null;
  created_at: string | null;
};

type PoPortalOrderRow = {
  po_id: string | null;
  rqq_id: string | null;
  po_title: string | null;
  po_date: string | null;
  actual_received_date?: string | null;
  cancelled_at?: string | null;
  closed_at?: string | null;
  estimated_arrived_date?: string | null;
  estimated_delivery_date?: string | null;
  work_status: string | null;
  requester: string | null;
  owner: string | null;
  supplier_code: string | null;
  supplier_name_snapshot: string | null;
  currency: string | null;
  po_amount_foreign: number | string | null;
  po_amount_thb: number | string | null;
  freight_total?: number | string | null;
  other_landed_cost_total?: number | string | null;
  landed_cost_note?: string | null;
  header_purpose?: string | null;
  quotation_reference?: string | null;
  supplier_invoice_no?: string | null;
  supplier_discussion_note?: string | null;
  vat_mode?: string | null;
  payment_terms_snapshot: string | null;
  source_payload?: unknown;
};

type PoOrderSummaryRow = PoPortalOrderRow & {
  active_incoming_qty: number | string | null;
  active_line_count: number | string | null;
  paid_amount_thb: number | string | null;
  pending_approval_qty: number | string | null;
  pending_line_count: number | string | null;
  planned_amount_thb: number | string | null;
  statuses: string[] | null;
  total_items: number | string | null;
  total_outstanding_qty: number | string | null;
  total_qty: number | string | null;
  total_received_qty: number | string | null;
  updated_at: string | null;
};

type PoPortalItemRow = {
  id: string;
  po_item_id: string | null;
  po_id: string | null;
  line_no: string | null;
  sku: string | null;
  product_title_snapshot: string | null;
  variant_title_snapshot: string | null;
  ordered_qty: number | string | null;
  legacy_received_qty: number | string | null;
  backorder_qty: number | string | null;
  unit_price: number | string | null;
  freight_unit_cost?: number | string | null;
  landed_unit_cost?: number | string | null;
  line_amount: number | string | null;
  currency: string | null;
  remark: string | null;
  full_name: string | null;
  line_status: string | null;
  sort_position?: number | string | null;
  source_payload?: unknown;
};

type PoCatalogVariantRow = {
  product_variant_id?: string | null;
  shopify_variant_id?: string | null;
  sku: string | null;
  variant_title: string | null;
  option1_value: string | null;
  option2_value: string | null;
  option3_value: string | null;
  variant_image_url: string | null;
  products:
    | {
        product_title: string | null;
        product_image_url: string | null;
        vendor: string | null;
        tags: string[] | null;
      }
    | {
        product_title: string | null;
        product_image_url: string | null;
        vendor: string | null;
        tags: string[] | null;
      }[]
    | null;
};

type PoDecisionControlRow = {
  sku: string | null;
  product_name_override: string | null;
  main_name_override: string | null;
  supplier_override: string | null;
  hide_from_purchasing: boolean | null;
  lead_time_days?: number | string | null;
  order_cycle_days?: number | string | null;
  safety_days?: number | string | null;
  tags_override?: string[] | null;
};

type LastPoPriceRow = {
  po_id: string | null;
  sku: string | null;
  unit_price: number | string | null;
  freight_unit_cost?: number | string | null;
  landed_unit_cost?: number | string | null;
  currency: string | null;
  created_at: string | null;
};

type HistoricalFreightItemRow = {
  id: string;
  po_id: string | null;
  sku: string | null;
  freight_unit_cost: number | string | null;
  created_at: string | null;
};

type HistoricalFreightOrderRow = {
  po_id: string | null;
  actual_received_date?: string | null;
};

type HistoricalFreightReceiptRow = {
  po_item_id: string | null;
  actual_received_date?: string | null;
  received_at: string | null;
};

type ManualSupplierMappingRow = {
  sku: string | null;
  supplier: string | null;
};

type PoPortalReceiptTotalRow = {
  po_item_uuid: string | null;
  workflow_received_qty: number | string | null;
  total_received_qty: number | string | null;
  outstanding_qty: number | string | null;
};

type PoReceiptRow = {
  actual_received_date?: string | null;
  id: string;
  po_item_id: string | null;
  received_at: string | null;
  received_qty: number | string | null;
  received_by: string | null;
  note: string | null;
};

type PoPaymentRow = {
  id: string;
  po_id: string | null;
  payment_date: string | null;
  payment_type: string | null;
  payment_status?: string | null;
  xero_status?: string | null;
  due_date?: string | null;
  amount: number | string | null;
  exchange_rate?: number | string | null;
  amount_thb?: number | string | null;
  currency: string | null;
  paid_by: string | null;
  reference: string | null;
  note: string | null;
  created_at: string | null;
  updated_at?: string | null;
};

type PoStatusEventRow = {
  id: string;
  po_id: string | null;
  po_item_id: string | null;
  from_status: string | null;
  to_status: string | null;
  actor: string | null;
  note: string | null;
  created_at: string | null;
};

type ProductVariantImageRow = {
  sku: string | null;
  price?: number | string | null;
  variant_title?: string | null;
  variant_image_url: string | null;
  products:
    | {
        product_image_url: string | null;
        product_title?: string | null;
        tags?: string[] | null;
      }
    | {
        product_image_url: string | null;
        product_title?: string | null;
        tags?: string[] | null;
      }[]
    | null;
};

type InventorySnapshotRow = {
  sku: string | null;
  on_hand: number | string | null;
  snapshot_date: string | null;
};

type CurrentInventoryRow = {
  sku: string | null;
  on_hand: number | string | null;
};

type DemandIndexSnapshotRow = {
  sku: string | null;
  demand_index_hm: number | string | null;
};

type PoPortalSupplierOption = {
  supplierCode: string;
  supplierName: string;
  currency: string;
  paymentTerms: string;
};

export type PoCatalogItemOption = {
  sku: string;
  productTitle: string;
  mainName: string;
  variantTitle: string;
  imageUrl: string | null;
  tags: string[];
  onHand: number;
  supplierCode: string;
  supplierName: string;
  currency: string;
  lastUnitPrice: number;
  lastFreightUnitCost: number;
  lastLandedUnitCost: number;
  lastPoId: string;
  demandIndexHm: number;
  leadTimeDays: number;
  recommendedRawQty: number;
  recommendedRoundQty: number;
  recommendedQty: number;
  searchText: string;
};

type PortalItem = PoPortalItem & {
  demandIndexHm?: number;
  freightUnitCost?: number;
  imageUrl?: string | null;
  itemUuid?: string;
  landedUnitCost?: number;
  leadTimeDays?: number;
  onHand?: number;
  sortPosition?: number;
  tags?: string[];
  unitPriceSource?: string;
  unitPriceSourceDate?: string;
  unitPriceSourcePoReference?: string;
};

export type PoMarginCheckRow = {
  avgLandedUnitCost: number;
  avgUnitCost: number;
  family: MatrixFamily;
  imageUrl: string | null;
  latestFreightSourceDate: string;
  latestFreightSourcePoId: string;
  latestFreightUnitAvg: number | null;
  productTitle: string;
  sectionLabel: string;
  size: string;
  shopifySalePrice: number | null;
  sku: string;
  totalQty: number;
  variantTitle: string;
};

type PortalOrder = {
  poId: string;
  rqqId: string;
  poTitle: string;
  poDate: string;
  workStatus: string;
  cancelledAt: string;
  closedAt: string;
  requester: string;
  owner: string;
  supplierCode: string;
  supplierName: string;
  currency: string;
  poAmountForeign: number;
  poAmountThb: number;
  freightTotal: number;
  otherLandedCostTotal: number;
  landedCostNote: string;
  headerPurpose: string;
  quotationReference: string;
  supplierInvoiceNo: string;
  supplierDiscussionNote: string;
  vatMode: string;
  estimatedDeliveryDate: string;
  estimatedArrivedDate: string;
  actualReceivedDate: string;
  paymentTerms: string;
  paidAmountThb: number;
  plannedAmountThb: number;
  itemCount: number;
  statuses: string[];
  totalQty: number;
  receivedQty: number;
  outstandingQty: number;
};

export type PoPortalListOptions = {
  dir?: "asc" | "desc";
  includeReceivedHistory?: boolean;
  page?: number;
  pageSize?: number;
  q?: string;
  sort?: string;
  status?: string[];
  supplier?: string[];
};

const DEFAULT_LIST_PAGE_SIZE = 25;
const MAX_LIST_PAGE_SIZE = 50;

function normalizedStatus(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function isPhysicalIncomingStatus(value: string) {
  return PHYSICAL_INCOMING_STATUSES.has(normalizedStatus(value));
}

function isPendingStatus(value: string) {
  return PENDING_STATUSES.has(normalizedStatus(value));
}

function isClosedOrderStatus(value: string) {
  return CLOSED_ORDER_STATUSES.has(normalizedStatus(value));
}

function isOrderClosedOrCancelled(order: {
  cancelledAt?: string;
  closedAt?: string;
  workStatus: string;
}) {
  const status = normalizedStatus(order.workStatus);
  return Boolean(
    order.closedAt ||
      order.cancelledAt ||
      status === "closed" ||
      status === "cancelled" ||
      status === "canceled",
  );
}

function statusLabel(value: string) {
  return value || "No status";
}

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

function compactText(value: string | null | undefined) {
  return value?.trim() || "";
}

function logPoPortalQueryError(label: string, error: PoPortalQueryError) {
  if (error && process.env.NODE_ENV !== "production") {
    console.warn(`[po-portal] ${label} query failed`, {
      code: error.code,
      details: error.details,
      hint: error.hint,
      message: error.message ?? "Unknown error",
    });
  }
}

function schemaColumnMiss(errorMessage: string) {
  const message = errorMessage.toLowerCase();
  return message.includes("schema cache") || message.includes("column");
}

function objectValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function poDetailHeaderPayload(value: unknown) {
  const payload = objectValue(value);
  return objectValue(payload.po_detail_header);
}

function payloadText(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === "string" ? value.trim() : "";
}

function firstProduct<T>(row: {
  products: T | T[] | null;
}) {
  return Array.isArray(row.products) ? row.products[0] : row.products;
}

function isActiveIncomingLine(
  item: PoPortalItem,
  order: { cancelledAt?: string; closedAt?: string; workStatus: string },
) {
  return (
    item.outstandingQty > 0 &&
    isPhysicalIncomingStatus(item.status) &&
    isPhysicalIncomingStatus(order.workStatus) &&
    !isOrderClosedOrCancelled(order)
  );
}

function isPendingApprovalLine(
  item: PoPortalItem,
  order: { cancelledAt?: string; closedAt?: string; workStatus: string },
) {
  return (
    item.outstandingQty > 0 &&
    isPendingStatus(item.status) &&
    isPendingStatus(order.workStatus) &&
    !isOrderClosedOrCancelled(order)
  );
}

function activeIncomingQty(
  items: PoPortalItem[],
  order: { cancelledAt?: string; closedAt?: string; workStatus: string },
) {
  return items
    .filter((item) => isActiveIncomingLine(item, order))
    .reduce((sum, item) => sum + item.outstandingQty, 0);
}

function pendingApprovalQty(
  items: PoPortalItem[],
  order: { cancelledAt?: string; closedAt?: string; workStatus: string },
) {
  return items
    .filter((item) => isPendingApprovalLine(item, order))
    .reduce((sum, item) => sum + item.outstandingQty, 0);
}

function mapSupabaseItem(
  item: PoPortalItemRow,
  receiptTotal?: PoPortalReceiptTotalRow,
  imageUrl?: string | null,
): PortalItem {
  const orderedQty = numeric(item.ordered_qty);
  const receivedQty = numeric(receiptTotal?.total_received_qty ?? item.legacy_received_qty);
  const outstandingQty = numeric(receiptTotal?.outstanding_qty);
  const sourcePayload = objectValue(item.source_payload);

  return {
    poId: item.po_id ?? "",
    itemUuid: item.id,
    lineNo: item.line_no ?? "",
    sku: item.sku ?? "",
    productTitle: item.product_title_snapshot ?? item.sku ?? "",
    variantTitle: item.variant_title_snapshot ?? "",
    qty: orderedQty,
    receivedQty,
    backorderQty: numeric(item.backorder_qty),
    outstandingQty,
    unitPrice: numeric(item.unit_price),
    freightUnitCost: numeric(item.freight_unit_cost),
    landedUnitCost: numeric(item.landed_unit_cost),
    lineAmount: numeric(item.line_amount),
    currency: item.currency ?? "THB",
    remark: item.remark ?? "",
    poItemId: item.po_item_id ?? item.id,
    fullName: item.full_name ?? "",
    imageUrl: imageUrl || payloadText(sourcePayload, "imageUrl") || null,
    sortPosition: numeric(item.sort_position),
    status: item.line_status ?? "unknown",
    unitPriceSource: payloadText(sourcePayload, "unitPriceSource"),
    unitPriceSourceDate: payloadText(sourcePayload, "unitPriceSourceDate"),
    unitPriceSourcePoReference: payloadText(sourcePayload, "unitPriceSourcePoReference"),
  };
}

function productImageUrl(row: ProductVariantImageRow) {
  const product = Array.isArray(row.products) ? row.products[0] : row.products;
  return row.variant_image_url?.trim() || product?.product_image_url?.trim() || null;
}

function productTags(row: ProductVariantImageRow) {
  const product = Array.isArray(row.products) ? row.products[0] : row.products;
  return product?.tags ?? [];
}

function firstAvailableTextDate(values: Array<string | null | undefined>) {
  return values.map((value) => compactText(value)).find(Boolean) ?? "";
}

async function latestFreightHistoryBySku(
  supabase: NonNullable<ReturnType<typeof getSupabaseServiceClient>>,
  skus: string[],
  currentPoId: string,
) {
  if (!skus.length) {
    return new Map<string, {
      freightUnitCost: number;
      sourceDate: string;
      sourcePoId: string;
    }>();
  }

  const historyResult = await supabase
    .from("po_items")
    .select("id,po_id,sku,freight_unit_cost,created_at")
    .in("sku", skus)
    .neq("po_id", currentPoId)
    .gt("freight_unit_cost", 0)
    .order("created_at", { ascending: false })
    .limit(Math.max(100, skus.length * 20));

  if (historyResult.error) {
    logPoPortalQueryError("po_items margin freight history", historyResult.error);
    return new Map<string, {
      freightUnitCost: number;
      sourceDate: string;
      sourcePoId: string;
    }>();
  }

  const historyRows = (historyResult.data ?? []) as HistoricalFreightItemRow[];
  const itemIds = historyRows.map((row) => row.id).filter(Boolean);
  const poIds = Array.from(
    new Set(historyRows.map((row) => compactText(row.po_id)).filter(Boolean)),
  );

  const receiptResult =
    itemIds.length > 0
      ? await supabase
          .from("po_receipts")
          .select("po_item_id,actual_received_date,received_at")
          .in("po_item_id", itemIds)
      : { data: [], error: null };
  const receiptFallback =
    receiptResult.error && schemaColumnMiss(receiptResult.error.message) && itemIds.length > 0
      ? await supabase
          .from("po_receipts")
          .select("po_item_id,received_at")
          .in("po_item_id", itemIds)
      : receiptResult;
  if (receiptFallback.error) {
    logPoPortalQueryError("po_receipts margin freight history", receiptFallback.error);
  }

  const orderResult =
    poIds.length > 0
      ? await supabase
          .from("po_orders")
          .select("po_id,actual_received_date")
          .in("po_id", poIds)
      : { data: [], error: null };
  if (orderResult.error) {
    logPoPortalQueryError("po_orders margin freight history", orderResult.error);
  }

  const receiptDatesByItemId = new Map<string, { actual: string; received: string }>();
  for (const receipt of (receiptFallback.data ?? []) as HistoricalFreightReceiptRow[]) {
    const itemId = compactText(receipt.po_item_id);
    if (!itemId) {
      continue;
    }
    const current = receiptDatesByItemId.get(itemId) ?? { actual: "", received: "" };
    const actualDate = compactText(receipt.actual_received_date);
    const receivedAt = compactText(receipt.received_at);
    if (actualDate > current.actual) {
      current.actual = actualDate;
    }
    if (receivedAt > current.received) {
      current.received = receivedAt;
    }
    receiptDatesByItemId.set(itemId, current);
  }

  const orderDateByPoId = new Map(
    ((orderResult.data ?? []) as HistoricalFreightOrderRow[])
      .filter((row) => compactText(row.po_id))
      .map((row) => [compactText(row.po_id), compactText(row.actual_received_date)]),
  );
  const latestBySku = new Map<string, {
    freightUnitCost: number;
    rankDate: string;
    sourceDate: string;
    sourcePoId: string;
  }>();

  for (const row of historyRows) {
    const sku = compactText(row.sku);
    const freightUnitCost = numeric(row.freight_unit_cost);
    if (!sku || freightUnitCost <= 0) {
      continue;
    }
    const poId = compactText(row.po_id);
    const receiptDates = receiptDatesByItemId.get(row.id);
    const sourceDate = firstAvailableTextDate([
      receiptDates?.actual,
      receiptDates?.received,
      orderDateByPoId.get(poId),
      row.created_at,
    ]);
    const current = latestBySku.get(sku);
    if (!current || sourceDate > current.rankDate) {
      latestBySku.set(sku, {
        freightUnitCost,
        rankDate: sourceDate,
        sourceDate,
        sourcePoId: poId,
      });
    }
  }

  return new Map(
    Array.from(latestBySku.entries()).map(([sku, value]) => [
      sku,
      {
        freightUnitCost: value.freightUnitCost,
        sourceDate: value.sourceDate,
        sourcePoId: value.sourcePoId,
      },
    ]),
  );
}

function buildPoMarginRows(
  items: PortalItem[],
  salePriceBySku: Map<string, number>,
  freightHistoryBySku: Map<string, {
    freightUnitCost: number;
    sourceDate: string;
    sourcePoId: string;
  }>,
): PoMarginCheckRow[] {
  const grouped = new Map<string, {
    family: MatrixFamily;
    imageUrl: string | null;
    landedWeightedSum: number;
    productTitle: string;
    sectionLabel: string;
    size: string;
    totalQty: number;
    unitWeightedSum: number;
    variantTitle: string;
  }>();

  for (const item of items) {
    const sku = compactText(item.sku);
    if (!sku) {
      continue;
    }
    const family = matrixItemFamily(item);
    const sectionName = matrixSectionName(item);
    const qty = Math.max(0, numeric(item.qty));
    const current = grouped.get(sku) ?? {
      family,
      imageUrl: item.imageUrl ?? null,
      landedWeightedSum: 0,
      productTitle: matrixProductName(item) || item.productTitle || sku,
      sectionLabel: matrixSectionLabel(sectionName, family),
      size: matrixItemSize(item),
      totalQty: 0,
      unitWeightedSum: 0,
      variantTitle: item.variantTitle || "",
    };
    const unitCost = numeric(item.unitPrice);
    const landedUnitCost = numeric(item.landedUnitCost) || unitCost + numeric(item.freightUnitCost);
    current.totalQty += qty;
    current.unitWeightedSum += unitCost * qty;
    current.landedWeightedSum += landedUnitCost * qty;
    if (!current.productTitle && item.productTitle) {
      current.productTitle = item.productTitle;
    }
    if (!current.variantTitle && item.variantTitle) {
      current.variantTitle = item.variantTitle;
    }
    if (!current.imageUrl && item.imageUrl) {
      current.imageUrl = item.imageUrl;
    }
    grouped.set(sku, current);
  }

  return Array.from(grouped.entries())
    .map(([sku, row]) => {
      const freightHistory = freightHistoryBySku.get(sku);
      return {
        avgLandedUnitCost: row.totalQty > 0 ? row.landedWeightedSum / row.totalQty : 0,
        avgUnitCost: row.totalQty > 0 ? row.unitWeightedSum / row.totalQty : 0,
        family: row.family,
        imageUrl: row.imageUrl,
        latestFreightSourceDate: freightHistory?.sourceDate ?? "",
        latestFreightSourcePoId: freightHistory?.sourcePoId ?? "",
        latestFreightUnitAvg: freightHistory?.freightUnitCost ?? null,
        productTitle: row.productTitle || sku,
        sectionLabel: row.sectionLabel,
        size: row.size,
        shopifySalePrice: salePriceBySku.get(sku) ?? null,
        sku,
        totalQty: row.totalQty,
        variantTitle: row.variantTitle,
      } satisfies PoMarginCheckRow;
    })
    .sort((a, b) => a.productTitle.localeCompare(b.productTitle) || a.sku.localeCompare(b.sku));
}

function latestOnHandBySku(rows: InventorySnapshotRow[]) {
  const latestDateBySku = new Map<string, string>();
  const onHandBySku = new Map<string, number>();

  for (const row of rows) {
    const sku = row.sku?.trim();
    const snapshotDate = row.snapshot_date;
    if (!sku || !snapshotDate) {
      continue;
    }

    const latestDate = latestDateBySku.get(sku);
    if (!latestDate || snapshotDate > latestDate) {
      latestDateBySku.set(sku, snapshotDate);
      onHandBySku.set(sku, numeric(row.on_hand));
      continue;
    }

    if (snapshotDate === latestDate) {
      onHandBySku.set(sku, (onHandBySku.get(sku) ?? 0) + numeric(row.on_hand));
    }
  }

  return onHandBySku;
}

function mapSupabaseOrder(
  order: PoPortalOrderRow,
  orderLineItems: PortalItem[],
  paymentTotals?: { paidAmountThb: number; plannedAmountThb: number },
): PortalOrder {
  const headerPayload = poDetailHeaderPayload(order.source_payload);
  const statuses = Array.from(new Set(orderLineItems.map((item) => item.status)));
  const totalQty = orderLineItems.reduce((sum, item) => sum + item.qty, 0);
  const receivedQty = orderLineItems.reduce((sum, item) => sum + item.receivedQty, 0);
  const outstandingQty = orderLineItems.reduce((sum, item) => sum + item.outstandingQty, 0);

  return {
    poId: order.po_id ?? "",
    rqqId: order.rqq_id ?? "",
    poTitle: order.po_title ?? "",
    poDate: order.po_date ?? "",
    workStatus: order.work_status ?? "",
    cancelledAt: order.cancelled_at ?? "",
    closedAt: order.closed_at ?? "",
    requester: order.requester ?? "",
    owner: order.owner ?? "",
    supplierCode: order.supplier_code ?? "",
    supplierName: order.supplier_name_snapshot ?? order.supplier_code ?? "",
    currency: order.currency ?? "THB",
    poAmountForeign: numeric(order.po_amount_foreign),
    poAmountThb: numeric(order.po_amount_thb),
    freightTotal: numeric(order.freight_total),
    otherLandedCostTotal: numeric(order.other_landed_cost_total),
    landedCostNote: order.landed_cost_note ?? "",
    headerPurpose:
      compactText(order.header_purpose) ||
      payloadText(headerPayload, "headerPurpose"),
    quotationReference:
      compactText(order.quotation_reference) ||
      payloadText(headerPayload, "quotationReference"),
    supplierInvoiceNo:
      compactText(order.supplier_invoice_no) ||
      payloadText(headerPayload, "supplierInvoiceNo"),
    supplierDiscussionNote:
      compactText(order.supplier_discussion_note) ||
      payloadText(headerPayload, "supplierDiscussionNote"),
    vatMode: order.vat_mode ?? "",
    estimatedDeliveryDate:
      compactText(order.estimated_delivery_date) ||
      payloadText(headerPayload, "estimatedDeliveryDate"),
    estimatedArrivedDate:
      compactText(order.estimated_arrived_date) ||
      payloadText(headerPayload, "estimatedArrivedDate"),
    actualReceivedDate:
      compactText(order.actual_received_date) ||
      payloadText(headerPayload, "actualReceivedDate"),
    paymentTerms: order.payment_terms_snapshot ?? "",
    paidAmountThb: paymentTotals?.paidAmountThb ?? 0,
    plannedAmountThb: paymentTotals?.plannedAmountThb ?? 0,
    itemCount: orderLineItems.length,
    statuses: statuses.length > 0 ? statuses : [order.work_status ?? "unknown"],
    totalQty,
    receivedQty,
    outstandingQty,
  };
}

function mapPoOrderSummary(row: PoOrderSummaryRow) {
  const headerPayload = poDetailHeaderPayload(row.source_payload);
  const statuses = Array.isArray(row.statuses)
    ? row.statuses.filter(Boolean)
    : [row.work_status ?? "unknown"];

  return {
    poId: row.po_id ?? "",
    rqqId: row.rqq_id ?? "",
    poTitle: row.po_title ?? "",
    poDate: row.po_date ?? "",
    workStatus: row.work_status ?? "",
    cancelledAt: row.cancelled_at ?? "",
    closedAt: row.closed_at ?? "",
    requester: row.requester ?? "",
    owner: row.owner ?? "",
    supplierCode: row.supplier_code ?? "",
    supplierName: row.supplier_name_snapshot ?? row.supplier_code ?? "",
    currency: row.currency ?? "THB",
    poAmountForeign: numeric(row.po_amount_foreign),
    poAmountThb: numeric(row.po_amount_thb),
    freightTotal: numeric(row.freight_total),
    otherLandedCostTotal: numeric(row.other_landed_cost_total),
    landedCostNote: row.landed_cost_note ?? "",
    headerPurpose:
      compactText(row.header_purpose) ||
      payloadText(headerPayload, "headerPurpose"),
    quotationReference:
      compactText(row.quotation_reference) ||
      payloadText(headerPayload, "quotationReference"),
    supplierInvoiceNo:
      compactText(row.supplier_invoice_no) ||
      payloadText(headerPayload, "supplierInvoiceNo"),
    supplierDiscussionNote:
      compactText(row.supplier_discussion_note) ||
      payloadText(headerPayload, "supplierDiscussionNote"),
    vatMode: row.vat_mode ?? "",
    estimatedDeliveryDate:
      compactText(row.estimated_delivery_date) ||
      payloadText(headerPayload, "estimatedDeliveryDate"),
    estimatedArrivedDate:
      compactText(row.estimated_arrived_date) ||
      payloadText(headerPayload, "estimatedArrivedDate"),
    actualReceivedDate:
      compactText(row.actual_received_date) ||
      payloadText(headerPayload, "actualReceivedDate"),
    paymentTerms: row.payment_terms_snapshot ?? "",
    paidAmountThb: numeric(row.paid_amount_thb),
    plannedAmountThb: numeric(row.planned_amount_thb),
    itemCount: numeric(row.total_items),
    statuses: statuses.length ? statuses : [row.work_status ?? "unknown"],
    totalQty: numeric(row.total_qty),
    receivedQty: numeric(row.total_received_qty),
    outstandingQty: numeric(row.total_outstanding_qty),
    activeIncomingQty: numeric(row.active_incoming_qty),
    pendingApprovalQty: numeric(row.pending_approval_qty),
    activeLineCount: numeric(row.active_line_count),
    pendingLineCount: numeric(row.pending_line_count),
    updatedAt: row.updated_at ?? "",
  };
}

function mapIncomingEtaReconciliation(
  row: PoIncomingEtaReconciliationRow | null,
  fallback: {
    scheduledEtaQty: number;
    totalIncomingPipelineQty: number;
    unscheduledEtaQty: number;
  },
) {
  const hasRow = Boolean(row);
  const totalIncomingPipelineQty = hasRow
    ? numeric(row?.total_incoming_pipeline_qty)
    : fallback.totalIncomingPipelineQty;
  const scheduledEtaQty = hasRow
    ? numeric(row?.scheduled_eta_qty)
    : fallback.scheduledEtaQty;
  const unscheduledEtaQty = hasRow
    ? numeric(row?.unscheduled_eta_qty)
    : fallback.unscheduledEtaQty;

  return {
    pipelineItemCount: hasRow ? numeric(row?.pipeline_item_count) : 0,
    pipelinePoCount: hasRow ? numeric(row?.pipeline_po_count) : 0,
    scheduledEtaQty,
    scheduledItemCount: hasRow ? numeric(row?.scheduled_item_count) : 0,
    scheduledPoCount: hasRow ? numeric(row?.scheduled_po_count) : 0,
    totalIncomingPipelineQty,
    unscheduledEtaQty,
    unscheduledItemCount: hasRow ? numeric(row?.unscheduled_item_count) : 0,
    unscheduledPoCount: hasRow ? numeric(row?.unscheduled_po_count) : 0,
    updatedAt: row?.updated_at ?? "",
  };
}

function mapIncomingEtaDailyRow(row: PoIncomingEtaDailyRow) {
  return {
    etaDate: row.eta_date ?? "",
    itemCount: numeric(row.item_count),
    poCount: numeric(row.po_count),
    supplierCode: row.supplier_code ?? "",
    supplierName: row.supplier_name ?? row.supplier_code ?? "Unknown supplier",
    tooltipItems: Array.isArray(row.detail_payload)
      ? row.detail_payload
          .map((item) => objectValue(item))
          .map((item) => ({
            incomingQty: numeric(item.incoming_qty as number | string | null | undefined),
            orderedQty: numeric(item.ordered_qty as number | string | null | undefined),
            receivedQty: numeric(item.received_qty as number | string | null | undefined),
            etaSource: typeof item.eta_source === "string" ? item.eta_source : "",
            headerPurpose:
              typeof item.header_purpose === "string"
                ? item.header_purpose
                : "",
            latestSupplierComment:
              typeof item.latest_supplier_comment === "string"
                ? item.latest_supplier_comment
                : "",
            lineStatus: typeof item.line_status === "string" ? item.line_status : "",
            poDetailHref:
              typeof item.po_detail_href === "string"
                ? item.po_detail_href
                : "",
            poId: typeof item.po_id === "string" ? item.po_id : "",
            poReference:
              typeof item.po_reference === "string"
                ? item.po_reference
                : typeof item.po_id === "string"
                  ? item.po_id
                  : "",
            poStatus: typeof item.po_status === "string" ? item.po_status : "",
            poItemId: typeof item.po_item_id === "string" ? item.po_item_id : "",
            productName: typeof item.product_name === "string" ? item.product_name : "",
            productTitle: "",
            quotationReference: "",
            supplierInvoiceNo: "",
            dateReceived: "",
            payment1PaidDate: "",
            imageUrl: "",
            sku: typeof item.sku === "string" ? item.sku : "",
            tags: [] as string[],
            variantTitle: "",
          }))
      : [],
    totalIncomingQty: numeric(row.total_incoming_qty),
  };
}

function mapIncomingReceivedHistoryRow(row: PoIncomingReceivedHistoryRow) {
  const payload = objectValue(row.source_payload);
  const headerPayload = poDetailHeaderPayload(row.source_payload);
  const receivedQty = numeric(row.total_received_qty);
  const totalQty = numeric(row.total_qty);
  const balanceQty = Math.max(numeric(row.total_outstanding_qty), 0);

  return {
    activeIncomingQty: numeric(row.active_incoming_qty),
    balanceQty,
    dateReceived:
      compactText(row.actual_received_date) ||
      payloadText(headerPayload, "actualReceivedDate"),
    etaDate:
      compactText(row.estimated_arrived_date) ||
      payloadText(headerPayload, "estimatedArrivedDate") ||
      compactText(row.estimated_delivery_date) ||
      payloadText(headerPayload, "estimatedDeliveryDate") ||
      compactText(row.po_date),
    headerPurpose:
      payloadText(headerPayload, "headerPurpose") ||
      payloadText(payload, "headerPurpose"),
    lineCount: numeric(row.total_items),
    poDetailHref: row.po_id ? `/po/${row.po_id}` : "/po",
    poId: row.po_id ?? "",
    payment1PaidDate: "",
    poReference:
      compactText(row.quotation_reference) ||
      compactText(row.supplier_invoice_no) ||
      compactText(row.rqq_id) ||
      compactText(row.po_title) ||
      compactText(row.po_id),
    quotationReference:
      compactText(row.quotation_reference) ||
      payloadText(headerPayload, "quotationReference") ||
      payloadText(payload, "quotationReference"),
    receivedQty,
    supplierCode: row.supplier_code ?? "",
    supplierInvoiceNo:
      compactText(row.supplier_invoice_no) ||
      payloadText(headerPayload, "supplierInvoiceNo") ||
      payloadText(payload, "supplierInvoiceNo"),
    supplierName:
      compactText(row.supplier_name_snapshot) ||
      compactText(row.supplier_code) ||
      "Unknown supplier",
    totalQty,
    workStatus: row.work_status ?? "",
  };
}

function mapPaymentTimelineEventRow(row: PoPaymentTimelineEventRow) {
  return {
    amountOriginal: numeric(row.amount_original),
    amountThb: numeric(row.amount_thb),
    currency: row.currency ?? "THB",
    eventDate: row.event_date ?? "",
    exchangeRate: numeric(row.exchange_rate),
    latestSupplierComment: row.latest_supplier_comment ?? "",
    paymentId: row.payment_id ?? "",
    paymentLabel: row.payment_label ?? row.payment_id ?? "",
    paymentStatus: row.payment_status ?? "",
    paymentType: row.payment_type ?? "",
    poDetailHref: row.po_detail_href ?? (row.po_id ? `/po/${row.po_id}` : "/po"),
    poId: row.po_id ?? "",
    poReference: row.po_reference ?? row.po_id ?? "",
    quotationReference: "",
    series: row.series === "planned" ? "planned" : "paid",
    supplierCode: row.supplier_code ?? "",
    supplierInvoiceNo: "",
    supplierName: row.supplier_name ?? row.supplier_code ?? "Unknown supplier",
  };
}

function mapIncomingEtaUnscheduledRow(row: PoIncomingEtaUnscheduledRow) {
  return {
    etaDate: row.eta_date ?? "",
    etaSource: row.eta_source ?? "missing",
    headerPurpose: "",
    incomingQty: numeric(row.incoming_qty),
    latestSupplierComment: row.latest_supplier_comment ?? "",
    lineStatus: row.line_status ?? "",
    poDetailHref: row.po_detail_href ?? (row.po_id ? `/po/${row.po_id}` : "/po"),
    poId: row.po_id ?? "",
    poReference: row.po_reference ?? row.po_id ?? "",
    poStatus: row.po_status ?? "",
    productName: row.product_name ?? row.sku ?? "",
    quotationReference: "",
    sku: row.sku ?? "",
    supplierCode: row.supplier_code ?? "",
    supplierInvoiceNo: "",
    supplierName: row.supplier_name ?? row.supplier_code ?? "Unknown supplier",
  };
}

function collectChartPoIds(
  etaDailyRows: ReturnType<typeof mapIncomingEtaDailyRow>[],
  etaUnscheduledRows: ReturnType<typeof mapIncomingEtaUnscheduledRow>[],
  paymentTimelineRows: ReturnType<typeof mapPaymentTimelineEventRow>[],
  receivedHistoryRows: ReturnType<typeof mapIncomingReceivedHistoryRow>[] = [],
) {
  return Array.from(
    new Set(
      [
        ...etaDailyRows.flatMap((row) => row.tooltipItems.map((item) => item.poId)),
        ...etaUnscheduledRows.map((row) => row.poId),
        ...paymentTimelineRows.map((row) => row.poId),
        ...receivedHistoryRows.map((row) => row.poId),
      ].filter(Boolean),
    ),
  );
}

function collectIncomingPoItemIds(
  etaDailyRows: ReturnType<typeof mapIncomingEtaDailyRow>[],
) {
  return Array.from(
    new Set(
      etaDailyRows
        .flatMap((row) => row.tooltipItems.map((item) => item.poItemId))
        .filter(Boolean),
    ),
  );
}

async function fetchReceiptItemRows(
  supabase: NonNullable<ReturnType<typeof getSupabaseServiceClient>>,
  activeIncomingPoItemIds: string[],
  receivedHistoryPoIds: string[],
) {
  const rows = new Map<string, PoReceiptItemRow>();

  for (let index = 0; index < activeIncomingPoItemIds.length; index += RECEIPT_LOOKUP_BATCH_SIZE) {
    const batch = activeIncomingPoItemIds.slice(index, index + RECEIPT_LOOKUP_BATCH_SIZE);
    const { data, error } = await supabase
      .from("po_items")
      .select("id,po_id")
      .in("id", batch);

    if (error) {
      return { data: Array.from(rows.values()), error };
    }

    for (const row of (data ?? []) as PoReceiptItemRow[]) {
      if (row.id) {
        rows.set(row.id, row);
      }
    }
  }

  for (let index = 0; index < receivedHistoryPoIds.length; index += PO_LOOKUP_BATCH_SIZE) {
    const batch = receivedHistoryPoIds.slice(index, index + PO_LOOKUP_BATCH_SIZE);
    let from = 0;

    for (;;) {
      const { data, error } = await supabase
        .from("po_items")
        .select("id,po_id")
        .in("po_id", batch)
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        return { data: Array.from(rows.values()), error };
      }

      const batchRows = (data ?? []) as PoReceiptItemRow[];
      for (const row of batchRows) {
        if (row.id) {
          rows.set(row.id, row);
        }
      }

      if (batchRows.length < PAGE_SIZE) {
        break;
      }
      from += PAGE_SIZE;
    }
  }

  return { data: Array.from(rows.values()), error: null };
}

async function fetchPaymentSequenceRows(
  supabase: NonNullable<ReturnType<typeof getSupabaseServiceClient>>,
  poIds: string[],
) {
  const rows: PoPaymentSequenceRow[] = [];

  for (let index = 0; index < poIds.length; index += PO_LOOKUP_BATCH_SIZE) {
    const batch = poIds.slice(index, index + PO_LOOKUP_BATCH_SIZE);
    const { data, error } = await supabase
      .from("po_payments")
      .select("id,po_id,payment_date,created_at")
      .in("po_id", batch)
      .order("created_at", { ascending: true, nullsFirst: false })
      .order("id", { ascending: true });

    if (error) {
      return { data: rows, error };
    }

    rows.push(...((data ?? []) as unknown as PoPaymentSequenceRow[]));
  }

  return { data: rows, error: null };
}

function latestReceiptMaps(
  receiptRows: PoReceiptRow[],
  itemRows: PoReceiptItemRow[] = [],
) {
  const poIdByItemId = new Map(
    itemRows
      .filter((item) => item.id)
      .map((item) => [item.id, item.po_id ?? ""]),
  );
  const byItemId = new Map<string, string>();
  const byPoId = new Map<string, string>();
  const savedByItemId = new Map<string, string>();
  const savedByPoId = new Map<string, string>();

  for (const receipt of receiptRows) {
    const actualReceivedAt = compactText(receipt.actual_received_date);
    const savedReceivedAt = compactText(receipt.received_at).slice(0, 10);
    const itemId = compactText(receipt.po_item_id);
    if (!itemId) {
      continue;
    }

    if (actualReceivedAt && (!byItemId.get(itemId) || actualReceivedAt > (byItemId.get(itemId) ?? ""))) {
      byItemId.set(itemId, actualReceivedAt);
    }

    const poId = poIdByItemId.get(itemId) ?? "";
    if (poId && actualReceivedAt && (!byPoId.get(poId) || actualReceivedAt > (byPoId.get(poId) ?? ""))) {
      byPoId.set(poId, actualReceivedAt);
    }

    if (savedReceivedAt && (!savedByItemId.get(itemId) || savedReceivedAt > (savedByItemId.get(itemId) ?? ""))) {
      savedByItemId.set(itemId, savedReceivedAt);
    }
    if (poId && savedReceivedAt && (!savedByPoId.get(poId) || savedReceivedAt > (savedByPoId.get(poId) ?? ""))) {
      savedByPoId.set(poId, savedReceivedAt);
    }
  }

  return { byItemId, byPoId, savedByItemId, savedByPoId };
}

function receivedHistoryFromReceipts(
  baseRows: ReturnType<typeof mapIncomingReceivedHistoryRow>[],
  receiptRows: PoReceiptRow[],
  itemRows: PoReceiptItemRow[],
) {
  const baseByPoId = new Map(baseRows.map((row) => [row.poId, row]));
  const itemPoId = new Map(itemRows.map((row) => [row.id, row.po_id ?? ""]));
  const groups = new Map<string, ReturnType<typeof mapIncomingReceivedHistoryRow>>();
  const poIdsWithReceipts = new Set<string>();

  for (const receipt of receiptRows) {
    const itemId = compactText(receipt.po_item_id);
    const poId = itemPoId.get(itemId) ?? "";
    const base = baseByPoId.get(poId);
    if (!poId || !base) {
      continue;
    }

    const dateReceived =
      compactText(receipt.actual_received_date) ||
      base.dateReceived ||
      compactText(receipt.received_at).slice(0, 10);
    if (!dateReceived) {
      continue;
    }

    poIdsWithReceipts.add(poId);
    const key = `${poId}-${dateReceived}`;
    const current = groups.get(key) ?? {
      ...base,
      activeIncomingQty: 0,
      balanceQty: Math.max(base.totalQty - base.receivedQty, 0),
      dateReceived,
      lineCount: 0,
      receivedQty: 0,
    };

    current.lineCount += 1;
    current.receivedQty += numeric(receipt.received_qty);
    groups.set(key, current);
  }

  for (const base of baseRows) {
    if (!poIdsWithReceipts.has(base.poId) && base.dateReceived && base.receivedQty > 0) {
      groups.set(`${base.poId}-${base.dateReceived}`, base);
    }
  }

  return Array.from(groups.values()).sort((a, b) =>
    b.dateReceived.localeCompare(a.dateReceived) || a.poReference.localeCompare(b.poReference),
  );
}

function chartPoDetailMap(rows: PoChartPoDetailRow[]) {
  return new Map(
    rows
      .filter((row) => row.po_id)
      .map((row) => {
        const payload = objectValue(row.source_payload);
        const headerPayload = poDetailHeaderPayload(row.source_payload);

        return [
          row.po_id as string,
          {
            actualReceivedDate:
              compactText(row.actual_received_date) ||
              payloadText(headerPayload, "actualReceivedDate") ||
              payloadText(payload, "actualReceivedDate"),
            quotationReference:
              compactText(row.quotation_reference) ||
              payloadText(headerPayload, "quotationReference") ||
              payloadText(payload, "quotationReference"),
            supplierInvoiceNo:
              compactText(row.supplier_invoice_no) ||
              payloadText(headerPayload, "supplierInvoiceNo") ||
              payloadText(payload, "supplierInvoiceNo"),
            headerPurpose:
              compactText(row.header_purpose) ||
              payloadText(headerPayload, "headerPurpose") ||
              payloadText(payload, "headerPurpose"),
          },
        ];
      }),
  );
}

function payment1PaidDateMap(rows: PoPaymentSequenceRow[]) {
  const paymentsByPoId = new Map<string, PoPaymentSequenceRow[]>();

  for (const row of rows) {
    const poId = compactText(row.po_id);
    if (!poId) {
      continue;
    }

    paymentsByPoId.set(poId, [...(paymentsByPoId.get(poId) ?? []), row]);
  }

  return new Map(
    Array.from(paymentsByPoId.entries()).map(([poId, payments]) => [
      poId,
      firstPaymentByStableSequence(payments)?.payment_date ?? "",
    ]),
  );
}

function chartSkuDetailMap(rows: ProductVariantImageRow[]) {
  return new Map(
    rows
      .filter((row) => row.sku)
      .map((row) => {
        const product = firstProduct(row);
        return [
          row.sku as string,
          {
            imageUrl: productImageUrl(row) ?? "",
            productTitle: compactText(product?.product_title),
            tags: product?.tags ?? [],
            variantTitle: compactText(row.variant_title),
          },
        ];
      }),
  );
}

function enrichChartDetails<
  T extends {
    incomingEta: {
      daily: ReturnType<typeof mapIncomingEtaDailyRow>[];
      receivedHistory?: ReturnType<typeof mapIncomingReceivedHistoryRow>[];
      unscheduled: ReturnType<typeof mapIncomingEtaUnscheduledRow>[];
    };
    paymentTimeline: ReturnType<typeof mapPaymentTimelineEventRow>[];
  },
>(
  data: T,
  details: Map<
    string,
    {
      actualReceivedDate: string;
      headerPurpose: string;
      quotationReference: string;
      supplierInvoiceNo: string;
    }
  >,
) {
  return {
    ...data,
    incomingEta: {
      ...data.incomingEta,
      daily: data.incomingEta.daily.map((row) => ({
        ...row,
        tooltipItems: row.tooltipItems.map((item) => ({
          ...item,
          headerPurpose: details.get(item.poId)?.headerPurpose ?? "",
          quotationReference: details.get(item.poId)?.quotationReference ?? "",
          supplierInvoiceNo: details.get(item.poId)?.supplierInvoiceNo ?? "",
          dateReceived: details.get(item.poId)?.actualReceivedDate ?? "",
        })),
      })),
      receivedHistory: data.incomingEta.receivedHistory?.map((row) => ({
        ...row,
        dateReceived: row.dateReceived || details.get(row.poId)?.actualReceivedDate || "",
        headerPurpose: row.headerPurpose || details.get(row.poId)?.headerPurpose || "",
        quotationReference: row.quotationReference || details.get(row.poId)?.quotationReference || "",
        supplierInvoiceNo: row.supplierInvoiceNo || details.get(row.poId)?.supplierInvoiceNo || "",
      })),
      unscheduled: data.incomingEta.unscheduled.map((row) => ({
        ...row,
        headerPurpose: details.get(row.poId)?.headerPurpose ?? "",
        quotationReference: details.get(row.poId)?.quotationReference ?? "",
        supplierInvoiceNo: details.get(row.poId)?.supplierInvoiceNo ?? "",
      })),
    },
    paymentTimeline: data.paymentTimeline.map((row) => ({
      ...row,
      headerPurpose: details.get(row.poId)?.headerPurpose ?? "",
      quotationReference: details.get(row.poId)?.quotationReference ?? "",
      supplierInvoiceNo: details.get(row.poId)?.supplierInvoiceNo ?? "",
    })),
  };
}

function enrichIncomingProductDetails<
  T extends {
    incomingEta: {
      daily: ReturnType<typeof mapIncomingEtaDailyRow>[];
    };
  },
>(
  data: T,
  details: Map<
    string,
    {
      imageUrl: string;
      productTitle: string;
      tags: string[];
      variantTitle: string;
    }
  >,
) {
  return {
    ...data,
    incomingEta: {
      ...data.incomingEta,
      daily: data.incomingEta.daily.map((row) => ({
        ...row,
        tooltipItems: row.tooltipItems.map((item) => {
          const skuDetails = details.get(item.sku);
          return {
            ...item,
            imageUrl: skuDetails?.imageUrl ?? "",
            productTitle: skuDetails?.productTitle ?? "",
            tags: skuDetails?.tags ?? [],
            variantTitle: skuDetails?.variantTitle ?? "",
          };
        }),
      })),
    },
  };
}

function enrichIncomingPaymentDates<
  T extends {
    incomingEta: {
      daily: ReturnType<typeof mapIncomingEtaDailyRow>[];
      receivedHistory?: ReturnType<typeof mapIncomingReceivedHistoryRow>[];
    };
  },
>(
  data: T,
  payment1PaidDateByPoId: Map<string, string>,
) {
  return {
    ...data,
    incomingEta: {
      ...data.incomingEta,
      daily: data.incomingEta.daily.map((row) => ({
        ...row,
        tooltipItems: row.tooltipItems.map((item) => ({
          ...item,
          payment1PaidDate: payment1PaidDateByPoId.get(item.poId) ?? "",
        })),
      })),
      receivedHistory: data.incomingEta.receivedHistory?.map((row) => ({
        ...row,
        payment1PaidDate: payment1PaidDateByPoId.get(row.poId) ?? "",
      })),
    },
  };
}

function enrichIncomingReceiptDates<
  T extends {
    incomingEta: {
      daily: ReturnType<typeof mapIncomingEtaDailyRow>[];
      receivedHistory?: ReturnType<typeof mapIncomingReceivedHistoryRow>[];
    };
  },
>(
  data: T,
  receiptDates: {
    byItemId: Map<string, string>;
    byPoId: Map<string, string>;
    savedByItemId: Map<string, string>;
    savedByPoId: Map<string, string>;
  },
) {
  return {
    ...data,
    incomingEta: {
      ...data.incomingEta,
      daily: data.incomingEta.daily.map((row) => ({
        ...row,
        tooltipItems: row.tooltipItems.map((item) => ({
          ...item,
          dateReceived:
            receiptDates.byItemId.get(item.poItemId) ||
            item.dateReceived ||
            receiptDates.byPoId.get(item.poId) ||
            receiptDates.savedByItemId.get(item.poItemId) ||
            receiptDates.savedByPoId.get(item.poId) ||
            "",
        })),
      })),
      receivedHistory: data.incomingEta.receivedHistory?.map((row) => ({
        ...row,
        dateReceived:
          receiptDates.byPoId.get(row.poId) ||
          row.dateReceived ||
          receiptDates.savedByPoId.get(row.poId) ||
          "",
      })),
    },
  };
}

function summarizePoPortalData(
  suppliers: PoPortalSupplierOption[],
  orders: PortalOrder[],
  items: PortalItem[],
  source: "appsheet-fallback" | "supabase",
  catalogItems: PoCatalogItemOption[] = [],
) {
  const itemByPoId = new Map<string, PortalItem[]>();
  for (const item of items) {
    itemByPoId.set(item.poId, [...(itemByPoId.get(item.poId) ?? []), item]);
  }

  const statusMap = new Map<
    string,
    {
      status: string;
      lineCount: number;
      poCount: Set<string>;
      outstandingQty: number;
    }
  >();

  for (const item of items) {
    const status = statusLabel(item.status);
    const current =
      statusMap.get(status) ??
      {
        status,
        lineCount: 0,
        poCount: new Set<string>(),
        outstandingQty: 0,
      };

    current.lineCount += 1;
    current.poCount.add(item.poId);
    current.outstandingQty += item.outstandingQty;
    statusMap.set(status, current);
  }

  const enrichedOrders = orders.map((order) => {
    const orderLineItems = itemByPoId.get(order.poId) ?? [];
    return {
      ...order,
      activeIncomingQty: activeIncomingQty(orderLineItems, order),
      pendingApprovalQty: pendingApprovalQty(orderLineItems, order),
      activeLineCount: orderLineItems.filter((item) =>
        isActiveIncomingLine(item, order),
      ).length,
      pendingLineCount: orderLineItems.filter((item) =>
        isPendingApprovalLine(item, order),
      ).length,
    };
  });

  const openOrders = enrichedOrders.filter((order) => !isOrderClosedOrCancelled(order));
  const activeOrders = enrichedOrders
    .filter(
      (order) =>
        !isOrderClosedOrCancelled(order) &&
        (order.activeIncomingQty > 0 ||
          order.pendingApprovalQty > 0 ||
          WORKBENCH_ORDER_STATUSES.has(normalizedStatus(order.workStatus))),
    )
    .sort(
      (a, b) =>
        b.activeIncomingQty - a.activeIncomingQty ||
        b.pendingApprovalQty - a.pendingApprovalQty,
    );
  const workbenchOrders = enrichedOrders
    .filter(
      (order) =>
        order.activeIncomingQty > 0 ||
        order.pendingApprovalQty > 0 ||
        WORKBENCH_ORDER_STATUSES.has(normalizedStatus(order.workStatus)) ||
        isClosedOrderStatus(order.workStatus),
    )
    .sort(
      (a, b) =>
        b.activeIncomingQty - a.activeIncomingQty ||
        b.pendingApprovalQty - a.pendingApprovalQty,
    );

  const openItems = items
    .filter(
      (item) =>
        item.outstandingQty > 0 &&
        !["closed", "cancelled", "canceled"].includes(normalizedStatus(item.status)),
    )
    .sort((a, b) => b.outstandingQty - a.outstandingQty)
    .slice(0, 20);

  const statusSummaries = Array.from(statusMap.values())
    .map((row) => ({
      status: row.status,
      lineCount: row.lineCount,
      poCount: row.poCount.size,
      outstandingQty: row.outstandingQty,
    }))
    .sort((a, b) => b.outstandingQty - a.outstandingQty || b.lineCount - a.lineCount);

  const supplierSummaryMap = new Map<
    string,
    {
      supplierCode: string;
      supplierName: string;
      paymentTerms: Set<string>;
      poCount: Set<string>;
      lineCount: number;
      incomingQty: number;
      totalQty: number;
      outstandingQty: number;
      paidAmountThb: number;
      plannedAmountThb: number;
    }
  >();

  const pipelineOrders = openOrders.filter(
    (order) =>
      order.activeIncomingQty > 0 ||
      order.pendingApprovalQty > 0 ||
      WORKBENCH_ORDER_STATUSES.has(normalizedStatus(order.workStatus)),
  );

  for (const order of pipelineOrders) {
    const supplierKey =
      order.supplierCode.trim().toLowerCase() ||
      order.supplierName.trim().toLowerCase() ||
      "unknown";
    const current =
      supplierSummaryMap.get(supplierKey) ??
      {
        supplierCode: order.supplierCode,
        supplierName: order.supplierName || order.supplierCode || "Unknown supplier",
        paymentTerms: new Set<string>(),
        poCount: new Set<string>(),
        lineCount: 0,
        incomingQty: 0,
        totalQty: 0,
        outstandingQty: 0,
        paidAmountThb: 0,
        plannedAmountThb: 0,
      };

    if (order.paymentTerms.trim()) {
      current.paymentTerms.add(order.paymentTerms.trim());
    }
    current.poCount.add(order.poId);
    current.lineCount += order.itemCount;
    current.incomingQty += order.activeIncomingQty;
    current.totalQty += order.activeIncomingQty + order.pendingApprovalQty;
    current.outstandingQty += order.activeIncomingQty + order.pendingApprovalQty;
    current.paidAmountThb += order.paidAmountThb;
    current.plannedAmountThb += order.plannedAmountThb;
    supplierSummaryMap.set(supplierKey, current);
  }

  const supplierSummaries = Array.from(supplierSummaryMap.values())
    .map((row) => ({
      supplierCode: row.supplierCode,
      supplierName: row.supplierName,
      paymentTerms: Array.from(row.paymentTerms).join(" | ") || "-",
      poCount: row.poCount.size,
      lineCount: row.lineCount,
      incomingQty: row.incomingQty,
      totalQty: row.totalQty,
      outstandingQty: row.outstandingQty,
      paidAmountThb: row.paidAmountThb,
      plannedAmountThb: row.plannedAmountThb,
    }))
    .sort(
      (a, b) =>
        b.incomingQty - a.incomingQty ||
        b.outstandingQty - a.outstandingQty ||
        b.totalQty - a.totalQty ||
        a.supplierName.localeCompare(b.supplierName),
    );

  const activeIncomingTotal = enrichedOrders.reduce(
    (sum, order) => sum + order.activeIncomingQty,
    0,
  );
  const pendingApprovalTotal = enrichedOrders.reduce(
    (sum, order) => sum + order.pendingApprovalQty,
    0,
  );
  const receivedTotal = orders.reduce(
    (sum, order) => sum + order.receivedQty,
    0,
  );
  const orderedTotal = orders.reduce((sum, order) => sum + order.totalQty, 0);
  const openPaidAmountThb = openOrders.reduce(
    (sum, order) => sum + order.paidAmountThb,
    0,
  );
  const plannedAmountThb = orders.reduce(
    (sum, order) => sum + order.plannedAmountThb,
    0,
  );

  return {
    metrics: {
      poCount: orders.length,
      supplierCount: suppliers.length,
      itemCount: items.length,
      activeIncomingTotal,
      pendingApprovalTotal,
      orderedTotal,
      receivedTotal,
      receivedRate: orderedTotal > 0 ? receivedTotal / orderedTotal : 0,
      openPaidAmountThb,
      plannedAmountThb,
    },
    source,
    suppliers,
    catalogItems,
    statusSummaries,
    supplierSummaries,
    incomingEta: {
      daily: [] as Array<{
        etaDate: string;
        itemCount: number;
        poCount: number;
        supplierCode: string;
        supplierName: string;
        tooltipItems: Array<{
          etaSource: string;
          headerPurpose: string;
          imageUrl: string;
          incomingQty: number;
          latestSupplierComment: string;
          lineStatus: string;
          poDetailHref: string;
          poId: string;
          poItemId: string;
          poReference: string;
          poStatus: string;
          productName: string;
          productTitle: string;
          quotationReference: string;
          orderedQty: number;
          payment1PaidDate: string;
          receivedQty: number;
          dateReceived: string;
          sku: string;
          supplierInvoiceNo: string;
          tags: string[];
          variantTitle: string;
        }>;
        totalIncomingQty: number;
      }>,
      receivedHistory: [] as Array<{
        activeIncomingQty: number;
        balanceQty: number;
        dateReceived: string;
        etaDate: string;
        headerPurpose: string;
        lineCount: number;
        poDetailHref: string;
        poId: string;
        payment1PaidDate: string;
        poReference: string;
        quotationReference: string;
        receivedQty: number;
        supplierCode: string;
        supplierInvoiceNo: string;
        supplierName: string;
        totalQty: number;
        workStatus: string;
      }>,
      reconciliation: {
        pipelineItemCount: 0,
        pipelinePoCount: 0,
        scheduledEtaQty: 0,
        scheduledItemCount: 0,
        scheduledPoCount: 0,
        totalIncomingPipelineQty: activeIncomingTotal,
        unscheduledEtaQty: 0,
        unscheduledItemCount: 0,
        unscheduledPoCount: 0,
        updatedAt: "",
      },
      unscheduled: [] as Array<{
        incomingQty: number;
        etaDate: string;
        etaSource: string;
        latestSupplierComment: string;
        lineStatus: string;
        poDetailHref: string;
        poId: string;
        poReference: string;
        poStatus: string;
        productName: string;
        headerPurpose: string;
        quotationReference: string;
        sku: string;
        supplierCode: string;
        supplierInvoiceNo: string;
        supplierName: string;
      }>,
    },
    paymentTimeline: [] as Array<{
      amountThb: number;
      currency: string;
      eventDate: string;
      latestSupplierComment: string;
      paymentId: string;
      paymentLabel: string;
      paymentStatus: string;
      paymentType: string;
      poDetailHref: string;
      poId: string;
      poReference: string;
      quotationReference: string;
      series: "paid" | "planned";
      supplierCode: string;
      supplierInvoiceNo: string;
      supplierName: string;
    }>,
    activeOrders: activeOrders.slice(0, 20),
    workbenchOrders,
    openItems,
    pagination: {
      hasNextPage: false,
      hasPreviousPage: false,
      page: 1,
      pageCount: 1,
      pageSize: workbenchOrders.length,
      total: workbenchOrders.length,
    },
  };
}

function getAppSheetPoPortalData() {
  return summarizePoPortalData(
    poPortalSuppliers.map((supplier) => ({
      supplierCode: supplier.supplierCode,
      supplierName: supplier.supplierName,
      currency: supplier.currency,
      paymentTerms: supplier.paymentTerms,
    })),
    poPortalOrders.map((order) => ({
      ...order,
      freightTotal: 0,
      landedCostNote: "",
      otherLandedCostTotal: 0,
      paidAmountThb: 0,
      plannedAmountThb: 0,
      headerPurpose: "",
      quotationReference: "",
      actualReceivedDate: "",
      cancelledAt: "",
      closedAt: "",
      estimatedArrivedDate: "",
      estimatedDeliveryDate: "",
      supplierDiscussionNote: "",
      supplierInvoiceNo: "",
      vatMode: "",
    })),
    poPortalItems.map((item) => ({
      ...item,
      freightUnitCost: 0,
      landedUnitCost: item.unitPrice,
    })),
    "appsheet-fallback",
    [],
  );
}

async function fetchAllRows<T>(
  table: string,
  columns: string,
  orderColumn?: string,
) {
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return null;
  }

  const rows: T[] = [];
  let from = 0;

  for (;;) {
    let query = supabase.from(table).select(columns).range(from, from + PAGE_SIZE - 1);
    if (orderColumn) {
      query = query.order(orderColumn, { ascending: true });
    }

    const { data, error } = await query;
    if (error) {
      return null;
    }

    const batch = (data ?? []) as T[];
    rows.push(...batch);

    if (batch.length < PAGE_SIZE) {
      return rows;
    }

    from += PAGE_SIZE;
  }
}

async function getSupabasePoPortalData(options: PoPortalListOptions = {}) {
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return null;
  }

  const pageSize = Math.min(
    MAX_LIST_PAGE_SIZE,
    Math.max(1, Math.round(options.pageSize ?? DEFAULT_LIST_PAGE_SIZE)),
  );
  const page = Math.max(1, Math.round(options.page ?? 1));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const q = options.q?.trim() ?? "";
  const includeReceivedHistory = options.includeReceivedHistory ?? true;
  const selectedStatuses = (options.status ?? [])
    .map((status) => normalizedStatus(status))
    .filter((status) => status && status !== "all");
  const selectedSuppliers = Array.from(
    new Set((options.supplier ?? []).map((supplier) => supplier.trim()).filter(Boolean)),
  );
  const sort = options.sort ?? "date";
  const dir = options.dir === "asc" ? "asc" : "desc";
  const sortColumn =
    sort === "po"
      ? "po_id"
      : sort === "supplier"
        ? "supplier_name_snapshot"
        : sort === "status"
          ? "work_status"
          : sort === "lines"
            ? "total_items"
            : sort === "incoming"
              ? "total_qty"
              : sort === "pending"
                ? "pending_approval_qty"
                : sort === "amount"
                  ? "po_amount_thb"
                  : sort === "updated"
                    ? "updated_at"
                    : "po_date";

  let orderQuery = supabase
    .from("po_order_summary")
    .select(
      [
        "po_id",
        "rqq_id",
        "po_title",
        "po_date",
        "actual_received_date",
        "cancelled_at",
        "closed_at",
        "estimated_arrived_date",
        "estimated_delivery_date",
        "work_status",
        "requester",
        "owner",
        "supplier_code",
        "supplier_name_snapshot",
        "currency",
        "po_amount_foreign",
        "po_amount_thb",
        "freight_total",
        "other_landed_cost_total",
        "landed_cost_note",
        "quotation_reference",
        "supplier_invoice_no",
        "supplier_discussion_note",
        "vat_mode",
        "payment_terms_snapshot",
        "source_payload",
        "updated_at",
        "total_items",
        "total_qty",
        "total_received_qty",
        "total_outstanding_qty",
        "active_incoming_qty",
        "pending_approval_qty",
        "active_line_count",
        "pending_line_count",
        "statuses",
        "paid_amount_thb",
        "planned_amount_thb",
      ].join(","),
      { count: "exact" },
    );

  if (selectedStatuses.length > 0) {
    orderQuery = orderQuery.in("work_status", selectedStatuses);
  } else {
    orderQuery = orderQuery
      .is("closed_at", null)
      .is("cancelled_at", null)
      .not("work_status", "in", "(closed,cancelled,canceled)");
  }

  if (selectedSuppliers.length > 0) {
    orderQuery = orderQuery.in("supplier_code", selectedSuppliers);
  }

  if (q) {
    const escaped = q.replace(/[%_]/g, "\\$&");
    orderQuery = orderQuery.or(
      [
        `po_id.ilike.%${escaped}%`,
        `po_title.ilike.%${escaped}%`,
        `supplier_name_snapshot.ilike.%${escaped}%`,
        `supplier_code.ilike.%${escaped}%`,
        `quotation_reference.ilike.%${escaped}%`,
        `supplier_invoice_no.ilike.%${escaped}%`,
        `supplier_discussion_note.ilike.%${escaped}%`,
        `owner.ilike.%${escaped}%`,
        `requester.ilike.%${escaped}%`,
      ].join(","),
    );
  }

  const [
    suppliers,
    metricsResult,
    supplierSummaryResult,
    etaReconciliationResult,
    etaDailyResult,
    etaUnscheduledResult,
    incomingReceivedHistoryResult,
    paymentTimelineResult,
    ordersResult,
  ] = await Promise.all([
    fetchAllRows<PoPortalSupplierRow>(
      "po_suppliers",
      "supplier_code,supplier_name,currency,payment_terms",
      "supplier_code",
    ),
    supabase
      .from("po_portal_metrics")
      .select(
        "po_count,supplier_count,item_count,active_incoming_total,pending_approval_total,ordered_total,received_total,open_paid_amount_thb,planned_amount_thb",
      )
      .maybeSingle(),
    supabase
      .from("po_supplier_pipeline_summary")
      .select(
        "supplier_code,supplier_name,payment_terms,po_count,line_count,incoming_qty,total_qty,outstanding_qty,paid_amount_thb,planned_amount_thb",
      )
      .order("incoming_qty", { ascending: false })
      .limit(50),
    supabase
      .from("po_incoming_eta_reconciliation")
      .select(
        "total_incoming_pipeline_qty,scheduled_eta_qty,unscheduled_eta_qty,pipeline_item_count,scheduled_item_count,unscheduled_item_count,pipeline_po_count,scheduled_po_count,unscheduled_po_count,updated_at",
      )
      .maybeSingle(),
    supabase
      .from("po_incoming_eta_daily")
      .select("eta_date,supplier_code,supplier_name,total_incoming_qty,item_count,po_count,detail_payload")
      .order("eta_date", { ascending: true })
      .order("total_incoming_qty", { ascending: false })
      .limit(120),
    supabase
      .from("po_incoming_eta_unscheduled_events")
      .select(
        "eta_date,eta_source,po_id,po_reference,supplier_code,supplier_name,sku,product_name,incoming_qty,line_status,po_status,latest_supplier_comment,po_detail_href",
      )
      .order("incoming_qty", { ascending: false })
      .limit(100),
    includeReceivedHistory
      ? supabase
          .from("po_order_summary")
          .select(
            [
              "po_id",
              "rqq_id",
              "po_title",
              "po_date",
              "actual_received_date",
              "estimated_arrived_date",
              "estimated_delivery_date",
              "work_status",
              "supplier_code",
              "supplier_name_snapshot",
              "quotation_reference",
              "supplier_invoice_no",
              "source_payload",
              "total_items",
              "total_qty",
              "total_received_qty",
              "total_outstanding_qty",
              "active_incoming_qty",
            ].join(","),
          )
          .gt("total_received_qty", 0)
          .order("actual_received_date", { ascending: false, nullsFirst: false })
          .limit(250)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("po_payment_timeline_events")
      .select(
        "event_date,po_id,po_reference,payment_id,payment_label,payment_type,payment_status,series,amount_original,exchange_rate,amount_thb,currency,supplier_code,supplier_name,latest_supplier_comment,po_detail_href",
      )
      .order("event_date", { ascending: true })
      .limit(500),
    orderQuery
      .order(sortColumn, { ascending: dir === "asc", nullsFirst: false })
      .order("po_id", { ascending: false })
      .range(from, to),
  ]);

  if (!suppliers || ordersResult.error) {
    return null;
  }

  const supplierOptions = suppliers.map((supplier) => ({
    supplierCode: supplier.supplier_code ?? "",
    supplierName: supplier.supplier_name ?? supplier.supplier_code ?? "",
    currency: supplier.currency ?? "",
    paymentTerms: supplier.payment_terms ?? "",
  }));
  const orderSummaryRows = (ordersResult.data ?? []) as unknown as PoOrderSummaryRow[];
  const workbenchPoIds = orderSummaryRows
    .map((order) => order.po_id ?? "")
    .filter(Boolean);
  const headerPurposeResult =
    workbenchPoIds.length > 0
      ? await supabase
          .from("po_orders")
          .select("po_id,header_purpose")
          .in("po_id", workbenchPoIds)
      : { data: [] as Array<{ header_purpose: string | null; po_id: string | null }>, error: null };
  logPoPortalQueryError("po_orders workbench header purpose", headerPurposeResult.error);
  const headerPurposeByPoId = new Map(
    (
      (headerPurposeResult.error ? [] : headerPurposeResult.data ?? []) as Array<{
        header_purpose: string | null;
        po_id: string | null;
      }>
    ).map((order) => [order.po_id ?? "", order.header_purpose ?? ""]),
  );
  const mappedOrders = orderSummaryRows
    .filter((order) => order.po_id)
    .map((order) => {
      const mapped = mapPoOrderSummary(order);
      return {
        ...mapped,
        headerPurpose: headerPurposeByPoId.get(mapped.poId) || mapped.headerPurpose,
      };
    });
  const metricsRow = metricsResult.data as PoPortalMetricsRow | null;
  const orderedTotal = numeric(metricsRow?.ordered_total);
  const receivedTotal = numeric(metricsRow?.received_total);
  logPoPortalQueryError("po_incoming_eta_reconciliation", etaReconciliationResult.error);
  logPoPortalQueryError("po_incoming_eta_daily", etaDailyResult.error);
  logPoPortalQueryError("po_incoming_eta_unscheduled_events", etaUnscheduledResult.error);
  logPoPortalQueryError("po_order_summary received history", incomingReceivedHistoryResult.error);
  logPoPortalQueryError("po_payment_timeline_events", paymentTimelineResult.error);

  const etaDailyRows = etaDailyResult.error
    ? []
    : ((etaDailyResult.data ?? []) as PoIncomingEtaDailyRow[]).map(mapIncomingEtaDailyRow);
  const etaUnscheduledRows = etaUnscheduledResult.error
    ? []
    : ((etaUnscheduledResult.data ?? []) as PoIncomingEtaUnscheduledRow[]).map(
        mapIncomingEtaUnscheduledRow,
      );
  const incomingReceivedHistoryRows = incomingReceivedHistoryResult.error
    ? []
    : ((incomingReceivedHistoryResult.data ?? []) as unknown as PoIncomingReceivedHistoryRow[]).map(
        mapIncomingReceivedHistoryRow,
      );
  const paymentTimelineRows = paymentTimelineResult.error
    ? []
    : ((paymentTimelineResult.data ?? []) as PoPaymentTimelineEventRow[]).map(
        mapPaymentTimelineEventRow,
      );
  const chartPoIds = collectChartPoIds(
    etaDailyRows,
    etaUnscheduledRows,
    paymentTimelineRows,
    incomingReceivedHistoryRows,
  );
  const activeIncomingPoItemIds = collectIncomingPoItemIds(etaDailyRows);
  const receivedHistoryPoIds = incomingReceivedHistoryRows
    .map((row) => row.poId)
    .filter(Boolean);
  const receiptItemRowsResult = await fetchReceiptItemRows(
    supabase,
    activeIncomingPoItemIds,
    receivedHistoryPoIds,
  );
  logPoPortalQueryError("po_items receipt date lookup", receiptItemRowsResult.error);
  const receiptItemRows = receiptItemRowsResult.error
    ? []
    : receiptItemRowsResult.data;
  const receiptLookupItemIds = Array.from(
    new Set([
      ...activeIncomingPoItemIds,
      ...receiptItemRows.map((row) => row.id),
    ]),
  ).filter(Boolean);
  const receiptRows: PoReceiptRow[] = [];
  let receiptRowsError: PoPortalQueryError = null;

  for (let index = 0; index < receiptLookupItemIds.length; index += RECEIPT_LOOKUP_BATCH_SIZE) {
    const batch = receiptLookupItemIds.slice(index, index + RECEIPT_LOOKUP_BATCH_SIZE);
    const receiptBatch = await supabase
      .from("po_receipts")
      .select("id,po_item_id,actual_received_date,received_at,received_qty,received_by,note")
      .in("po_item_id", batch)
      .order("received_at", { ascending: false })
      .limit(1000);
    const fallbackReceiptBatch =
      receiptBatch.error && schemaColumnMiss(receiptBatch.error.message)
        ? await supabase
        .from("po_receipts")
        .select("id,po_item_id,received_at,received_qty,received_by,note")
        .in("po_item_id", batch)
        .order("received_at", { ascending: false })
        .limit(1000)
        : null;
    const activeReceiptBatch = fallbackReceiptBatch ?? receiptBatch;

    if (activeReceiptBatch.error) {
      receiptRowsError = activeReceiptBatch.error;
      break;
    }

    receiptRows.push(...((activeReceiptBatch.data ?? []) as unknown as PoReceiptRow[]));
  }

  logPoPortalQueryError("po_receipts latest date lookup", receiptRowsError);
  const receiptDates = latestReceiptMaps(
    receiptRowsError ? [] : receiptRows,
    receiptItemRows,
  );
  const incomingReceivedHistoryRowsForDisplay = receiptRowsError
    ? incomingReceivedHistoryRows
    : receivedHistoryFromReceipts(
        incomingReceivedHistoryRows,
        receiptRows,
        receiptItemRows,
      );
  let chartPoDetailsResult =
    chartPoIds.length > 0
      ? await supabase
          .from("po_orders")
          .select("po_id,actual_received_date,header_purpose,quotation_reference,supplier_invoice_no,source_payload")
          .in("po_id", chartPoIds)
          .limit(1000)
      : { data: [] as PoChartPoDetailRow[], error: null };
  if (chartPoDetailsResult.error && schemaColumnMiss(chartPoDetailsResult.error.message)) {
    chartPoDetailsResult = await supabase
      .from("po_orders")
      .select("po_id,actual_received_date,quotation_reference,supplier_invoice_no,source_payload")
      .in("po_id", chartPoIds)
      .limit(1000);
  }
  logPoPortalQueryError("po_orders chart detail enrichment", chartPoDetailsResult.error);
  const chartDetails = chartPoDetailMap(
    ((chartPoDetailsResult.data ?? []) as unknown as PoChartPoDetailRow[]),
  );
  const paymentSequenceRowsResult =
    chartPoIds.length > 0
      ? await fetchPaymentSequenceRows(supabase, chartPoIds)
      : { data: [] as PoPaymentSequenceRow[], error: null };
  logPoPortalQueryError("po_payments payment 1 date enrichment", paymentSequenceRowsResult.error);
  const payment1PaidDateByPoId = payment1PaidDateMap(
    paymentSequenceRowsResult.error
      ? []
      : ((paymentSequenceRowsResult.data ?? []) as unknown as PoPaymentSequenceRow[]),
  );
  const chartSkus = Array.from(
    new Set(etaDailyRows.flatMap((row) => row.tooltipItems.map((item) => item.sku)).filter(Boolean)),
  );
  const chartSkuDetailsResult =
    chartSkus.length > 0
      ? await supabase
          .from("product_variants")
          .select("sku,variant_title,variant_image_url,products(product_title,product_image_url,tags)")
          .in("sku", chartSkus)
          .limit(1000)
      : { data: [] as ProductVariantImageRow[], error: null };
  logPoPortalQueryError("product_variants incoming chart image enrichment", chartSkuDetailsResult.error);
  const chartSkuDetails = chartSkuDetailMap(
    chartSkuDetailsResult.error
      ? []
      : ((chartSkuDetailsResult.data ?? []) as unknown as ProductVariantImageRow[]),
  );
  const scheduledEtaQtyFromDaily = etaDailyRows.reduce(
    (sum, row) => sum + row.totalIncomingQty,
    0,
  );
  const unscheduledEtaQtyFromRows = etaUnscheduledRows.reduce(
    (sum, row) => sum + row.incomingQty,
    0,
  );
  const totalIncomingPipelineQty = numeric(metricsRow?.active_incoming_total);
  const fallbackScheduledEtaQty = scheduledEtaQtyFromDaily;
  const fallbackUnscheduledEtaQty =
    totalIncomingPipelineQty > 0
      ? Math.max(totalIncomingPipelineQty - fallbackScheduledEtaQty, 0)
      : unscheduledEtaQtyFromRows;
  const etaReconciliationRow = etaReconciliationResult.error
    ? null
    : (etaReconciliationResult.data as PoIncomingEtaReconciliationRow | null);
  const etaReconciliation = mapIncomingEtaReconciliation(etaReconciliationRow, {
    scheduledEtaQty: fallbackScheduledEtaQty,
    totalIncomingPipelineQty,
    unscheduledEtaQty: fallbackUnscheduledEtaQty,
  });

  return enrichIncomingReceiptDates(enrichIncomingPaymentDates(enrichIncomingProductDetails(enrichChartDetails({
    metrics: {
      poCount: numeric(metricsRow?.po_count),
      supplierCount: numeric(metricsRow?.supplier_count) || supplierOptions.length,
      itemCount: numeric(metricsRow?.item_count),
      activeIncomingTotal: numeric(metricsRow?.active_incoming_total),
      pendingApprovalTotal: numeric(metricsRow?.pending_approval_total),
      orderedTotal,
      receivedTotal,
      receivedRate: orderedTotal > 0 ? receivedTotal / orderedTotal : 0,
      openPaidAmountThb: numeric(metricsRow?.open_paid_amount_thb),
      plannedAmountThb: numeric(metricsRow?.planned_amount_thb),
    },
    source: "supabase" as const,
    suppliers: supplierOptions,
    catalogItems: [] as PoCatalogItemOption[],
    statusSummaries: [] as Array<{
      lineCount: number;
      outstandingQty: number;
      poCount: number;
      status: string;
    }>,
    supplierSummaries: ((supplierSummaryResult.data ?? []) as PoSupplierPipelineSummaryRow[])
      .map((row) => ({
        supplierCode: row.supplier_code ?? "",
        supplierName: row.supplier_name ?? row.supplier_code ?? "Unknown supplier",
        paymentTerms: row.payment_terms || "-",
        poCount: numeric(row.po_count),
        lineCount: numeric(row.line_count),
        incomingQty: numeric(row.incoming_qty),
        totalQty: numeric(row.total_qty),
        outstandingQty: numeric(row.outstanding_qty),
        paidAmountThb: numeric(row.paid_amount_thb),
        plannedAmountThb: numeric(row.planned_amount_thb),
      })),
    incomingEta: {
      daily: etaDailyRows,
      receivedHistory: incomingReceivedHistoryRowsForDisplay,
      reconciliation: etaReconciliation,
      unscheduled: etaUnscheduledRows,
    },
    paymentTimeline: paymentTimelineRows,
    activeOrders: mappedOrders.slice(0, 20),
    workbenchOrders: mappedOrders,
    openItems: [] as PortalItem[],
    pagination: {
      hasNextPage: (ordersResult.count ?? 0) > to + 1,
      hasPreviousPage: page > 1,
      page,
      pageCount: Math.max(1, Math.ceil((ordersResult.count ?? 0) / pageSize)),
      pageSize,
      total: ordersResult.count ?? mappedOrders.length,
    },
  }, chartDetails), chartSkuDetails), payment1PaidDateByPoId), receiptDates);
}

function roundUpToTen(value: number) {
  if (value <= 0) {
    return 0;
  }

  return Math.ceil(value / 10) * 10;
}

export async function searchPoCatalogItems({
  limit = 20,
  q,
  supplierCode = "",
  supplierName = "",
}: {
  limit?: number;
  q: string;
  supplierCode?: string;
  supplierName?: string;
}) {
  const supabase = getSupabaseServiceClient();
  const term = q.trim();
  if (!supabase || term.length < 2) {
    return [] as PoCatalogItemOption[];
  }

  const maxResults = Math.min(50, Math.max(1, Math.round(limit)));
  const escaped = term.replace(/[%_]/g, "\\$&");
  const catalogQuery = await supabase
    .from("po_catalog_search")
    .select(
      "sku,variant_title,variant_image_url,product_title,product_image_url,vendor,tags",
    )
    .or(
      [
        `sku.ilike.%${escaped}%`,
        `variant_title.ilike.%${escaped}%`,
        `product_title.ilike.%${escaped}%`,
      ].join(","),
    )
    .order("sku", { ascending: true })
    .limit(maxResults * 4);

  let rawRows = (catalogQuery.data ?? []) as Array<PoCatalogVariantRow & {
    product_image_url?: string | null;
    product_title?: string | null;
    tags?: string[] | null;
    vendor?: string | null;
  }>;

  if (catalogQuery.error) {
    const fallbackCatalogQuery = await supabase
      .from("product_variants")
      .select("sku,variant_title,variant_image_url,products(product_title,product_image_url,vendor,tags)")
      .or(`sku.ilike.%${escaped}%,variant_title.ilike.%${escaped}%`)
      .order("sku", { ascending: true })
      .limit(maxResults * 4);
    rawRows = (fallbackCatalogQuery.data ?? []) as unknown as Array<PoCatalogVariantRow & {
      product_image_url?: string | null;
      product_title?: string | null;
      tags?: string[] | null;
      vendor?: string | null;
    }>;
  }

  const skus = Array.from(
    new Set(rawRows.map((row) => row.sku?.trim()).filter(Boolean) as string[]),
  );
  if (!skus.length) {
    return [];
  }

  const [
    supplierRows,
    manualSupplierRows,
    decisionControlRows,
    lastPriceRows,
    demandRows,
    inventoryRows,
    incomingRows,
  ] = await Promise.all([
    fetchAllRows<PoPortalSupplierRow>(
      "po_suppliers",
      "supplier_code,supplier_name,currency,payment_terms",
      "supplier_code",
    ),
    supabase
      .from("manual_supplier_mappings")
      .select("sku,supplier")
      .in("sku", skus),
    supabase
      .from("purchasing_decision_controls")
      .select("sku,product_name_override,main_name_override,supplier_override,hide_from_purchasing,safety_days,lead_time_days,order_cycle_days,tags_override")
      .in("sku", skus),
    supabase
      .from("po_items")
      .select("po_id,sku,unit_price,freight_unit_cost,landed_unit_cost,currency,created_at")
      .in("sku", skus)
      .order("created_at", { ascending: false })
      .limit(Math.max(100, skus.length * 6)),
    supabase
      .from("demand_index_current")
      .select("sku,demand_index_hm")
      .in("sku", skus),
    supabase
      .from("current_inventory_by_sku")
      .select("sku,on_hand")
      .in("sku", skus),
    supabase
      .from("po_incoming_by_sku")
      .select("sku,active_incoming_qty")
      .in("sku", skus),
  ]);

  const supplierOptions = (supplierRows ?? []).map((supplier) => ({
    supplierCode: supplier.supplier_code ?? "",
    supplierName: supplier.supplier_name ?? supplier.supplier_code ?? "",
    currency: supplier.currency ?? "",
    paymentTerms: supplier.payment_terms ?? "",
  }));
  const supplierCodeByName = new Map(
    supplierOptions.map((supplier) => [supplier.supplierName.toLowerCase(), supplier.supplierCode]),
  );
  const supplierCurrencyByName = new Map(
    supplierOptions.map((supplier) => [supplier.supplierName.toLowerCase(), supplier.currency || "THB"]),
  );
  const manualSupplierBySku = new Map(
    ((manualSupplierRows.data ?? []) as ManualSupplierMappingRow[])
      .filter((row) => row.sku?.trim() && row.supplier?.trim())
      .map((row) => [row.sku!.trim(), row.supplier!.trim()]),
  );
  const controlBySku = new Map(
    ((decisionControlRows.data ?? []) as PoDecisionControlRow[])
      .filter((row) => row.sku?.trim())
      .map((row) => [row.sku!.trim(), row]),
  );
  const lastPriceBySku = new Map<string, LastPoPriceRow>();
  for (const row of (lastPriceRows.data ?? []) as LastPoPriceRow[]) {
    const sku = row.sku?.trim();
    if (sku && !lastPriceBySku.has(sku)) {
      lastPriceBySku.set(sku, row);
    }
  }
  const demandBySku = new Map(
    ((demandRows.data ?? []) as DemandIndexSnapshotRow[])
      .filter((row) => row.sku)
      .map((row) => [row.sku!, numeric(row.demand_index_hm)]),
  );
  const onHandBySku = new Map(
    ((inventoryRows.data ?? []) as CurrentInventoryRow[])
      .filter((row) => row.sku)
      .map((row) => [row.sku!, numeric(row.on_hand)]),
  );
  const incomingBySku = new Map(
    ((incomingRows.data ?? []) as Array<{ sku: string | null; active_incoming_qty: number | string | null }>)
      .filter((row) => row.sku)
      .map((row) => [row.sku!, numeric(row.active_incoming_qty)]),
  );
  const selectedSupplierKey = supplierName.trim().toLowerCase();
  const targetCurrencyBySku = new Map(
    rawRows.flatMap((row) => {
      const sku = row.sku?.trim();
      if (!sku) return [];
      const productRelation = firstProduct(row);
      const control = controlBySku.get(sku);
      const resolvedSupplierName =
        compactText(control?.supplier_override) ||
        manualSupplierBySku.get(sku) ||
        excelSupplierMap.find((item) => item.sku === sku)?.supplierName ||
        compactText(row.vendor) ||
        compactText(productRelation?.vendor) ||
        "Unmapped";
      return [[sku, supplierCurrencyByName.get(resolvedSupplierName.toLowerCase()) ?? "THB"] as const];
    }),
  );
  const latestClosedCostBySku = await getLatestClosedPoUnitCostBySkus(
    supabase,
    skus,
    targetCurrencyBySku,
  );

  return rawRows.flatMap((row) => {
    const sku = row.sku?.trim();
    if (!sku) {
      return [];
    }
    const productRelation = firstProduct(row);
    const control = controlBySku.get(sku);
    if (control?.hide_from_purchasing) {
      return [];
    }
    const productTitle =
      compactText(control?.product_name_override) ||
      compactText(row.product_title) ||
      compactText(productRelation?.product_title) ||
      sku;
    const variantTitle = compactText(row.variant_title);
    const mainName =
      compactText(control?.main_name_override) ||
      compactText(row.product_title) ||
      compactText(productRelation?.product_title) ||
      productTitle;
    const resolvedSupplierName =
      compactText(control?.supplier_override) ||
      manualSupplierBySku.get(sku) ||
      excelSupplierMap.find((item) => item.sku === sku)?.supplierName ||
      compactText(row.vendor) ||
      compactText(productRelation?.vendor) ||
      "Unmapped";
    const resolvedSupplierKey = resolvedSupplierName.toLowerCase();
    const resolvedSupplierCode = supplierCodeByName.get(resolvedSupplierKey) ?? "";
    const matchesSupplier =
      !supplierCode ||
      resolvedSupplierCode === supplierCode ||
      (selectedSupplierKey && resolvedSupplierKey === selectedSupplierKey);
    if (!matchesSupplier) {
      return [];
    }

    const lastPrice = lastPriceBySku.get(sku);
    const latestClosedCost = latestClosedCostBySku.get(sku);
    const demandIndex = demandBySku.get(sku) ?? 0;
    const safetyDays = numeric(control?.safety_days) || 14;
    const leadTimeDays = numeric(control?.lead_time_days) || 60;
    const orderCycleDays = numeric(control?.order_cycle_days) || 30;
    const targetQty = Math.max(0, Math.ceil(demandIndex * (safetyDays + leadTimeDays + orderCycleDays)));
    const recommendedRawQty = Math.max(
      0,
      targetQty - (onHandBySku.get(sku) ?? 0) - (incomingBySku.get(sku) ?? 0),
    );
    const recommendedRoundQty = roundUpToTen(recommendedRawQty);
    const tags =
      control?.tags_override?.length
        ? control.tags_override
        : row.tags ?? productRelation?.tags ?? [];
    const imageUrl =
      compactText(row.variant_image_url) ||
      compactText(row.product_image_url) ||
      compactText(productRelation?.product_image_url) ||
      null;

    return [{
      sku,
      productTitle:
        !variantTitle || variantTitle === "Default Title" || productTitle.includes(variantTitle)
          ? productTitle
          : `${productTitle} / ${variantTitle}`,
      mainName,
      variantTitle,
      imageUrl,
      tags,
      onHand: onHandBySku.get(sku) ?? 0,
      supplierCode: resolvedSupplierCode,
      supplierName: resolvedSupplierName,
      currency: targetCurrencyBySku.get(sku) ?? "THB",
      lastUnitPrice: latestClosedCost?.latestUnitPrice ?? 0,
      lastFreightUnitCost: numeric(lastPrice?.freight_unit_cost),
      lastLandedUnitCost: numeric(lastPrice?.landed_unit_cost),
      lastPoId: latestClosedCost?.sourcePoId ?? "",
      demandIndexHm: demandIndex,
      leadTimeDays,
      recommendedRawQty,
      recommendedRoundQty,
      recommendedQty: recommendedRoundQty,
      searchText: [sku, productTitle, mainName, variantTitle, resolvedSupplierName, tags.join(" ")]
        .join(" ")
        .toLowerCase(),
    } satisfies PoCatalogItemOption];
  }).slice(0, maxResults);
}

export async function getPoPortalData(options: PoPortalListOptions = {}) {
  const supabaseData = await getSupabasePoPortalData(options);
  return supabaseData ?? getAppSheetPoPortalData();
}

export async function getPoPortalDetailData(poId: string) {
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    const order = poPortalOrders.find((row) => row.poId === poId);
    if (!order) {
      return null;
    }

    return {
      source: "appsheet-fallback" as const,
      catalogItems: [],
      order: {
        ...order,
        freightTotal: 0,
        landedCostNote: "",
        otherLandedCostTotal: 0,
        headerPurpose: "",
        quotationReference: "",
        actualReceivedDate: "",
        cancelledAt: "",
        closedAt: "",
        estimatedArrivedDate: "",
        estimatedDeliveryDate: "",
        supplierDiscussionNote: "",
        supplierInvoiceNo: "",
        vatMode: "",
      },
      items: poPortalItems
        .filter((item) => item.poId === poId)
        .map((item) => ({
          ...item,
          demandIndexHm: 0,
          freightUnitCost: 0,
          imageUrl: null,
          itemUuid: undefined,
          landedUnitCost: item.unitPrice,
          onHand: 0,
        })),
      marginRows: [] as PoMarginCheckRow[],
      payments: [],
      receipts: [],
      statusEvents: [],
    };
  }

  let { data: orderRow, error: orderError } = await supabase
    .from("po_orders")
    .select(
      [
        "po_id",
        "rqq_id",
        "po_title",
        "po_date",
        "actual_received_date",
        "cancelled_at",
        "closed_at",
        "estimated_arrived_date",
        "estimated_delivery_date",
        "work_status",
        "requester",
        "owner",
        "supplier_code",
        "supplier_name_snapshot",
        "currency",
        "po_amount_foreign",
        "po_amount_thb",
        "freight_total",
        "other_landed_cost_total",
        "landed_cost_note",
        "header_purpose",
        "quotation_reference",
        "supplier_invoice_no",
        "supplier_discussion_note",
        "vat_mode",
        "payment_terms_snapshot",
        "source_payload",
      ].join(","),
    )
    .eq("po_id", poId)
    .maybeSingle();

  if (orderError) {
    const fallback = await supabase
      .from("po_orders")
      .select(
        [
          "po_id",
          "rqq_id",
          "po_title",
          "po_date",
          "cancelled_at",
          "closed_at",
          "work_status",
          "requester",
          "owner",
          "supplier_code",
          "supplier_name_snapshot",
          "currency",
          "po_amount_foreign",
          "po_amount_thb",
          "freight_total",
          "other_landed_cost_total",
          "landed_cost_note",
          "quotation_reference",
          "supplier_invoice_no",
          "vat_mode",
          "source_payload",
          "payment_terms_snapshot",
        ].join(","),
      )
      .eq("po_id", poId)
      .maybeSingle();
    orderRow = fallback.data;
    orderError = fallback.error;
  }

  if (orderError || !orderRow) {
    return null;
  }

  let itemQuery = await supabase
    .from("po_items")
    .select(
      [
        "id",
        "po_item_id",
        "po_id",
        "line_no",
        "sku",
        "product_title_snapshot",
        "variant_title_snapshot",
        "ordered_qty",
        "legacy_received_qty",
        "backorder_qty",
        "unit_price",
        "freight_unit_cost",
        "landed_unit_cost",
        "line_amount",
        "currency",
        "remark",
        "full_name",
        "line_status",
        "sort_position",
        "source_payload",
      ].join(","),
    )
    .eq("po_id", poId)
    .order("sort_position", { ascending: true, nullsFirst: false })
    .order("line_no", { ascending: true });

  if (itemQuery.error) {
    itemQuery = await supabase
      .from("po_items")
      .select(
        [
          "id",
          "po_item_id",
          "po_id",
          "line_no",
          "sku",
          "product_title_snapshot",
          "variant_title_snapshot",
          "ordered_qty",
          "legacy_received_qty",
          "backorder_qty",
          "unit_price",
          "freight_unit_cost",
          "landed_unit_cost",
          "line_amount",
          "currency",
          "remark",
          "full_name",
          "line_status",
          "source_payload",
        ].join(","),
      )
      .eq("po_id", poId)
      .order("line_no", { ascending: true });
  }

  const { data: itemRows, error: itemError } = itemQuery;

  if (itemError) {
    return null;
  }

  const supabaseItems = (itemRows ?? []) as unknown as PoPortalItemRow[];
  const itemIds = supabaseItems.map((item) => item.id);
  const skus = Array.from(
    new Set(supabaseItems.map((item) => item.sku).filter(Boolean) as string[]),
  );

  const imageRows =
    skus.length > 0
      ? await supabase
          .from("product_variants")
          .select("sku,price,variant_image_url,products(product_image_url,tags)")
          .in("sku", skus)
      : { data: [] };

  const productRows = ((imageRows.data ?? []) as unknown as ProductVariantImageRow[])
    .filter((row) => row.sku);
  const imageBySku = new Map(productRows.map((row) => [row.sku, productImageUrl(row)]));
  const salePriceBySku = new Map(
    productRows
      .filter((row) => row.sku)
      .map((row) => [row.sku!, numeric(row.price)]),
  );
  const tagsBySku = new Map(productRows.map((row) => [row.sku, productTags(row)]));

  let onHandBySku = new Map<string, number>();
  if (skus.length > 0) {
    const currentInventoryRows = await supabase
      .from("current_inventory_by_sku")
      .select("sku,on_hand")
      .in("sku", skus);
    if (!currentInventoryRows.error) {
      onHandBySku = new Map(
        ((currentInventoryRows.data ?? []) as CurrentInventoryRow[])
          .filter((row) => row.sku)
          .map((row) => [row.sku!, numeric(row.on_hand)]),
      );
    } else {
      const inventoryRows = await supabase
        .from("inventory_snapshots")
        .select("sku,on_hand,snapshot_date")
        .in("sku", skus)
        .order("snapshot_date", { ascending: false });
      onHandBySku = latestOnHandBySku(
        (inventoryRows.data ?? []) as unknown as InventorySnapshotRow[],
      );
    }
  }

  const [demandRows, controlRows] =
    skus.length > 0
      ? await Promise.all([
          supabase
            .from("demand_index_current")
            .select("sku,demand_index_hm")
            .in("sku", skus),
          supabase
            .from("purchasing_decision_controls")
            .select("sku,lead_time_days,tags_override")
            .in("sku", skus),
        ])
      : [{ data: [] }, { data: [] }];
  const demandBySku = new Map(
    ((demandRows.data ?? []) as DemandIndexSnapshotRow[])
      .filter((row) => row.sku)
      .map((row) => [row.sku!, numeric(row.demand_index_hm)]),
  );
  const controlBySku = new Map(
    ((controlRows.data ?? []) as PoDecisionControlRow[])
      .filter((row) => row.sku)
      .map((row) => [row.sku!, row]),
  );

  const { data: receiptTotals } = await supabase
    .from("po_item_receipt_totals")
    .select("po_item_uuid,workflow_received_qty,total_received_qty,outstanding_qty")
    .eq("po_id", poId);

  const receiptTotalByItemId = new Map(
    ((receiptTotals ?? []) as unknown as PoPortalReceiptTotalRow[])
      .filter((row) => row.po_item_uuid)
      .map((row) => [row.po_item_uuid, row]),
  );
  const items = supabaseItems.map((item) => {
    const sku = item.sku ?? "";
    const control = controlBySku.get(sku);

    return {
      ...mapSupabaseItem(item, receiptTotalByItemId.get(item.id), imageBySku.get(sku)),
      demandIndexHm: demandBySku.get(sku) ?? 0,
      leadTimeDays: numeric(control?.lead_time_days),
      onHand: onHandBySku.get(sku) ?? 0,
      tags: control?.tags_override?.length ? control.tags_override : tagsBySku.get(sku) ?? [],
    };
  });
  const freightHistoryBySku = await latestFreightHistoryBySku(supabase, skus, poId);
  const marginRows = buildPoMarginRows(items, salePriceBySku, freightHistoryBySku);

  const receiptsWithActualDate =
    itemIds.length > 0
      ? await supabase
          .from("po_receipts")
          .select("id,po_item_id,actual_received_date,received_at,received_qty,received_by,note")
          .in("po_item_id", itemIds)
          .order("received_at", { ascending: false })
      : { data: [], error: null };
  const receipts =
    receiptsWithActualDate.error && schemaColumnMiss(receiptsWithActualDate.error.message)
      ? await supabase
          .from("po_receipts")
          .select("id,po_item_id,received_at,received_qty,received_by,note")
          .in("po_item_id", itemIds)
          .order("received_at", { ascending: false })
      : receiptsWithActualDate;

  const { data: statusEvents } = await supabase
    .from("po_status_events")
    .select("id,po_id,po_item_id,from_status,to_status,actor,note,created_at")
    .eq("po_id", poId)
    .order("created_at", { ascending: false });

  const paymentQuery = await supabase
    .from("po_payments")
    .select("id,po_id,payment_date,payment_type,payment_status,xero_status,due_date,amount,exchange_rate,amount_thb,currency,paid_by,reference,note,created_at,updated_at")
    .eq("po_id", poId)
    .order("payment_date", { ascending: true });

  let paymentRows: unknown[] = paymentQuery.data ?? [];
  if (paymentQuery.error) {
    const fallbackPaymentQuery = await supabase
      .from("po_payments")
      .select("id,po_id,payment_date,payment_type,payment_status,xero_status,due_date,amount,exchange_rate,amount_thb,currency,paid_by,reference,note,created_at")
      .eq("po_id", poId)
      .order("payment_date", { ascending: false });
    paymentRows = fallbackPaymentQuery.data ?? [];

    if (fallbackPaymentQuery.error) {
      const legacyPaymentQuery = await supabase
        .from("po_payments")
        .select("id,po_id,payment_date,payment_type,payment_status,due_date,amount,exchange_rate,amount_thb,currency,paid_by,reference,note,created_at")
        .eq("po_id", poId)
        .order("payment_date", { ascending: false });
      paymentRows = legacyPaymentQuery.data ?? [];
    }
  }

  return {
    source: "supabase" as const,
    catalogItems: [] as PoCatalogItemOption[],
    marginRows,
    order: mapSupabaseOrder(orderRow as unknown as PoPortalOrderRow, items),
    items,
    payments: sortPoPayments(paymentRows as PoPaymentRow[]),
    receipts: (receipts.data ?? []) as PoReceiptRow[],
    statusEvents: (statusEvents ?? []) as PoStatusEventRow[],
  };
}

export type PoPortalData = Awaited<ReturnType<typeof getPoPortalData>>;
export type EnrichedPoPortalOrder = PoPortalData["activeOrders"][number];
export type PoPortalDetailData = Awaited<ReturnType<typeof getPoPortalDetailData>>;
