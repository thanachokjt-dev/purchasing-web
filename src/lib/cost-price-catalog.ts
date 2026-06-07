import "server-only";

import { getSupabaseServiceClient } from "@/lib/supabase/server";
import type { CostPriceMonitorRow } from "@/lib/cost-price-monitor";

type IncomingEtaEventRow = {
  eta_date: string | null;
  incoming_qty: number | string | null;
  line_status: string | null;
  po_id: string | null;
  po_reference: string | null;
  po_status: string | null;
  product_name: string | null;
  sku: string | null;
};

type IncomingQuantityPoLineRow = {
  cancelled_qty: number | string | null;
  line_status: string | null;
  ordered_qty: number | string | null;
  po_orders:
    | {
        cancelled_at: string | null;
        closed_at: string | null;
        work_status: string | null;
      }
    | {
        cancelled_at: string | null;
        closed_at: string | null;
        work_status: string | null;
      }[]
    | null;
  sku: string | null;
};

export type CatalogIncomingEta = {
  additionalPoCount: number;
  etaDate: string;
  incomingQty: number;
  poCount: number;
  poReference: string;
  quarter: string;
  timing: string;
};

export type CatalogRow = {
  currentQty: number;
  estimatedCost: number;
  groupLabel: string;
  incomingEta: CatalogIncomingEta | null;
  incomingQty: number;
  landedAddOn: number;
  latestPurchaseCost: number;
  marginPct: number | null;
  productName: string;
  row: CostPriceMonitorRow;
  totalQty: number;
};

const ETA_LOOKUP_BATCH_SIZE = 200;
const INCOMING_QTY_LOOKUP_BATCH_SIZE = 200;
const CLOSED_OR_CANCELLED_STATUS_KEYS = new Set(["closed", "cancelled", "canceled", "void", "voided", "deleted"]);
const CLOSED_LINE_STATUS_KEYS = new Set([...CLOSED_OR_CANCELLED_STATUS_KEYS, "fully_received"]);

export function generatedCatalogDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: "Asia/Bangkok",
  }).format(date);
}

