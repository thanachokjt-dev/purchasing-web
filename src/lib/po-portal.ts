import {
  poPortalItems,
  poPortalOrders,
  poPortalSuppliers,
  type PoPortalItem,
} from "@/lib/po-portal-data";

const ACTIVE_STATUSES = new Set(["inpro", "delivery", "final_payment"]);
const PENDING_STATUSES = new Set(["waiting_for_approve"]);

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

function orderItems(poId: string) {
  return poPortalItems.filter((item) => item.poId === poId);
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

export function getPoPortalData() {
  const statusMap = new Map<
    string,
    {
      status: string;
      lineCount: number;
      poCount: Set<string>;
      outstandingQty: number;
    }
  >();

  for (const item of poPortalItems) {
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

  const enrichedOrders = poPortalOrders.map((order) => {
    const items = orderItems(order.poId);
    return {
      ...order,
      activeIncomingQty: activeIncomingQty(items),
      pendingApprovalQty: pendingApprovalQty(items),
      activeLineCount: items.filter((item) => isActiveStatus(item.status)).length,
      pendingLineCount: items.filter((item) => isPendingStatus(item.status)).length,
    };
  });

  const activeOrders = enrichedOrders
    .filter((order) => order.activeIncomingQty > 0 || order.pendingApprovalQty > 0)
    .sort(
      (a, b) =>
        b.activeIncomingQty - a.activeIncomingQty ||
        b.pendingApprovalQty - a.pendingApprovalQty,
    )
    .slice(0, 20);

  const openItems = poPortalItems
    .filter((item) => item.outstandingQty > 0 && item.status !== "Closed")
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
  const receivedTotal = poPortalOrders.reduce(
    (sum, order) => sum + order.receivedQty,
    0,
  );
  const orderedTotal = poPortalOrders.reduce((sum, order) => sum + order.totalQty, 0);

  return {
    metrics: {
      poCount: poPortalOrders.length,
      supplierCount: poPortalSuppliers.length,
      itemCount: poPortalItems.length,
      activeIncomingTotal,
      pendingApprovalTotal,
      orderedTotal,
      receivedTotal,
      receivedRate: orderedTotal > 0 ? receivedTotal / orderedTotal : 0,
    },
    statusSummaries,
    activeOrders,
    openItems,
  };
}

export type PoPortalData = ReturnType<typeof getPoPortalData>;
export type EnrichedPoPortalOrder = PoPortalData["activeOrders"][number];
