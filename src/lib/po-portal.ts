import {
  poPortalItems,
  poPortalOrders,
  poPortalSuppliers,
  type PoPortalItem,
} from "@/lib/po-portal-data";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

const ACTIVE_STATUSES = new Set(["inpro", "delivery", "final_payment"]);
const PENDING_STATUSES = new Set(["waiting_for_approve"]);
const WORKBENCH_ORDER_STATUSES = new Set([
  "draft",
  "waiting_for_approve",
  "inpro",
  "delivery",
  "final_payment",
]);
const PAGE_SIZE = 1000;

type PoPortalSupplierRow = {
  supplier_code: string | null;
  supplier_name: string | null;
  currency: string | null;
  payment_terms: string | null;
};

type PoPortalOrderRow = {
  po_id: string | null;
  rqq_id: string | null;
  po_title: string | null;
  po_date: string | null;
  work_status: string | null;
  requester: string | null;
  owner: string | null;
  supplier_code: string | null;
  supplier_name_snapshot: string | null;
  currency: string | null;
  po_amount_foreign: number | string | null;
  po_amount_thb: number | string | null;
  payment_terms_snapshot: string | null;
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
  line_amount: number | string | null;
  currency: string | null;
  remark: string | null;
  full_name: string | null;
  line_status: string | null;
};

type PoPortalReceiptTotalRow = {
  po_item_uuid: string | null;
  workflow_received_qty: number | string | null;
  total_received_qty: number | string | null;
  outstanding_qty: number | string | null;
};

type PoPortalSupplierOption = {
  supplierCode: string;
  supplierName: string;
  currency: string;
  paymentTerms: string;
};

type PortalItem = PoPortalItem & {
  itemUuid?: string;
};

function normalizedStatus(value: string) {
  return value.trim().toLowerCase();
}

function isActiveStatus(value: string) {
  return ACTIVE_STATUSES.has(normalizedStatus(value));
}

function isPendingStatus(value: string) {
  return PENDING_STATUSES.has(normalizedStatus(value));
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

function activeIncomingQty(items: PoPortalItem[]) {
  return items
    .filter((item) => isActiveStatus(item.status))
    .reduce((sum, item) => sum + item.outstandingQty, 0);
}

function pendingApprovalQty(items: PoPortalItem[]) {
  return items
    .filter((item) => isPendingStatus(item.status))
    .reduce((sum, item) => sum + item.outstandingQty, 0);
}

function summarizePoPortalData(
  suppliers: PoPortalSupplierOption[],
  orders: Array<{
    poId: string;
    rqqId: string;
    poTitle: string;
    poDate: string;
    workStatus: string;
    requester: string;
    owner: string;
    supplierCode: string;
    supplierName: string;
    currency: string;
    poAmountForeign: number;
    poAmountThb: number;
    paymentTerms: string;
    itemCount: number;
    statuses: string[];
    totalQty: number;
    receivedQty: number;
    outstandingQty: number;
  }>,
  items: PortalItem[],
  source: "appsheet-fallback" | "supabase",
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
      activeIncomingQty: activeIncomingQty(orderLineItems),
      pendingApprovalQty: pendingApprovalQty(orderLineItems),
      activeLineCount: orderLineItems.filter((item) => isActiveStatus(item.status)).length,
      pendingLineCount: orderLineItems.filter((item) => isPendingStatus(item.status)).length,
    };
  });

  const activeOrders = enrichedOrders
    .filter(
      (order) =>
        order.activeIncomingQty > 0 ||
        order.pendingApprovalQty > 0 ||
        WORKBENCH_ORDER_STATUSES.has(normalizedStatus(order.workStatus)),
    )
    .sort(
      (a, b) =>
        b.activeIncomingQty - a.activeIncomingQty ||
        b.pendingApprovalQty - a.pendingApprovalQty,
    )
    .slice(0, 20);

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
    },
    source,
    suppliers,
    statusSummaries,
    activeOrders,
    openItems,
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
    poPortalOrders,
    poPortalItems,
    "appsheet-fallback",
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