export function bangkokDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Bangkok",
    year: "numeric",
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function formatEtaDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00Z`));
}

export function formatThb(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "THB",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

export function daysBetweenDates(from: string, to: string) {
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  return Math.floor((end.getTime() - start.getTime()) / 86_400_000);
}

export function timingText(etaDate: string, today: string) {
  const daysUntil = daysBetweenDates(today, etaDate);
  if (daysUntil < 0) {
    return `${Math.abs(daysUntil)} day${Math.abs(daysUntil) === 1 ? "" : "s"} overdue`;
  }
  if (daysUntil === 0) {
    return "Due today";
  }
  if (daysUntil === 1) {
    return "In 1 day";
  }
  return `In ${daysUntil} days`;
}

export function quarterText(etaDate: string) {
  const date = new Date(`${etaDate}T00:00:00Z`);
  const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
  return `Q${quarter} ${date.getUTCFullYear()}`;
}

export function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function statusKey(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export function toNonNegativeNumber(value: string | null | undefined, fallback: number) {
  if (!value?.trim()) {
    return fallback;
  }
  const parsed = Number(value ?? "");
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function printBaseCost(row: CostPriceMonitorRow) {
  return row.latestPurchasePrice > 0 ? row.latestPurchasePrice : row.averagePurchasePrice > 0 ? row.averagePurchasePrice : 0;
}

export function printLandedAddOn(row: CostPriceMonitorRow, estimatedLandCost: number) {
  return (row.manualLandedCost ?? 0) > 0 ? row.manualLandedCost ?? 0 : estimatedLandCost;
}

export function printEstimatedCost(row: CostPriceMonitorRow, estimatedLandCost: number) {
  const baseCost = printBaseCost(row);
  return baseCost > 0 ? baseCost + printLandedAddOn(row, estimatedLandCost) : 0;
}

export function printMarginPct(estimatedCost: number, sellingPrice: number) {
  if (sellingPrice <= 0 || estimatedCost <= 0) {
    return null;
  }
  const margin = ((sellingPrice - estimatedCost) / sellingPrice) * 100;
  return Number.isFinite(margin) ? margin : null;
}

export function printProductName(row: CostPriceMonitorRow) {
  return row.color && row.color !== "No color" ? `${row.mainName} - ${row.color}` : row.mainName;
}

export function productGroupLabel(row: CostPriceMonitorRow, selectedGroup: string) {
  if (selectedGroup.trim()) {
    return selectedGroup.trim();
  }
  const value = row.productGroup.trim();
  return value && value.toLowerCase() !== "unassigned" ? value : "Uncategorized";
}

export function groupedCatalogRows(rows: CostPriceMonitorRow[], selectedGroup: string) {
  const groups = new Map<string, CostPriceMonitorRow[]>();
  for (const row of rows) {
    const label = productGroupLabel(row, selectedGroup);
    const group = groups.get(label) ?? [];
    group.push(row);
    groups.set(label, group);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([label, group]) => ({
      label,
      rows: group.sort((left, right) => printProductName(left).localeCompare(printProductName(right))),
    }));
}

export function skuValues(row: CostPriceMonitorRow) {
  return Array.from(
    new Set(
      row.skuList
        .split(",")
        .map((sku) => sku.trim())
        .filter(Boolean),
    ),
  );
}

export async function fetchIncomingEtaByRow(rows: CostPriceMonitorRow[]) {
  const supabase = getSupabaseServiceClient();
  const today = bangkokDateString();
  const skus = Array.from(new Set(rows.flatMap(skuValues)));
  const eventsBySku = new Map<string, IncomingEtaEventRow[]>();

  if (!supabase || skus.length === 0) {
    return new Map<string, CatalogIncomingEta>();
  }

  for (let index = 0; index < skus.length; index += ETA_LOOKUP_BATCH_SIZE) {
    const batch = skus.slice(index, index + ETA_LOOKUP_BATCH_SIZE);
    const { data, error } = await supabase
      .from("po_incoming_eta_events")
      .select("eta_date,po_id,po_reference,sku,product_name,incoming_qty,line_status,po_status")
      .in("sku", batch)
      .order("eta_date", { ascending: true });

    if (error) {
      return new Map<string, CatalogIncomingEta>();
    }

    for (const event of (data ?? []) as IncomingEtaEventRow[]) {
      const sku = event.sku?.trim();
      if (!sku || !event.eta_date) {
        continue;
      }
      const events = eventsBySku.get(sku) ?? [];
      events.push(event);
      eventsBySku.set(sku, events);
    }
  }

  const incomingByGroup = new Map<string, CatalogIncomingEta>();
  for (const row of rows) {
    const rowEvents = skuValues(row).flatMap((sku) => eventsBySku.get(sku) ?? []);
    if (rowEvents.length === 0) {
      continue;
    }
    const sorted = rowEvents.sort((left, right) =>
      (left.eta_date ?? "").localeCompare(right.eta_date ?? "") ||
      (left.po_reference ?? left.po_id ?? "").localeCompare(right.po_reference ?? right.po_id ?? ""),
    );
    const nearest = sorted[0];
    if (!nearest.eta_date) {
      continue;
    }
    const poIds = new Set(sorted.map((event) => event.po_id || event.po_reference).filter(Boolean));
    incomingByGroup.set(row.groupKey, {
      additionalPoCount: Math.max(poIds.size - 1, 0),
      etaDate: nearest.eta_date,
      incomingQty: sorted.reduce((sum, event) => sum + toNumber(event.incoming_qty), 0),
      poCount: poIds.size,
      poReference: nearest.po_reference || nearest.po_id || "Incoming PO",
      quarter: quarterText(nearest.eta_date),
      timing: timingText(nearest.eta_date, today),
    });
  }

  return incomingByGroup;
}

function firstOrder(row: IncomingQuantityPoLineRow) {
  return Array.isArray(row.po_orders) ? row.po_orders[0] : row.po_orders;
}

function isOpenIncomingLine(row: IncomingQuantityPoLineRow) {
  const order = firstOrder(row);
  const orderStatus = statusKey(order?.work_status);
  const lineStatus = statusKey(row.line_status);
  return Boolean(
    order &&
      !order.closed_at &&
      !order.cancelled_at &&
      !CLOSED_OR_CANCELLED_STATUS_KEYS.has(orderStatus) &&
      !CLOSED_LINE_STATUS_KEYS.has(lineStatus),
  );
}

export async function fetchIncomingQuantityByRow(rows: CostPriceMonitorRow[]) {
  const supabase = getSupabaseServiceClient();
  const skus = Array.from(new Set(rows.flatMap(skuValues)));
  const incomingQtyBySku = new Map<string, number>();

  if (!supabase || skus.length === 0) {
    return new Map<string, number>();
  }

  for (let index = 0; index < skus.length; index += INCOMING_QTY_LOOKUP_BATCH_SIZE) {
    const batch = skus.slice(index, index + INCOMING_QTY_LOOKUP_BATCH_SIZE);
    const { data, error } = await supabase
      .from("po_items")
      .select("sku,ordered_qty,cancelled_qty,line_status,po_orders!inner(work_status,closed_at,cancelled_at)")
      .in("sku", batch);

    if (error) {
      return new Map<string, number>();
    }

    for (const line of (data ?? []) as IncomingQuantityPoLineRow[]) {
      const sku = line.sku?.trim();
      if (!sku || !isOpenIncomingLine(line)) {
        continue;
      }
      const orderedQty = Math.max(toNumber(line.ordered_qty) - toNumber(line.cancelled_qty), 0);
      if (orderedQty <= 0) {
        continue;
      }
      incomingQtyBySku.set(sku, (incomingQtyBySku.get(sku) ?? 0) + orderedQty);
    }
  }

  const incomingQtyByGroup = new Map<string, number>();
  for (const row of rows) {
    const incomingQty = skuValues(row).reduce((sum, sku) => sum + (incomingQtyBySku.get(sku) ?? 0), 0);
    incomingQtyByGroup.set(row.groupKey, incomingQty);
  }

  return incomingQtyByGroup;
}

export async function resolveCatalogRows(rows: CostPriceMonitorRow[], estimatedLandCost: number, selectedGroup: string) {
  const [incomingEtaByGroup, incomingQtyByGroup] = await Promise.all([
    fetchIncomingEtaByRow(rows),
    fetchIncomingQuantityByRow(rows),
  ]);
  const catalogRows = groupedCatalogRows(rows, selectedGroup).flatMap((group) =>
    group.rows.map((row) => {
      const currentQty = row.stockQty || 0;
      const incomingQty = incomingQtyByGroup.get(row.groupKey) ?? 0;
      const latestPurchaseCost = printBaseCost(row);
      const landedAddOn = printLandedAddOn(row, estimatedLandCost);
      const estimatedCost = printEstimatedCost(row, estimatedLandCost);
      return {
        currentQty,
        estimatedCost,
        groupLabel: group.label,
        incomingEta: incomingEtaByGroup.get(row.groupKey) ?? null,
        incomingQty,
        landedAddOn,
        latestPurchaseCost,
        marginPct: printMarginPct(estimatedCost, row.sellingPrice),
        productName: printProductName(row),
        row,
        totalQty: currentQty + incomingQty,
      } satisfies CatalogRow;
    }),
  );

  return { catalogRows, incomingEtaByGroup };
}

export function visibilityScope(value: string | undefined) {
  if (value === "all") {
    return "Visibility: All";
  }
  if (value === "hidden") {
    return "Visibility: Hidden only";
  }
  return "Visibility: Active only";
}

export function supplierScope(suppliers: string[]) {
  if (suppliers.length === 0) {
    return "All suppliers";
  }
  if (suppliers.length === 1) {
    return `Supplier: ${suppliers[0]}`;
  }
  if (suppliers.length <= 3) {
    return `Suppliers: ${suppliers.join(", ")}`;
  }
  return "Multiple suppliers";
}

export function catalogScopeLine({
  category,
  group,
  lowMarginOnly,
  missingCostOnly,
  poStatus,
  q,
  selected,
  selectedRowCount,
  suppliers,
  visibility,
}: {
  category?: string;
  group?: string;
  lowMarginOnly?: string;
  missingCostOnly?: string;
  poStatus?: string;
  q?: string;
  selected?: string | string[];
  selectedRowCount: number;
  suppliers: string[];
  visibility?: string;
}) {
  const selectedCount = Array.isArray(selected) ? selected.filter(Boolean).length : selected ? 1 : 0;
  if (selectedCount > 0) {
    return `Scope: Selected products: ${selectedRowCount} / ${visibilityScope(visibility)}`;
  }

  const displayFilter = (label: string, value: string | undefined, allLabel: string) =>
    value?.trim() ? `${label}: ${value.trim()}` : allLabel;
  const parts = [
    supplierScope(suppliers),
    visibilityScope(visibility),
    displayFilter("Product Group", group, "All product groups"),
    displayFilter("Category", category, "All categories"),
  ];
  if (poStatus?.trim()) {
    parts.push(`PO Status: ${poStatus.trim()}`);
  }
  if (q?.trim()) {
    parts.push(`Search: ${q.trim()}`);
  }
  if (missingCostOnly === "1") {
    parts.push("Missing cost only");
  }
  if (lowMarginOnly === "1") {
    parts.push("Low margin only");
  }
  return `Scope: ${parts.join(" / ")}`;
}

export function safeFilenamePart(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
