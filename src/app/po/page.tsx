import Link from "next/link";
import Image from "next/image";
import type { CSSProperties } from "react";
import {
  ArrowLeft,
  CalendarClock,
  ClipboardList,
  Factory,
  PackageCheck,
  Truck,
  WalletCards,
} from "lucide-react";
import { getPoPortalData } from "@/lib/po-portal";
import { formatNumber } from "@/lib/baseline-data";
import {
  canCreatePo,
  canEditPo,
  canOpenPoDetail,
  canReceivePo,
  canViewIncomingEtaOnly,
  getProfileAccessRole,
  readonlyAccessLabel,
} from "@/lib/access-control";
import { PendingSubmitButton } from "@/app/loading-controls";
import {
  AddPoItemForm,
  CreatePoForm,
  DeleteDraftPoForm,
  PoStatusFilterSelect,
  QuickPoCommentForm,
  StatusActionForm,
} from "@/app/po/po-forms";
import { ChartPopoverControls } from "@/app/po/chart-popover-controls";
import { IncomingEtaSync } from "@/app/po/incoming-eta-sync";
import { PoSidebarNav } from "@/app/po/sidebar-nav";
import { requireUser } from "@/lib/auth";
import {
  matrixItemFamily,
  matrixItemSize,
  matrixProductGroupKey,
  matrixProductName,
  matrixSectionLabel,
  matrixSectionName,
  sortMatrixSizes,
  type MatrixFamily,
} from "@/lib/po-size-matrix";
import { canAccessAdminControlTower, defaultLandingForRole } from "@/lib/role-nav";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const SORT_KEYS = new Set([
  "po",
  "date",
  "supplier",
  "status",
  "lines",
  "incoming",
  "pending",
  "amount",
]);

const DEFAULT_PO_STATUS_OPTIONS = [
  "draft",
  "waiting_for_approve",
  "follow_up",
  "inpro",
  "delivery",
  "final_payment",
  "closed",
  "cancelled",
];
const DEFAULT_ACTIVE_WORKBENCH_STATUSES = [
  "draft",
  "waiting_for_approve",
  "follow_up",
  "inpro",
  "delivery",
  "final_payment",
];

const statusLabels: Record<string, string> = {
  cancelled: "Cancelled",
  closed: "Closed",
  delivery: "Delivery",
  draft: "Draft",
  final_payment: "Final payment",
  follow_up: "Follow-up",
  inpro: "In progress",
  unknown: "Unknown",
  waiting_for_approve: "Waiting approve",
};

const formatCurrency = (value: number, currency: string) =>
  new Intl.NumberFormat("en-US", {
    currency: currency || "THB",
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
    style: "currency",
  }).format(value);

const formatPercent = (value: number) =>
  new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
    style: "percent",
  }).format(value);

const formatDate = (value: string) =>
  value
    ? new Intl.DateTimeFormat("en-US", {
        day: "2-digit",
        month: "short",
      }).format(new Date(`${value}T00:00:00`))
    : "No ETA";

const formatLongDate = (value: string) =>
  value
    ? new Intl.DateTimeFormat("en-US", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }).format(new Date(`${value}T00:00:00`))
    : "No ETA";

const formatShortDate = (value: string) =>
  value
    ? new Intl.DateTimeFormat("en-US", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(new Date(`${value}T00:00:00`))
    : "No ETA";

function bangkokDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Bangkok",
    year: "numeric",
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}`;
}

function incomingEtaStatus(etaDate: string, today: string) {
  if (!etaDate) {
    return "No ETA";
  }

  const daysUntil = daysBetweenDates(today, etaDate);

  if (daysUntil < 0) {
    return "ETA Passed";
  }
  if (daysUntil <= 7) {
    return "Arriving Soon";
  }
  if (daysUntil <= 30) {
    return "Coming Up";
  }

  return "Later";
}

function incomingEtaStatusClass(status: string) {
  if (status.startsWith("Closed")) {
    return "bg-[#eef0f2] text-[#52606d]";
  }
  if (status.startsWith("Cancelled")) {
    return "bg-[#fff0f0] text-[#b42318]";
  }
  if (status === "Received") {
    return "bg-[#eaf6ef] text-[#1f6b3d]";
  }
  if (status === "Partially Received") {
    return "bg-[#eef4f8] text-[#255f85]";
  }
  if (status === "ETA Passed") {
    return "bg-[#fff0f0] text-[#b42318]";
  }
  if (status === "Arriving Soon") {
    return "bg-[#e8f1ff] text-[#255f85]";
  }
  if (status === "Coming Up") {
    return "bg-[#fff4e5] text-[#946200]";
  }
  return "bg-[#eaf6ef] text-[#1f6b3d]";
}

function incomingTimingLabel(row: {
  etaDate: string;
  status: string;
}, today: string) {
  if (row.status === "Received" || row.status === "Closed") {
    return "Received";
  }
  if (!row.etaDate) {
    return "No ETA";
  }

  const daysUntil = daysBetweenDates(today, row.etaDate);
  if (daysUntil < 0) {
    return "Overdue";
  }
  if (daysUntil === 0) {
    return "Due today";
  }
  if (daysUntil === 1) {
    return "In 1 day";
  }
  return `In ${daysUntil} days`;
}

function incomingTimingClass(label: string) {
  if (label === "Received") {
    return "bg-[#eaf6ef] text-[#1f6b3d]";
  }
  if (label === "Overdue") {
    return "bg-[#fff0f0] text-[#b42318]";
  }
  if (label === "Due today") {
    return "bg-[#fff4e5] text-[#946200]";
  }
  if (label === "No ETA") {
    return "bg-[#f3f5f7] text-[#52606d]";
  }
  return "bg-[#e8f1ff] text-[#255f85]";
}

function incomingTimelineBandClass(status: string) {
  if (status === "Received") {
    return "bg-[#eef0f2] text-[#52606d]";
  }
  return incomingEtaStatusClass(status);
}

function dateSpine(dates: string[]) {
  const cleanDates = dates.filter(Boolean).sort();
  if (!cleanDates.length) {
    return [] as string[];
  }

  const result: string[] = [];
  const cursor = new Date(`${cleanDates[0]}T00:00:00Z`);
  const end = new Date(`${cleanDates[cleanDates.length - 1]}T00:00:00Z`);

  while (cursor <= end) {
    result.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return result;
}

function monthAxisSpans(dates: string[]) {
  const spans: Array<{
    key: string;
    label: string;
    span: number;
    start: number;
  }> = [];

  for (const [index, date] of dates.entries()) {
    const key = date.slice(0, 7);
    const last = spans.at(-1);

    if (last?.key === key) {
      last.span += 1;
    } else {
      spans.push({
        key,
        label: new Intl.DateTimeFormat("en-US", { month: "long" }).format(
          new Date(`${date}T00:00:00`),
        ),
        span: 1,
        start: index,
      });
    }
  }

  return spans;
}

function monthDividerLeft(startIndex: number, columnCount: number) {
  return `${(startIndex / Math.max(columnCount, 1)) * 100}%`;
}

function shouldShowIncomingDateLabel({
  day,
}: {
  day: {
    etaDate: string;
    totalIncomingQty: number;
  };
}) {
  return day.totalIncomingQty > 0 && Boolean(day.etaDate);
}

function isMonthBoundary(index: number, dates: string[]) {
  return index > 0 && dates[index]?.slice(0, 7) !== dates[index - 1]?.slice(0, 7);
}

const PAYMENT_VIEW_OPTIONS = ["daily", "weekly", "monthly"] as const;
const PAYMENT_RANGE_OPTIONS = ["30", "60", "90", "180", "all"] as const;
const INCOMING_VIEW_OPTIONS = ["active", "all"] as const;

type PaymentTimelineView = (typeof PAYMENT_VIEW_OPTIONS)[number];
type PaymentTimelineRange = (typeof PAYMENT_RANGE_OPTIONS)[number];
type IncomingEtaView = (typeof INCOMING_VIEW_OPTIONS)[number];

function paymentValueLabelInterval(view: PaymentTimelineView, bucketCount: number) {
  if (view === "monthly") {
    return 1;
  }
  if (view === "weekly") {
    if (bucketCount <= 30) {
      return 1;
    }
    if (bucketCount <= 52) {
      return 2;
    }
    return 4;
  }
  if (bucketCount <= 18) {
    return 1;
  }
  if (bucketCount <= 36) {
    return 2;
  }
  if (bucketCount <= 72) {
    return 4;
  }
  if (bucketCount <= 140) {
    return 7;
  }
  return 14;
}

function shouldShowPaymentValueLabel({
  bucketCount,
  index,
  maxValue,
  value,
  view,
}: {
  bucketCount: number;
  index: number;
  maxValue: number;
  value: number;
  view: PaymentTimelineView;
}) {
  if (value <= 0) {
    return false;
  }

  const interval = paymentValueLabelInterval(view, bucketCount);
  return value === maxValue || index % interval === 0;
}

function paymentMonthSeparatorColor(view: PaymentTimelineView) {
  if (view === "weekly") {
    return "#c9d8ef";
  }
  return "#e5e9ef";
}

function compactCurrency(value: number) {
  if (value >= 1_000_000) {
    return `THB ${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `THB ${(value / 1_000).toFixed(0)}K`;
  }

  return formatCurrency(value, "THB");
}

function compactThb(value: number) {
  if (value >= 1_000_000) {
    return `THB ${(value / 1_000_000).toFixed(value >= 10_000_000 ? 1 : 2).replace(/\.0+$/, "")}M`;
  }
  if (value >= 1_000) {
    const amount = value / 1_000;
    return `THB ${amount >= 100 ? amount.toFixed(0) : amount.toFixed(1).replace(/\.0$/, "")}K`;
  }

  return `THB ${formatNumber(value)}`;
}

function compactUnits(value: number) {
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  }

  return formatNumber(value);
}

function yTicks(maxValue: number, formatter: (value: number) => string) {
  return [1, 0.5, 0].map((ratio) => ({
    label: formatter(Math.round(maxValue * ratio)),
    top: `${(1 - ratio) * 100}%`,
  }));
}

function paymentSeriesLabel(value: string) {
  if (value === "paid") {
    return "Paid";
  }
  if (value === "overdue") {
    return "Overdue";
  }
  return "Planned";
}

function humanPaymentType(value: string, fallback = "-") {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9%]+/g, "");
  const labels: Record<string, string> = {
    "afterreceived25": "After Received 25%",
    "afterreceived25%": "After Received 25%",
    "afterreceived25%1month": "After Received 25% - 1 Month",
    "afterrecived25": "After Received 25%",
    "afterrecived25%": "After Received 25%",
    "afterrecived25%1month": "After Received 25% - 1 Month",
    "aftersale25%1month": "After Sale 25% - 1 Month",
    "beforeshipments25": "Before Shipment 25%",
    "beforeshipments25%": "Before Shipment 25%",
    "beforeshipments50": "Before Shipment 50%",
    "beforeshipments50%": "Before Shipment 50%",
    "deposit50": "Deposit 50%",
    "deposit50%": "Deposit 50%",
    freight: "Freight",
    other: "Other",
    shipping: "Shipping",
  };

  if (labels[normalized]) {
    return labels[normalized];
  }

  return value.trim() || fallback;
}

function currencyCode(value: string) {
  return value.trim().toUpperCase() || "THB";
}

function isThbCurrency(currency: string) {
  return currencyCode(currency) === "THB";
}

function hasValidFxRate(event: {
  amountThb: number;
  currency: string;
  exchangeRate?: number;
}) {
  return isThbCurrency(event.currency) || (event.exchangeRate ?? 0) > 1;
}

function cashflowAmountThb(event: {
  amountOriginal?: number;
  amountThb: number;
  currency: string;
  exchangeRate?: number;
}) {
  if (isThbCurrency(event.currency)) {
    return event.amountThb || event.amountOriginal || 0;
  }
  return hasValidFxRate(event) ? event.amountThb : 0;
}

function cashflowTotalThb<T extends { amountOriginal?: number; amountThb: number; currency: string; exchangeRate?: number }>(
  events: T[],
) {
  return events.reduce((sum, event) => sum + cashflowAmountThb(event), 0);
}

function missingFxCount<T extends { amountThb: number; currency: string; exchangeRate?: number }>(
  events: T[],
) {
  return events.filter((event) => !hasValidFxRate(event)).length;
}

function originalAmount(event: {
  amountOriginal?: number;
  amountThb: number;
  currency: string;
  exchangeRate?: number;
}) {
  if ((event.amountOriginal ?? 0) > 0) {
    return event.amountOriginal ?? 0;
  }
  if (!isThbCurrency(event.currency) && (event.exchangeRate ?? 0) > 0) {
    return event.amountThb / (event.exchangeRate ?? 1);
  }
  return event.amountThb;
}

function formatPaymentAmount(event: {
  amountOriginal?: number;
  amountThb: number;
  currency: string;
  exchangeRate?: number;
}) {
  const currency = currencyCode(event.currency);
  const original = originalAmount(event);

  if (currency === "THB") {
    return {
      primary: formatCurrency(event.amountThb || original, "THB"),
      secondary: "",
      warning: "",
    };
  }

  if (!hasValidFxRate(event)) {
    return {
      primary: formatCurrency(original, currency),
      secondary: "FX rate missing",
      warning: "Not included in THB cashflow total",
    };
  }

  return {
    primary: `${formatCurrency(event.amountThb, "THB")} est.`,
    secondary: `Original: ${formatCurrency(original, currency)} @ ${(event.exchangeRate ?? 0).toFixed(2)}`,
    warning: "",
  };
}

function fxWarningText(count: number) {
  return count > 0 ? `${formatNumber(count)} FX rate missing` : "";
}

function originalPaymentTotalsText(events: Array<{
  amountOriginal?: number;
  amountThb: number;
  currency: string;
  exchangeRate?: number;
}>) {
  const totals = new Map<string, number>();

  for (const event of events) {
    const currency = currencyCode(event.currency);
    const original = originalAmount(event);
    totals.set(currency, (totals.get(currency) ?? 0) + original);
  }

  return Array.from(totals.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, amount]) => formatCurrency(amount, currency))
    .join(" + ");
}

function normalizePaymentView(value?: string): PaymentTimelineView {
  return PAYMENT_VIEW_OPTIONS.includes(value as PaymentTimelineView)
    ? (value as PaymentTimelineView)
    : "weekly";
}

function normalizePaymentRange(value?: string): PaymentTimelineRange {
  return PAYMENT_RANGE_OPTIONS.includes(value as PaymentTimelineRange)
    ? (value as PaymentTimelineRange)
    : "all";
}

function normalizeIncomingEtaView(value?: string): IncomingEtaView {
  return INCOMING_VIEW_OPTIONS.includes(value as IncomingEtaView)
    ? (value as IncomingEtaView)
    : "active";
}

function addUtcDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function startOfUtcWeek(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  const day = date.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function endOfUtcWeek(value: string) {
  return addUtcDays(startOfUtcWeek(value), 6);
}

function startOfUtcMonth(value: string) {
  return `${value.slice(0, 7)}-01`;
}

function endOfUtcMonth(value: string) {
  const date = new Date(`${value.slice(0, 7)}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function paymentBucketRange(value: string, view: PaymentTimelineView) {
  if (view === "monthly") {
    return {
      end: endOfUtcMonth(value),
      key: startOfUtcMonth(value),
      label: new Intl.DateTimeFormat("en-US", {
        month: "short",
        year: "numeric",
      }).format(new Date(`${value}T00:00:00Z`)),
    };
  }

  if (view === "weekly") {
    const start = startOfUtcWeek(value);
    const end = endOfUtcWeek(value);
    return {
      end,
      key: start,
      label: `${formatDate(start)}-${formatDate(end)}`,
    };
  }

  return {
    end: value,
    key: value,
    label: formatDate(value),
  };
}

function daysBetweenDates(from: string, to: string) {
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  return Math.floor((end.getTime() - start.getTime()) / 86_400_000);
}

function datePositionInBuckets(
  value: string,
  buckets: Array<{ bucketEnd: string; bucketStart: string }>,
) {
  const bucketIndex = buckets.findIndex(
    (bucket) => bucket.bucketStart <= value && bucket.bucketEnd >= value,
  );
  if (bucketIndex < 0 || buckets.length === 0) {
    return "";
  }

  const bucket = buckets[bucketIndex];
  const bucketDays = Math.max(1, daysBetweenDates(bucket.bucketStart, bucket.bucketEnd) + 1);
  const dayOffset = Math.max(0, Math.min(bucketDays - 1, daysBetweenDates(bucket.bucketStart, value)));
  return `${((bucketIndex + (dayOffset + 0.5) / bucketDays) / buckets.length) * 100}%`;
}

function monthSpansForPaymentBuckets(
  buckets: Array<{
    bucketStart: string;
    paidAmountThb: number;
    plannedAmountThb: number;
  }>,
) {
  const spans: Array<{
    key: string;
    label: string;
    paidAmountThb: number;
    plannedAmountThb: number;
    span: number;
    start: number;
  }> = [];

  for (const [index, bucket] of buckets.entries()) {
    const key = bucket.bucketStart.slice(0, 7);
    const last = spans.at(-1);

    if (last?.key === key) {
      last.span += 1;
      last.paidAmountThb += bucket.paidAmountThb;
      last.plannedAmountThb += bucket.plannedAmountThb;
    } else {
      spans.push({
        key,
        label: new Intl.DateTimeFormat("en-US", { month: "short" }).format(
          new Date(`${bucket.bucketStart}T00:00:00Z`),
        ),
        paidAmountThb: bucket.paidAmountThb,
        plannedAmountThb: bucket.plannedAmountThb,
        span: 1,
        start: index,
      });
    }
  }

  return spans;
}

const SUPPLIER_COLOR_PALETTE = [
  "#2563eb",
  "#ea580c",
  "#16a34a",
  "#7c3aed",
  "#0f766e",
  "#be123c",
  "#d97706",
  "#4f46e5",
  "#0891b2",
  "#65a30d",
  "#db2777",
  "#475569",
  "#9333ea",
];

function supplierColor(supplierName: string) {
  const normalized = supplierName.trim().toLowerCase();

  let hash = 0;
  for (const char of normalized) {
    hash = (hash * 31 + char.charCodeAt(0)) % SUPPLIER_COLOR_PALETTE.length;
  }

  return SUPPLIER_COLOR_PALETTE[hash] ?? "#2563eb";
}

function normalizedSupplierLegendKey(supplierName: string) {
  return supplierName.trim().replace(/\s+/g, " ").toLowerCase();
}

function generatedSupplierColor(supplierName: string) {
  let hash = 0;
  for (const char of normalizedSupplierLegendKey(supplierName)) {
    hash = (hash * 31 + char.charCodeAt(0)) % 360;
  }

  return `hsl(${hash} 68% 42%)`;
}

function buildSupplierColorMap(supplierNames: string[]) {
  const colorMap = new Map<string, string>();
  const uniqueNames = Array.from(
    new Map(
      supplierNames
        .map((name) => name.trim())
        .filter(Boolean)
        .map((name) => [normalizedSupplierLegendKey(name), name]),
    ).values(),
  ).sort((a, b) => a.localeCompare(b));

  uniqueNames.forEach((name, index) => {
    colorMap.set(
      normalizedSupplierLegendKey(name),
      SUPPLIER_COLOR_PALETTE[index] ?? generatedSupplierColor(name),
    );
  });

  return colorMap;
}

function colorForSupplier(supplierName: string, colorMap?: Map<string, string>) {
  return colorMap?.get(normalizedSupplierLegendKey(supplierName)) ?? supplierColor(supplierName);
}

type IncomingEtaTooltipItem = {
  dateReceived: string;
  etaSource: string;
  headerPurpose: string;
  imageUrl: string;
  incomingQty: number;
  latestSupplierComment: string;
  lineStatus: string;
  orderedQty: number;
  poDetailHref: string;
  poId: string;
  poItemId: string;
  poReference: string;
  poStatus: string;
  productName: string;
  productTitle: string;
  quotationReference: string;
  receivedQty: number;
  sku: string;
  supplierInvoiceNo: string;
  tags: string[];
  variantTitle: string;
};

type IncomingEtaSupplierRow = {
  etaDate: string;
  itemCount: number;
  poCount: number;
  supplierName: string;
  tooltipItems: IncomingEtaTooltipItem[];
  totalIncomingQty: number;
};

function topIncomingSupplier(rows: IncomingEtaSupplierRow[], colorMap?: Map<string, string>) {
  const sorted = [...rows]
    .filter((row) => row.totalIncomingQty > 0)
    .sort((a, b) => b.totalIncomingQty - a.totalIncomingQty);
  const top = sorted[0];
  if (!top) {
    return null;
  }

  const secondQty = sorted[1]?.totalIncomingQty ?? 0;
  const isClearTop = sorted.length === 1 || top.totalIncomingQty >= secondQty * 1.2;

  return {
    color: colorForSupplier(top.supplierName, colorMap),
    isClearTop,
    row: top,
  };
}

function supplierBreakdownForRows(rows: IncomingEtaSupplierRow[], colorMap?: Map<string, string>) {
  return rows
    .map((row) => ({
      color: colorForSupplier(row.supplierName, colorMap),
      poCount: row.poCount,
      supplierName: row.supplierName || "Unknown supplier",
      totalIncomingQty: row.totalIncomingQty,
    }))
    .filter((row) => row.totalIncomingQty > 0)
    .sort((a, b) => b.totalIncomingQty - a.totalIncomingQty || a.supplierName.localeCompare(b.supplierName));
}

function purposeText(value: string) {
  return value.trim() || "-";
}

function poReferenceText(group: {
  poId: string;
  poReference: string;
  quotationReference: string;
}) {
  return group.poReference || group.quotationReference || group.poId || "Unknown PO";
}

function incomingItemName(item: IncomingEtaTooltipItem) {
  return item.productName || item.productTitle || item.sku || "Incoming item";
}

function incomingItemVariant(item: IncomingEtaTooltipItem) {
  if (item.variantTitle && !incomingItemName(item).includes(item.variantTitle)) {
    return item.variantTitle;
  }
  return item.sku;
}

function incomingMainProductName(item: IncomingEtaTooltipItem) {
  return matrixProductName(item);
}

function safeDomId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "item";
}

function groupedIncomingProducts(rows: IncomingEtaSupplierRow[]) {
  const groups = new Map<string, {
    category: string;
    family: MatrixFamily;
    id: string;
    imageUrl: string;
    items: Array<IncomingEtaTooltipItem & { supplierName: string }>;
    mainName: string;
    sectionLabel: string;
    sizeColumns: string[];
    sizeTotals: Map<string, number>;
    totalQty: number;
  }>();

  for (const row of rows) {
    for (const item of row.tooltipItems) {
      const category = matrixSectionName(item, item.headerPurpose || "Other Incoming");
      const family = matrixItemFamily(item);
      const key = matrixProductGroupKey(item);
      const group = groups.get(key) ?? {
        category,
        family,
        id: safeDomId(key),
        imageUrl: item.imageUrl,
        items: [],
        mainName: incomingMainProductName(item),
        sectionLabel: matrixSectionLabel(category, family),
        sizeColumns: [],
        sizeTotals: new Map<string, number>(),
        totalQty: 0,
      };
      const size = matrixItemSize(item);
      group.items.push({ ...item, supplierName: row.supplierName });
      if (!group.imageUrl && item.imageUrl) {
        group.imageUrl = item.imageUrl;
      }
      group.sizeTotals.set(size, (group.sizeTotals.get(size) ?? 0) + item.incomingQty);
      group.totalQty += item.incomingQty;
      group.sizeColumns = sortMatrixSizes(Array.from(group.sizeTotals.keys()), group.family);
      groups.set(key, group);
    }
  }

  return Array.from(groups.values()).sort(
    (a, b) =>
      a.sectionLabel.localeCompare(b.sectionLabel) ||
      b.totalQty - a.totalQty ||
      a.mainName.localeCompare(b.mainName),
  );
}

function groupedProductPoDetails(items: Array<IncomingEtaTooltipItem & { supplierName: string }>) {
  const groups = new Map<string, {
    items: Array<IncomingEtaTooltipItem & { supplierName: string }>;
    poDetailHref: string;
    poId: string;
    poReference: string;
    sizeTotals: Map<string, number>;
    supplierName: string;
    totalQty: number;
  }>();

  for (const item of items) {
    const key = item.poId || item.poReference || item.poDetailHref;
    const group = groups.get(key) ?? {
      items: [],
      poDetailHref: item.poDetailHref || (item.poId ? `/po/${item.poId}` : "/po"),
      poId: item.poId,
      poReference: item.poReference,
      sizeTotals: new Map<string, number>(),
      supplierName: item.supplierName,
      totalQty: 0,
    };
    const size = matrixItemSize(item);
    group.items.push(item);
    group.sizeTotals.set(size, (group.sizeTotals.get(size) ?? 0) + item.incomingQty);
    group.totalQty += item.incomingQty;
    groups.set(key, group);
  }

  return Array.from(groups.values()).sort(
    (a, b) => a.supplierName.localeCompare(b.supplierName) || a.poReference.localeCompare(b.poReference),
  );
}

function productSections<T extends { sectionLabel: string }>(products: T[]) {
  return Array.from(
    products
      .reduce((sections, product) => {
        sections.set(product.sectionLabel, [...(sections.get(product.sectionLabel) ?? []), product]);
        return sections;
      }, new Map<string, T[]>())
      .entries(),
  );
}

function sizeSummary(sizeColumns: string[], sizeTotals: Map<string, number>) {
  return sizeColumns
    .map((size) => {
      const qty = sizeTotals.get(size) ?? 0;
      return qty > 0 ? `${size} ${formatNumber(qty)}` : "";
    })
    .filter(Boolean)
    .join(" · ");
}

function groupedIncomingPos(rows: IncomingEtaSupplierRow[]) {
  const groups = new Map<
    string,
    {
      etaSources: string[];
      dateReceived: string;
      headerPurpose: string;
      incomingQty: number;
      latestSupplierComment: string;
      lineStatuses: string[];
      lineCount: number;
      orderedQty: number;
      poDetailHref: string;
      poId: string;
      poReference: string;
      poStatuses: string[];
      quotationReference: string;
      receivedQty: number;
      supplierInvoiceNo: string;
      supplierName: string;
    }
  >();

  for (const row of rows) {
    for (const item of row.tooltipItems) {
      const key = item.poId || item.poDetailHref || item.poReference || item.quotationReference;
      const current = groups.get(key) ?? {
        etaSources: [] as string[],
        dateReceived: item.dateReceived,
        headerPurpose: item.headerPurpose,
        incomingQty: 0,
        latestSupplierComment: "",
        lineStatuses: [] as string[],
        lineCount: 0,
        orderedQty: 0,
        poDetailHref: item.poDetailHref || (item.poId ? `/po/${item.poId}` : "/po"),
        poId: item.poId,
        poReference: item.poReference,
        poStatuses: [] as string[],
        quotationReference: item.quotationReference,
        receivedQty: 0,
        supplierInvoiceNo: item.supplierInvoiceNo,
        supplierName: row.supplierName,
      };

      current.incomingQty += item.incomingQty;
      current.orderedQty += item.orderedQty;
      current.receivedQty += item.receivedQty;
      current.lineCount += 1;
      if (item.dateReceived && item.dateReceived > current.dateReceived) {
        current.dateReceived = item.dateReceived;
      }
      if (!current.headerPurpose && item.headerPurpose) {
        current.headerPurpose = item.headerPurpose;
      }
      if (!current.latestSupplierComment && item.latestSupplierComment) {
        current.latestSupplierComment = item.latestSupplierComment;
      }
      if (!current.quotationReference && item.quotationReference) {
        current.quotationReference = item.quotationReference;
      }
      if (!current.supplierInvoiceNo && item.supplierInvoiceNo) {
        current.supplierInvoiceNo = item.supplierInvoiceNo;
      }
      if (item.etaSource) {
        current.etaSources.push(item.etaSource);
      }
      if (item.lineStatus) {
        current.lineStatuses.push(item.lineStatus);
      }
      if (item.poStatus) {
        current.poStatuses.push(item.poStatus);
      }
      groups.set(key, current);
    }
  }

  return Array.from(groups.values()).sort((a, b) =>
    poReferenceText(a).localeCompare(poReferenceText(b)),
  );
}

function incomingActionStatus(row: {
  balanceQty: number;
  etaStatus: string;
  poStatus?: string;
  receivedQty: number;
  totalQty: number;
}) {
  const poStatus = normalizeStatusLabel(row.poStatus ?? "");
  if (poStatus === "closed") {
    return row.receivedQty > 0 && row.totalQty > 0 && row.receivedQty < row.totalQty
      ? "Closed / Partially Received"
      : "Closed";
  }
  if (poStatus === "cancelled" || poStatus === "canceled") {
    return "Cancelled";
  }
  if (row.totalQty > 0 && row.receivedQty >= row.totalQty && row.balanceQty <= 0) {
    return "Received";
  }
  if (row.receivedQty > 0) {
    return "Partially Received";
  }
  return row.etaStatus;
}

function isClosedOrCancelledStatus(value: string) {
  const status = normalizeStatusLabel(value);
  return status === "closed" || status === "cancelled" || status === "canceled";
}

function isPhysicalIncomingStatus(value: string) {
  const status = normalizeStatusLabel(value);
  return status === "inpro" || status === "delivery";
}

function isActiveIncomingRecord(row: {
  balanceQty: number;
  lineStatus?: string;
  poStatus?: string;
  receivedQty: number;
  totalQty: number;
}) {
  if (row.balanceQty <= 0) {
    return false;
  }
  if (row.totalQty > 0 && row.receivedQty >= row.totalQty) {
    return false;
  }
  if (row.poStatus && (isClosedOrCancelledStatus(row.poStatus) || !isPhysicalIncomingStatus(row.poStatus))) {
    return false;
  }
  if (row.lineStatus && (isClosedOrCancelledStatus(row.lineStatus) || !isPhysicalIncomingStatus(row.lineStatus))) {
    return false;
  }
  return true;
}

function incomingActionSortRank(status: string) {
  if (status === "ETA Passed") {
    return 0;
  }
  if (status === "Partially Received") {
    return 1;
  }
  if (status === "Arriving Soon") {
    return 2;
  }
  if (status === "Coming Up") {
    return 3;
  }
  if (status === "Later") {
    return 4;
  }
  if (status === "Received") {
    return 5;
  }
  return 6;
}

function receivedReferenceText(row: {
  poId: string;
  poReference: string;
  quotationReference: string;
}) {
  const primary = row.poId || row.poReference || row.quotationReference || "Unknown PO";
  const secondary = row.poReference || row.quotationReference;

  return secondary && secondary !== primary ? `${primary} / ${secondary}` : primary;
}

function incomingTimelineBands(
  dates: string[],
  today: string,
  view: IncomingEtaView,
) {
  const soonEnd = addUtcDays(today, 7);
  const comingEnd = addUtcDays(today, 30);
  const bands: Array<{
    label: string;
    span: number;
    start: number;
  }> = [];

  for (const [index, date] of dates.entries()) {
    let label = "";

    if (view === "all" && date < today) {
      label = "Received";
    } else if (date >= today && date <= soonEnd) {
      label = "Arriving Soon";
    } else if (date > soonEnd && date <= comingEnd) {
      label = "Coming Up";
    } else if (date > comingEnd) {
      label = "Later";
    }

    if (!label) {
      continue;
    }

    const previous = bands.at(-1);
    if (previous?.label === label && previous.start + previous.span === index) {
      previous.span += 1;
    } else {
      bands.push({ label, span: 1, start: index });
    }
  }

  return bands;
}

function normalizeValues(value?: string | string[]) {
  return (Array.isArray(value) ? value : value ? [value] : [])
    .flatMap((item) => item.split(","))
    .map((item) => normalizeStatusLabel(item))
    .filter(Boolean);
}

function normalizeSelectedStatuses(value?: string | string[]) {
  const statuses = Array.from(new Set(normalizeValues(value)));
  if (statuses.includes("all")) {
    return ["all"];
  }
  return statuses.length === 0 ? DEFAULT_ACTIVE_WORKBENCH_STATUSES : statuses;
}

function normalizeStatusLabel(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function displayStatus(value: string) {
  return statusLabels[normalizeStatusLabel(value)] ?? value;
}

function generatedPoId() {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
    String(now.getMilliseconds()).padStart(3, "0"),
  ].join("");
  return `PO-${stamp}`;
}

const statusClass = (status: string) => {
  const normalized = normalizeStatusLabel(status);
  if (normalized === "delivery") {
    return "bg-[#eaf6ef] text-[#1f6b3d]";
  }
  if (normalized === "inpro" || normalized === "final_payment") {
    return "bg-[#fff4e5] text-[#946200]";
  }
  if (normalized === "follow_up") {
    return "bg-[#f1ecff] text-[#6b3fb3]";
  }
  if (normalized === "waiting_for_approve") {
    return "bg-[#eef4f8] text-[#255f85]";
  }
  return "bg-[#f3f5f7] text-[#52606d]";
};

export default async function PoPortalPage({
  searchParams,
}: {
  searchParams: Promise<{
    dir?: string;
    page?: string;
    incomingView?: string;
    paymentRange?: string;
    paymentView?: string;
    q?: string;
    sort?: string;
    status?: string | string[];
  }>;
}) {
  const currentUser = await requireUser("/po");
  const incomingEtaOnly = canViewIncomingEtaOnly(currentUser.email);
  const allowCreatePo = canCreatePo(currentUser.email) && currentUser.role === "super_admin";
  const allowEditPo = canEditPo(currentUser.email) && currentUser.role === "super_admin";
  const allowOpenPoDetail = canOpenPoDetail(currentUser.email);
  const allowReceivePo = canReceivePo(currentUser.email);
  const isWarehouseStaff = getProfileAccessRole(currentUser) === "warehouse_staff";
  const accessNote = readonlyAccessLabel(currentUser);

  if (!incomingEtaOnly && !canAccessAdminControlTower(currentUser)) {
    redirect(`/access-denied?from=${encodeURIComponent("/po")}&next=${encodeURIComponent(defaultLandingForRole(currentUser.role))}`);
  }
  const params = await searchParams;
  const { q = "" } = params;
  const incomingView = normalizeIncomingEtaView(params.incomingView);
  const paymentView = normalizePaymentView(params.paymentView);
  const paymentRange = normalizePaymentRange(params.paymentRange);
  const selectedStatuses = normalizeSelectedStatuses(params.status);
  const selectedStatusSet = new Set(selectedStatuses);
  const sortKey = SORT_KEYS.has(params.sort ?? "") ? params.sort ?? "date" : "date";
  const sortDir = params.dir === "asc" ? "asc" : "desc";
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const data = await getPoPortalData({
    dir: sortDir,
    includeReceivedHistory: incomingView === "all",
    page,
    pageSize: 25,
    q,
    sort: sortKey,
    status: selectedStatuses,
  });
  const scheduledEtaRows = data.incomingEta.daily
    .map((row) => {
      const tooltipItems = row.tooltipItems.filter((item) =>
        isActiveIncomingRecord({
          balanceQty: item.incomingQty,
          lineStatus: item.lineStatus,
          poStatus: item.poStatus,
          receivedQty: item.receivedQty,
          totalQty: item.orderedQty,
        }),
      );
      const totalIncomingQty = tooltipItems.reduce((sum, item) => sum + item.incomingQty, 0);
      return {
        ...row,
        itemCount: tooltipItems.length,
        poCount: new Set(tooltipItems.map((item) => item.poId).filter(Boolean)).size,
        tooltipItems,
        totalIncomingQty,
      };
    })
    .filter((row) => row.totalIncomingQty > 0 && row.tooltipItems.length > 0);
  const unscheduledEtaRows = data.incomingEta.unscheduled.filter((row) =>
    isActiveIncomingRecord({
      balanceQty: row.incomingQty,
      lineStatus: row.lineStatus,
      poStatus: row.poStatus,
      receivedQty: 0,
      totalQty: 0,
    }),
  );
  const etaReconciliation = {
    ...data.incomingEta.reconciliation,
    pipelineItemCount: scheduledEtaRows.reduce((sum, row) => sum + row.itemCount, 0) + unscheduledEtaRows.length,
    pipelinePoCount: new Set([
      ...scheduledEtaRows.flatMap((row) => row.tooltipItems.map((item) => item.poId)),
      ...unscheduledEtaRows.map((row) => row.poId),
    ].filter(Boolean)).size,
    scheduledEtaQty: scheduledEtaRows.reduce((sum, row) => sum + row.totalIncomingQty, 0),
    scheduledItemCount: scheduledEtaRows.reduce((sum, row) => sum + row.itemCount, 0),
    scheduledPoCount: new Set(
      scheduledEtaRows.flatMap((row) => row.tooltipItems.map((item) => item.poId)).filter(Boolean),
    ).size,
    totalIncomingPipelineQty:
      scheduledEtaRows.reduce((sum, row) => sum + row.totalIncomingQty, 0) +
      unscheduledEtaRows.reduce((sum, row) => sum + row.incomingQty, 0),
    unscheduledEtaQty: unscheduledEtaRows.reduce((sum, row) => sum + row.incomingQty, 0),
    unscheduledItemCount: unscheduledEtaRows.length,
    unscheduledPoCount: new Set(unscheduledEtaRows.map((row) => row.poId).filter(Boolean)).size,
  };
  const today = bangkokDateString();
  const incomingToday = today;
  const receivedHistoryRows = Array.from(
    (data.incomingEta.receivedHistory ?? [])
      .filter((row) => row.dateReceived && row.receivedQty > 0)
      .reduce((groups, row) => {
        const key = `${row.dateReceived}-${row.poId || row.poReference || row.supplierName}`;
        const current = groups.get(key) ?? {
          ...row,
          lineCount: 0,
          receivedQty: 0,
        };

        current.lineCount += Math.max(1, row.lineCount || 0);
        current.receivedQty += row.receivedQty;
        current.totalQty = Math.max(current.totalQty, row.totalQty);
        current.balanceQty = Math.max(current.balanceQty, row.balanceQty);
        groups.set(key, current);
        return groups;
      }, new Map<string, NonNullable<typeof data.incomingEta.receivedHistory>[number]>())
      .values(),
  );
  const incomingByDate = scheduledEtaRows.reduce((groups, row) => {
    const group = groups.get(row.etaDate) ?? {
      etaDate: row.etaDate,
      rows: [] as typeof scheduledEtaRows,
      totalIncomingQty: 0,
      totalItemCount: 0,
      totalPoCount: 0,
    };

    group.rows.push(row);
    group.totalIncomingQty += row.totalIncomingQty;
    group.totalItemCount += row.itemCount;
    group.totalPoCount += row.poCount;
    groups.set(row.etaDate, group);

    return groups;
  }, new Map<string, {
    etaDate: string;
    rows: typeof scheduledEtaRows;
    totalIncomingQty: number;
    totalItemCount: number;
    totalPoCount: number;
  }>());
  const receivedByDate = receivedHistoryRows.reduce((groups, row) => {
    const group = groups.get(row.dateReceived) ?? {
      dateReceived: row.dateReceived,
      rows: [] as typeof receivedHistoryRows,
      totalReceivedQty: 0,
    };

    group.rows.push(row);
    group.totalReceivedQty += row.receivedQty;
    groups.set(row.dateReceived, group);

    return groups;
  }, new Map<string, {
    dateReceived: string;
    rows: typeof receivedHistoryRows;
    totalReceivedQty: number;
  }>());
  const incomingChartDates =
    incomingView === "all"
      ? [
          ...scheduledEtaRows.map((row) => row.etaDate),
          ...receivedHistoryRows.map((row) => row.dateReceived),
        ]
      : scheduledEtaRows.map((row) => row.etaDate);
  const incomingDateSpine = dateSpine(incomingChartDates);
  const incomingMonthSpans = monthAxisSpans(incomingDateSpine);
  const incomingChartDays = incomingDateSpine.map((date) => {
    const incomingGroup = incomingByDate.get(date) ?? {
      etaDate: date,
      rows: [] as typeof scheduledEtaRows,
      totalIncomingQty: 0,
      totalItemCount: 0,
      totalPoCount: 0,
    };
    const receivedGroup = receivedByDate.get(date) ?? {
      dateReceived: date,
      rows: [] as typeof receivedHistoryRows,
      totalReceivedQty: 0,
    };

    return {
      ...incomingGroup,
      receivedRows: receivedGroup.rows,
      totalChartQty:
        incomingGroup.totalIncomingQty +
        (incomingView === "all" ? receivedGroup.totalReceivedQty : 0),
      totalReceivedQty: incomingView === "all" ? receivedGroup.totalReceivedQty : 0,
    };
  });
  const incomingMonthTotals = incomingChartDays.reduce((totals, day) => {
    const key = day.etaDate.slice(0, 7);
    totals.set(key, (totals.get(key) ?? 0) + day.totalChartQty);
    return totals;
  }, new Map<string, number>());
  const incomingSupplierColorMap = buildSupplierColorMap(
    scheduledEtaRows.map((row) => row.supplierName),
  );
  const incomingSupplierLegend = Array.from(
    new Map(
      supplierBreakdownForRows(scheduledEtaRows, incomingSupplierColorMap).map((supplier) => [
        normalizedSupplierLegendKey(supplier.supplierName),
        supplier,
      ]),
    ).values(),
  ).slice(0, 8);
  const defaultSelectedIncomingDay =
    incomingChartDays.find((day) => day.totalIncomingQty > 0 && day.etaDate >= incomingToday) ??
    incomingChartDays.find((day) => day.totalIncomingQty > 0) ??
    incomingChartDays[0] ??
    null;
  const maxIncomingDayQty = Math.max(
    1,
    ...incomingChartDays.map((row) => row.totalChartQty),
  );
  const incomingTicks = yTicks(maxIncomingDayQty, compactUnits);
  const incomingChartStartDate = incomingDateSpine[0] ?? "";
  const incomingChartEndDate = incomingDateSpine.at(-1) ?? "";
  const incomingChartColumnCount = Math.max(incomingChartDays.length, 1);
  const incomingChartDayCount =
    incomingChartStartDate && incomingChartEndDate
      ? daysBetweenDates(incomingChartStartDate, incomingChartEndDate) + 1
      : 0;
  const incomingTodayLeft =
    incomingChartStartDate &&
    incomingChartEndDate &&
    incomingToday >= incomingChartStartDate &&
    incomingToday <= incomingChartEndDate &&
    incomingChartDayCount > 0
      ? `${((daysBetweenDates(incomingChartStartDate, incomingToday) + 0.5) / incomingChartDayCount) * 100}%`
      : "";
  const incomingBarHeight = (quantity: number) =>
    quantity > 0 ? Math.max(8, (quantity / maxIncomingDayQty) * 210) : 3;
  const incomingBucketLeft = (index: number) =>
    `${((index + 0.5) / incomingChartColumnCount) * 100}%`;
  const incomingTimelineBandSpans = incomingTimelineBands(
    incomingDateSpine,
    incomingToday,
    incomingView,
  );
  const arrivingIn7DaysQty = scheduledEtaRows
    .filter((row) => row.etaDate >= incomingToday && row.etaDate <= addUtcDays(incomingToday, 7))
    .reduce((sum, row) => sum + row.totalIncomingQty, 0);
  const arrivingIn30DaysQty = scheduledEtaRows
    .filter((row) => row.etaDate >= incomingToday && row.etaDate <= addUtcDays(incomingToday, 30))
    .reduce((sum, row) => sum + row.totalIncomingQty, 0);
  const activeIncomingActionRows = scheduledEtaRows
    .flatMap((row) =>
      groupedIncomingPos([row]).map((group) => {
        const etaStatus = incomingEtaStatus(row.etaDate, incomingToday);
        const totalQty = group.orderedQty || group.receivedQty + group.incomingQty;
        const poStatus = group.poStatuses[0] ?? "";

        return {
          balanceQty: group.incomingQty,
          dateReceived: group.dateReceived,
          etaDate: row.etaDate,
          etaStatus,
          headerPurpose: group.headerPurpose,
          lineCount: group.lineCount,
          poDetailHref: group.poDetailHref || `/po/${group.poId}`,
          poId: group.poId,
          poReference: group.poReference,
          quotationReference: group.quotationReference,
          receivedQty: group.receivedQty,
          status: incomingActionStatus({
            balanceQty: group.incomingQty,
            etaStatus,
            poStatus,
            receivedQty: group.receivedQty,
            totalQty,
          }),
          supplierName: group.supplierName,
          source: "active" as const,
          totalIncomingQty: group.incomingQty,
          totalQty,
        };
      }),
    )
    .sort((a, b) => {
      const statusRank = incomingActionSortRank(a.status) - incomingActionSortRank(b.status);
      if (statusRank !== 0) {
        return statusRank;
      }
      return a.etaDate.localeCompare(b.etaDate);
    });
  const activeIncomingPoIds = new Set(activeIncomingActionRows.map((row) => row.poId).filter(Boolean));
  const historicalIncomingActionRows = (data.incomingEta.receivedHistory ?? [])
    .filter((row) => row.poId && !activeIncomingPoIds.has(row.poId))
    .map((row) => {
      const etaStatus = row.etaDate ? incomingEtaStatus(row.etaDate, incomingToday) : "Later";
      return {
        balanceQty: row.balanceQty,
        dateReceived: row.dateReceived,
        etaDate: row.etaDate,
        etaStatus,
        headerPurpose: row.headerPurpose,
        lineCount: row.lineCount,
        poDetailHref: row.poDetailHref,
        poId: row.poId,
        poReference: row.poReference,
        quotationReference: row.quotationReference,
        receivedQty: row.receivedQty,
        status: incomingActionStatus({
          balanceQty: row.balanceQty,
          etaStatus,
          poStatus: row.workStatus,
          receivedQty: row.receivedQty,
          totalQty: row.totalQty,
        }),
        supplierName: row.supplierName,
        source: "historical" as const,
        totalIncomingQty: row.balanceQty,
        totalQty: row.totalQty,
      };
    });
  const incomingActionRows = (incomingView === "all"
    ? [...activeIncomingActionRows, ...historicalIncomingActionRows]
    : activeIncomingActionRows
  ).sort((a, b) => {
    const statusRank = incomingActionSortRank(a.status) - incomingActionSortRank(b.status);
    if (statusRank !== 0) {
      return statusRank;
    }
    return (a.etaDate || "9999-12-31").localeCompare(b.etaDate || "9999-12-31");
  });
  const incomingSyncRows = incomingActionRows.map((row) => ({
    balanceQty: row.balanceQty,
    dateReceived: row.dateReceived,
    etaDate: row.etaDate,
    lineCount: row.lineCount,
    poId: row.poId,
    receivedQty: row.receivedQty,
    source: row.source,
    supplierName: row.supplierName,
    totalIncomingQty: row.totalIncomingQty,
    totalQty: row.totalQty,
  }));
  const incomingSyncUnscheduledRows = unscheduledEtaRows.map((row) => ({
    incomingQty: row.incomingQty,
    supplierName: row.supplierName,
  }));
  const defaultIncomingActionCount = 7;
  const primaryIncomingActionRows = incomingActionRows.slice(0, defaultIncomingActionCount);
  const extraIncomingActionRows = incomingActionRows.slice(defaultIncomingActionCount);
  type PaymentTimelineEvent = {
    amountOriginal?: number;
    amountThb: number;
    currency: string;
    eventDate: string;
    exchangeRate?: number;
    headerPurpose?: string;
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
  };
  const paymentEvents = data.paymentTimeline as PaymentTimelineEvent[];
  const paymentRangeEnd =
    paymentRange === "all" ? "" : addUtcDays(today, Number(paymentRange));
  const filteredPaymentEvents = paymentEvents.filter((event) => {
    if (paymentRange === "all") {
      return true;
    }
    if (event.series === "planned" && event.eventDate < today) {
      return true;
    }
    return event.eventDate >= today && event.eventDate <= paymentRangeEnd;
  });
  type PaymentTimelineBucket = {
    bucketEnd: string;
    bucketLabel: string;
    bucketStart: string;
    overdueAmountThb: number;
    overdueEvents: PaymentTimelineEvent[];
    paidAmountThb: number;
    paidEvents: PaymentTimelineEvent[];
    plannedAmountThb: number;
    plannedEvents: PaymentTimelineEvent[];
  };
  const paymentByBucket = filteredPaymentEvents.reduce((groups, event) => {
    const bucket = paymentBucketRange(event.eventDate, paymentView);
    const series = event.series === "planned" && event.eventDate < today ? "overdue" : event.series;
    const amountThb = cashflowAmountThb(event);
    const group = groups.get(bucket.key) ?? {
      bucketEnd: bucket.end,
      bucketLabel: bucket.label,
      bucketStart: bucket.key,
      overdueAmountThb: 0,
      overdueEvents: [] as PaymentTimelineEvent[],
      paidAmountThb: 0,
      paidEvents: [] as PaymentTimelineEvent[],
      plannedAmountThb: 0,
      plannedEvents: [] as PaymentTimelineEvent[],
    };

    if (series === "paid") {
      group.paidAmountThb += amountThb;
      group.paidEvents.push(event);
    } else if (series === "overdue") {
      group.overdueAmountThb += amountThb;
      group.overdueEvents.push(event);
    } else {
      group.plannedAmountThb += amountThb;
      group.plannedEvents.push(event);
    }

    groups.set(bucket.key, group);
    return groups;
  }, new Map<string, PaymentTimelineBucket>());
  const paymentChartBuckets = Array.from(paymentByBucket.values()).sort((a, b) =>
    a.bucketStart.localeCompare(b.bucketStart),
  );
  if (
    paymentView === "daily" &&
    !paymentChartBuckets.some((bucket) => bucket.bucketStart === today)
  ) {
    const todayIsInsideAllRange =
      paymentChartBuckets.length > 0 &&
      paymentChartBuckets[0].bucketStart <= today &&
      paymentChartBuckets[paymentChartBuckets.length - 1].bucketEnd >= today;
    const shouldAddTodayBucket = paymentRange === "all" ? todayIsInsideAllRange : true;

    if (shouldAddTodayBucket) {
      paymentChartBuckets.push({
        bucketEnd: today,
        bucketLabel: formatDate(today),
        bucketStart: today,
        overdueAmountThb: 0,
        overdueEvents: [],
        paidAmountThb: 0,
        paidEvents: [],
        plannedAmountThb: 0,
        plannedEvents: [],
      });
      paymentChartBuckets.sort((a, b) => a.bucketStart.localeCompare(b.bucketStart));
    }
  }
  const paymentTodayLeft = datePositionInBuckets(today, paymentChartBuckets);
  const maxPaymentSeriesAmount = Math.max(
    1,
    ...paymentChartBuckets.flatMap((row) => [
      row.paidAmountThb,
      row.plannedAmountThb,
      row.overdueAmountThb,
    ]),
  );
  const maxPaymentDayAmount = Math.max(
    1,
    ...paymentChartBuckets.map(
      (row) => row.paidAmountThb + row.plannedAmountThb + row.overdueAmountThb,
    ),
  );
  const paymentTicks = yTicks(maxPaymentSeriesAmount, compactThb);
  const overdueEvents = paymentEvents
    .filter((event) => event.series === "planned" && event.eventDate < today)
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate));
  const overdueAmountThb = cashflowTotalThb(overdueEvents);
  const overdueMissingFxCount = missingFxCount(overdueEvents);
  const overdueSummaryText = overdueAmountThb > 0
    ? `${formatCurrency(overdueAmountThb, "THB")} overdue`
    : formatCurrency(0, "THB");
  const paymentMonthBucketSpans = monthSpansForPaymentBuckets(paymentChartBuckets);
  const paymentRangeLabel = paymentRange === "all" ? "All" : `${paymentRange} days`;
  const paymentViewLabel = `${paymentView[0].toUpperCase()}${paymentView.slice(1)}`;
  const defaultPaymentActionCount = 7;
  const dueThisWeekEnd = endOfUtcWeek(today);
  const dueThisWeekEvents = paymentEvents.filter(
    (event) => event.series === "planned" && event.eventDate >= today && event.eventDate <= dueThisWeekEnd,
  );
  const dueNext30Events = paymentEvents.filter(
    (event) => event.series === "planned" && event.eventDate >= today && event.eventDate <= addUtcDays(today, 30),
  );
  const paidTimelineAmountThb = cashflowTotalThb(
    paymentEvents.filter((event) => event.series === "paid"),
  );
  const plannedTimelineAmountThb = cashflowTotalThb(
    paymentEvents.filter((event) => event.series === "planned"),
  );
  const paidMissingFxCount = missingFxCount(paymentEvents.filter((event) => event.series === "paid"));
  const plannedMissingFxCount = missingFxCount(
    paymentEvents.filter((event) => event.series === "planned"),
  );
  const dueThisWeekAmountThb = cashflowTotalThb(dueThisWeekEvents);
  const dueNext30AmountThb = cashflowTotalThb(dueNext30Events);
  const dueThisWeekMissingFxCount = missingFxCount(dueThisWeekEvents);
  const dueNext30MissingFxCount = missingFxCount(dueNext30Events);
  const nextDueDate = paymentEvents
    .filter((event) => event.series === "planned" && event.eventDate >= today)
    .map((event) => event.eventDate)
    .sort()[0] ?? "";
  const nextDueEvents = nextDueDate
    ? paymentEvents.filter(
        (event) => event.series === "planned" && event.eventDate === nextDueDate,
      )
    : [];
  const nextDueMissingFxCount = missingFxCount(nextDueEvents);
  const nextDueAmountText = nextDueEvents.length
    ? `${formatCurrency(cashflowTotalThb(nextDueEvents), "THB")} est.`
    : "";
  const nextDueOriginalText = nextDueEvents.some((event) => !isThbCurrency(event.currency))
    ? `Original: ${originalPaymentTotalsText(nextDueEvents)}`
    : "";
  const paymentActionEvents = paymentEvents
    .filter((event) => event.series === "planned")
    .sort((a, b) => {
      const aOverdue = a.eventDate < today;
      const bOverdue = b.eventDate < today;
      if (aOverdue !== bOverdue) {
        return aOverdue ? -1 : 1;
      }
      return a.eventDate.localeCompare(b.eventDate);
    });
  const primaryPaymentActionEvents = paymentActionEvents.slice(0, defaultPaymentActionCount);
  const extraPaymentActionEvents = paymentActionEvents.slice(defaultPaymentActionCount);
  const quotationFlows = Array.from(
    paymentEvents.reduce((groups, event) => {
      const key =
        event.quotationReference ||
        event.poReference ||
        event.poId ||
        `${event.supplierCode}-${event.poDetailHref}`;
      const group = groups.get(key) ?? {
        events: [] as PaymentTimelineEvent[],
        key,
        quotationReference: event.quotationReference || "-",
        supplierInvoiceNo: event.supplierInvoiceNo || "-",
        supplierName: event.supplierName,
      };

      group.events.push(event);
      groups.set(key, group);
      return groups;
    }, new Map<string, {
      events: PaymentTimelineEvent[];
      key: string;
      quotationReference: string;
      supplierInvoiceNo: string;
      supplierName: string;
    }>())
      .values(),
  )
    .map((flow) => ({
      ...flow,
      events: flow.events.sort((a, b) => a.eventDate.localeCompare(b.eventDate)),
      totalAmountThb: flow.events.reduce((sum, event) => sum + event.amountThb, 0),
    }))
    .filter((flow) => flow.events.length > 1)
    .sort((a, b) => b.totalAmountThb - a.totalAmountThb)
    .slice(0, 8);
  const filteredWorkbenchOrders = data.workbenchOrders;
  const detectedStatusOptions = Array.from(
    new Set(
      data.workbenchOrders
        .flatMap((order) => [order.workStatus, ...order.statuses])
        .map((value) => normalizeStatusLabel(value))
        .filter(Boolean),
    ),
  );
  const statusOptions = [
    ...DEFAULT_PO_STATUS_OPTIONS,
    ...Array.from(detectedStatusOptions)
      .filter((status) => !DEFAULT_PO_STATUS_OPTIONS.includes(status))
      .sort(),
  ];
  const hasFilters = Boolean(q.trim()) || Boolean(params.status);
  const buildSortHref = (key: string) => {
    const nextParams = new URLSearchParams();
    const nextDir = sortKey === key && sortDir === "asc" ? "desc" : "asc";

    if (q.trim()) {
      nextParams.set("q", q.trim());
    }
    if (!selectedStatusSet.has("all")) {
      nextParams.set("status", selectedStatuses.join(","));
    }
    nextParams.set("sort", key);
    nextParams.set("dir", nextDir);
    nextParams.set("page", "1");

    return `/po?${nextParams.toString()}`;
  };
  const buildPageHref = (nextPage: number) => {
    const nextParams = new URLSearchParams();
    if (q.trim()) {
      nextParams.set("q", q.trim());
    }
    if (!selectedStatusSet.has("all")) {
      nextParams.set("status", selectedStatuses.join(","));
    }
    nextParams.set("sort", sortKey);
    nextParams.set("dir", sortDir);
    nextParams.set("page", String(nextPage));

    return `/po?${nextParams.toString()}`;
  };
  const buildPaymentTimelineHref = (
    nextValues: Partial<{
      paymentRange: PaymentTimelineRange;
      paymentView: PaymentTimelineView;
    }>,
  ) => {
    const nextParams = new URLSearchParams();
    if (q.trim()) {
      nextParams.set("q", q.trim());
    }
    if (!selectedStatusSet.has("all")) {
      nextParams.set("status", selectedStatuses.join(","));
    }
    nextParams.set("sort", sortKey);
    nextParams.set("dir", sortDir);
    nextParams.set("page", String(page));
    nextParams.set("paymentView", nextValues.paymentView ?? paymentView);
    nextParams.set("paymentRange", nextValues.paymentRange ?? paymentRange);

    return `/po?${nextParams.toString()}#payment-timeline`;
  };
  const buildIncomingEtaHref = (nextIncomingView: IncomingEtaView) => {
    const nextParams = new URLSearchParams();
    if (q.trim()) {
      nextParams.set("q", q.trim());
    }
    if (!selectedStatusSet.has("all")) {
      nextParams.set("status", selectedStatuses.join(","));
    }
    nextParams.set("sort", sortKey);
    nextParams.set("dir", sortDir);
    nextParams.set("page", String(page));
    nextParams.set("incomingView", nextIncomingView);
    nextParams.set("paymentView", paymentView);
    nextParams.set("paymentRange", paymentRange);

    return `/po?${nextParams.toString()}#eta-schedule`;
  };
  const renderSelectedDateDetail = (
    day: (typeof incomingChartDays)[number],
    mode: "default" | "selected",
  ) => {
    const supplierBreakdown = supplierBreakdownForRows(day.rows, incomingSupplierColorMap);
    const poGroups = groupedIncomingPos(day.rows);
    const productGroups = groupedIncomingProducts(day.rows);
    const productSectionGroups = productSections(productGroups);

    return (
      <section
        className="min-w-0 max-w-full overflow-hidden rounded-lg border border-[#dfe4ea] bg-white p-4 shadow-sm"
        data-selected-date={mode === "selected" ? day.etaDate : undefined}
        data-selected-date-default={mode === "default" ? true : undefined}
        data-selected-date-detail={mode === "selected" ? true : undefined}
        hidden={mode === "selected"}
        key={`${mode}-selected-date-${day.etaDate}`}
      >
        <div className="border-b border-[#edf1f5] pb-3">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#64707d]">
            Selected Date Detail
          </p>
          <h3 className="mt-1 text-base font-semibold text-[#172026]">
            {formatLongDate(day.etaDate)}
          </h3>
          <p className="mt-1 text-sm text-[#667380]">
            {mode === "default" ? "Nearest incoming date" : "Selected chart date"}
          </p>
        </div>
        {day.totalIncomingQty > 0 ? (
          <div className="mt-3 grid min-w-0 gap-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md border border-[#dfe4ea] bg-[#fbfcfd] px-2 py-2">
                <p className="text-[10px] font-semibold uppercase text-[#667380]">Qty</p>
                <p className="font-mono text-base font-bold text-[#255f85]">
                  {formatNumber(day.totalIncomingQty)}
                </p>
              </div>
              <div className="rounded-md border border-[#dfe4ea] bg-[#fbfcfd] px-2 py-2">
                <p className="text-[10px] font-semibold uppercase text-[#667380]">POs</p>
                <p className="font-mono text-base font-bold">{formatNumber(day.totalPoCount)}</p>
              </div>
              <div className="rounded-md border border-[#dfe4ea] bg-[#fbfcfd] px-2 py-2">
                <p className="text-[10px] font-semibold uppercase text-[#667380]">Suppliers</p>
                <p className="font-mono text-base font-bold">
                  {formatNumber(supplierBreakdown.length)}
                </p>
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64707d]">
                Supplier breakdown
              </p>
              <div className="mt-2 grid min-w-0 gap-1.5">
                {supplierBreakdown.map((supplier) => (
                  <div
                    className="grid min-w-0 max-w-full grid-cols-[10px_minmax(0,1fr)_auto] items-center gap-2 overflow-hidden rounded-md border border-[#edf1f5] bg-[#fbfcfd] px-2 py-1.5 text-xs"
                    key={`${day.etaDate}-${supplier.supplierName}`}
                  >
                    <span
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: supplier.color }}
                    />
                    <span className="min-w-0 truncate font-semibold text-[#172026]">
                      {supplier.supplierName}
                    </span>
                    <span className="font-mono font-bold text-[#255f85]">
                      {formatNumber(supplier.totalIncomingQty)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="min-w-0 max-w-full overflow-hidden rounded-lg border border-[#dfe4ea] bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#64707d]">
                Product Summary
              </p>
              {productSectionGroups.length > 0 ? (
                <div className="mt-3 grid max-h-[360px] min-w-0 gap-3 overflow-auto pr-1">
                  {productSectionGroups.map(([sectionLabel, products]) => (
                    <div className="min-w-0" key={`${day.etaDate}-${sectionLabel}`}>
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <p className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-[#364252]">
                          {sectionLabel || "Uncategorized"}
                        </p>
                        <p className="font-mono text-[11px] font-semibold text-[#667380]">
                          {formatNumber(products.reduce((sum, product) => sum + product.totalQty, 0))}
                        </p>
                      </div>
                      <div className="grid min-w-0 gap-1.5">
                        {products.map((product) => (
                          <div
                            className="grid min-w-0 max-w-full grid-cols-[38px_minmax(0,1fr)_auto] items-center gap-2 overflow-hidden rounded-md border border-[#edf1f5] bg-[#fbfcfd] px-2 py-1.5"
                            key={`${day.etaDate}-${sectionLabel}-${product.id}`}
                          >
                            {product.imageUrl ? (
                              <Image
                                alt=""
                                className="size-[38px] rounded object-cover"
                                height={38}
                                src={product.imageUrl}
                                unoptimized
                                width={38}
                              />
                            ) : (
                              <div className="size-[38px] rounded bg-[#eef0f2]" />
                            )}
                            <p className="line-clamp-2 min-w-0 text-xs font-semibold text-[#172026]">
                              {product.mainName}
                            </p>
                            <p className="font-mono text-sm font-bold text-[#255f85]">
                              {formatNumber(product.totalQty)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-[#667380]">No products for selected date</p>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64707d]">
                Related PO / Quote
              </p>
              <div className="mt-2 grid max-h-[260px] min-w-0 gap-1.5 overflow-auto">
                {poGroups.slice(0, 8).map((group) => {
                  const content = (
                    <div className="min-w-0 max-w-full overflow-hidden rounded-md border border-[#edf1f5] bg-[#fbfcfd] px-2 py-2 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-[#172026]">
                            {group.supplierName}
                          </p>
                          <p className="mt-0.5 truncate font-mono text-[#52606d]">
                            {poReferenceText(group)}
                          </p>
                        </div>
                        <p className="shrink-0 font-mono font-bold text-[#255f85]">
                          {formatNumber(group.incomingQty)}
                        </p>
                      </div>
                      <p className="mt-1 line-clamp-2 text-[#667380]">
                        {purposeText(group.headerPurpose)}
                      </p>
                    </div>
                  );

                  return allowOpenPoDetail ? (
                    <Link
                      className="block min-w-0 max-w-full hover:opacity-90"
                      href={group.poDetailHref || `/po/${group.poId}`}
                      key={`${day.etaDate}-${group.poId || group.poReference}`}
                    >
                      {content}
                    </Link>
                  ) : (
                    <div className="min-w-0 max-w-full" key={`${day.etaDate}-${group.poId || group.poReference}`}>
                      {content}
                    </div>
                  );
                })}
                {poGroups.length > 8 ? (
                  <p className="text-xs font-semibold text-[#667380]">
                    +{formatNumber(poGroups.length - 8)} more PO groups
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-3 rounded-md border border-[#edf1f5] bg-[#fbfcfd] p-3 text-sm text-[#667380]">
            No incoming scheduled for selected date
          </p>
        )}
      </section>
    );
  };
  const sortHeader = (key: string, label: string, align: "left" | "right" = "left") => (
    <Link
      className={`inline-flex w-full ${align === "right" ? "justify-end" : ""} underline-offset-2 hover:underline`}
      href={buildSortHref(key)}
    >
      {label}
      {sortKey === key ? ` ${sortDir}` : ""}
    </Link>
  );
  const renderIncomingActionRow = (row: (typeof incomingActionRows)[number]) => {
    const canOpenReceiving =
      isWarehouseStaff &&
      allowReceivePo &&
      Boolean(row.poId && row.poDetailHref) &&
      row.source === "active" &&
      row.balanceQty > 0 &&
      !["Received", "Closed", "Cancelled"].includes(row.status);

    return (
    <tr
      className={row.status === "ETA Passed" ? "bg-[#fff8f8]" : "bg-white"}
      data-incoming-date-received={row.dateReceived || ""}
      data-incoming-eta-date={row.etaDate || ""}
      data-incoming-record-row
      data-incoming-source={row.source}
      data-incoming-supplier={row.supplierName || ""}
      key={`${row.etaDate}-${row.poId}-${row.poReference}-${row.supplierName}`}
    >
      <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">
        {row.etaDate ? formatShortDate(row.etaDate) : "-"}
      </td>
      <td className="whitespace-nowrap px-3 py-2">
        {(() => {
          const timing = incomingTimingLabel(row, incomingToday);
          return (
            <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${incomingTimingClass(timing)}`}>
              {timing}
            </span>
          );
        })()}
      </td>
      <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">
        {row.dateReceived ? formatShortDate(row.dateReceived) : "-"}
      </td>
      <td className="min-w-0 px-3 py-2 font-semibold">
        {row.supplierName || "-"}
      </td>
      <td className="min-w-0 px-3 py-2 text-xs text-[#52606d]">
        <p className="truncate font-mono font-semibold text-[#172026]">
          {row.poReference || row.poId || "-"}
        </p>
        <p className="truncate">Quote: {row.quotationReference || "-"}</p>
      </td>
      <td className="min-w-0 px-3 py-2 text-xs text-[#52606d]">
        <span className="line-clamp-2">{purposeText(row.headerPurpose)}</span>
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right font-mono">
        {formatNumber(row.lineCount)}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right font-mono font-semibold">
        <p>{formatNumber(row.receivedQty)}</p>
        {row.totalQty > 0 ? (
          <p className="text-[11px] font-normal text-[#667380]">
            of {formatNumber(row.totalQty)}
          </p>
        ) : null}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right font-mono font-semibold">
        {formatNumber(row.balanceQty)}
      </td>
      <td className="whitespace-nowrap px-3 py-2">
        <span
          className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${incomingEtaStatusClass(row.status)}`}
        >
          {row.status}
        </span>
      </td>
      <td className="whitespace-nowrap px-3 py-2">
        {canOpenReceiving ? (
          <Link
            className="inline-flex rounded-md bg-[#172026] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#364252]"
            href={`${row.poDetailHref}#receiving`}
          >
            Lines &amp; Receiving
          </Link>
        ) : allowOpenPoDetail ? (
          <Link
            className="inline-flex rounded-md bg-[#172026] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#364252]"
            href={row.poDetailHref}
          >
            Open PO
          </Link>
        ) : (
          <span className="text-xs font-semibold text-[#8a96a3]">View only</span>
        )}
      </td>
    </tr>
    );
  };
  const renderPaymentActionRow = (event: PaymentTimelineEvent) => {
    const deltaDays = daysBetweenDates(today, event.eventDate);
    const isOverdue = deltaDays < 0;
    const amountDisplay = formatPaymentAmount(event);
    const purposeTag = event.headerPurpose?.trim() || "-";

    return (
      <tr
        className={isOverdue ? "bg-[#fff8f8]" : "bg-white"}
        key={`${event.paymentId}-${event.poId}-${event.eventDate}`}
      >
        <td className="whitespace-nowrap px-3 py-2">
          <span
            className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
              isOverdue
                ? "bg-[#fff0f0] text-[#b42318]"
                : "bg-[#fff4e5] text-[#946200]"
            }`}
          >
            {isOverdue ? "Overdue" : "Planned"}
          </span>
        </td>
        <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">
          {formatShortDate(event.eventDate)}
        </td>
        <td className="min-w-0 px-3 py-2 font-semibold">
          <span className="truncate">{event.supplierName || "-"}</span>
        </td>
        <td className="min-w-0 px-3 py-2 text-xs text-[#52606d]">
          <p className="truncate font-mono font-semibold text-[#172026]">
            {event.poReference || event.poId || "-"}
          </p>
          <p className="truncate">Quote: {event.quotationReference || "-"}</p>
        </td>
        <td className="min-w-0 px-3 py-2 text-xs text-[#52606d]">
          <span className="line-clamp-2">{purposeTag}</span>
        </td>
        <td className="min-w-0 px-3 py-2">
          <span className="line-clamp-2">
            {humanPaymentType(event.paymentType, event.paymentLabel || "-")}
          </span>
        </td>
        <td className="whitespace-nowrap px-3 py-2 text-right">
          <p className="font-mono font-semibold text-[#172026]">
            {amountDisplay.primary}
          </p>
          {amountDisplay.secondary ? (
            <p className="mt-0.5 font-mono text-xs text-[#667380]">
              {amountDisplay.secondary}
            </p>
          ) : null}
          {amountDisplay.warning ? (
            <p className="mt-0.5 text-xs font-semibold text-[#b42318]">
              {amountDisplay.warning}
            </p>
          ) : null}
        </td>
        <td
          className={`whitespace-nowrap px-3 py-2 text-xs font-semibold ${
            isOverdue ? "text-[#b42318]" : "text-[#946200]"
          }`}
        >
          {isOverdue
            ? `${Math.abs(deltaDays)} days overdue`
            : deltaDays === 0
              ? "Due today"
              : `Due in ${deltaDays} days`}
        </td>
        <td className="whitespace-nowrap px-3 py-2">
          <Link
            className="inline-flex rounded-md bg-[#172026] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#364252]"
            href={event.poDetailHref}
          >
            Open PO
          </Link>
        </td>
      </tr>
    );
  };

  return (
    <main className="min-h-screen bg-[#f4f6f8] text-[#172026] lg:grid lg:grid-cols-[200px_minmax(0,1fr)]">
      <ChartPopoverControls />
      <PoSidebarNav active="po" />

      <div className="min-w-0 max-w-full overflow-x-hidden">
        <header className="border-b border-[#d9dde3] bg-white">
        <div className="flex flex-col gap-3 px-4 py-4 sm:px-5 2xl:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64707d]">
              Phase 2 preview - AppSheet PO export
            </p>
            <h1 className="mt-1.5 text-2xl font-semibold tracking-normal">
              PO Portal
            </h1>
            <span className="mt-2 inline-flex rounded-md bg-[#eef4f8] px-2 py-1 text-xs font-semibold text-[#255f85]">
              {data.source === "supabase"
                ? "Live Supabase PO workflow"
                : "AppSheet PO export fallback"}
            </span>
            {accessNote ? (
              <span className="ml-2 mt-2 inline-flex rounded-md bg-[#fff4e5] px-2 py-1 text-xs font-semibold text-[#946200]">
                {accessNote}
              </span>
            ) : null}
            <p className="mt-1.5 max-w-3xl text-sm leading-5 text-[#52606d]">
              {incomingEtaOnly
                ? "Incoming ETA schedule access for reviewing expected arrivals."
                : "Open purchase orders, move work statuses, and receive stock into `po_receipts` so incoming quantities come from the PO lifecycle."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!incomingEtaOnly ? (
              <Link
                className="inline-flex items-center gap-2 self-start rounded-md border border-[#cfd6df] bg-[#f9fafb] px-3 py-1.5 text-sm font-semibold text-[#364252]"
                href="/"
              >
                <ArrowLeft size={16} />
                Dashboard
              </Link>
            ) : null}
            {allowCreatePo ? (
              <a
                className="inline-flex items-center gap-2 self-start rounded-md bg-[#2563eb] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#1d4ed8]"
                href="#new-po"
              >
                Create PO
              </a>
            ) : null}
          </div>
        </div>
      </header>

      <div className="grid w-full gap-4 px-4 py-4 sm:px-5 2xl:px-6">
        {!incomingEtaOnly ? (
        <section className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3">
          {[
            {
              detail: `${formatNumber(data.metrics.supplierCount)} suppliers`,
              icon: ClipboardList,
              label: "Purchase orders",
              value: formatNumber(data.metrics.poCount),
            },
            {
              detail: "in progress / delivery outstanding only",
              icon: Truck,
              label: "Incoming units",
              value: formatNumber(data.metrics.activeIncomingTotal),
            },
            {
              detail: "waiting for approval",
              icon: Factory,
              label: "Pending units",
              value: formatNumber(data.metrics.pendingApprovalTotal),
            },
            {
              detail: `${formatNumber(data.metrics.receivedTotal)} received from ${formatNumber(
                data.metrics.orderedTotal,
              )} ordered`,
              icon: PackageCheck,
              label: "Receiving rate",
              value: formatPercent(data.metrics.receivedRate),
            },
            {
              detail: "paid rows from non-closed PO",
              icon: WalletCards,
              label: "Paid on open PO",
              value: formatCurrency(data.metrics.openPaidAmountThb, "THB"),
            },
            {
              detail: "payment_status = planned",
              icon: CalendarClock,
              label: "Planned payments",
              value: formatCurrency(data.metrics.plannedAmountThb, "THB"),
            },
          ].map((metric) => {
            const Icon = metric.icon;
            return (
              <article
                className="min-h-[112px] rounded-lg border border-[#dfe4ea] bg-white p-3 shadow-sm"
                key={metric.label}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-[#5d6a78]">
                      {metric.label}
                    </p>
                    <p className="mt-1.5 text-2xl font-semibold">{metric.value}</p>
                  </div>
                  <span className="grid size-9 place-items-center rounded-md bg-[#eef4f8] text-[#255f85]">
                    <Icon size={18} />
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-[#667380]">
                  {metric.detail}
                </p>
              </article>
            );
          })}
        </section>
        ) : null}

        <section
          className="min-w-0 max-w-full rounded-lg border border-[#dfe4ea] bg-white shadow-sm"
          data-incoming-sync-root
          id="eta-schedule"
          style={{
            "--incoming-active-opacity": "1",
            "--incoming-background-opacity": "0.10",
            "--incoming-guide-opacity": "0.32",
            "--incoming-minor-guide-opacity": "0.22",
            "--incoming-month-guide-opacity": "0.44",
          } as CSSProperties}
        >
          <div className="border-b border-[#e2e7ed] p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <h2 className="text-base font-semibold">Incoming ETA Schedule</h2>
                <p className="mt-1 text-xs text-[#667380]">
                  Scheduled bars show active incoming with ETA dates. No ETA explains the remaining pipeline qty.
                </p>
              </div>
              <div className="grid min-w-0 gap-2 text-sm sm:grid-cols-2 lg:grid-cols-5 lg:w-full lg:max-w-[820px]">
                <div className="rounded-md border border-[#dfe4ea] px-3 py-1.5">
                  <p className="text-xs font-semibold uppercase text-[#667380]">Pipeline</p>
                  <p className="mt-0.5 font-mono text-base font-semibold" data-incoming-kpi="pipeline">
                    {formatNumber(etaReconciliation.totalIncomingPipelineQty)}
                  </p>
                </div>
                <div className="rounded-md border border-[#dfe4ea] px-3 py-1.5">
                  <p className="text-xs font-semibold uppercase text-[#667380]">Scheduled ETA</p>
                  <p className="mt-0.5 font-mono text-base font-semibold text-[#1f6b3d]" data-incoming-kpi="scheduled">
                    {formatNumber(etaReconciliation.scheduledEtaQty)}
                  </p>
                </div>
                <div className="rounded-md border border-[#dfe4ea] px-3 py-1.5">
                  <p className="text-xs font-semibold uppercase text-[#667380]">No ETA</p>
                  <p className="mt-0.5 font-mono text-base font-semibold text-[#946200]" data-incoming-kpi="no-eta">
                    {formatNumber(etaReconciliation.unscheduledEtaQty)}
                  </p>
                </div>
                <div className="rounded-md border border-[#dfe4ea] px-3 py-1.5">
                  <p className="text-xs font-semibold uppercase text-[#667380]">Arriving in 7 days</p>
                  <p className="mt-0.5 font-mono text-base font-semibold text-[#255f85]" data-incoming-kpi="arriving-7">
                    {formatNumber(arrivingIn7DaysQty)}
                  </p>
                </div>
                <div className="rounded-md border border-[#dfe4ea] px-3 py-1.5">
                  <p className="text-xs font-semibold uppercase text-[#667380]">Arriving in 30 days</p>
                  <p className="mt-0.5 font-mono text-base font-semibold text-[#946200]" data-incoming-kpi="arriving-30">
                    {formatNumber(arrivingIn30DaysQty)}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_minmax(260px,340px)]">
            <div className="min-w-0">
              <IncomingEtaSync
                incomingView={incomingView}
                rows={incomingSyncRows}
                today={incomingToday}
                unscheduledRows={incomingSyncUnscheduledRows}
              />
              <div className="hidden">
                {incomingChartDays
                  .filter((day) => day.totalIncomingQty > 0)
                  .map((day) => {
                    const productGroups = groupedIncomingProducts(day.rows);
                    const sectionGroups = productSections(productGroups);
                    const topSupplier = topIncomingSupplier(day.rows, incomingSupplierColorMap);
                    const selectedDateKey = safeDomId(day.etaDate);

                    return (
                      <section
                        className="rounded-lg border border-[#cfd6df] bg-white p-4 shadow-sm"
                        data-selected-date={day.etaDate}
                        data-selected-date-detail
                        hidden
                        key={`selected-date-detail-${day.etaDate}`}
                      >
                        <div className="flex flex-col gap-3 border-b border-[#edf1f5] pb-3 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#64707d]">
                              Selected Date Detail
                            </p>
                            <h3 className="mt-1 text-lg font-semibold text-[#172026]">
                              Selected incoming date: {formatLongDate(day.etaDate)}
                            </h3>
                            <p className="mt-1 text-sm text-[#667380]">
                              {formatNumber(day.totalIncomingQty)} incoming units
                              {topSupplier ? ` | Top supplier: ${topSupplier.row.supplierName}` : ""}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="rounded-md border border-[#dfe4ea] px-3 py-1.5">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#667380]">POs</p>
                              <p className="font-mono font-bold text-[#172026]">{formatNumber(day.totalPoCount)}</p>
                            </div>
                            <div className="rounded-md border border-[#dfe4ea] px-3 py-1.5">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#667380]">Lines</p>
                              <p className="font-mono font-bold text-[#172026]">{formatNumber(day.totalItemCount)}</p>
                            </div>
                            <button
                              className="inline-flex h-9 items-center justify-center rounded-md border border-[#cfd6df] bg-white px-3 text-sm font-semibold text-[#364252] hover:bg-[#f7f9fb]"
                              data-incoming-clear-selection
                              type="button"
                            >
                              Clear selection
                            </button>
                          </div>
                        </div>

                        {productGroups.length > 0 ? (
                          <div className="mt-4">
                            {productGroups.map((product, productIndex) => {
                              const productInputId = `selected-product-${selectedDateKey}-${product.id}-${productIndex}`;
                              return (
                                <input
                                  className="peer sr-only"
                                  defaultChecked={productIndex === 0}
                                  id={productInputId}
                                  key={`${productInputId}-input`}
                                  name={`selected-product-${selectedDateKey}`}
                                  type="radio"
                                />
                              );
                            })}
                            {productGroups.map((product, productIndex) => {
                              const productInputId = `selected-product-${selectedDateKey}-${product.id}-${productIndex}`;
                              return (
                                <style key={`${productInputId}-style`}>
                                  {`#${productInputId}:checked ~ [data-product-panel="${productInputId}"]{display:block}`}
                                </style>
                              );
                            })}

                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#64707d]">
                                Product Summary
                              </p>
                              <div className="mt-2 grid gap-3">
                                {sectionGroups.map(([sectionLabel, products]) => (
                                  <div className="rounded-md border border-[#dfe4ea] bg-white p-2" key={sectionLabel}>
                                    <div className="mb-2 flex items-center justify-between gap-3">
                                      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#364252]">
                                        {sectionLabel}
                                      </p>
                                      <p className="font-mono text-xs font-semibold text-[#667380]">
                                        {formatNumber(products.reduce((sum, product) => sum + product.totalQty, 0))} units
                                      </p>
                                    </div>
                                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                      {products.map((product) => {
                                        const productIndex = productGroups.indexOf(product);
                                        const productInputId = `selected-product-${selectedDateKey}-${product.id}-${productIndex}`;
                                        return (
                                          <label
                                            className="grid cursor-pointer grid-cols-[56px_minmax(0,1fr)_auto] gap-3 rounded-md border border-[#dfe4ea] bg-[#fbfcfd] p-3 hover:border-[#255f85] hover:bg-[#eef4f8]"
                                            htmlFor={productInputId}
                                            key={`${productInputId}-summary`}
                                          >
                                            {product.imageUrl ? (
                                              <Image
                                                alt=""
                                                className="size-14 rounded-md object-cover"
                                                height={56}
                                                src={product.imageUrl}
                                                unoptimized
                                                width={56}
                                              />
                                            ) : (
                                              <div className="grid size-14 place-items-center rounded-md bg-[#eef0f2] text-[10px] font-semibold text-[#667380]">
                                                No image
                                              </div>
                                            )}
                                            <div className="min-w-0">
                                              <p className="line-clamp-2 font-semibold text-[#172026]">{product.mainName}</p>
                                              <p className="mt-1 truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-[#667380]">
                                                {product.category}
                                              </p>
                                              <p className="mt-1 text-xs text-[#667380]">
                                                {formatNumber(product.items.length)} variants/lines
                                              </p>
                                              {product.sizeColumns.length > 0 ? (
                                                <p className="mt-1 line-clamp-2 text-[11px] text-[#52606d]">
                                                  {sizeSummary(product.sizeColumns, product.sizeTotals)}
                                                </p>
                                              ) : null}
                                            </div>
                                            <p className="font-mono text-base font-bold text-[#255f85]">
                                              {formatNumber(product.totalQty)}
                                            </p>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="mt-4 rounded-md border border-[#dfe4ea] bg-[#fbfcfd] p-3">
                              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#64707d]">
                                Selected Product Details
                              </p>
                              {productGroups.map((product, productIndex) => {
                                const productInputId = `selected-product-${selectedDateKey}-${product.id}-${productIndex}`;
                                const poDetailGroups = groupedProductPoDetails(product.items);
                                const firstItem = product.items[0];
                                return (
                                  <div
                                    className="mt-3 hidden"
                                    data-product-panel={productInputId}
                                    key={`${productInputId}-panel`}
                                  >
                                    <div className="grid gap-3 rounded-md bg-white p-3 sm:grid-cols-[72px_minmax(0,1fr)_auto]">
                                      {product.imageUrl ? (
                                        <Image
                                          alt=""
                                          className="size-[72px] rounded-md object-cover"
                                          height={72}
                                          src={product.imageUrl}
                                          unoptimized
                                          width={72}
                                        />
                                      ) : (
                                        <div className="grid size-[72px] place-items-center rounded-md bg-[#eef0f2] text-[10px] font-semibold text-[#667380]">
                                          No image
                                        </div>
                                      )}
                                      <div className="min-w-0">
                                        <p className="text-base font-semibold text-[#172026]">{product.mainName}</p>
                                        <p className="mt-1 text-sm text-[#667380]">{product.sectionLabel}</p>
                                        <p className="mt-1 text-sm text-[#667380]">
                                          Style/color: {firstItem ? incomingItemVariant(firstItem) : "-"}
                                        </p>
                                      </div>
                                      <p className="font-mono text-xl font-bold text-[#255f85]">
                                        {formatNumber(product.totalQty)}
                                      </p>
                                    </div>
                                    <div className="mt-3 grid gap-2">
                                      {poDetailGroups.map((poGroup) => (
                                        <div
                                          className="rounded-md border border-[#dfe4ea] bg-white p-3"
                                          key={`${productInputId}-${poGroup.poId || poGroup.poReference}`}
                                        >
                                          <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div>
                                              <p className="font-semibold text-[#172026]">{poGroup.supplierName}</p>
                                              <p className="mt-0.5 font-mono text-sm text-[#52606d]">
                                                {poGroup.poReference || poGroup.poId || "Unknown PO"}
                                              </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <p className="font-mono font-bold text-[#172026]">
                                                {formatNumber(poGroup.totalQty)}
                                              </p>
                                              {allowOpenPoDetail ? (
                                                <Link
                                                  className="rounded bg-[#172026] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#364252]"
                                                  href={poGroup.poDetailHref}
                                                >
                                                  Open PO
                                                </Link>
                                              ) : null}
                                            </div>
                                          </div>
                                          <div className="mt-3 divide-y divide-[#edf1f5] rounded-md border border-[#edf1f5]">
                                            <div
                                              className="grid bg-[#f3f5f7] text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-[#667380]"
                                              style={{
                                                gridTemplateColumns: `minmax(180px,1fr) repeat(${product.sizeColumns.length}, minmax(56px,72px))`,
                                              }}
                                            >
                                              <div className="px-3 py-2 text-left">Status</div>
                                              {product.sizeColumns.map((size) => (
                                                <div className="border-l border-[#dfe4ea] px-2 py-2" key={size}>
                                                  {size}
                                                </div>
                                              ))}
                                            </div>
                                            <div
                                              className="grid text-right"
                                              style={{
                                                gridTemplateColumns: `minmax(180px,1fr) repeat(${product.sizeColumns.length}, minmax(56px,72px))`,
                                              }}
                                            >
                                              <div className="px-3 py-2 text-left text-xs text-[#667380]">
                                                {poGroup.items[0]
                                                  ? `${purposeText(poGroup.items[0].headerPurpose)} | ${displayStatus(poGroup.items[0].poStatus)} / ${displayStatus(poGroup.items[0].lineStatus)}`
                                                  : "-"}
                                              </div>
                                              {product.sizeColumns.map((size) => (
                                                <div className="border-l border-[#edf1f5] px-2 py-2 font-mono font-bold text-[#172026]" key={size}>
                                                  {(poGroup.sizeTotals.get(size) ?? 0) > 0
                                                    ? formatNumber(poGroup.sizeTotals.get(size) ?? 0)
                                                    : ""}
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <p className="mt-4 rounded-md border border-[#dfe4ea] bg-[#fbfcfd] p-3 text-sm text-[#667380]">
                            No active incoming product lines for this selected date.
                          </p>
                        )}
                      </section>
                    );
                  })}
              </div>
              <div className="mb-2 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Daily incoming units</h3>
                  <p className="mt-0.5 text-xs text-[#667380]">
                    {incomingView === "all"
                      ? "All shows active incoming ETA plus historical received units by received date."
                      : "Active Incoming shows only open balance still expected to arrive."}
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <p className="text-xs text-[#667380]">
                    {formatNumber(etaReconciliation.scheduledItemCount)} lines |{" "}
                    {formatNumber(etaReconciliation.scheduledPoCount)} POs
                  </p>
                  <div className="inline-flex rounded-md border border-[#cfd6df] bg-[#f7f9fb] p-1 text-xs font-semibold">
                    {INCOMING_VIEW_OPTIONS.map((option) => (
                      <Link
                        className={`rounded px-3 py-1.5 ${
                          incomingView === option
                            ? "bg-white text-[#172026] shadow-sm"
                            : "text-[#667380] hover:text-[#172026]"
                        }`}
                        href={buildIncomingEtaHref(option)}
                        key={`incoming-chart-view-${option}`}
                      >
                        {option === "active" ? "Active Incoming" : "All"}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
              {incomingSupplierLegend.length > 0 ? (
                <div
                  className="mb-3 flex flex-wrap gap-2 text-xs"
                  data-incoming-supplier-list
                >
                  {incomingSupplierLegend.map((supplier) => (
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#dfe4ea] bg-white px-2 py-1 font-semibold text-[#52606d]"
                      key={`incoming-supplier-legend-${normalizedSupplierLegendKey(supplier.supplierName)}`}
                    >
                      <span
                        className="size-2.5 rounded-full"
                        style={{ backgroundColor: supplier.color }}
                      />
                      <span className="max-w-[160px] truncate">{supplier.supplierName}</span>
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="min-w-0 max-w-full overflow-hidden rounded-md border border-[#dfe4ea] bg-[#fbfcfd] p-3">
                <div className="mb-3 flex min-w-0 gap-2">
                  <div className="w-11 shrink-0" aria-hidden="true" />
                  <div
                    className="grid min-w-0 flex-1 gap-px text-[10px] font-semibold text-[#52606d]"
                    style={{
                      gridTemplateColumns: `repeat(${incomingChartColumnCount}, minmax(0, 1fr))`,
                    }}
                  >
                    {incomingTimelineBandSpans.map((band) => {
                      const startDate = incomingDateSpine[band.start];
                      const endDate = incomingDateSpine[band.start + band.span - 1];

                      return (
                        <div
                          className={`min-w-0 truncate rounded-full px-2 py-1 text-center ${incomingTimelineBandClass(band.label)}`}
                          key={`${band.label}-${band.start}-${band.span}`}
                          style={{
                            borderLeftColor:
                              "rgba(82, 96, 109, var(--incoming-month-guide-opacity, 0.44))",
                            gridColumn: `${band.start + 1} / span ${band.span}`,
                          }}
                          title={`${band.label}: ${formatShortDate(startDate)} - ${formatShortDate(endDate)}`}
                        >
                          {band.label}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="flex min-w-0 gap-2">
                  <div className="relative w-11 shrink-0 text-[10px] font-medium text-[#667380]">
                    <span className="absolute -left-1 top-1 origin-left -rotate-90 text-[11px] font-semibold uppercase tracking-[0.12em]">
                      Units
                    </span>
                    <div className="absolute inset-y-0 right-0 w-9">
                      {incomingTicks.map((tick, index) => (
                        <span
                          className="absolute right-1 -translate-y-1/2 font-mono"
                          key={`incoming-axis-tick-${index}-${tick.label}-${tick.top}`}
                          style={{ top: tick.top }}
                        >
                          {tick.label}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div
                      className="relative h-64 min-w-0 max-w-full border-b border-l px-2 pt-8"
                      style={{
                        borderColor: "rgba(82, 96, 109, var(--incoming-guide-opacity, 0.32))",
                      }}
                    >
                      {incomingTicks.map((tick, index) => (
                        <span
                          className="pointer-events-none absolute left-0 right-0 border-t border-dashed"
                          key={`incoming-grid-tick-${index}-${tick.label}-${tick.top}`}
                          style={{
                            borderTopColor:
                              "rgba(82, 96, 109, var(--incoming-minor-guide-opacity, 0.22))",
                            top: tick.top,
                          }}
                        />
                      ))}
                      {incomingMonthSpans
                        .filter((month) => month.start > 0)
                        .map((month) => (
                          <span
                            aria-hidden="true"
                            className="pointer-events-none absolute bottom-0 top-0 z-20 border-l border-dashed border-[#d64545]/70"
                            key={`incoming-month-divider-${month.key}`}
                            style={{
                              left: monthDividerLeft(month.start, incomingChartColumnCount),
                            }}
                          >
                            <span className="absolute left-1 top-1 rounded bg-white/90 px-1 text-[9px] font-bold uppercase tracking-[0.08em] text-[#b42318] shadow-[0_0_0_1px_rgba(255,255,255,0.85)]">
                              {month.label.slice(0, 3)}
                            </span>
                          </span>
                        ))}
                      <div
                        className="relative z-10 grid h-full min-w-0 max-w-full items-end gap-px"
                        style={{
                          gridTemplateColumns: `repeat(${incomingChartColumnCount}, minmax(0, 1fr))`,
                        }}
                      >
                        {incomingTodayLeft ? (
                          <span
                            className="pointer-events-none absolute bottom-0 top-0 z-40 w-0.5 -translate-x-1/2 bg-[#172026] shadow-[0_0_0_1px_rgba(255,255,255,0.75)]"
                            style={{ left: incomingTodayLeft }}
                          >
                            <span className="absolute -top-6 left-1/2 -translate-x-1/2 rounded bg-[#172026] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                              Today
                            </span>
                          </span>
                        ) : null}
                        {incomingChartDays.map((day, index) => {
                          if (day.totalChartQty <= 0) {
                            return null;
                          }

                          const height = incomingBarHeight(day.totalChartQty);
                          const alignmentClass =
                            incomingChartDays.length === 1
                              ? "-translate-x-1/2"
                              : index === 0
                                ? "translate-x-0"
                                : index === incomingChartDays.length - 1
                                  ? "-translate-x-full"
                                  : "-translate-x-1/2";

                          return (
                            <span
                              data-incoming-value-label
                              hidden
                              className={`pointer-events-none absolute z-30 whitespace-nowrap rounded bg-white/95 px-1 text-[10px] font-semibold leading-none text-[#255f85] shadow-[0_0_0_1px_rgba(207,214,223,0.8)] ${alignmentClass}`}
                              key={`incoming-value-label-${day.etaDate}`}
                              style={{
                                bottom: Math.min(218, height + 6),
                                left: incomingBucketLeft(index),
                              }}
                            >
                              {compactUnits(day.totalChartQty)}
                            </span>
                          );
                        })}
                        {incomingChartDays.map((day, index) => {
                          if (!shouldShowIncomingDateLabel({
                            day,
                          })) {
                            return null;
                          }

                          const height = incomingBarHeight(day.totalChartQty);
                          const alignmentClass =
                            incomingChartDays.length === 1
                              ? "-translate-x-1/2"
                              : index === 0
                                ? "translate-x-0"
                                : index === incomingChartDays.length - 1
                                  ? "-translate-x-full"
                                  : "-translate-x-1/2";
                          const dense = incomingChartDays.length > 45;
                          const stagger = [0, 11, 22, 33][index % 4] ?? 0;
                          const horizontalOffset =
                            incomingChartDays.length > 70
                              ? index % 3 === 0
                                ? "-0.45rem"
                                : index % 3 === 2
                                  ? "0.45rem"
                                  : "0"
                              : "0";

                          return (
                            <span
                              className={`pointer-events-none absolute z-30 max-w-32 origin-bottom whitespace-nowrap rounded bg-white/95 px-1 py-0.5 text-[9px] font-semibold leading-none text-[#172026] shadow-[0_0_0_1px_rgba(207,214,223,0.85)] ${alignmentClass} ${dense ? "-rotate-[18deg]" : ""}`}
                              key={`incoming-date-label-${day.etaDate}`}
                              style={{
                                bottom: Math.min(238, height + 20 + stagger),
                                left: incomingBucketLeft(index),
                                marginLeft: horizontalOffset,
                              }}
                            >
                              {formatLongDate(day.etaDate)}
                            </span>
                          );
                        })}
                        {incomingChartDays.map((day, index) => {
                    const height = incomingBarHeight(day.totalChartQty);
                    const incomingHeight =
                      day.totalChartQty > 0
                        ? (day.totalIncomingQty / day.totalChartQty) * height
                        : 0;
                    const receivedHeight =
                      day.totalChartQty > 0
                        ? (day.totalReceivedQty / day.totalChartQty) * height
                        : 0;
                    const supplierSegments = supplierBreakdownForRows(day.rows, incomingSupplierColorMap);
                    const label = incomingEtaStatus(day.etaDate, incomingToday);
                    const supplierSummary = day.rows
                      .map((row) => `${row.supplierName} ${formatNumber(row.totalIncomingQty)}`)
                      .join(" | ");
                    const receivedSummary = day.receivedRows
                      .slice(0, 6)
                      .map((row) => `${row.supplierName} ${receivedReferenceText(row)} ${formatNumber(row.receivedQty)}`)
                      .join(" | ");
                    const receivedPoCount = new Set(
                      day.receivedRows.map((row) => row.poId).filter(Boolean),
                    ).size;
                    const receivedLineCount = day.receivedRows.reduce(
                      (sum, row) => sum + Math.max(1, row.lineCount || 0),
                      0,
                    );
                    const topSupplier = topIncomingSupplier(day.rows, incomingSupplierColorMap);
                    const poGroups = groupedIncomingPos(day.rows);
                    const productGroups = groupedIncomingProducts(day.rows);
                    const poPurposePreview = poGroups.slice(0, 3).map(
                      (group) =>
                        `${poReferenceText(group)} - ${purposeText(group.headerPurpose)}`,
                    );
                    const opensLeft = index > incomingChartDays.length * 0.62;

                    return (
                      <details
                        data-chart-popover
                        data-incoming-chart-day
                        data-incoming-date={day.etaDate}
                        className={`group relative flex min-w-0 flex-col items-center justify-end data-[filtered-out=true]:opacity-15 data-[selected=true]:rounded data-[selected=true]:ring-2 data-[selected=true]:ring-[#255f85] ${
                          isMonthBoundary(index, incomingDateSpine)
                            ? "border-l border-dashed border-[#d64545]/40"
                            : ""
                        }`}
                        key={day.etaDate}
                        style={
                          isMonthBoundary(index, incomingDateSpine)
                            ? {
                                borderLeftColor:
                                  "rgba(214, 69, 69, var(--incoming-month-guide-opacity, 0.44))",
                              }
                            : undefined
                        }
                        title={[
                          `${formatLongDate(day.etaDate)} | ${formatNumber(day.totalChartQty)} units`,
                          incomingView === "all"
                            ? `Received: ${formatNumber(day.totalReceivedQty)} units`
                            : "",
                          `Active incoming: ${formatNumber(day.totalIncomingQty)} units`,
                          `ETA status: ${label}`,
                          `Incoming: ${formatNumber(day.totalItemCount)} lines | ${formatNumber(day.totalPoCount)} POs`,
                          incomingView === "all"
                            ? `Historical received: ${formatNumber(receivedPoCount)} POs | ${formatNumber(receivedLineCount)} lines`
                            : "",
                          supplierSummary,
                          receivedSummary ? `Received records: ${receivedSummary}` : "",
                          topSupplier ? `Top supplier: ${topSupplier.row.supplierName}` : "",
                          poPurposePreview.length ? "POs:" : "",
                          ...poPurposePreview,
                          poGroups.length > 3 ? `+${poGroups.length - 3} more` : "",
                        ].filter(Boolean).join("\n")}
                      >
                        <summary
                          className="relative flex h-56 w-full min-w-0 cursor-pointer list-none flex-col items-center justify-end"
                          data-incoming-chart-select
                          data-incoming-date={day.etaDate}
                          data-incoming-source="all"
                        >
                          <span
                            className="relative flex w-full max-w-8 flex-col justify-end overflow-hidden rounded-t-sm transition"
                            data-incoming-background-bar
                            style={{
                              backgroundColor:
                                "rgba(47, 115, 217, var(--incoming-background-opacity, 0.10))",
                              height,
                            }}
                          >
                            {day.totalIncomingQty > 0 ? (
                              <span
                                className="flex w-full flex-col justify-end overflow-hidden"
                                data-incoming-active-bar
                                style={{
                                  height: Math.max(4, incomingHeight),
                                  opacity: "var(--incoming-active-opacity, 1)",
                                }}
                              >
                                {supplierSegments.map((segment) => (
                                  <span
                                    className="block w-full"
                                    key={`${day.etaDate}-${segment.supplierName}-segment`}
                                    style={{
                                      backgroundColor:
                                        day.etaDate < incomingToday
                                          ? "#d64545"
                                          : segment.color,
                                      height: `${(segment.totalIncomingQty / day.totalIncomingQty) * 100}%`,
                                    }}
                                  />
                                ))}
                              </span>
                            ) : null}
                            {day.totalReceivedQty > 0 ? (
                              <span
                                className="block w-full bg-[#9aa5b1]"
                                data-incoming-background-bar
                                style={{
                                  height: Math.max(4, receivedHeight),
                                  opacity: "var(--incoming-background-opacity, 0.10)",
                                }}
                              />
                            ) : null}
                            {topSupplier?.isClearTop ? (
                              <span
                                className="absolute inset-x-0 top-0 h-[5px] rounded-t-sm"
                                data-incoming-active-bar
                                style={{
                                  backgroundColor: topSupplier.color,
                                  opacity: "var(--incoming-active-opacity, 1)",
                                }}
                              />
                            ) : null}
                          </span>
                        </summary>
                        <div
                          className={`absolute bottom-0 z-50 hidden max-h-[560px] w-[min(92vw,640px)] overflow-auto rounded-md border border-[#cfd6df] bg-white p-3 text-left text-xs shadow-xl ${
                            opensLeft ? "right-full mr-2" : "left-full ml-2"
                          }`}
                        >
                          <div className="mb-2 flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-[#172026]">{formatLongDate(day.etaDate)}</p>
                              <p className="mt-1 text-[#667380]">
                                {formatNumber(day.totalChartQty)} units total
                                {incomingView === "all"
                                  ? ` | Received ${formatNumber(day.totalReceivedQty)} | Incoming ${formatNumber(day.totalIncomingQty)}`
                                  : ""}
                                {topSupplier ? ` | Top supplier: ${topSupplier.row.supplierName}` : ""}
                              </p>
                              <p className="mt-1 text-[#667380]">
                                Incoming: {formatNumber(day.totalItemCount)} lines |{" "}
                                {formatNumber(day.totalPoCount)} POs
                              </p>
                              {incomingView === "all" ? (
                                <p className="mt-1 text-[#667380]">
                                  Historical received: {formatNumber(receivedPoCount)} POs |{" "}
                                  {formatNumber(receivedLineCount)} lines
                                </p>
                              ) : null}
                            </div>
                            <div className="flex items-start gap-2">
                              <p className="font-mono font-semibold text-[#2f73d9]">
                                {compactUnits(day.totalChartQty)}
                              </p>
                              <button
                                aria-label="Close bar details"
                                className="grid size-6 place-items-center rounded border border-[#dfe4ea] text-sm leading-none text-[#667380] hover:bg-[#f3f5f7]"
                                data-chart-popover-close
                                type="button"
                              >
                                ×
                              </button>
                            </div>
                          </div>
                          {poGroups.length > 0 ? (
                            <div className="grid gap-2">
                              <div className="rounded-md border border-[#dfe4ea] bg-white p-2">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#667380]">
                                  Supplier breakdown
                                </p>
                                <div className="mt-2 grid gap-1">
                                  {supplierSegments.map((segment) => (
                                    <div
                                      className="grid grid-cols-[10px_minmax(0,1fr)_auto] items-center gap-2 text-xs"
                                      key={`${day.etaDate}-${segment.supplierName}-tooltip`}
                                    >
                                      <span
                                        className="size-2.5 rounded-full"
                                        style={{ backgroundColor: segment.color }}
                                      />
                                      <span className="truncate font-semibold">{segment.supplierName}</span>
                                      <span className="font-mono font-bold text-[#255f85]">
                                        {formatNumber(segment.totalIncomingQty)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div className="rounded-md bg-[#f7f9fb] px-2 py-2">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#667380]">
                                  Product Summary
                                </p>
                                <div className="relative mt-2">
                                  {productGroups.map((product, productIndex) => {
                                    const productInputId = `incoming-product-${safeDomId(day.etaDate)}-${product.id}-${productIndex}`;
                                    return (
                                      <input
                                        className="peer sr-only"
                                        defaultChecked={productIndex === 0}
                                        id={productInputId}
                                        key={`${productInputId}-input`}
                                        name={`incoming-product-${safeDomId(day.etaDate)}`}
                                        type="radio"
                                      />
                                    );
                                  })}
                                  {productGroups.map((product, productIndex) => {
                                    const productInputId = `incoming-product-${safeDomId(day.etaDate)}-${product.id}-${productIndex}`;
                                    return (
                                      <style key={`${productInputId}-style`}>
                                        {`#${productInputId}:checked ~ [data-product-panel="${productInputId}"]{display:block}`}
                                      </style>
                                    );
                                  })}
                                  <div className="grid gap-2 sm:grid-cols-2">
                                    {productGroups.map((product, productIndex) => {
                                      const productInputId = `incoming-product-${safeDomId(day.etaDate)}-${product.id}-${productIndex}`;
                                      return (
                                        <label
                                          className="grid cursor-pointer grid-cols-[52px_minmax(0,1fr)_auto] gap-2 rounded-md border border-[#dfe4ea] bg-white p-2 hover:border-[#255f85] hover:bg-[#eef4f8]"
                                          htmlFor={productInputId}
                                          key={`${productInputId}-summary`}
                                        >
                                          {product.imageUrl ? (
                                            <Image
                                              alt=""
                                              className="h-[52px] w-[52px] rounded-md object-cover"
                                              height={52}
                                              src={product.imageUrl}
                                              unoptimized
                                              width={52}
                                            />
                                          ) : (
                                            <div className="grid h-[52px] w-[52px] place-items-center rounded-md bg-[#eef0f2] text-[10px] font-semibold text-[#667380]">
                                              No image
                                            </div>
                                          )}
                                          <div className="min-w-0">
                                            <p className="line-clamp-2 font-semibold text-[#172026]">
                                              {product.mainName}
                                            </p>
                                            <p className="mt-1 truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-[#667380]">
                                              {product.category}
                                            </p>
                                            <p className="mt-1 text-[11px] text-[#667380]">
                                              {formatNumber(product.items.length)} variants/lines
                                            </p>
                                          </div>
                                          <p className="self-start font-mono font-bold text-[#255f85]">
                                            {formatNumber(product.totalQty)}
                                          </p>
                                        </label>
                                      );
                                    })}
                                  </div>
                                  <div className="mt-3 rounded-md border border-[#dfe4ea] bg-white p-2">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#667380]">
                                      Selected Product PO Details
                                    </p>
                                    {productGroups.map((product, productIndex) => {
                                      const productInputId = `incoming-product-${safeDomId(day.etaDate)}-${product.id}-${productIndex}`;
                                      const poDetailGroups = groupedProductPoDetails(product.items);
                                      const firstItem = product.items[0];
                                      return (
                                        <div
                                          className="mt-2 hidden"
                                          data-product-panel={productInputId}
                                          key={`${productInputId}-panel`}
                                        >
                                          <div className="grid gap-3 border-b border-[#edf1f5] pb-2 sm:grid-cols-[64px_minmax(0,1fr)_auto]">
                                            {product.imageUrl ? (
                                              <Image
                                                alt=""
                                                className="size-16 rounded-md object-cover"
                                                height={64}
                                                src={product.imageUrl}
                                                unoptimized
                                                width={64}
                                              />
                                            ) : (
                                              <div className="grid size-16 place-items-center rounded-md bg-[#eef0f2] text-[10px] font-semibold text-[#667380]">
                                                No image
                                              </div>
                                            )}
                                            <div className="min-w-0">
                                              <p className="font-semibold text-[#172026]">{product.mainName}</p>
                                              <p className="mt-1 text-[#667380]">{product.category}</p>
                                              <p className="mt-1 text-[#667380]">
                                                Style/color: {firstItem ? incomingItemVariant(firstItem) : "-"}
                                              </p>
                                            </div>
                                            <p className="font-mono text-base font-bold text-[#255f85]">
                                              {formatNumber(product.totalQty)}
                                            </p>
                                          </div>
                                          <div className="mt-2 grid gap-2">
                                            {poDetailGroups.map((poGroup) => (
                                              <div
                                                className="rounded-md border border-[#edf1f5] bg-[#fbfcfd] p-2"
                                                key={`${productInputId}-${poGroup.poId || poGroup.poReference}`}
                                              >
                                                <div className="flex flex-wrap items-start justify-between gap-2">
                                                  <div className="min-w-0">
                                                    <p className="font-semibold text-[#172026]">{poGroup.supplierName}</p>
                                                    <p className="mt-0.5 font-mono text-[#52606d]">
                                                      {poGroup.poReference || poGroup.poId || "Unknown PO"}
                                                    </p>
                                                  </div>
                                                  <div className="flex items-center gap-2">
                                                    <p className="font-mono font-bold text-[#172026]">
                                                      {formatNumber(poGroup.totalQty)}
                                                    </p>
                                                    {allowOpenPoDetail ? (
                                                      <Link
                                                        className="rounded bg-[#172026] px-2 py-1 text-[10px] font-semibold text-white hover:bg-[#364252]"
                                                        href={poGroup.poDetailHref}
                                                      >
                                                        Open PO
                                                      </Link>
                                                    ) : null}
                                                  </div>
                                                </div>
                                                <div className="mt-2 divide-y divide-[#edf1f5] rounded-md bg-white">
                                                  {poGroup.items.map((item) => (
                                                    <div
                                                      className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 px-2 py-1.5"
                                                      key={`${productInputId}-${item.poItemId || item.sku}`}
                                                    >
                                                      <div className="min-w-0">
                                                        <p className="truncate font-semibold text-[#172026]">
                                                          {incomingItemVariant(item)}
                                                        </p>
                                                        <p className="mt-0.5 truncate text-[11px] text-[#667380]">
                                                          {purposeText(item.headerPurpose)} | {displayStatus(item.poStatus)} / {displayStatus(item.lineStatus)}
                                                        </p>
                                                      </div>
                                                      <p className="font-mono font-bold text-[#172026]">
                                                        {formatNumber(item.incomingQty)}
                                                      </p>
                                                    </div>
                                                  ))}
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                                <p className="mt-2 text-[#667380]">
                                  {formatNumber(day.totalPoCount)} POs | {formatNumber(day.totalItemCount)} lines
                                </p>
                              </div>
                              {incomingView === "all" && day.receivedRows.length > 0 ? (
                                <div className="rounded-md border border-[#dfe4ea] bg-white p-2">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#667380]">
                                    Historical Received
                                  </p>
                                  <div className="mt-2 grid gap-1.5">
                                    {day.receivedRows.slice(0, 8).map((row) => (
                                      allowOpenPoDetail ? (
                                      <Link
                                        className="grid gap-1 rounded-md px-2 py-1.5 hover:bg-[#eef4f8] hover:text-[#255f85]"
                                        href={row.poDetailHref}
                                        key={`received-${day.etaDate}-${row.poId}`}
                                      >
                                        <span className="font-semibold">{row.supplierName}</span>
                                        <span className="font-mono text-[#52606d]">
                                          {receivedReferenceText(row)} | {formatNumber(row.receivedQty)} units
                                        </span>
                                        <span className="text-[#667380]">
                                          {formatNumber(Math.max(1, row.lineCount || 0))} receipt lines/SKUs
                                        </span>
                                      </Link>
                                      ) : (
                                      <div
                                        className="grid gap-1 rounded-md px-2 py-1.5"
                                        key={`received-${day.etaDate}-${row.poId}`}
                                      >
                                        <span className="font-semibold">{row.supplierName}</span>
                                        <span className="font-mono text-[#52606d]">
                                          {receivedReferenceText(row)} | {formatNumber(row.receivedQty)} units
                                        </span>
                                        <span className="text-[#667380]">
                                          {formatNumber(Math.max(1, row.lineCount || 0))} receipt lines/SKUs
                                        </span>
                                      </div>
                                      )
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                              <div className="rounded-md border border-[#dfe4ea] bg-white p-2">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#667380]">
                                  PO Purpose Summary
                                </p>
                                <div className="mt-2 grid gap-1.5">
                                  {poGroups.map((group, groupIndex) => (
                                    allowOpenPoDetail ? (
                                    <Link
                                      className="grid gap-1 rounded-md px-2 py-1.5 hover:bg-[#eef4f8] hover:text-[#255f85]"
                                      href={group.poDetailHref || `/po/${group.poId}`}
                                      key={`${day.etaDate}-${group.poId || group.poReference}-${groupIndex}`}
                                    >
                                      <span className="font-semibold">
                                        {groupIndex + 1}. {poReferenceText(group)}
                                      </span>
                                      <span className="text-[#52606d]">
                                        Purpose: {purposeText(group.headerPurpose)}
                                      </span>
                                      <span className="text-[#667380]">
                                        {formatNumber(group.incomingQty)} units | {formatNumber(group.lineCount)} lines
                                      </span>
                                    </Link>
                                    ) : (
                                    <div
                                      className="grid gap-1 rounded-md px-2 py-1.5"
                                      key={`${day.etaDate}-${group.poId || group.poReference}-${groupIndex}`}
                                    >
                                      <span className="font-semibold">
                                        {groupIndex + 1}. {poReferenceText(group)}
                                      </span>
                                      <span className="text-[#52606d]">
                                        Purpose: {purposeText(group.headerPurpose)}
                                      </span>
                                      <span className="text-[#667380]">
                                        {formatNumber(group.incomingQty)} units | {formatNumber(group.lineCount)} lines
                                      </span>
                                    </div>
                                    )
                                  ))}
                                </div>
                              </div>
                            </div>
                          ) : incomingView === "all" && day.receivedRows.length > 0 ? (
                            <div className="rounded-md border border-[#dfe4ea] bg-white p-2">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#667380]">
                                Historical Received
                              </p>
                              <div className="mt-2 grid gap-1.5">
                                {day.receivedRows.slice(0, 8).map((row) => (
                                  allowOpenPoDetail ? (
                                  <Link
                                    className="grid gap-1 rounded-md px-2 py-1.5 hover:bg-[#eef4f8] hover:text-[#255f85]"
                                    href={row.poDetailHref}
                                    key={`received-only-${day.etaDate}-${row.poId}`}
                                  >
                                    <span className="font-semibold">{row.supplierName}</span>
                                    <span className="font-mono text-[#52606d]">
                                      {receivedReferenceText(row)} | {formatNumber(row.receivedQty)} units
                                    </span>
                                    <span className="text-[#667380]">
                                      {formatNumber(Math.max(1, row.lineCount || 0))} receipt lines/SKUs
                                    </span>
                                  </Link>
                                  ) : (
                                  <div
                                    className="grid gap-1 rounded-md px-2 py-1.5"
                                    key={`received-only-${day.etaDate}-${row.poId}`}
                                  >
                                    <span className="font-semibold">{row.supplierName}</span>
                                    <span className="font-mono text-[#52606d]">
                                      {receivedReferenceText(row)} | {formatNumber(row.receivedQty)} units
                                    </span>
                                    <span className="text-[#667380]">
                                      {formatNumber(Math.max(1, row.lineCount || 0))} receipt lines/SKUs
                                    </span>
                                  </div>
                                  )
                                ))}
                              </div>
                            </div>
                          ) : (
                            <p className="text-[#667380]">No incoming scheduled on this date.</p>
                          )}
                        </div>
                      </details>
                    );
                        })}
                      </div>
                    </div>
                    <div
                      className="mt-1.5 grid gap-1 text-[10px] font-semibold text-[#52606d]"
                      style={{
                        gridTemplateColumns: `repeat(${Math.max(incomingChartDays.length, 1)}, minmax(0, 1fr))`,
                      }}
                    >
                      {incomingMonthSpans.map((month) => (
                        <span
                          className="min-w-0 cursor-pointer truncate rounded px-1 text-left data-[filtered-out=true]:opacity-25 data-[selected=true]:bg-[#eef4f8] data-[selected=true]:text-[#255f85]"
                          data-incoming-chart-select
                          data-incoming-date={month.key}
                          data-incoming-month={month.key}
                          data-incoming-source="all"
                          key={month.key}
                          style={{
                            gridColumn: `${month.start + 1} / span ${month.span}`,
                          }}
                        >
                          {month.label} · {compactUnits(incomingMonthTotals.get(month.key) ?? 0)} units
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-4 rounded-md border border-[#dfe4ea]">
                <div className="flex flex-col gap-2 border-b border-[#edf1f5] bg-white px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold">Incoming records</p>
                    <p className="mt-0.5 text-xs text-[#667380]">
                      {incomingView === "all"
                        ? "All view adds received history to the active incoming list."
                        : "Active Incoming shows only open balance still expected to arrive."}
                    </p>
                  </div>
                  <div className="inline-flex rounded-md border border-[#cfd6df] bg-[#f7f9fb] p-1 text-xs font-semibold">
                    {INCOMING_VIEW_OPTIONS.map((option) => (
                      <Link
                        className={`rounded px-3 py-1.5 ${
                          incomingView === option
                            ? "bg-white text-[#172026] shadow-sm"
                            : "text-[#667380] hover:text-[#172026]"
                        }`}
                        href={buildIncomingEtaHref(option)}
                        key={option}
                      >
                        {option === "active" ? "Active Incoming" : "All"}
                      </Link>
                    ))}
                  </div>
                </div>
                <div className="overflow-x-auto">
                <table className="w-full min-w-[1320px] table-fixed text-left text-sm">
                  <colgroup>
                    <col className="w-[104px]" />
                    <col className="w-[112px]" />
                    <col className="w-[112px]" />
                    <col className="w-[15%]" />
                    <col className="w-[20%]" />
                    <col className="w-[18%]" />
                    <col className="w-[70px]" />
                    <col className="w-[112px]" />
                    <col className="w-[100px]" />
                    <col className="w-[150px]" />
                    <col className="w-[92px]" />
                  </colgroup>
                  <thead className="bg-[#f3f5f7] text-xs uppercase tracking-[0.12em] text-[#65717f]">
                    <tr>
                      <th className="px-3 py-2 font-semibold">ETA date</th>
                      <th className="px-3 py-2 font-semibold">Timing</th>
                      <th className="px-3 py-2 font-semibold">Date received</th>
                      <th className="px-3 py-2 font-semibold">Supplier</th>
                      <th className="px-3 py-2 font-semibold">PO / Quote</th>
                      <th className="px-3 py-2 font-semibold">Purpose / Tag</th>
                      <th className="px-3 py-2 text-right font-semibold">Lines</th>
                      <th className="px-3 py-2 text-right font-semibold">Received qty</th>
                      <th className="px-3 py-2 text-right font-semibold">Balance qty</th>
                      <th className="px-3 py-2 font-semibold">Status</th>
                      <th className="px-3 py-2 font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#edf1f5]">
                    {primaryIncomingActionRows.map(renderIncomingActionRow)}
                    {incomingActionRows.length === 0 ? (
                      <tr>
                        <td className="px-3 py-4 text-sm text-[#667380]" colSpan={11}>
                          No scheduled incoming ETA records found.
                        </td>
                      </tr>
                    ) : null}
                    <tr data-incoming-empty-state hidden>
                      <td className="px-3 py-4 text-sm text-[#667380]" colSpan={11}>
                        No incoming records for the current chart selection.
                      </td>
                    </tr>
                  </tbody>
                </table>
                </div>
                {extraIncomingActionRows.length > 0 ? (
                  <details className="group border-t border-[#edf1f5]" data-incoming-extra-details>
                    <summary className="flex min-w-[1320px] cursor-pointer list-none justify-center bg-white px-3 py-3 text-sm font-semibold text-[#255f85] hover:bg-[#f7f9fb]">
                      <span className="group-open:hidden">
                        Expand Incoming List ({formatNumber(extraIncomingActionRows.length)} more)
                      </span>
                      <span className="hidden group-open:inline">
                        Collapse Incoming List
                      </span>
                    </summary>
                    <div className="overflow-x-auto">
                    <table className="w-full min-w-[1320px] table-fixed text-left text-sm">
                      <colgroup>
                        <col className="w-[104px]" />
                        <col className="w-[112px]" />
                        <col className="w-[112px]" />
                        <col className="w-[15%]" />
                        <col className="w-[20%]" />
                        <col className="w-[18%]" />
                        <col className="w-[70px]" />
                        <col className="w-[112px]" />
                        <col className="w-[100px]" />
                        <col className="w-[150px]" />
                        <col className="w-[92px]" />
                      </colgroup>
                      <tbody className="divide-y divide-[#edf1f5]">
                        {extraIncomingActionRows.map(renderIncomingActionRow)}
                      </tbody>
                    </table>
                    </div>
                  </details>
                ) : null}
              </div>
            </div>

            <div className="min-w-0">
              <div className="mb-3 grid gap-3 xl:sticky xl:top-3 xl:z-10">
                {defaultSelectedIncomingDay ? renderSelectedDateDetail(defaultSelectedIncomingDay, "default") : (
                  <section className="rounded-lg border border-[#dfe4ea] bg-white p-4 shadow-sm" data-selected-date-default>
                    <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#64707d]">
                      Selected Date Detail
                    </p>
                    <p className="mt-3 text-sm text-[#667380]">
                      No scheduled incoming dates are available.
                    </p>
                  </section>
                )}
                {incomingChartDays.map((day) => renderSelectedDateDetail(day, "selected"))}
                <section
                  className="rounded-lg border border-[#dfe4ea] bg-white p-4 text-sm text-[#667380] shadow-sm"
                  data-selected-date-empty
                  hidden
                >
                  No incoming scheduled for selected date
                </section>
              </div>
              <div className="hidden">
                <h3 className="text-sm font-semibold">No ETA incoming</h3>
                <p className="text-xs text-[#667380]">
                  {formatNumber(etaReconciliation.unscheduledItemCount)} lines |{" "}
                  {formatNumber(etaReconciliation.unscheduledPoCount)} POs
                </p>
              </div>
              {etaReconciliation.unscheduledEtaQty <= 0 ? (
                <div className="hidden">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#1f6b3d] text-xs font-bold text-white">
                    ✓
                  </span>
                  <div>
                    <p className="font-semibold text-[#1f6b3d]">
                      All active incoming POs have ETA dates.
                    </p>
                    <p className="mt-1 text-[#667380]">
                      Scheduled ETA covers the full incoming pipeline.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="hidden">
                  {unscheduledEtaRows.map((row) => {
                    const content = (
                      <>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">
                              {row.supplierName}
                            </p>
                            <p className="mt-1 truncate text-xs text-[#667380]">
                              {row.poReference || row.poId} | {row.sku}
                            </p>
                          </div>
                          <p className="shrink-0 font-mono text-sm font-semibold text-[#946200]">
                            {formatNumber(row.incomingQty)}
                          </p>
                        </div>
                        <div className="mt-2 grid gap-1 text-xs text-[#667380]">
                          <p>
                            Status: {displayStatus(row.poStatus)} / {displayStatus(row.lineStatus)}
                          </p>
                          {row.latestSupplierComment ? (
                            <p className="line-clamp-2">
                              Comment: {row.latestSupplierComment}
                            </p>
                          ) : null}
                        </div>
                      </>
                    );

                    return allowOpenPoDetail ? (
                      <Link
                        className="block px-3 py-3 hover:bg-[#f7f9fb]"
                        data-incoming-no-eta-row
                        data-incoming-supplier={row.supplierName || ""}
                        href={row.poDetailHref}
                        key={`${row.poId}-${row.sku}`}
                      >
                        {content}
                      </Link>
                    ) : (
                      <div
                        className="block px-3 py-3"
                        data-incoming-no-eta-row
                        data-incoming-supplier={row.supplierName || ""}
                        key={`${row.poId}-${row.sku}`}
                      >
                        {content}
                      </div>
                    );
                  })}
                  <p className="px-3 py-3 text-sm text-[#667380]" data-incoming-no-eta-empty hidden>
                    No no-ETA incoming records for the selected supplier.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {!incomingEtaOnly ? (
        <>
        <section className="min-w-0 max-w-full rounded-lg border border-[#dfe4ea] bg-white shadow-sm" id="payment-timeline">
          <div className="border-b border-[#e2e7ed] p-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <h2 className="text-base font-semibold">Payment Timeline</h2>
                <p className="mt-1 text-xs text-[#667380]">
                  Paid, planned, and overdue payment events for active purchase orders.
                </p>
              </div>
              <div className="grid min-w-0 gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3 xl:w-full xl:max-w-[820px]">
                {[
                  {
                    label: "Paid total",
                    detail: fxWarningText(paidMissingFxCount),
                    tone: "text-[#1f6b3d]",
                    value: formatCurrency(paidTimelineAmountThb, "THB"),
                  },
                  {
                    label: "Planned total",
                    detail: fxWarningText(plannedMissingFxCount),
                    tone: "text-[#946200]",
                    value: formatCurrency(plannedTimelineAmountThb, "THB"),
                  },
                  {
                    label: "Next due",
                    detail: [nextDueAmountText, nextDueOriginalText, fxWarningText(nextDueMissingFxCount)]
                      .filter(Boolean)
                      .join(" | "),
                    tone: "text-[#172026]",
                    value: nextDueDate ? formatDate(nextDueDate) : "-",
                  },
                  {
                    label: "Overdue",
                    detail: fxWarningText(overdueMissingFxCount),
                    tone: "text-[#b42318]",
                    value: overdueSummaryText,
                  },
                  {
                    label: "Due this week",
                    detail: fxWarningText(dueThisWeekMissingFxCount),
                    tone: "text-[#946200]",
                    value: formatCurrency(dueThisWeekAmountThb, "THB"),
                  },
                  {
                    label: "Due next 30 days",
                    detail: fxWarningText(dueNext30MissingFxCount),
                    tone: "text-[#946200]",
                    value: formatCurrency(dueNext30AmountThb, "THB"),
                  },
                ].map((card) => (
                  <div className="rounded-md border border-[#dfe4ea] px-3 py-2" key={card.label}>
                    <p className="text-xs font-semibold uppercase text-[#667380]">{card.label}</p>
                    <p className={`mt-0.5 font-mono text-base font-semibold ${card.tone}`}>
                      {card.value}
                    </p>
                    {"detail" in card && card.detail ? (
                      <p className="mt-0.5 text-xs font-semibold text-[#946200]">
                        {card.detail}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="p-4">
            {overdueAmountThb > 0 ? (
              <div className="mb-4 flex flex-col gap-2 rounded-md border border-[#f0b8b8] bg-[#fff5f5] px-3 py-2 text-sm font-semibold text-[#b42318] sm:flex-row sm:items-center sm:justify-between">
                <span>
                  {overdueSummaryText} across {formatNumber(overdueEvents.length)} payment events
                </span>
                <a
                  className="inline-flex self-start rounded-md border border-[#f0b8b8] bg-white px-2 py-1 text-xs font-semibold text-[#b42318] hover:bg-[#fff8f8] sm:self-auto"
                  href="#payment-action-list"
                >
                  View overdue payments
                </a>
              </div>
            ) : null}
            <div className="mb-3 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
              <div className="flex flex-wrap gap-3 text-xs font-semibold">
                <span className="inline-flex items-center gap-2 text-[#1f6b3d]">
                  <span className="size-3 rounded-sm bg-[#2f8f4e]" /> Paid
                </span>
                <span className="inline-flex items-center gap-2 text-[#946200]">
                  <span className="size-3 rounded-sm bg-[#d9852f]" /> Planned
                </span>
                <span className="inline-flex items-center gap-2 text-[#b42318]">
                  <span className="size-3 rounded-sm bg-[#d64545]" /> Overdue
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="inline-flex overflow-hidden rounded-md border border-[#cfd6df] bg-white text-xs font-semibold">
                  {PAYMENT_VIEW_OPTIONS.map((option) => (
                    <Link
                      className={`px-3 py-1.5 capitalize ${
                        paymentView === option
                          ? "bg-[#172026] text-white"
                          : "text-[#52606d] hover:bg-[#f3f5f7]"
                      }`}
                      href={buildPaymentTimelineHref({ paymentView: option })}
                      key={option}
                    >
                      {option}
                    </Link>
                  ))}
                </div>
                <div className="inline-flex overflow-hidden rounded-md border border-[#cfd6df] bg-white text-xs font-semibold">
                  {PAYMENT_RANGE_OPTIONS.map((option) => (
                    <Link
                      className={`px-3 py-1.5 ${
                        paymentRange === option
                          ? "bg-[#172026] text-white"
                          : "text-[#52606d] hover:bg-[#f3f5f7]"
                      }`}
                      href={buildPaymentTimelineHref({ paymentRange: option })}
                      key={option}
                    >
                      {option === "all" ? "All" : `${option} days`}
                    </Link>
                  ))}
                </div>
              </div>
              <p className="text-xs text-[#667380] lg:col-span-2">
                {paymentViewLabel} view | {paymentRangeLabel} range | showing{" "}
                {formatNumber(paymentChartBuckets.length)} visible buckets. Date range covers today forward; overdue planned payments before today stay visible for follow-up.
              </p>
            </div>
            <details className="group mb-3 rounded-md border border-[#dfe4ea] bg-white">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm font-semibold text-[#364252]">
                <span className="grid size-4 place-items-center rounded border border-[#aeb8c4] text-[10px] group-open:hidden" />
                <span className="hidden size-4 place-items-center rounded border border-[#255f85] bg-[#255f85] text-[10px] text-white group-open:grid">
                  ✓
                </span>
                Include Quotation Stage
              </summary>
              <div className="grid gap-3 border-t border-[#edf1f5] p-3">
                <p className="text-xs text-[#667380]">
                  Includes quotation-stage payment records in this timeline when those records exist.
                </p>
                {quotationFlows.length > 0 ? (
                  quotationFlows.map((flow) => (
                    <div
                      className="rounded-md border border-[#edf1f5] bg-[#fbfcfd] p-3"
                      key={flow.key}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">
                            {flow.supplierName}
                          </p>
                          <p className="mt-1 truncate text-xs text-[#667380]">
                            Quotation {flow.quotationReference} | Invoice {flow.supplierInvoiceNo}
                          </p>
                        </div>
                        <p className="font-mono text-xs font-semibold text-[#364252]">
                          {compactThb(flow.totalAmountThb)}
                        </p>
                      </div>
                      <div className="mt-3 flex items-center overflow-x-auto pb-1">
                        {flow.events.map((event, index) => (
                          <div className="flex shrink-0 items-center" key={`${flow.key}-${event.paymentId}`}>
                            <Link
                              className="rounded-md border border-[#dfe4ea] bg-white px-2 py-1 text-xs hover:border-[#255f85]"
                              href={event.poDetailHref}
                              title={`${formatLongDate(event.eventDate)} | ${humanPaymentType(event.paymentType, event.paymentLabel)} | ${event.paymentStatus || paymentSeriesLabel(event.series)} | ${compactThb(event.amountThb)}`}
                            >
                              <span
                                className={`mr-1 inline-block size-2 rounded-full ${
                                  event.series === "paid"
                                    ? "bg-[#2f8f4e]"
                                    : event.eventDate < today
                                      ? "bg-[#d64545]"
                                      : "bg-[#d9852f]"
                                }`}
                              />
                              {formatShortDate(event.eventDate)} |{" "}
                              {humanPaymentType(event.paymentType, event.paymentLabel || paymentSeriesLabel(event.series))} |{" "}
                              {compactThb(event.amountThb)}
                            </Link>
                            {index < flow.events.length - 1 ? (
                              <span className="mx-2 h-px w-8 bg-[#cfd6df]" />
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[#667380]">
                    No multi-stage quotation payment flows in the current timeline.
                  </p>
                )}
              </div>
            </details>
            <div className="min-w-0 max-w-full overflow-hidden rounded-md border border-[#dfe4ea] bg-[#fbfcfd] p-3">
              <div className="flex min-w-0 gap-2">
                <div className="relative w-20 shrink-0 text-[10px] font-medium text-[#667380]">
                  <span className="absolute -left-1 top-1 origin-left -rotate-90 text-[11px] font-semibold uppercase tracking-[0.12em]">
                    Amount (THB)
                  </span>
                  <div className="absolute inset-y-0 right-0 w-16">
                    {paymentTicks.map((tick, index) => (
                      <span
                        className="absolute right-1 -translate-y-1/2 font-mono"
                        key={`payment-axis-tick-${index}-${tick.label}-${tick.top}`}
                        style={{ top: tick.top }}
                      >
                        {tick.label}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="relative h-64 min-w-0 max-w-full border-b border-l border-[#dfe4ea] px-2 pt-6">
                    {paymentTicks.map((tick, index) => (
                      <span
                        className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-[#e4e9f0]"
                        key={`payment-grid-tick-${index}-${tick.label}-${tick.top}`}
                        style={{ top: tick.top }}
                      />
                    ))}
                    {paymentTodayLeft ? (
                      <span
                        className="pointer-events-none absolute inset-y-0 z-30 w-0.5 -translate-x-1/2 bg-[#5d6a78]"
                        style={{ left: paymentTodayLeft }}
                      >
                        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded bg-[#5d6a78] px-1.5 py-0.5 text-[10px] font-bold text-white">
                          Today
                        </span>
                      </span>
                    ) : null}
                    <div
                      className="relative z-10 grid h-full min-w-0 max-w-full items-end gap-1"
                      style={{
                        gridTemplateColumns: `repeat(${Math.max(paymentChartBuckets.length, 1)}, minmax(14px, 1fr))`,
                      }}
                    >
                      {paymentChartBuckets.map((bucket, index) => {
                  const series = [
                    {
                      amount: bucket.paidAmountThb,
                      color: "bg-[#2f8f4e] group-hover:bg-[#1f6b3d]",
                      events: bucket.paidEvents,
                      key: "paid",
                    },
                    {
                      amount: bucket.plannedAmountThb,
                      color: "bg-[#d9852f] group-hover:bg-[#b86717]",
                      events: bucket.plannedEvents,
                      key: "planned",
                    },
                    {
                      amount: bucket.overdueAmountThb,
                      color: "bg-[#d64545] group-hover:bg-[#b42318]",
                      events: bucket.overdueEvents,
                      key: "overdue",
                    },
                  ];
                  const totalAmount =
                    bucket.paidAmountThb + bucket.plannedAmountThb + bucket.overdueAmountThb;
                  const opensLeft = index > paymentChartBuckets.length * 0.62;
                  const isPaymentMonthBoundary =
                    paymentView !== "monthly" &&
                    index > 0 &&
                    bucket.bucketStart.slice(0, 7) !== paymentChartBuckets[index - 1]?.bucketStart.slice(0, 7);
                  const showValueLabel = shouldShowPaymentValueLabel({
                    bucketCount: paymentChartBuckets.length,
                    index,
                    maxValue: maxPaymentDayAmount,
                    value: totalAmount,
                    view: paymentView,
                  });

                  return (
                    <details
                      data-chart-popover
                      className={`group relative flex min-w-0 flex-col items-center justify-end rounded-t-sm px-1 ${
                        isPaymentMonthBoundary
                          ? "border-l border-dashed"
                          : ""
                      }`}
                      key={bucket.bucketStart}
                      style={
                        isPaymentMonthBoundary
                          ? { borderLeftColor: paymentMonthSeparatorColor(paymentView) }
                          : undefined
                      }
                      title={[
                        `${bucket.bucketLabel} | ${compactCurrency(totalAmount)}`,
                        `Paid ${compactCurrency(bucket.paidAmountThb)}`,
                        `Planned ${compactCurrency(bucket.plannedAmountThb)}`,
                        `Overdue ${compactCurrency(bucket.overdueAmountThb)}`,
                      ].join("\n")}
                    >
                      <summary className="flex h-56 w-full min-w-0 cursor-pointer list-none flex-col items-center justify-end gap-px">
                        {showValueLabel ? (
                          <span className="mb-1 whitespace-nowrap rounded bg-white/90 px-1 text-[10px] font-semibold leading-none text-[#364252] shadow-[0_0_0_1px_rgba(207,214,223,0.7)]">
                            {compactThb(totalAmount)}
                          </span>
                        ) : null}
                        <span className="flex w-full min-w-0 items-end justify-center gap-px">
                        {series.map((item) => {
                          const height = item.amount > 0
                            ? Math.max(8, (item.amount / maxPaymentSeriesAmount) * 210)
                            : 3;

                          return (
                            <span
                              className={`block w-1/3 max-w-5 rounded-t-sm transition ${
                                item.amount > 0 ? item.color : "bg-[#edf1f5] group-hover:bg-[#dfe6ee]"
                              }`}
                              key={item.key}
                              style={{ height }}
                            />
                          );
                        })}
                        </span>
                      </summary>
                      <div
                        className={`absolute bottom-0 z-20 hidden max-h-[220px] w-[340px] overflow-auto rounded-md border border-[#cfd6df] bg-white p-3 text-left text-xs shadow-xl group-open:block ${
                          opensLeft ? "right-full mr-2" : "left-full ml-2"
                        }`}
                      >
                        <div className="mb-2 flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-[#172026]">{bucket.bucketLabel}</p>
                            <p className="mt-1 text-[#667380]">{compactCurrency(totalAmount)} total</p>
                          </div>
                          <button
                            aria-label="Close bar details"
                            className="grid size-6 shrink-0 place-items-center rounded border border-[#dfe4ea] text-sm leading-none text-[#667380] hover:bg-[#f3f5f7]"
                            data-chart-popover-close
                            type="button"
                          >
                            ×
                          </button>
                        </div>
                        <div className="grid gap-2">
                          {series.map((item) => (
                            <div className="rounded-md bg-[#f7f9fb] px-2 py-2" key={item.key}>
                              <div className="mb-1 flex justify-between gap-2">
                                <p className="font-semibold">{paymentSeriesLabel(item.key)}</p>
                                <p className="font-mono">{compactCurrency(item.amount)}</p>
                              </div>
                              {item.events.length > 0 ? (
                                <div className="grid gap-1">
                                  {item.events.slice(0, 8).map((event) => (
                                    <Link
                                      className="grid gap-1 rounded bg-white px-2 py-1 hover:text-[#255f85]"
                                      href={event.poDetailHref}
                                      key={`${event.paymentId}-${event.poId}`}
                                    >
                                      <span className="font-semibold">
                                        {event.supplierName} | {event.poReference || event.poId}
                                      </span>
                                      <span className="truncate text-[#52606d]">
                                        Quotation {event.quotationReference || "-"} | Invoice{" "}
                                        {event.supplierInvoiceNo || "-"}
                                      </span>
                                      <span className="truncate text-[#667380]">
                                        {humanPaymentType(event.paymentType, event.paymentLabel)} |{" "}
                                        Status {event.paymentStatus || paymentSeriesLabel(item.key)} |{" "}
                                        {formatPaymentAmount(event).primary} |{" "}
                                        {event.latestSupplierComment || "No supplier comment"}
                                      </span>
                                    </Link>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-[#667380]">No {paymentSeriesLabel(item.key).toLowerCase()} events.</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </details>
                  );
                      })}
                    </div>
                  </div>
                  {paymentMonthBucketSpans.length > 0 ? (
                    <div
                      className="mt-1.5 grid gap-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#667380]"
                      style={{
                        gridTemplateColumns: `repeat(${Math.max(paymentChartBuckets.length, 1)}, minmax(14px, 1fr))`,
                      }}
                    >
                      {paymentMonthBucketSpans.map((month) => (
                        <span
                          className="min-w-0 truncate border-l border-dashed pl-1 text-left first:border-l-0 first:pl-0"
                          key={`payment-month-label-${month.key}`}
                          style={{
                            borderLeftColor: paymentMonthSeparatorColor(paymentView),
                            gridColumn: `${month.start + 1} / span ${month.span}`,
                          }}
                        >
                          <span>{month.label}</span>
                          {month.paidAmountThb > 0 || month.plannedAmountThb > 0 ? (
                            <span className="ml-1 font-medium normal-case tracking-normal text-[#667380]">
                              P:{compactThb(month.paidAmountThb).replace("THB ", "")}{" "}
                              Pl:{compactThb(month.plannedAmountThb).replace("THB ", "")}
                            </span>
                          ) : null}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <div
                    className="mt-1.5 grid gap-1 text-[10px] font-semibold text-[#52606d]"
                    style={{
                      gridTemplateColumns: `repeat(${Math.max(paymentChartBuckets.length, 1)}, minmax(14px, 1fr))`,
                    }}
                  >
                    {paymentView === "monthly" || paymentChartBuckets.length <= 16
                      ? paymentChartBuckets.map((bucket) => (
                          <span
                            className="min-w-0 truncate text-center"
                            key={`payment-axis-${bucket.bucketStart}`}
                          >
                            {bucket.bucketLabel}
                          </span>
                        ))
                      : null}
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 overflow-x-auto rounded-md border border-[#dfe4ea]" id="payment-action-list">
              <table className="w-full min-w-[1180px] table-fixed text-left text-sm">
                <colgroup>
                  <col className="w-[94px]" />
                  <col className="w-[104px]" />
                  <col className="w-[16%]" />
                  <col className="w-[18%]" />
                  <col className="w-[16%]" />
                  <col className="w-[14%]" />
                  <col className="w-[210px]" />
                  <col className="w-[120px]" />
                  <col className="w-[90px]" />
                </colgroup>
                <thead className="bg-[#f3f5f7] text-xs uppercase tracking-[0.12em] text-[#65717f]">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Status</th>
                    <th className="px-3 py-2 font-semibold">Due date</th>
                    <th className="px-3 py-2 font-semibold">Supplier</th>
                    <th className="px-3 py-2 font-semibold">PO / Quote</th>
                    <th className="px-3 py-2 font-semibold">Purpose / Tag</th>
                    <th className="px-3 py-2 font-semibold">Payment type</th>
                    <th className="px-3 py-2 text-right font-semibold">Amount</th>
                    <th className="px-3 py-2 font-semibold">Timing</th>
                    <th className="px-3 py-2 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf1f5]">
                  {primaryPaymentActionEvents.map(renderPaymentActionRow)}
                  {paymentActionEvents.length === 0 ? (
                    <tr>
                      <td className="px-3 py-4 text-sm text-[#667380]" colSpan={9}>
                        No planned payment actions found.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
              {extraPaymentActionEvents.length > 0 ? (
                <details className="group border-t border-[#edf1f5]">
                  <summary className="flex min-w-[1180px] cursor-pointer list-none justify-center bg-white px-3 py-3 text-sm font-semibold text-[#255f85] hover:bg-[#f7f9fb]">
                    <span className="group-open:hidden">
                      Expand Payment List ({formatNumber(extraPaymentActionEvents.length)} more)
                    </span>
                    <span className="hidden group-open:inline">
                      Collapse Payment List
                    </span>
                  </summary>
                  <table className="w-full min-w-[1180px] table-fixed text-left text-sm">
                    <colgroup>
                      <col className="w-[94px]" />
                      <col className="w-[104px]" />
                      <col className="w-[16%]" />
                      <col className="w-[18%]" />
                      <col className="w-[16%]" />
                      <col className="w-[14%]" />
                      <col className="w-[210px]" />
                      <col className="w-[120px]" />
                      <col className="w-[90px]" />
                    </colgroup>
                    <tbody className="divide-y divide-[#edf1f5]">
                      {extraPaymentActionEvents.map(renderPaymentActionRow)}
                    </tbody>
                  </table>
                </details>
              ) : null}
            </div>
          </div>
        </section>

        {allowCreatePo ? (
        <section className="rounded-lg border border-[#dfe4ea] bg-white shadow-sm" id="new-po">
          <details open>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
              <div>
                <h2 className="text-base font-semibold">Open New PO</h2>
                <p className="mt-0.5 text-xs text-[#667380]">
                  Create a draft PO when you are ready to add a new order.
                </p>
              </div>
              <span className="rounded-md border border-[#cfd6df] px-3 py-1.5 text-sm font-semibold text-[#364252]">
                Ready
              </span>
            </summary>
            <div className="border-t border-[#e2e7ed] p-4">
              {data.source === "supabase" ? (
                <CreatePoForm
                  suggestedPoId={generatedPoId()}
                  suppliers={data.suppliers}
                  today={today}
                />
              ) : (
                <p className="rounded-md bg-[#fff4e5] px-3 py-2 text-sm font-medium text-[#946200]">
                  Connect Supabase and import PO data before opening live POs.
                </p>
              )}
            </div>
          </details>
        </section>
        ) : null}

        <section className="grid gap-4 xl:grid-cols-[minmax(400px,500px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(420px,520px)_minmax(0,1fr)]">
          <div className="rounded-lg border border-[#dfe4ea] bg-white shadow-sm" id="pipeline">
            <div className="border-b border-[#e2e7ed] p-4">
              <h2 className="text-base font-semibold">PO Status Pipeline</h2>
              <p className="mt-1 text-xs text-[#667380]">
                Supplier incoming counts only unreceived in-progress or delivery lines.
              </p>
            </div>
            <div className="divide-y divide-[#edf1f5]">
              {data.supplierSummaries.map((row) => (
                <div
                  className="grid gap-2 px-4 py-3"
                  key={`${row.supplierCode}-${row.supplierName}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{row.supplierName}</p>
                      <p className="mt-1 text-xs text-[#667380]">
                        {row.supplierCode || "No code"} | {formatNumber(row.poCount)} POs |{" "}
                        {formatNumber(row.lineCount)} lines
                      </p>
                    </div>
                    <p className="text-right font-mono font-semibold">
                      {formatNumber(row.incomingQty)}
                    </p>
                  </div>
                  <div className="grid gap-2 text-xs text-[#667380] sm:grid-cols-2">
                    <p>
                      Term:{" "}
                      <span className="font-semibold text-[#364252]">
                        {row.paymentTerms}
                      </span>
                    </p>
                    <p className="sm:text-right">
                      Open qty:{" "}
                      <span className="font-mono text-[#364252]">
                        {formatNumber(row.totalQty)}
                      </span>
                    </p>
                    <p>
                      Paid:{" "}
                      <span className="font-mono text-[#1f6b3d]">
                        {formatCurrency(row.paidAmountThb, "THB")}
                      </span>
                    </p>
                    <p className="sm:text-right">
                      Planned:{" "}
                      <span className="font-mono text-[#946200]">
                        {formatCurrency(row.plannedAmountThb, "THB")}
                      </span>
                    </p>
                  </div>
                </div>
              ))}
              {data.supplierSummaries.length === 0 ? (
                <p className="px-4 py-5 text-sm text-[#667380]">
                  No active incoming supplier pipeline rows.
                </p>
              ) : null}
            </div>
          </div>

          <div className="min-w-0 rounded-lg border border-[#dfe4ea] bg-white shadow-sm" id="workbench">
            <div className="border-b border-[#e2e7ed] p-4">
              <h2 className="text-base font-semibold">Active PO Workbench</h2>
              <p className="mt-1 text-xs text-[#667380]">
                POs with active incoming, waiting approval, draft, and open workflow statuses.
              </p>
              <form className="mt-3 grid gap-3 lg:grid-cols-[minmax(280px,1fr)_minmax(300px,520px)_auto]" action="/po">
                <input
                  className="h-10 rounded-md border border-[#cfd6df] bg-white px-3 text-sm outline-none focus:border-[#255f85]"
                  defaultValue={q}
                  name="q"
                  placeholder="Search PO, supplier, owner"
                />
                <PoStatusFilterSelect options={statusOptions} selected={selectedStatuses} />
                <PendingSubmitButton
                  className="inline-flex h-10 items-center justify-center rounded-md bg-[#172026] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  loadingText="Filtering..."
                >
                  Filter
                </PendingSubmitButton>
              </form>
              <p className="mt-2 text-xs font-medium text-[#667380]">
                Showing page {data.pagination?.page ?? 1} of {data.pagination?.pageCount ?? 1} |{" "}
                {formatNumber(data.pagination?.total ?? filteredWorkbenchOrders.length)} matching POs
              </p>
              {hasFilters ? (
                <Link className="mt-2 inline-flex text-sm font-semibold text-[#255f85]" href="/po">
                  Clear filters
                </Link>
              ) : null}
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[1500px] text-left text-sm">
                <thead className="bg-[#f3f5f7] text-xs uppercase tracking-[0.12em] text-[#65717f]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">{sortHeader("po", "PO")}</th>
                    <th className="px-4 py-3 font-semibold">{sortHeader("date", "Date")}</th>
                    <th className="px-4 py-3 font-semibold">
                      {sortHeader("supplier", "Supplier")}
                    </th>
                    <th className="px-4 py-3 font-semibold">Comment</th>
                    <th className="px-4 py-3 font-semibold">
                      {sortHeader("status", "Status")}
                    </th>
                    <th className="px-4 py-3 text-right font-semibold">
                      {sortHeader("lines", "Lines", "right")}
                    </th>
                    <th className="px-4 py-3 text-right font-semibold">
                      {sortHeader("incoming", "Incoming", "right")}
                    </th>
                    <th className="px-4 py-3 text-right font-semibold">
                      {sortHeader("pending", "Pending", "right")}
                    </th>
                    <th className="px-4 py-3 text-right font-semibold">
                      {sortHeader("amount", "Amount", "right")}
                    </th>
                    <th className="px-4 py-3 font-semibold">Update</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf1f5]">
                  {filteredWorkbenchOrders.map((order) => (
                    <tr key={order.poId}>
                      <td className="whitespace-nowrap px-4 py-3">
                        <p className="font-mono text-xs font-semibold text-[#172026]">
                          <Link
                            className="underline-offset-2 hover:underline"
                            href={`/po/${encodeURIComponent(order.poId)}`}
                          >
                            {order.poId}
                          </Link>
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-[#6b7785]">
                        {order.poDate ? order.poDate.slice(0, 10) : "No date"}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{order.supplierName}</p>
                        <p className="mt-1 text-xs text-[#6b7785]">
                          Quotation: {order.quotationReference || "-"}
                        </p>
                        <p className="mt-0.5 text-xs text-[#6b7785]">
                          Supplier INV: {order.supplierInvoiceNo || "-"}
                        </p>
                      </td>
                      <td className="min-w-[320px] px-4 py-3 align-top">
                        {data.source === "supabase" && allowEditPo ? (
                          <QuickPoCommentForm
                            actualReceivedDate={order.actualReceivedDate}
                            estimatedArrivedDate={order.estimatedArrivedDate}
                            estimatedDeliveryDate={order.estimatedDeliveryDate}
                            poId={order.poId}
                            quotationReference={order.quotationReference}
                            supplierDiscussionNote={order.supplierDiscussionNote}
                            supplierInvoiceNo={order.supplierInvoiceNo}
                          />
                        ) : (
                          <p
                            className="max-h-24 max-w-[360px] overflow-y-auto whitespace-pre-wrap rounded-md border border-[#e2e7ed] bg-[#fbfcfd] px-3 py-2 text-xs leading-5 text-[#52606d]"
                            title={order.supplierDiscussionNote}
                          >
                            {order.supplierDiscussionNote || "-"}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {order.statuses.map((status) => (
                            <span
                              className={`rounded-md px-2 py-1 text-xs font-semibold ${statusClass(
                                status,
                              )}`}
                              key={status}
                            >
                              {displayStatus(status)}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {formatNumber(order.itemCount)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-[#1f6b3d]">
                        {formatNumber(order.activeIncomingQty)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-[#946200]">
                        {formatNumber(order.pendingApprovalQty)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {formatCurrency(order.poAmountForeign, order.currency)}
                      </td>
                      <td className="px-4 py-3 align-top">
                        {data.source === "supabase" && allowEditPo ? (
                          <>
                            <StatusActionForm
                              currentStatus={order.workStatus || order.statuses[0] || "draft"}
                              poId={order.poId}
                            />
                            <AddPoItemForm poId={order.poId} />
                            <DeleteDraftPoForm
                              isDraft={order.workStatus.toLowerCase() === "draft"}
                              poId={order.poId}
                            />
                          </>
                        ) : (
                          <span className="text-xs text-[#8a96a3]">
                            {data.source === "supabase" ? "Read-only" : "Fallback only"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredWorkbenchOrders.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-sm text-[#667380]" colSpan={10}>
                        No purchase orders match this search.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-[#edf1f5] px-4 py-3 text-sm">
              <Link
                aria-disabled={!data.pagination?.hasPreviousPage}
                className={`rounded-md border border-[#cfd6df] px-3 py-2 font-semibold ${
                  data.pagination?.hasPreviousPage
                    ? "bg-white text-[#364252]"
                    : "pointer-events-none bg-[#f3f5f7] text-[#9aa5b1]"
                }`}
                href={buildPageHref(Math.max(1, (data.pagination?.page ?? 1) - 1))}
              >
                Previous
              </Link>
              <span className="font-medium text-[#667380]">
                Page {data.pagination?.page ?? 1} / {data.pagination?.pageCount ?? 1}
              </span>
              <Link
                aria-disabled={!data.pagination?.hasNextPage}
                className={`rounded-md border border-[#cfd6df] px-3 py-2 font-semibold ${
                  data.pagination?.hasNextPage
                    ? "bg-white text-[#364252]"
                    : "pointer-events-none bg-[#f3f5f7] text-[#9aa5b1]"
                }`}
                href={buildPageHref((data.pagination?.page ?? 1) + 1)}
              >
                Next
              </Link>
            </div>
          </div>
        </section>
        </>
        ) : null}
      </div>
      </div>
    </main>
  );
}