async function getSupabasePoPortalData() {
  const [suppliers, orders, items, receiptTotals] = await Promise.all([
    fetchAllRows<PoPortalSupplierRow>(
      "po_suppliers",
      "supplier_code,supplier_name,currency,payment_terms",
      "supplier_code",
    ),
    fetchAllRows<PoPortalOrderRow>(
      "po_orders",
      [
        "po_id",
        "rqq_id",
        "po_title",
        "po_date",
        "work_status",
        "requester",
        "owner",
        "supplier_code",
        "supplier_name_snapshot",
        "currency",
        "po_amount_foreign",
        "po_amount_thb",
        "payment_terms_snapshot",
      ].join(","),
      "po_date",
    ),
    fetchAllRows<PoPortalItemRow>(
      "po_items",
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
        "line_amount",
        "currency",
        "remark",
        "full_name",
        "line_status",
      ].join(","),
      "po_id",
    ),
    fetchAllRows<PoPortalReceiptTotalRow>(
      "po_item_receipt_totals",
      "po_item_uuid,workflow_received_qty,total_received_qty,outstanding_qty",
      "po_id",
    ),
  ]);

  if (!suppliers || !orders || !items || !receiptTotals || orders.length === 0) {
    return null;
  }

  const receiptTotalByItemId = new Map(
    receiptTotals
      .filter((row) => row.po_item_uuid)
      .map((row) => [row.po_item_uuid, row]),
  );

  const mappedItems: PortalItem[] = items
    .filter((item) => item.po_id && item.sku)
    .map((item) => {
      const receiptTotal = receiptTotalByItemId.get(item.id);
      const orderedQty = numeric(item.ordered_qty);
      const receivedQty = numeric(receiptTotal?.total_received_qty ?? item.legacy_received_qty);
      const outstandingQty = numeric(receiptTotal?.outstanding_qty);

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
        lineAmount: numeric(item.line_amount),
        currency: item.currency ?? "THB",
        remark: item.remark ?? "",
        poItemId: item.po_item_id ?? item.id,
        fullName: item.full_name ?? "",
        status: item.line_status ?? "unknown",
      };
    });

  const itemsByPoId = new Map<string, PoPortalItem[]>();
  for (const item of mappedItems) {
    itemsByPoId.set(item.poId, [...(itemsByPoId.get(item.poId) ?? []), item]);
  }

  const mappedOrders = orders
    .filter((order) => order.po_id)
    .map((order) => {
      const orderLineItems = itemsByPoId.get(order.po_id ?? "") ?? [];
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
        requester: order.requester ?? "",
        owner: order.owner ?? "",
        supplierCode: order.supplier_code ?? "",
        supplierName: order.supplier_name_snapshot ?? order.supplier_code ?? "",
        currency: order.currency ?? "THB",
        poAmountForeign: numeric(order.po_amount_foreign),
        poAmountThb: numeric(order.po_amount_thb),
        paymentTerms: order.payment_terms_snapshot ?? "",
        itemCount: orderLineItems.length,
        statuses: statuses.length > 0 ? statuses : [order.work_status ?? "unknown"],
        totalQty,
        receivedQty,
        outstandingQty,
      };
    });

  return summarizePoPortalData(
    suppliers.map((supplier) => ({
      supplierCode: supplier.supplier_code ?? "",
      supplierName: supplier.supplier_name ?? supplier.supplier_code ?? "",
      currency: supplier.currency ?? "",
      paymentTerms: supplier.payment_terms ?? "",
    })),
    mappedOrders,
    mappedItems,
    "supabase",
  );
}

export async function getPoPortalData() {
  const supabaseData = await getSupabasePoPortalData();
  return supabaseData ?? getAppSheetPoPortalData();
}

export type PoPortalData = Awaited<ReturnType<typeof getPoPortalData>>;
export type EnrichedPoPortalOrder = PoPortalData["activeOrders"][number];
