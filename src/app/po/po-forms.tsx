"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { DragEvent, ReactNode } from "react";
import {
  addPoItemAction,
  addPoItemsBatchAction,
  addPoPaymentAction,
  allocatePoLandedCostAction,
  batchReceivePoItemsAction,
  changePoStatusAction,
  createPoAction,
  deleteDraftPoAction,
  receivePoItemAction,
  repricePoDraftLinesAction,
  removePoReceiptAction,
  updatePoHeaderRefsAction,
  updatePoDraftLinesAction,
  updatePoPaymentsAction,
  type PoActionState,
} from "@/app/po/actions";
import { LoadingLabel } from "@/app/loading-controls";
import {
  matrixItemFamily,
  matrixItemSize,
  matrixProductName,
  matrixSectionLabel,
  matrixSectionName,
  sortMatrixSizes,
  type MatrixFamily,
} from "@/lib/po-size-matrix";
import { sortPoPayments, type PoPaymentDisplayRow } from "@/lib/po-payments";

type SupplierOption = {
  supplierCode: string;
  supplierName: string;
  currency: string;
  paymentTerms: string;
};

type CatalogItemOption = {
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
  recommendedRawQty: number;
  recommendedRoundQty: number;
  recommendedQty: number;
  searchText: string;
};

type DraftLineItem = {
  itemUuid?: string;
  tempId?: string;
  imageUrl?: string | null;
  lineNo: string;
  sku: string;
  productTitle: string;
  variantTitle?: string;
  fullName?: string;
  qty: number;
  unitPrice: number;
  unitPriceSource?: string;
  unitPriceSourceDate?: string;
  unitPriceSourcePoReference?: string;
  freightUnitCost?: number;
  landedUnitCost?: number;
  lineAmount: number;
  currency: string;
  remark: string;
  sortPosition?: number;
  tags?: string[];
  onHand?: number;
};

type PaymentRowItem = PoPaymentDisplayRow;

type CreatePoDraftLine = {
  currency: string;
  freightUnitCost: string;
  imageUrl: string;
  productTitle: string;
  qty: string;
  remark: string;
  sku: string;
  source: "catalog" | "manual";
  tempId: string;
  unitPrice: string;
  variantTitle: string;
};

const initialState: PoActionState = { ok: false, message: "" };
const printIntentEvent = "po-detail:print-intent";
const fillAllReceivingEvent = "po-detail:fill-all-receiving";
const statusOptions = [
  "draft",
  "waiting_for_approve",
  "follow_up",
  "inpro",
  "delivery",
  "final_payment",
  "closed",
  "cancelled",
];

const statusOptionLabels: Record<string, string> = {
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

function statusOptionLabel(status: string) {
  return statusOptionLabels[status] ?? status;
}

const standardPaymentTypes = [
  ["deposit50%", "Deposit 50%"],
  ["deposit30%", "Deposit 30%"],
  ["beforeshipments25%", "Before Shipment 25%"],
  ["beforeshipments50%", "Before Shipment 50%"],
  ["afterreceived25%", "After Received 25%"],
  ["afterreceived25%_1month", "After Received 25% - 1 Month"],
  ["aftersale25%_1month", "After Sale 25% - 1 Month"],
  ["balance", "Balance"],
  ["freight", "Freight"],
  ["shipping", "Shipping"],
  ["fine", "Fine / penalty"],
  ["other", "Other"],
] as const;

function readablePaymentType(value: string) {
  const compact = value.trim().toLowerCase().replace(/[^a-z0-9%]+/g, "");
  const labels: Record<string, string> = {
    afterreceived25: "After Received 25%",
    "afterreceived25%": "After Received 25%",
    afterreceived251month: "After Received 25% - 1 Month",
    afterrecived25: "After Received 25%",
    "afterrecived25%": "After Received 25%",
    afterrecived251month: "After Received 25% - 1 Month",
    aftersale251month: "After Sale 25% - 1 Month",
    before_shipment50: "Before Shipment 50%",
    beforeshipment50: "Before Shipment 50%",
    beforeshipments25: "Before Shipment 25%",
    "beforeshipments25%": "Before Shipment 25%",
    beforeshipments50: "Before Shipment 50%",
    "beforeshipments50%": "Before Shipment 50%",
    deposit30: "Deposit 30%",
    "deposit30%": "Deposit 30%",
    deposit50: "Deposit 50%",
    "deposit50%": "Deposit 50%",
    freight: "Freight",
    other: "Other",
    shipping: "Shipping",
  };

  return labels[compact] ?? (value.trim() || "-");
}

function paymentTypeOptions(paymentTerms?: string | null, savedTypes: string[] = []) {
  const fromSavedTypes = savedTypes
    .map((type) => type.trim())
    .filter(Boolean)
    .map((type) => ({
      label: readablePaymentType(type),
      value: type,
    }));
  const fromTerms = String(paymentTerms ?? "")
    .split(/[,+/|]/)
    .map((term) => term.trim())
    .filter(Boolean)
    .map((term) => ({
      label: readablePaymentType(term),
      value: term.toLowerCase().replace(/[^a-z0-9%]+/g, "_").replace(/^_+|_+$/g, ""),
    }));

  const seen = new Set<string>();
  return [
    ...fromSavedTypes,
    ...fromTerms,
    ...standardPaymentTypes.map(([value, label]) => ({ label, value })),
  ].filter((option) => {
    if (!option.value || seen.has(option.value)) {
      return false;
    }
    seen.add(option.value);
    return true;
  });
}

function paymentTypeOptionsWithBlank(
  paymentTerms?: string | null,
  savedTypes: string[] = [],
) {
  return [
    { label: "Select payment type", value: "" },
    ...paymentTypeOptions(paymentTerms, savedTypes),
  ];
}

function draftLineKey(item: DraftLineItem) {
  return item.itemUuid || item.tempId || `${item.sku}:${item.lineNo}`;
}

function roundQtyUpToTen(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return Math.ceil(value / 10) * 10;
}

function freightUnitFromTotal(value: string, lines: DraftLineItem[]) {
  if (!value) {
    return null;
  }
  const totalCost = Number(value);
  const totalQty = lines.reduce((sum, line) => sum + line.qty, 0);
  if (!Number.isFinite(totalCost) || totalCost < 0 || totalQty <= 0) {
    return null;
  }

  return totalCost / totalQty;
}

function applyLogisticCostToLines(lines: DraftLineItem[], value: string) {
  const freightUnitCost = freightUnitFromTotal(value, lines);
  if (freightUnitCost === null) {
    return lines;
  }

  return lines.map((line) => ({
    ...line,
    freightUnitCost: Number(freightUnitCost.toFixed(4)),
  }));
}

function averageExchangeRate(values: string[]) {
  const usableRates = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (usableRates.length === 0) {
    return null;
  }

  return usableRates.reduce((sum, value) => sum + value, 0) / usableRates.length;
}

function ActionMessage({ state }: { state: PoActionState }) {
  if (!state.message) {
    return null;
  }

  return (
    <p
      className={`mt-3 rounded-md px-3 py-2 text-sm font-medium ${
        state.ok ? "bg-[#eaf6ef] text-[#1f6b3d]" : "bg-[#fff1f0] text-[#9f2a2a]"
      }`}
    >
      {state.message}
    </p>
  );
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value);
}

function createDraftLineId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const initialPaymentDraftKey = "draft-initial-0";

function createAddedPaymentDraftKey(index: number) {
  return `draft-added-${index}`;
}

function dateInputValue(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return "";
  }
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }
  const slashMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!slashMatch) {
    return "";
  }
  const day = slashMatch[1].padStart(2, "0");
  const month = slashMatch[2].padStart(2, "0");
  const year = slashMatch[3].length === 2 ? `20${slashMatch[3]}` : slashMatch[3];
  return `${year}-${month}-${day}`;
}

const inputClass =
  "h-10 rounded-md border border-[#cfd6df] bg-white px-3 text-sm text-[#172026] outline-none focus:border-[#255f85]";
const labelClass = "grid gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#64707d]";
const buttonClass =
  "inline-flex h-10 items-center justify-center rounded-md bg-[#172026] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50";

function getPaymentStatusSelectClass(status: string) {
  if (status === "paid") {
    return "!border-green-700 !bg-green-600 !font-semibold !text-white";
  }
  if (status === "planned") {
    return "!border-blue-300 !bg-blue-100 !font-semibold !text-blue-900";
  }
  return "!border-red-300 !bg-red-100 !font-semibold !text-red-900";
}

function getXeroStatusSelectClass(status: string) {
  if (status === "uploaded") {
    return "!border-green-700 !bg-green-600 !font-semibold !text-white";
  }
  if (status === "draft") {
    return "!border-orange-500 !bg-orange-400 !font-semibold !text-black";
  }
  return "!border-amber-300 !bg-amber-100 !font-semibold !text-amber-900";
}

function getPaymentTypeSelectClass(type: string) {
  const compact = type.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (!compact) {
    return "!border-slate-300 !bg-slate-100 !text-slate-600";
  }
  if (compact.includes("deposit")) {
    return "!border-indigo-300 !bg-indigo-100 !font-semibold !text-indigo-900";
  }
  if (compact.includes("before") || compact.includes("shipment")) {
    return "!border-blue-300 !bg-blue-100 !font-semibold !text-blue-900";
  }
  if (compact.includes("freight") || compact.includes("shipping")) {
    return "!border-orange-300 !bg-orange-100 !font-semibold !text-orange-900";
  }
  if (compact.includes("afterreceived") || compact.includes("aftersale") || compact.includes("balance")) {
    return "!border-green-300 !bg-green-100 !font-semibold !text-green-900";
  }
  if (compact.includes("fine") || compact.includes("penalty")) {
    return "!border-red-300 !bg-red-100 !font-semibold !text-red-900";
  }
  return "!border-slate-300 !bg-white !text-slate-800";
}

const xeroBillHeaders = [
  "*ContactName",
  "EmailAddress",
  "POAddressLine1",
  "POAddressLine2",
  "POAddressLine3",
  "POAddressLine4",
  "POCity",
  "PORegion",
  "POPostalCode",
  "POCountry",
  "*InvoiceNumber",
  "*InvoiceDate",
  "*DueDate",
  "Total",
  "InventoryItemCode",
  "Description",
  "*Quantity",
  "*UnitAmount",
  "*AccountCode",
  "*TaxType",
  "TaxAmount",
  "TrackingName1",
  "TrackingOption1",
  "TrackingName2",
  "TrackingOption2",
  "Currency",
] as const;

const shopifyPurchaseOrderHeaders = [
  "SKU",
  "Barcode",
  "Supplier SKU",
  "Quantity",
  "Cost",
  "Tax",
] as const;

function csvCell(value: string | number) {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function xeroDescription(line: DraftLineItem) {
  const productTitle = line.productTitle.trim();
  const variantTitle = line.variantTitle?.trim() ?? "";
  const fullName = line.fullName?.trim() ?? "";

  if (productTitle && variantTitle && !productTitle.toLowerCase().includes(variantTitle.toLowerCase())) {
    return `${productTitle} / ${variantTitle}`;
  }

  return productTitle || fullName || line.sku;
}

function safeCsvFileToken(value: string) {
  return value
    .trim()
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function downloadXeroBillCsv({
  lines,
  poReference,
  supplierName,
}: {
  lines: DraftLineItem[];
  poReference: string;
  supplierName: string;
}) {
  const contactName = supplierName.trim();
  if (!contactName) {
    throw new Error("Supplier/contact name is required before downloading the Xero CSV.");
  }

  const exportCurrency = "THB";
  const exportRows = lines
    .map((line) => {
      const sku = line.sku.trim();
      const description = xeroDescription(line).trim();
      const quantity = Number(line.qty);
      const unitAmount = Number(line.unitPrice);

      return {
        description,
        quantity,
        sku,
        unitAmount,
      };
    })
    .filter((row) => row.sku || row.description || row.quantity > 0);

  if (exportRows.length === 0) {
    throw new Error("No valid line rows are available for the Xero CSV.");
  }
  if (exportRows.every((row) => !row.sku && !row.description)) {
    throw new Error("At least one line needs a SKU or description before downloading the Xero CSV.");
  }

  for (const [index, row] of exportRows.entries()) {
    if (!Number.isFinite(row.quantity) || row.quantity <= 0) {
      throw new Error(`Line ${index + 1} needs a quantity greater than 0 before downloading the Xero CSV.`);
    }
    if (!Number.isFinite(row.unitAmount) || row.unitAmount < 0) {
      throw new Error(`Line ${index + 1} needs a unit amount of 0 or greater before downloading the Xero CSV.`);
    }
  }

  const rows = exportRows
    .map((row) => [
      contactName,
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      row.sku,
      row.description,
      row.quantity,
      row.unitAmount,
      "",
      "Tax on Purchases (7%)",
      "",
      "Department",
      "Online Store",
      "",
      "",
      exportCurrency,
    ]);
  const csv = [xeroBillHeaders, ...rows]
    .map((row) => row.map((value) => csvCell(value)).join(","))
    .join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const fileToken = safeCsvFileToken(poReference);
  link.download = fileToken ? `xero_bill_${fileToken}.csv` : "xero_bill_export.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadShopifyPurchaseOrderCsv({
  lines,
  poReference,
}: {
  lines: DraftLineItem[];
  poReference: string;
}) {
  const exportRows = lines
    .map((line) => ({
      quantity: Number(line.qty),
      sku: line.sku.trim(),
    }))
    .filter((row) => row.sku && row.quantity > 0);

  if (exportRows.length === 0) {
    const hasAnyLineRows = lines.some((line) => line.sku.trim() || Number(line.qty) > 0);
    const hasAnySku = lines.some((line) => line.sku.trim());
    const hasAnyPositiveQty = lines.some((line) => Number(line.qty) > 0);

    if (!hasAnyLineRows) {
      throw new Error("No valid PO line rows are available for the Shopify CSV.");
    }
    if (!hasAnySku) {
      throw new Error("At least one line needs a SKU before downloading the Shopify CSV.");
    }
    if (!hasAnyPositiveQty) {
      throw new Error("At least one line needs a quantity greater than 0 before downloading the Shopify CSV.");
    }

    throw new Error("No rows have both SKU and quantity greater than 0 for the Shopify CSV.");
  }

  const rows = exportRows.map((row) => [
    row.sku,
    "",
    "",
    row.quantity,
    0,
    0,
  ]);
  const csv = [shopifyPurchaseOrderHeaders, ...rows]
    .map((row) => row.map((value) => csvCell(value)).join(","))
    .join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const fileToken = safeCsvFileToken(poReference);
  link.download = fileToken
    ? `shopify_purchase_order_${fileToken}_READY.csv`
    : "shopify_purchase_order_READY.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function useCatalogSearch({
  limit,
  query,
  supplierCode,
  supplierName,
}: {
  limit: number;
  query: string;
  supplierCode?: string;
  supplierName?: string;
}) {
  const [items, setItems] = useState<CatalogItemOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) {
      return;
    }

    const controller = new AbortController();
    let stale = false;
    const debounceTimer = window.setTimeout(() => {
      const params = new URLSearchParams({
        limit: String(limit),
        q: normalizedQuery,
      });
      if (supplierCode) {
        params.set("supplierCode", supplierCode);
      }
      if (supplierName) {
        params.set("supplierName", supplierName);
      }

      setLoading(true);
      fetch(`/api/po/catalog-search?${params.toString()}`, {
        signal: controller.signal,
      })
        .then((response) => (response.ok ? response.json() : { items: [] }))
        .then((payload: { items?: CatalogItemOption[] }) => {
          if (!stale) {
            setItems(Array.isArray(payload.items) ? payload.items : []);
          }
        })
        .catch((error) => {
          if (!stale && !(error instanceof DOMException && error.name === "AbortError")) {
            setItems([]);
          }
        })
        .finally(() => {
          if (!stale) {
            setLoading(false);
          }
        });
    }, 275);

    return () => {
      stale = true;
      window.clearTimeout(debounceTimer);
      controller.abort();
    };
  }, [limit, query, supplierCode, supplierName]);

  const hasSearchQuery = query.trim().length >= 2;

  return {
    items: hasSearchQuery ? items : [],
    loading: hasSearchQuery && loading,
  };
}

function matrixCatalogSearchQuery(productName: string) {
  return productName.split(/\s+\/\s+/)[0]?.trim() || productName.trim();
}

function matrixProductMatchKey(productName: string) {
  return productName
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function matrixCatalogProductName(item: CatalogItemOption) {
  return item.mainName.trim() || matrixProductName(item);
}

function uniqueCatalogItems(items: CatalogItemOption[]) {
  return Array.from(
    items
      .reduce((itemBySku, item) => {
        if (item.sku.trim()) {
          itemBySku.set(item.sku.trim(), item);
        }
        return itemBySku;
      }, new Map<string, CatalogItemOption>())
      .values(),
  );
}

function useMatrixCatalogProducts(productNames: string[]) {
  const queryKey = Array.from(
    new Set(
      productNames
        .map(matrixCatalogSearchQuery)
        .filter((query) => query.length >= 2),
    ),
  )
    .sort()
    .join("\n");
  const [result, setResult] = useState<{
    items: CatalogItemOption[];
    queryKey: string;
  }>({ items: [], queryKey: "" });

  useEffect(() => {
    const queries = queryKey.split("\n").filter(Boolean);
    if (queries.length === 0) {
      return;
    }

    const controller = new AbortController();
    let stale = false;

    Promise.all(
      queries.map((query) => {
        const params = new URLSearchParams({
          limit: "50",
          q: query,
        });
        return fetch(`/api/po/catalog-search?${params.toString()}`, {
          signal: controller.signal,
        })
          .then((response) => (response.ok ? response.json() : { items: [] }))
          .then((payload: { items?: CatalogItemOption[] }) =>
            Array.isArray(payload.items) ? payload.items : [],
          );
      }),
    )
      .then((results) => {
        if (!stale) {
          setResult({
            items: uniqueCatalogItems(results.flat()),
            queryKey,
          });
        }
      })
      .catch((error) => {
        if (!stale && !(error instanceof DOMException && error.name === "AbortError")) {
          setResult({ items: [], queryKey });
        }
      });

    return () => {
      stale = true;
      controller.abort();
    };
  }, [queryKey]);

  return {
    items: result.queryKey === queryKey ? result.items : [],
    loading: Boolean(queryKey) && result.queryKey !== queryKey,
  };
}

function editableQuoteMatrixRows(
  lines: DraftLineItem[],
  catalogItems: CatalogItemOption[] = [],
) {
  const rows = new Map<
    string,
    {
      availableSizes: Set<string>;
      family: MatrixFamily;
      groupTag: string;
      imageUrl: string | null;
      items: Map<
        string,
        {
          lineIndexes: number[];
          onHand: number;
          orderedQty: number;
          skus: Set<string>;
        }
      >;
      productName: string;
      totalQty: number;
    }
  >();

  lines.forEach((line, lineIndex) => {
    const productName = matrixProductName(line);
    const groupTag = matrixSectionName(line);
    const family = matrixItemFamily(line);
    const key = `${groupTag.toLowerCase()}::${family}::${productName.toLowerCase()}`;
    const row =
      rows.get(key) ??
      {
        availableSizes: new Set<string>(),
        family,
        groupTag,
        imageUrl: line.imageUrl ?? null,
        items: new Map(),
        productName,
        totalQty: 0,
      };
    const size = matrixItemSize(line);
    row.availableSizes.add(size);
    const cell =
      row.items.get(size) ??
      {
        lineIndexes: [],
        onHand: 0,
        orderedQty: 0,
        skus: new Set<string>(),
      };

    cell.lineIndexes.push(lineIndex);
    cell.orderedQty += line.qty;
    if (!cell.skus.has(line.sku)) {
      cell.onHand += line.onHand ?? 0;
      cell.skus.add(line.sku);
    }
    row.totalQty += line.qty;
    if (!row.imageUrl && line.imageUrl) {
      row.imageUrl = line.imageUrl;
    }

    row.items.set(size, cell);
    rows.set(key, row);
  });

  const rowsByProduct = new Map<
    string,
    Array<(typeof rows extends Map<string, infer T> ? T : never)>
  >();
  for (const row of rows.values()) {
    const productKey = `${row.family}::${matrixProductMatchKey(row.productName)}`;
    rowsByProduct.set(productKey, [...(rowsByProduct.get(productKey) ?? []), row]);
  }

  for (const item of catalogItems) {
    const productName = matrixCatalogProductName(item);
    const productKey = `${matrixItemFamily(item)}::${matrixProductMatchKey(productName)}`;
    const matchingRows = rowsByProduct.get(productKey) ?? [];
    for (const row of matchingRows) {
      row.availableSizes.add(matrixItemSize(item));
      if (!row.imageUrl && item.imageUrl) {
        row.imageUrl = item.imageUrl;
      }
    }
  }

  const rowValues = Array.from(rows.values());
  return Array.from(
    rowValues
      .reduce((groupMap, row) => {
        const groupKey = `${row.groupTag}::${row.family}`;
        groupMap.set(groupKey, [...(groupMap.get(groupKey) ?? []), row]);
        return groupMap;
      }, new Map<string, typeof rowValues>())
      .entries(),
  )
    .map(([, groupRows]) => {
      const family = groupRows[0]?.family ?? "unknown";
      const groupTag = groupRows[0]?.groupTag ?? "Untagged";
      const sizes = sortMatrixSizes(
        groupRows.flatMap((row) => Array.from(row.availableSizes)),
        family,
      );
      const maxQty = Math.max(
        0,
        ...groupRows.flatMap((row) =>
          Array.from(row.items.values()).map((item) => item.orderedQty),
        ),
      );

      return {
        family,
        groupTag,
        label: matrixSectionLabel(groupTag, family),
        maxQty,
        rows: groupRows.sort((a, b) => a.productName.localeCompare(b.productName)),
        sizes,
      };
    })
    .sort((a, b) => a.groupTag.localeCompare(b.groupTag) || a.label.localeCompare(b.label));
}

function editableQtyHeatStyle(value: number, maxValue: number) {
  if (!value) {
    return {
      backgroundColor: "#111827",
      color: "#ffffff",
    };
  }

  const ratio = maxValue > 0 ? Math.min(1, value / maxValue) : 0;
  const hue = 4 + ratio * 128;
  const saturation = 62;
  const lightness = 93 - ratio * 8;

  return {
    backgroundColor: `hsl(${hue} ${saturation}% ${lightness}%)`,
    color: "#172026",
  };
}

function formatQty(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value);
}

export function PoStatusFilterSelect({
  options,
  selected,
}: {
  options: string[];
  selected: string[];
}) {
  const [selectedValues, setSelectedValues] = useState(
    selected.length > 0 ? selected : ["all"],
  );

  function toggleStatus(value: string, checked: boolean) {
    setSelectedValues((current) => {
      if (value === "all") {
        return checked ? ["all"] : [];
      }

      const withoutAll = current.filter((item) => item !== "all");
      const next = checked
        ? Array.from(new Set([...withoutAll, value]))
        : withoutAll.filter((item) => item !== value);

      return next.length > 0 ? next : ["all"];
    });
  }

  return (
    <div className="rounded-md border border-[#cfd6df] bg-white px-3 py-2">
      <input name="status" type="hidden" value={selectedValues.join(",")} />
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#65717f]">
        Status
      </p>
      <div className="flex max-h-24 flex-wrap gap-2 overflow-auto">
        {["all", ...options].map((option) => {
          const checked = selectedValues.includes(option);
          return (
            <label
              className="inline-flex items-center gap-2 rounded-md border border-[#dfe4ea] px-2 py-1 text-xs font-semibold text-[#364252]"
              key={option}
            >
              <input
                checked={checked}
                className="size-3 accent-[#255f85]"
                onChange={(event) => toggleStatus(option, event.target.checked)}
                type="checkbox"
              />
              {option === "all" ? "All" : statusOptionLabel(option)}
            </label>
          );
        })}
      </div>
    </div>
  );
}

export function CreatePoForm({
  suggestedPoId,
  suppliers,
  today,
}: {
  suggestedPoId: string;
  suppliers: SupplierOption[];
  today: string;
}) {
  const [state, formAction, pending] = useActionState(createPoAction, initialState);
  const [supplierCode, setSupplierCode] = useState("");
  const [query, setQuery] = useState("");
  const [currency, setCurrency] = useState("THB");
  const [lines, setLines] = useState<CreatePoDraftLine[]>([]);
  const [manualProductTitle, setManualProductTitle] = useState("");
  const [manualSku, setManualSku] = useState("");
  const [manualVariantTitle, setManualVariantTitle] = useState("");
  const [manualImageUrl, setManualImageUrl] = useState("");
  const [manualQty, setManualQty] = useState("");
  const [manualUnitPrice, setManualUnitPrice] = useState("");
  const [manualFreightUnitCost, setManualFreightUnitCost] = useState("");
  const [manualRemark, setManualRemark] = useState("");
  const selectedSupplier = suppliers.find(
    (supplier) => supplier.supplierCode === supplierCode,
  );
  const { items: filteredCatalogItems, loading: catalogLoading } = useCatalogSearch({
    limit: 10,
    query,
    supplierCode,
    supplierName: selectedSupplier?.supplierName ?? "",
  });

  function addCatalogItem(item: CatalogItemOption) {
    const lineCurrency = item.currency || selectedSupplier?.currency || currency || "THB";
    setLines((current) => [
      ...current,
      {
        currency: lineCurrency,
        freightUnitCost: item.lastFreightUnitCost ? String(item.lastFreightUnitCost) : "",
        imageUrl: item.imageUrl ?? "",
        productTitle: item.productTitle,
        qty: item.recommendedQty ? String(item.recommendedQty) : "",
        remark: "",
        sku: item.sku,
        source: "catalog",
        tempId: createDraftLineId(),
        unitPrice: String(item.lastUnitPrice || ""),
        variantTitle: item.variantTitle,
      },
    ]);
    setCurrency(lineCurrency);
    setQuery("");
  }

  function addManualItem() {
    const productTitle = manualProductTitle.trim();
    const qty = Number(manualQty);
    if (!productTitle || !Number.isFinite(qty) || qty <= 0) {
      return;
    }

    setLines((current) => [
      ...current,
      {
        currency: selectedSupplier?.currency || currency || "THB",
        freightUnitCost: manualFreightUnitCost,
        imageUrl: manualImageUrl.trim(),
        productTitle,
        qty: manualQty,
        remark: manualRemark.trim(),
        sku: manualSku.trim(),
        source: "manual",
        tempId: createDraftLineId(),
        unitPrice: manualUnitPrice,
        variantTitle: manualVariantTitle.trim(),
      },
    ]);
    setManualProductTitle("");
    setManualSku("");
    setManualVariantTitle("");
    setManualImageUrl("");
    setManualQty("");
    setManualUnitPrice("");
    setManualFreightUnitCost("");
    setManualRemark("");
  }

  function updateLine(index: number, patch: Partial<CreatePoDraftLine>) {
    setLines((current) =>
      current.map((line, lineIndex) =>
        lineIndex === index ? { ...line, ...patch } : line,
      ),
    );
  }

  function removeLine(index: number) {
    setLines((current) => current.filter((_, lineIndex) => lineIndex !== index));
  }

  return (
    <form action={formAction} className="grid gap-4">
      <div className="grid gap-3 lg:grid-cols-4">
        <label className={labelClass}>
          PO ID
          <input className={inputClass} name="poId" readOnly value={suggestedPoId} />
        </label>
        <label className={labelClass}>
          PO Date
          <input className={inputClass} defaultValue={today} name="poDate" type="date" />
        </label>
        <label className={labelClass}>
          Supplier
          <select
            className={inputClass}
            name="supplierCode"
            onChange={(event) => {
              const nextSupplier = suppliers.find(
                (supplier) => supplier.supplierCode === event.target.value,
              );
              setSupplierCode(event.target.value);
              setCurrency(nextSupplier?.currency || "THB");
              setQuery("");
              setLines([]);
            }}
            required
            value={supplierCode}
          >
            <option value="">Select supplier</option>
            {suppliers.map((supplier) => (
              <option key={supplier.supplierCode} value={supplier.supplierCode}>
                {supplier.supplierName}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Owner
          <input className={inputClass} name="owner" placeholder="Jittavat" />
        </label>
      </div>

      <div className="grid gap-3 rounded-lg border border-[#dfe4ea] bg-[#fbfcfd] p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-[#172026]">Add Shopify Item</h3>
            <p className="text-xs text-[#667380]">
              Search local Shopify/read-model SKUs and add them to this draft PO.
            </p>
          </div>
          <span className="rounded-md bg-[#eef4f8] px-2 py-1 text-xs font-semibold text-[#255f85]">
            {selectedSupplier?.supplierName || "Select supplier first"}
          </span>
        </div>
        <div className={`${labelClass} relative`}>
          SKU / Product search
          <input
            className={inputClass}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            placeholder={
              supplierCode
                ? "Search SKU or product name"
                : "Select supplier first"
            }
            value={query}
          />
          {query.trim().length >= 2 && (filteredCatalogItems.length > 0 || catalogLoading) ? (
            <div className="absolute left-0 right-0 top-[64px] z-20 max-h-72 overflow-auto rounded-md border border-[#cfd6df] bg-white shadow-lg">
              {catalogLoading ? (
                <p className="px-3 py-2 text-sm font-medium normal-case tracking-normal text-[#667380]">
                  Searching...
                </p>
              ) : null}
              {filteredCatalogItems.map((item) => (
                <button
                  className="grid w-full grid-cols-[48px_1fr] gap-3 border-b border-[#edf1f5] px-3 py-2 text-left text-sm last:border-b-0 hover:bg-[#f3f5f7]"
                  key={`${item.sku}-${item.supplierName}`}
                  onClick={() => addCatalogItem(item)}
                  type="button"
                >
                  <span className="row-span-3 grid size-12 place-items-center overflow-hidden rounded-md border border-[#dfe4ea] bg-[#f6f7f9]">
                    {item.imageUrl ? (
                      <Image
                        alt={item.productTitle}
                        className="h-full w-full object-cover"
                        height={48}
                        src={item.imageUrl}
                        unoptimized
                        width={48}
                      />
                    ) : (
                      <span className="text-[10px] font-semibold text-[#8a96a3]">NO IMG</span>
                    )}
                  </span>
                  <span className="col-start-2 font-mono text-xs font-semibold text-[#172026]">
                    {item.sku}
                  </span>
                  <span className="col-start-2 truncate font-medium normal-case tracking-normal text-[#172026]">
                    {item.productTitle}
                  </span>
                  <span className="col-start-2 text-xs normal-case tracking-normal text-[#667380]">
                    Round 10 {item.recommendedQty || "-"} / {item.supplierName}
                    {item.lastPoId
                      ? ` · last ${item.lastPoId} @ ${item.lastUnitPrice}`
                      : ""}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 rounded-lg border border-[#dfe4ea] bg-white p-3">
        <div>
          <h3 className="text-sm font-semibold text-[#172026]">Add Manual Item</h3>
          <p className="text-xs text-[#667380]">
            Use this for supplier lines that are not in Shopify yet.
          </p>
        </div>
        <div className="grid gap-3 lg:grid-cols-[1fr_0.7fr_0.7fr_1fr_0.45fr_0.55fr_0.55fr]">
          <label className={labelClass}>
            Product name
            <input
              className={inputClass}
              onChange={(event) => setManualProductTitle(event.target.value)}
              placeholder="Required"
              value={manualProductTitle}
            />
          </label>
          <label className={labelClass}>
            SKU
            <input
              className={inputClass}
              onChange={(event) => setManualSku(event.target.value)}
              placeholder="Optional"
              value={manualSku}
            />
          </label>
          <label className={labelClass}>
            Variant
            <input
              className={inputClass}
              onChange={(event) => setManualVariantTitle(event.target.value)}
              placeholder="Size / color"
              value={manualVariantTitle}
            />
          </label>
          <label className={labelClass}>
            Image URL
            <input
              className={inputClass}
              onChange={(event) => setManualImageUrl(event.target.value)}
              placeholder="Optional"
              value={manualImageUrl}
            />
          </label>
          <label className={labelClass}>
            Qty
            <input
              className={inputClass}
              min="0.0001"
              onChange={(event) => setManualQty(event.target.value)}
              step="0.0001"
              type="number"
              value={manualQty}
            />
          </label>
          <label className={labelClass}>
            Unit cost
            <input
              className={inputClass}
              min="0"
              onChange={(event) => setManualUnitPrice(event.target.value)}
              step="0.0001"
              type="number"
              value={manualUnitPrice}
            />
          </label>
          <label className={labelClass}>
            Freight/unit
            <input
              className={inputClass}
              min="0"
              onChange={(event) => setManualFreightUnitCost(event.target.value)}
              step="0.0001"
              type="number"
              value={manualFreightUnitCost}
            />
          </label>
        </div>
        <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
          <label className={labelClass}>
            Note
            <input
              className={inputClass}
              onChange={(event) => setManualRemark(event.target.value)}
              placeholder="Optional line note"
              value={manualRemark}
            />
          </label>
          <button
            className="h-10 self-end rounded-md border border-[#255f85] bg-[#255f85] px-4 text-sm font-semibold text-white hover:bg-[#1f4f70] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!manualProductTitle.trim() || Number(manualQty) <= 0}
            onClick={addManualItem}
            type="button"
          >
            Add Manual Item
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-[#dfe4ea]">
        <table className="min-w-[980px] text-left text-sm">
          <thead className="bg-[#f3f5f7] text-xs uppercase tracking-[0.1em] text-[#65717f]">
            <tr>
              <th className="px-3 py-2 font-semibold">Item</th>
              <th className="px-3 py-2 font-semibold">SKU</th>
              <th className="px-3 py-2 font-semibold">Variant</th>
              <th className="px-3 py-2 text-right font-semibold">Qty</th>
              <th className="px-3 py-2 text-right font-semibold">Unit</th>
              <th className="px-3 py-2 text-right font-semibold">Freight</th>
              <th className="px-3 py-2 font-semibold">Note</th>
              <th className="px-3 py-2 font-semibold">Remove</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#edf1f5]">
            {lines.length ? (
              lines.map((line, index) => (
                <tr key={line.tempId}>
                  <td className="px-3 py-2">
                    <input name="lineSource" type="hidden" value={line.source} />
                    <input name="lineCurrency" type="hidden" value={line.currency || currency || "THB"} />
                    <input name="lineImageUrl" type="hidden" value={line.imageUrl} />
                    <div className="flex min-w-[260px] items-center gap-2">
                      <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-md border border-[#dfe4ea] bg-[#f6f7f9]">
                        {line.imageUrl ? (
                          <Image
                            alt={line.productTitle || line.sku || "PO item"}
                            className="h-full w-full object-cover"
                            height={40}
                            src={line.imageUrl}
                            unoptimized
                            width={40}
                          />
                        ) : (
                          <span className="text-[9px] font-semibold text-[#8a96a3]">IMG</span>
                        )}
                      </span>
                      <input
                        className={inputClass}
                        name="lineProductTitle"
                        onChange={(event) => updateLine(index, { productTitle: event.target.value })}
                        required
                        value={line.productTitle}
                      />
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className={inputClass}
                      name="lineSku"
                      onChange={(event) => updateLine(index, { sku: event.target.value })}
                      placeholder={line.source === "manual" ? "Optional" : "SKU"}
                      value={line.sku}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className={inputClass}
                      name="lineVariantTitle"
                      onChange={(event) => updateLine(index, { variantTitle: event.target.value })}
                      value={line.variantTitle}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className={`${inputClass} text-right font-mono`}
                      min="0.0001"
                      name="lineOrderedQty"
                      onChange={(event) => updateLine(index, { qty: event.target.value })}
                      required
                      step="0.0001"
                      type="number"
                      value={line.qty}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className={`${inputClass} text-right font-mono`}
                      min="0"
                      name="lineUnitPrice"
                      onChange={(event) => updateLine(index, { unitPrice: event.target.value })}
                      step="0.0001"
                      type="number"
                      value={line.unitPrice}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className={`${inputClass} text-right font-mono`}
                      min="0"
                      name="lineFreightUnitCost"
                      onChange={(event) => updateLine(index, { freightUnitCost: event.target.value })}
                      step="0.0001"
                      type="number"
                      value={line.freightUnitCost}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className={inputClass}
                      name="lineRemark"
                      onChange={(event) => updateLine(index, { remark: event.target.value })}
                      value={line.remark}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <button
                      className="rounded-md border border-[#cfd6df] bg-white px-3 py-1.5 text-xs font-semibold text-[#364252] hover:bg-[#f3f5f7]"
                      onClick={() => removeLine(index)}
                      type="button"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-3 py-5 text-center text-sm text-[#667380]" colSpan={8}>
                  Add at least one Shopify or manual item before creating the PO.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className={labelClass}>
          PO currency
          <input
            className={`${inputClass} w-32`}
            name="currency"
            onChange={(event) => setCurrency(event.target.value)}
            value={currency}
          />
        </label>
        <button className={buttonClass} disabled={pending} type="submit">
          <LoadingLabel loading={pending} loadingText="Creating...">
            Open Draft PO
          </LoadingLabel>
        </button>
      </div>
      <ActionMessage state={state} />
    </form>
  );
}

export function AddPoItemForm({ poId }: { poId: string }) {
  const [state, formAction, pending] = useActionState(addPoItemAction, initialState);

  return (
    <form action={formAction} className="mt-3 grid gap-2">
      <input name="poId" type="hidden" value={poId} />
      <div className="grid gap-2 md:grid-cols-[1fr_1fr_0.55fr_0.6fr_0.6fr_auto]">
        <input className={inputClass} name="sku" placeholder="SKU" required />
        <input className={inputClass} name="productTitle" placeholder="Product" />
        <input className={inputClass} min="0.0001" name="orderedQty" placeholder="Qty" required step="0.0001" type="number" />
        <input className={inputClass} min="0" name="unitPrice" placeholder="Price" step="0.0001" type="number" />
        <input className={inputClass} min="0" name="freightUnitCost" placeholder="Freight/unit" step="0.0001" type="number" />
        <button className={buttonClass} disabled={pending} type="submit">
          <LoadingLabel loading={pending} loadingText="Adding...">
            Add line
          </LoadingLabel>
        </button>
      </div>
      <ActionMessage state={state} />
    </form>
  );
}

export function PoHeaderRefsForm({
  actualReceivedDate,
  estimatedArrivedDate,
  estimatedDeliveryDate,
  headerPurpose,
  poId,
  quotationReference,
  supplierDiscussionNote,
  supplierInvoiceNo,
}: {
  actualReceivedDate: string;
  estimatedArrivedDate: string;
  estimatedDeliveryDate: string;
  headerPurpose: string;
  poId: string;
  quotationReference: string;
  supplierDiscussionNote: string;
  supplierInvoiceNo: string;
}) {
  const [state, formAction, pending] = useActionState(
    updatePoHeaderRefsAction,
    initialState,
  );
  return (
    <form action={formAction} className="grid gap-3">
      <input name="poId" type="hidden" value={poId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={`${labelClass} sm:col-span-2`}>
          PO Purpose / Header Tag
          <input
            className={inputClass}
            defaultValue={headerPurpose}
            name="headerPurpose"
            placeholder="e.g. Customs, Import Docs, Retail Stock"
          />
        </label>
        <label className={labelClass}>
          Quotation
          <input
            className={inputClass}
            defaultValue={quotationReference}
            name="quotationReference"
            placeholder="Supplier quotation no."
          />
        </label>
        <label className={labelClass}>
          Supplier INV
          <input
            className={inputClass}
            defaultValue={supplierInvoiceNo}
            name="supplierInvoiceNo"
            placeholder="Invoice no. if available"
          />
        </label>
        <label className={labelClass}>
          Estimated delivery
          <input
            className={inputClass}
            defaultValue={estimatedDeliveryDate}
            name="estimatedDeliveryDate"
            type="date"
          />
        </label>
        <label className={labelClass}>
          Estimated arrived
          <input
            className={inputClass}
            defaultValue={estimatedArrivedDate}
            name="estimatedArrivedDate"
            type="date"
          />
        </label>
        <label className={labelClass}>
          Date received
          <input
            className={inputClass}
            defaultValue={actualReceivedDate}
            name="actualReceivedDate"
            type="date"
          />
        </label>
      </div>
      {supplierDiscussionNote ? (
        <div className="rounded-md border border-[#dfe4ea] bg-[#fbfcfd] px-3 py-2 text-xs text-[#52606d]">
          <p className="font-semibold uppercase tracking-[0.08em] text-[#65717f]">
            Latest supplier update
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-[#172026]">
            {supplierDiscussionNote}
          </p>
        </div>
      ) : null}
      <label className={labelClass}>
        Supplier update / comment
        <textarea
          className={`${inputClass} min-h-24 py-2`}
          name="supplierDiscussionNote"
          placeholder="Type latest supplier conversation, promise date, delay reason, or follow-up note"
        />
      </label>
      <button className={buttonClass} disabled={pending} type="submit">
        <LoadingLabel loading={pending} loadingText="Saving...">
          Save header
        </LoadingLabel>
      </button>
      <ActionMessage state={state} />
    </form>
  );
}

export function QuickPoCommentForm({
  actualReceivedDate,
  estimatedArrivedDate,
  estimatedDeliveryDate,
  poId,
  quotationReference,
  supplierDiscussionNote,
  supplierInvoiceNo,
}: {
  actualReceivedDate: string;
  estimatedArrivedDate: string;
  estimatedDeliveryDate: string;
  poId: string;
  quotationReference: string;
  supplierDiscussionNote: string;
  supplierInvoiceNo: string;
}) {
  const [state, formAction, pending] = useActionState(
    updatePoHeaderRefsAction,
    initialState,
  );
  const [draftComment, setDraftComment] = useState("");
  const noteBoxRef = useRef<HTMLParagraphElement>(null);
  const displayNote = state.supplierDiscussionNote ?? supplierDiscussionNote;

  useEffect(() => {
    const noteBox = noteBoxRef.current;
    if (noteBox) {
      noteBox.scrollTop = noteBox.scrollHeight;
    }
  }, [displayNote]);

  return (
    <div className="grid min-w-[280px] gap-2">
      <p
        className="max-h-24 max-w-[360px] overflow-y-auto whitespace-pre-wrap rounded-md border border-[#e2e7ed] bg-[#fbfcfd] px-3 py-2 text-xs leading-5 text-[#52606d]"
        ref={noteBoxRef}
        title={displayNote}
      >
        {displayNote || "-"}
      </p>
      <form action={formAction} className="grid gap-2">
      <input name="poId" type="hidden" value={poId} />
      <input name="updateScope" type="hidden" value="quickComment" />
      <input name="quotationReference" type="hidden" value={quotationReference} />
      <input name="supplierInvoiceNo" type="hidden" value={supplierInvoiceNo} />
      <input name="estimatedDeliveryDate" type="hidden" value={estimatedDeliveryDate} />
      <input name="estimatedArrivedDate" type="hidden" value={estimatedArrivedDate} />
      <input name="actualReceivedDate" type="hidden" value={actualReceivedDate} />
      <div className="flex gap-2">
        <input
          className="h-9 min-w-0 flex-1 rounded-md border border-[#cfd6df] bg-white px-3 text-xs text-[#172026] outline-none focus:border-[#255f85]"
          name="supplierDiscussionNote"
          onChange={(event) => setDraftComment(event.target.value)}
          placeholder="Quick comment"
          value={draftComment}
        />
        <button
          className="inline-flex h-9 items-center justify-center rounded-md border border-[#cfd6df] bg-white px-3 text-xs font-semibold text-[#364252] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={pending}
          type="submit"
        >
          <LoadingLabel loading={pending} loadingText="Saving...">
            Save
          </LoadingLabel>
        </button>
      </div>
      <ActionMessage state={state} />
      </form>
    </div>
  );
}

export function SmartAddPoItemForm({
  currency,
  poId,
  supplierCode,
  supplierName,
}: {
  currency: string;
  poId: string;
  supplierCode: string;
  supplierName: string;
}) {
  const [state, formAction, pending] = useActionState(addPoItemsBatchAction, initialState);
  const [query, setQuery] = useState("");
  const [selectedSkus, setSelectedSkus] = useState<string[]>([]);
  const [qtyBySku, setQtyBySku] = useState<Record<string, string>>({});
  const [priceBySku, setPriceBySku] = useState<Record<string, string>>({});
  const [freightBySku, setFreightBySku] = useState<Record<string, string>>({});
  const { items: filteredCatalogItems, loading: catalogLoading } = useCatalogSearch({
    limit: 40,
    query,
    supplierCode,
    supplierName,
  });
  const mainNameGroups = useMemo(() => {
    if (query.trim().length < 2) {
      return [];
    }

    const groups = new Map<string, CatalogItemOption[]>();
    for (const item of filteredCatalogItems) {
      const key = item.mainName || item.productTitle;
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }
    return Array.from(groups.entries());
  }, [filteredCatalogItems, query]);

  function toggleItem(item: CatalogItemOption, checked: boolean) {
    setSelectedSkus((current) =>
      checked
        ? Array.from(new Set([...current, item.sku]))
        : current.filter((sku) => sku !== item.sku),
    );
    setQtyBySku((current) => ({
      ...current,
      [item.sku]: current[item.sku] ?? String(item.recommendedQty || ""),
    }));
    setPriceBySku((current) => ({
      ...current,
      [item.sku]: current[item.sku] ?? String(item.lastUnitPrice || ""),
    }));
    setFreightBySku((current) => ({
      ...current,
      [item.sku]: current[item.sku] ?? String(item.lastFreightUnitCost || ""),
    }));
  }

  function toggleGroup(items: CatalogItemOption[], checked: boolean) {
    items.forEach((item) => toggleItem(item, checked));
  }

  return (
    <form action={formAction} className="grid gap-3">
      <input name="poId" type="hidden" value={poId} />
      <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
        <div className={`${labelClass} relative`}>
          SKU / Product search
          <input
            className={inputClass}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            placeholder="Search SKU, product name, or main name"
            value={query}
          />
        </div>
        <button className={buttonClass} disabled={pending} type="submit">
          <LoadingLabel loading={pending} loadingText="Adding...">
            {`Add ${selectedSkus.length || ""} line${selectedSkus.length === 1 ? "" : "s"}`}
          </LoadingLabel>
        </button>
      </div>

      {query.trim().length > 0 && query.trim().length < 2 ? (
        <p className="rounded-md bg-[#fbfcfd] px-3 py-2 text-sm text-[#667380]">
          Type at least 2 characters to search SKU catalog.
        </p>
      ) : null}
      {catalogLoading ? (
        <p className="rounded-md bg-[#fbfcfd] px-3 py-2 text-sm text-[#667380]">
          Searching catalog...
        </p>
      ) : null}
      {mainNameGroups.length > 0 ? (
        <div className="max-h-[420px] overflow-auto rounded-lg border border-[#dfe4ea]">
          {mainNameGroups.map(([mainName, items]) => (
            <div className="border-b border-[#edf1f5] last:border-b-0" key={mainName}>
              <div className="flex items-center justify-between gap-3 bg-[#f7f9fb] px-3 py-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-[#172026]">
                  <input
                    checked={items.every((item) => selectedSkus.includes(item.sku))}
                    onChange={(event) => toggleGroup(items, event.target.checked)}
                    type="checkbox"
                  />
                  {mainName}
                </label>
                <span className="text-xs font-semibold text-[#667380]">{items.length} SKUs</span>
              </div>
              <div className="grid gap-2 p-3">
                {items.map((item) => {
                  const selected = selectedSkus.includes(item.sku);
                  return (
                    <div
                      className={`grid gap-2 rounded-md border p-2 md:grid-cols-[32px_44px_1fr_90px_90px_90px] ${
                        selected ? "border-[#255f85] bg-[#f3f8fb]" : "border-[#edf1f5] bg-white"
                      }`}
                      key={item.sku}
                    >
                      <input
                        checked={selected}
                        name="selectedSku"
                        onChange={(event) => toggleItem(item, event.target.checked)}
                        type="checkbox"
                        value={item.sku}
                      />
                      <span className="grid size-11 place-items-center overflow-hidden rounded-md border border-[#dfe4ea] bg-[#f6f7f9]">
                        {item.imageUrl ? (
                          <Image
                            alt={item.productTitle}
                            className="h-full w-full object-cover"
                            height={44}
                            src={item.imageUrl}
                            width={44}
                          />
                        ) : (
                          <span className="text-[9px] font-semibold text-[#8a96a3]">IMG</span>
                        )}
                      </span>
                      <div className="min-w-0">
                        <input name="sku" type="hidden" value={item.sku} />
                        <input name="productTitle" type="hidden" value={item.productTitle} />
                        <input name="variantTitle" type="hidden" value={item.variantTitle} />
                        <input name="currency" type="hidden" value={item.currency || currency || "THB"} />
                        <p className="truncate font-medium">{item.productTitle}</p>
                        <p className="font-mono text-xs text-[#667380]">{item.sku}</p>
                      </div>
                      <input
                        className={inputClass}
                        min="0"
                        name="orderedQty"
                        onChange={(event) => setQtyBySku({ ...qtyBySku, [item.sku]: event.target.value })}
                        placeholder="Qty"
                        step="0.0001"
                        type="number"
                        value={qtyBySku[item.sku] ?? String(item.recommendedQty || "")}
                      />
                      <input
                        className={inputClass}
                        min="0"
                        name="unitPrice"
                        onChange={(event) => setPriceBySku({ ...priceBySku, [item.sku]: event.target.value })}
                        placeholder="Price"
                        step="0.0001"
                        type="number"
                        value={priceBySku[item.sku] ?? String(item.lastUnitPrice || "")}
                      />
                      <input
                        className={inputClass}
                        min="0"
                        name="freightUnitCost"
                        onChange={(event) => setFreightBySku({ ...freightBySku, [item.sku]: event.target.value })}
                        placeholder="Freight"
                        step="0.0001"
                        type="number"
                        value={freightBySku[item.sku] ?? String(item.lastFreightUnitCost || "")}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : null}
      <label className={labelClass}>
        Remark
        <input className={inputClass} name="remark" placeholder="Line note" />
      </label>
      <ActionMessage state={state} />
    </form>
  );
}

export function PoDraftLinesForm({
  items,
  poId,
  poReference,
  supplierCode,
  supplierName,
}: {
  items: DraftLineItem[];
  poId: string;
  poReference: string;
  supplierCode: string;
  supplierName: string;
}) {
  const [state, formAction, pending] = useActionState(
    updatePoDraftLinesAction,
    initialState,
  );
  const [repriceState, setRepriceState] = useState<PoActionState>(initialState);
  const [repricePending, startRepriceTransition] = useTransition();
  const [lines, setLines] = useState(items);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [adjustPercent, setAdjustPercent] = useState("");
  const [logisticCost, setLogisticCost] = useState("");
  const [vatMode, setVatMode] = useState<"none" | "include" | "exclude">("none");
  const [exchangeRates, setExchangeRates] = useState(["", "", ""]);
  const [exchangeMode, setExchangeMode] = useState<"none" | "thai" | "foreign">("none");
  const [xeroCsvError, setXeroCsvError] = useState("");
  const [xeroCsvMessage, setXeroCsvMessage] = useState("");
  const [xeroCsvPreparing, setXeroCsvPreparing] = useState(false);
  const [shopifyCsvError, setShopifyCsvError] = useState("");
  const [shopifyCsvMessage, setShopifyCsvMessage] = useState("");
  const [shopifyCsvPreparing, setShopifyCsvPreparing] = useState(false);
  const [matrixSearchQuery, setMatrixSearchQuery] = useState("");
  const [matrixAddQtyBySku, setMatrixAddQtyBySku] = useState<Record<string, string>>({});
  const [matrixAddMessage, setMatrixAddMessage] = useState("");
  const [matrixAddTarget, setMatrixAddTarget] = useState<{
    productName: string;
    size: string;
  } | null>(null);
  const matrixAddRef = useRef<HTMLDivElement>(null);
  const { items: matrixCatalogItems, loading: matrixCatalogLoading } = useCatalogSearch({
    limit: 50,
    query: matrixSearchQuery,
    supplierCode: matrixAddTarget ? undefined : supplierCode,
    supplierName: matrixAddTarget ? undefined : supplierName,
  });
  const initialQtyByLine = useMemo(
    () =>
      new Map(
        items.map((item) => [draftLineKey(item), item.qty]),
    ),
    [items],
  );
  const [baseUnitPriceByLine, setBaseUnitPriceByLine] = useState<Record<string, number>>(
    () =>
      Object.fromEntries(
        items.map((item) => [draftLineKey(item), item.unitPrice]),
      ),
  );
  const totalOrderedQty = lines.reduce((sum, line) => sum + line.qty, 0);
  const logisticUnitCost = freightUnitFromTotal(logisticCost, lines);
  const exchangeRateAverage = averageExchangeRate(exchangeRates);
  const baseMatrixGroups = useMemo(() => editableQuoteMatrixRows(lines), [lines]);
  const matrixProductNames = useMemo(
    () =>
      baseMatrixGroups.flatMap((group) =>
        group.rows.map((row) => row.productName),
      ),
    [baseMatrixGroups],
  );
  const {
    items: matrixProductCatalogItems,
    loading: matrixProductCatalogLoading,
  } = useMatrixCatalogProducts(matrixProductNames);
  const matrixGroups = useMemo(
    () => editableQuoteMatrixRows(lines, matrixProductCatalogItems),
    [lines, matrixProductCatalogItems],
  );
  const visibleMatrixCatalogItems = useMemo(() => {
    if (!matrixAddTarget) {
      return matrixCatalogItems;
    }
    return uniqueCatalogItems([
      ...matrixProductCatalogItems,
      ...matrixCatalogItems,
    ]).filter(
      (item) =>
        matrixItemSize(item) === matrixAddTarget.size &&
        matrixProductMatchKey(matrixCatalogProductName(item)) ===
          matrixProductMatchKey(matrixAddTarget.productName),
    );
  }, [matrixAddTarget, matrixCatalogItems, matrixProductCatalogItems]);
  const matrixTargetLoading =
    matrixCatalogLoading || (matrixAddTarget ? matrixProductCatalogLoading : false);
  const existingSkus = useMemo(
    () => new Set(lines.map((line) => line.sku.trim()).filter(Boolean)),
    [lines],
  );

  function repriceDraftLines() {
    if (!window.confirm("This will replace current draft unit prices with latest closed PO purchase costs. Lines without purchase history will be set to 0.")) {
      return;
    }
    startRepriceTransition(async () => {
      const formData = new FormData();
      formData.set("poId", poId);
      const result = await repricePoDraftLinesAction(initialState, formData);
      setRepriceState(result);
      if (!result.ok || !result.repricedLines?.length) {
        return;
      }
      const repricedById = new Map(
        result.repricedLines.map((line) => [line.itemUuid, line]),
      );
      setLines((current) =>
        current.map((line) => {
          const repriced = line.itemUuid ? repricedById.get(line.itemUuid) : undefined;
          return repriced ? { ...line, ...repriced } : line;
        }),
      );
      setBaseUnitPriceByLine((current) => {
        const next = { ...current };
        for (const line of items) {
          const repriced = line.itemUuid ? repricedById.get(line.itemUuid) : undefined;
          if (repriced) next[draftLineKey(line)] = repriced.unitPrice;
        }
        return next;
      });
      setVatMode("none");
      setExchangeMode("none");
    });
  }

  function updateLine(index: number, patch: Partial<DraftLineItem>) {
    setLines((current) =>
      applyLogisticCostToLines(
        current.map((line, lineIndex) =>
          lineIndex === index ? { ...line, ...patch } : line,
        ),
        logisticCost,
      ),
    );
  }

  function updateMatrixQty(lineIndexes: number[], value: number) {
    const desiredQty = Number.isFinite(value) ? Math.max(0, value) : 0;
    setLines((current) => {
      if (lineIndexes.length === 0) {
        return current;
      }
      const next = current.map((line) => ({ ...line }));
      const currentQty = lineIndexes.reduce(
        (sum, lineIndex) => sum + (next[lineIndex]?.qty ?? 0),
        0,
      );
      const delta = desiredQty - currentQty;

      if (delta >= 0) {
        const lineIndex = lineIndexes[0];
        if (next[lineIndex]) {
          next[lineIndex].qty += delta;
        }
      } else {
        let qtyToRemove = Math.abs(delta);
        for (const lineIndex of [...lineIndexes].reverse()) {
          const line = next[lineIndex];
          if (!line || qtyToRemove <= 0) {
            continue;
          }
          const removableQty = Math.min(line.qty, qtyToRemove);
          line.qty -= removableQty;
          qtyToRemove -= removableQty;
        }
      }

      return applyLogisticCostToLines(next, logisticCost);
    });
  }

  function addCatalogLineFromMatrix(item: CatalogItemOption) {
    if (existingSkus.has(item.sku)) {
      setMatrixAddMessage(`${item.sku} is already in this draft. Edit its quantity in the matrix.`);
      return;
    }
    const requestedQty = Number(
      matrixAddQtyBySku[item.sku] ?? item.recommendedQty ?? 0,
    );
    if (!Number.isFinite(requestedQty) || requestedQty <= 0) {
      setMatrixAddMessage(`Enter a quantity greater than 0 for ${item.sku}.`);
      return;
    }

    const tempId = `matrix-${createDraftLineId()}`;
    const newLine: DraftLineItem = {
      currency: item.currency || "THB",
      freightUnitCost: item.lastFreightUnitCost,
      fullName: item.productTitle,
      imageUrl: item.imageUrl,
      landedUnitCost: item.lastUnitPrice + item.lastFreightUnitCost,
      lineAmount: requestedQty * item.lastUnitPrice,
      lineNo: String(lines.length + 1),
      onHand: item.onHand,
      productTitle: item.productTitle,
      qty: requestedQty,
      remark: "Added from Supplier Quote Matrix",
      sku: item.sku,
      tags: item.tags,
      tempId,
      unitPrice: item.lastUnitPrice,
      unitPriceSource: item.lastPoId ? "latest_closed_po" : "no_purchase_history",
      unitPriceSourcePoReference: item.lastPoId,
      variantTitle: item.variantTitle,
    };

    setLines((current) =>
      applyLogisticCostToLines(
        [...current, { ...newLine, lineNo: String(current.length + 1) }],
        logisticCost,
      ),
    );
    setBaseUnitPriceByLine((current) => ({
      ...current,
      [tempId]: item.lastUnitPrice,
    }));
    setMatrixAddMessage(
      `Added ${item.sku} to the draft. Save Draft Details to confirm the new line.`,
    );
  }

  function openMatrixCellAdd(productName: string, size: string) {
    setMatrixAddTarget({ productName, size });
    setMatrixSearchQuery(matrixCatalogSearchQuery(productName));
    setMatrixAddMessage(`Choose quantity for ${productName} / ${size}.`);
    window.setTimeout(() => {
      matrixAddRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 0);
  }

  function updateUnitPrice(index: number, value: number) {
    const line = lines[index];
    if (!line) {
      return;
    }
    setVatMode("none");
    setExchangeMode("none");
    setBaseUnitPriceByLine((current) => ({
      ...current,
      [draftLineKey(line)]: value,
    }));
    updateLine(index, { unitPrice: value, unitPriceSource: "manual" });
  }

  function updateFreightUnitCost(index: number, value: number) {
    setLogisticCost("");
    setLines((current) =>
      current.map((line, lineIndex) =>
        lineIndex === index ? { ...line, freightUnitCost: value } : line,
      ),
    );
  }

  function moveLine(index: number, direction: -1 | 1) {
    setLines((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) {
        return current;
      }
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function removeLine(index: number) {
    const line = lines[index];
    if (line?.itemUuid) {
      setDeletedIds((current) => Array.from(new Set([...current, line.itemUuid!])));
    }
    setLines((current) =>
      applyLogisticCostToLines(
        current.filter((_, lineIndex) => lineIndex !== index),
        logisticCost,
      ),
    );
  }

  function initialQtyForLine(line: DraftLineItem) {
    return initialQtyByLine.get(draftLineKey(line)) ?? line.qty;
  }

  function baseUnitPriceForLine(line: DraftLineItem) {
    return baseUnitPriceByLine[draftLineKey(line)] ?? line.unitPrice;
  }

  function adjustAllQty() {
    const percent = Number(adjustPercent);
    if (!Number.isFinite(percent)) {
      return;
    }
    const factor = 1 + percent / 100;
    setLines((current) =>
      applyLogisticCostToLines(
        current.map((line) => {
          const baseQty = initialQtyForLine(line);
          return {
            ...line,
            qty: roundQtyUpToTen(baseQty * factor),
          };
        }),
        logisticCost,
      ),
    );
  }

  function resetAdjustedQty() {
    setLines((current) =>
      applyLogisticCostToLines(
        current.map((line) => ({
          ...line,
          qty: initialQtyForLine(line),
        })),
        logisticCost,
      ),
    );
    setAdjustPercent("");
  }

  function applyVat(mode: "include" | "exclude") {
    const factor = mode === "exclude" ? 1.07 : 1 / 1.07;
    setVatMode(mode);
    setLines((current) =>
      current.map((line) => ({
        ...line,
        unitPrice: Number((baseUnitPriceForLine(line) * factor).toFixed(4)),
      })),
    );
  }

  function resetVat() {
    setVatMode("none");
    setLines((current) =>
      current.map((line) => ({
        ...line,
        unitPrice: baseUnitPriceForLine(line),
      })),
    );
  }

  function updateLogisticCost(value: string) {
    setLogisticCost(value);
    setLines((current) => applyLogisticCostToLines(current, value));
  }

  function updateExchangeRate(index: number, value: string) {
    setExchangeRates((current) =>
      current.map((currentValue, currentIndex) =>
        currentIndex === index ? value : currentValue,
      ),
    );
  }

  function applyExchangeAverage() {
    const averageRate = averageExchangeRate(exchangeRates);
    if (averageRate === null) {
      return;
    }

    setExchangeMode(averageRate === 1 ? "thai" : "foreign");
    setLines((current) =>
      current.map((line) => ({
        ...line,
        unitPrice: Number((baseUnitPriceForLine(line) * averageRate).toFixed(4)),
      })),
    );
  }

  function applyThaiSupplierRate() {
    setExchangeRates(["1", "0", "0"]);
    setExchangeMode("thai");
    setLines((current) =>
      current.map((line) => ({
        ...line,
        unitPrice: baseUnitPriceForLine(line),
      })),
    );
  }

  function onDragStart(event: DragEvent<HTMLTableRowElement>, index: number) {
    event.dataTransfer.setData("text/plain", String(index));
  }

  function onDrop(event: DragEvent<HTMLTableRowElement>, index: number) {
    event.preventDefault();
    const from = Number(event.dataTransfer.getData("text/plain"));
    if (!Number.isInteger(from) || from === index) {
      return;
    }
    setLines((current) => {
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(index, 0, moved);
      return next;
    });
  }

  async function handleDownloadXeroCsv() {
    setXeroCsvPreparing(true);
    setXeroCsvError("");
    setXeroCsvMessage("");

    try {
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve());
      });
      downloadXeroBillCsv({
        lines,
        poReference,
        supplierName,
      });
      setXeroCsvMessage("Xero CSV downloaded.");
    } catch (error) {
      setXeroCsvError(error instanceof Error ? error.message : "Unable to generate Xero CSV.");
    } finally {
      setXeroCsvPreparing(false);
    }
  }

  async function handleDownloadShopifyCsv() {
    setShopifyCsvPreparing(true);
    setShopifyCsvError("");
    setShopifyCsvMessage("");

    try {
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve());
      });
      downloadShopifyPurchaseOrderCsv({
        lines,
        poReference,
      });
      setShopifyCsvMessage("Shopify CSV downloaded.");
    } catch (error) {
      setShopifyCsvError(error instanceof Error ? error.message : "Unable to generate Shopify CSV.");
    } finally {
      setShopifyCsvPreparing(false);
    }
  }

  return (
    <form action={formAction} className="grid gap-5">
      <input name="poId" type="hidden" value={poId} />
      {deletedIds.map((id) => (
        <input key={id} name="deleteItemUuid" type="hidden" value={id} />
      ))}
      <section
        className="min-w-0 rounded-lg border border-[#dfe4ea] bg-white shadow-sm"
        id="draft-lines"
      >
      <div className="border-b border-[#e2e7ed] p-5">
        <h2 className="text-lg font-semibold">Draft Line Details</h2>
        <p className="mt-1 text-sm text-[#667380]">
          Edit SKU, product name, order qty, unit price, freight/unit, and remarks.
          Quantity changes here and in the Supplier Quote Matrix stay synchronized.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3 border-b border-[#e2e7ed] p-4">
        <label className={labelClass}>
          Adjust Qty %
          <input
            className="h-10 w-32 rounded-md border border-[#cfd6df] bg-white px-3 text-right font-mono text-sm"
            onChange={(event) => setAdjustPercent(event.target.value)}
            placeholder="-10 / 15"
            step="0.01"
            type="number"
            value={adjustPercent}
          />
        </label>
        <button className="h-10 rounded-md border border-[#cfd6df] bg-white px-3 text-xs font-semibold" onClick={adjustAllQty} type="button">
          Apply Qty %
        </button>
        <button className="h-10 rounded-md border border-[#cfd6df] bg-white px-3 text-xs font-semibold" onClick={resetAdjustedQty} type="button">
          Reset Qty
        </button>
        <button className="h-10 rounded-md border border-[#cfd6df] bg-white px-3 text-xs font-semibold" onClick={() => applyVat("include")} type="button">
          Include VAT / net
        </button>
        <button className="h-10 rounded-md border border-[#cfd6df] bg-white px-3 text-xs font-semibold" onClick={() => applyVat("exclude")} type="button">
          Exclude VAT +7%
        </button>
        <button className="h-10 rounded-md border border-[#cfd6df] bg-white px-3 text-xs font-semibold" onClick={resetVat} type="button">
          Reset VAT
        </button>
        <div className="grid max-w-sm gap-1">
          <button
            className="h-10 rounded-md border border-[#9a5b13] bg-[#fff8e8] px-4 text-xs font-semibold text-[#7a450b] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={pending || repricePending}
            onClick={repriceDraftLines}
            type="button"
          >
            {repricePending ? "Repricing..." : "Refresh unit cost from latest PO"}
          </button>
          <p className="text-xs normal-case tracking-normal text-[#667380]">
            Manual action only. Existing prices are unchanged until confirmed.
          </p>
          <ActionMessage state={repriceState} />
        </div>
        <label className={labelClass}>
          Logistic cost total
          <input
            className="h-10 w-40 rounded-md border border-[#cfd6df] bg-white px-3 text-right font-mono text-sm"
            min="0"
            onChange={(event) => updateLogisticCost(event.target.value)}
            placeholder="manual total"
            step="0.0001"
            type="number"
            value={logisticCost}
          />
        </label>
        <div className="pb-1 text-xs font-medium text-[#667380]">
          <p>Total qty {formatMoney(totalOrderedQty)}</p>
          <p>
            Freight/unit{" "}
            {logisticUnitCost === null ? "-" : logisticUnitCost.toFixed(4)}
          </p>
        </div>
        <div className="grid gap-2 rounded-md border border-[#dfe4ea] bg-[#fbfcfd] p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#65717f]">
            Exchange rate average
          </p>
          <div className="flex flex-wrap items-end gap-2">
            {exchangeRates.map((value, index) => (
              <label className={labelClass} key={`exchange-${index + 1}`}>
                Rate {index + 1}
                <input
                  className="h-10 w-28 rounded-md border border-[#cfd6df] bg-white px-3 text-right font-mono text-sm"
                  min="0"
                  onChange={(event) => updateExchangeRate(index, event.target.value)}
                  placeholder={index === 0 ? "35.5" : "0"}
                  step="0.000001"
                  type="number"
                  value={value}
                />
              </label>
            ))}
            <button
              className="h-10 rounded-md border border-[#cfd6df] bg-white px-3 text-xs font-semibold"
              onClick={applyExchangeAverage}
              type="button"
            >
              Apply avg FX
            </button>
            <button
              className="h-10 rounded-md border border-[#cfd6df] bg-white px-3 text-xs font-semibold"
              onClick={applyThaiSupplierRate}
              type="button"
            >
              Sup Thai
            </button>
          </div>
          <p className="text-xs text-[#667380]">
            Avg {exchangeRateAverage === null ? "-" : exchangeRateAverage.toFixed(6)}; 0 or blank is ignored.
          </p>
        </div>
        {vatMode !== "none" ? (
          <span className="mb-1 rounded-md bg-[#eef4f8] px-2 py-1 text-xs font-semibold text-[#255f85]">
            VAT mode: {vatMode === "exclude" ? "+7%" : "net /1.07"}
          </span>
        ) : null}
        {exchangeMode !== "none" ? (
          <span className="mb-1 rounded-md bg-[#eaf6ef] px-2 py-1 text-xs font-semibold text-[#1f6b3d]">
            FX mode: {exchangeMode === "thai" ? "Thai supplier" : "average applied"}
          </span>
        ) : null}
        <div className="grid max-w-sm gap-1">
          <button
            className="h-10 rounded-md border border-[#2563eb] bg-[#2563eb] px-4 text-xs font-semibold text-white shadow-sm transition hover:border-[#1d4ed8] hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={xeroCsvPreparing}
            onClick={handleDownloadXeroCsv}
            type="button"
          >
            {xeroCsvPreparing ? "Preparing CSV..." : "Download Xero CSV"}
          </button>
          <p className="text-xs normal-case tracking-normal text-[#667380]">
            This downloads a CSV for manual Xero import. It does not upload directly to Xero.
          </p>
          <p className="text-xs normal-case tracking-normal text-[#667380]">
            CSV includes the current line values shown on this screen.
          </p>
          {xeroCsvMessage ? (
            <p className="text-xs font-semibold normal-case tracking-normal text-[#1f6b3d]">
              {xeroCsvMessage}
            </p>
          ) : null}
          {xeroCsvError ? (
            <p className="text-xs font-semibold normal-case tracking-normal text-[#b42318]">
              {xeroCsvError}
            </p>
          ) : null}
        </div>
        <div className="grid max-w-sm gap-1">
          <button
            className="h-10 rounded-md border border-[#1f6b3d] bg-[#1f6b3d] px-4 text-xs font-semibold text-white shadow-sm transition hover:border-[#18562f] hover:bg-[#18562f] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={shopifyCsvPreparing}
            onClick={handleDownloadShopifyCsv}
            type="button"
          >
            {shopifyCsvPreparing ? "Preparing Shopify CSV..." : "Download Shopify CSV"}
          </button>
          <p className="text-xs normal-case tracking-normal text-[#667380]">
            Downloads SKU and quantity only. Barcode and Supplier SKU are blank. Cost and tax are exported as 0 for staff-safe Shopify import.
          </p>
          {shopifyCsvMessage ? (
            <p className="text-xs font-semibold normal-case tracking-normal text-[#1f6b3d]">
              {shopifyCsvMessage}
            </p>
          ) : null}
          {shopifyCsvError ? (
            <p className="text-xs font-semibold normal-case tracking-normal text-[#b42318]">
              {shopifyCsvError}
            </p>
          ) : null}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[1480px] text-left text-sm">
          <thead className="bg-[#f3f5f7] text-xs uppercase tracking-[0.12em] text-[#65717f]">
            <tr>
              <th className="px-4 py-3 font-semibold">Move</th>
              <th className="px-4 py-3 font-semibold">Line</th>
              <th className="px-4 py-3 font-semibold">Img</th>
              <th className="px-4 py-3 font-semibold">SKU</th>
              <th className="px-4 py-3 font-semibold">Product</th>
              <th className="px-4 py-3 text-right font-semibold">Qty</th>
              <th className="px-4 py-3 text-right font-semibold">Unit</th>
              <th className="px-4 py-3 text-right font-semibold">Freight/unit</th>
              <th className="px-4 py-3 text-right font-semibold">Landed/unit</th>
              <th className="px-4 py-3 text-right font-semibold">Line amount</th>
              <th className="px-4 py-3 font-semibold">Remark</th>
              <th className="px-4 py-3 font-semibold">Delete</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#edf1f5]">
            {lines.map((item, index) => {
              const lineAmountCurrency = exchangeMode !== "none" ? "THB" : item.currency;
              return (
              <tr
                draggable
                key={item.itemUuid ?? item.tempId ?? `${poId}-${item.lineNo}`}
                onDragOver={(event) => event.preventDefault()}
                onDragStart={(event) => onDragStart(event, index)}
                onDrop={(event) => onDrop(event, index)}
              >
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button className="h-8 rounded-md border px-2 text-xs" onClick={() => moveLine(index, -1)} type="button">↑</button>
                    <button className="h-8 rounded-md border px-2 text-xs" onClick={() => moveLine(index, 1)} type="button">↓</button>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-xs">{index + 1}</td>
                <td className="px-4 py-3">
                  <span className="grid size-12 place-items-center overflow-hidden rounded-md border border-[#dfe4ea] bg-[#f6f7f9]">
                    {item.imageUrl ? (
                      <Image
                        alt={item.productTitle || item.sku}
                        className="h-full w-full object-cover"
                        height={48}
                        src={item.imageUrl}
                        unoptimized
                        width={48}
                      />
                    ) : (
                      <span className="text-[9px] font-semibold text-[#8a96a3]">IMG</span>
                    )}
                  </span>
                </td>
                <td className="min-w-[170px] px-4 py-3">
                  <input name="itemUuid" type="hidden" value={item.itemUuid ?? ""} />
                  <input name="currency" type="hidden" value={lineAmountCurrency} />
                  <input name="variantTitle" type="hidden" value={item.variantTitle ?? ""} />
                  <input
                    className={inputClass}
                    name="sku"
                    onChange={(event) => updateLine(index, { sku: event.target.value })}
                    required
                    value={item.sku}
                  />
                </td>
                <td className="min-w-[280px] px-4 py-3">
                  <input
                    className={inputClass}
                    name="productTitle"
                    onChange={(event) => updateLine(index, { productTitle: event.target.value })}
                    value={item.productTitle}
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    className={`${inputClass} text-right font-mono`}
                    min="0"
                    name="orderedQty"
                    onChange={(event) => updateLine(index, { qty: Number(event.target.value) || 0 })}
                    step="0.0001"
                    type="number"
                    value={item.qty}
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    className={`${inputClass} text-right font-mono`}
                    min="0"
                    name="unitPrice"
                    onChange={(event) => updateUnitPrice(index, Number(event.target.value) || 0)}
                    step="0.0001"
                    type="number"
                    value={item.unitPrice}
                  />
                  <p className="mt-1 text-[11px] text-[#667380]">
                    {item.unitPriceSource === "latest_closed_po"
                      ? `Latest closed PO${item.unitPriceSourcePoReference ? ` · ${item.unitPriceSourcePoReference}` : ""}${item.unitPriceSourceDate ? ` · ${item.unitPriceSourceDate}` : ""}`
                      : item.unitPriceSource === "no_purchase_history"
                        ? "No purchase history"
                        : "Manual"}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <input
                    className={`${inputClass} text-right font-mono`}
                    min="0"
                    name="freightUnitCost"
                    onChange={(event) => updateFreightUnitCost(index, Number(event.target.value) || 0)}
                    step="0.0001"
                    type="number"
                    value={item.freightUnitCost ?? 0}
                  />
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {(item.unitPrice + (item.freightUnitCost ?? 0)).toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {formatMoney(item.qty * item.unitPrice)} {lineAmountCurrency}
                </td>
                <td className="min-w-[220px] px-4 py-3">
                  <input
                    className={inputClass}
                    name="remark"
                    onChange={(event) => updateLine(index, { remark: event.target.value })}
                    value={item.remark}
                  />
                </td>
                <td className="px-4 py-3">
                  <button
                    className="h-9 rounded-md border border-[#efcaca] bg-[#fff7f7] px-3 text-xs font-semibold text-[#9f2a2a]"
                    onClick={() => removeLine(index)}
                    type="button"
                  >
                    Remove
                  </button>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-3 border-t border-[#e2e7ed] p-5 sm:flex-row sm:items-center sm:justify-between">
        <ActionMessage state={state} />
        <button className={buttonClass} disabled={pending} type="submit">
          <LoadingLabel loading={pending} loadingText="Saving...">
            Save Draft Details
          </LoadingLabel>
        </button>
      </div>
      </section>

      <section className="min-w-0 rounded-lg border border-[#dfe4ea] bg-white shadow-sm">
        <div className="border-b border-[#e2e7ed] p-5">
          <h2 className="text-lg font-semibold">Supplier Quote Matrix</h2>
          <p className="mt-1 text-sm text-[#667380]">
            Edit order quantities directly in the matrix. On-hand is read-only;
            every quantity uses the same draft-line state shown above.
          </p>
        </div>

        <div className="grid gap-5 p-5">
          {matrixGroups.map((group) => (
            <div className="overflow-x-auto rounded-lg border border-[#e2e7ed]" key={group.label}>
              <div className="border-b border-[#e2e7ed] bg-[#fbfcfd] px-4 py-3">
                <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-[#364252]">
                  {group.label}
                </h3>
              </div>
              <table className="min-w-full border-collapse text-left text-sm">
                <thead className="bg-[#f3f5f7] text-xs uppercase tracking-[0.12em] text-[#65717f]">
                  <tr>
                    <th className="border-b border-[#dfe4ea] px-4 py-3 font-semibold">Product</th>
                    {group.sizes.map((size) => (
                      <th
                        className="border-b border-l border-[#dfe4ea] px-3 py-3 text-right font-semibold"
                        key={size}
                      >
                        {size}
                      </th>
                    ))}
                    <th className="border-b border-l border-[#dfe4ea] px-3 py-3 text-right font-semibold">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((row) => (
                    <tr className="border-b border-[#edf1f5]" key={row.productName}>
                      <td className="min-w-[320px] px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-md border border-[#dfe4ea] bg-[#f6f7f9]">
                            {row.imageUrl ? (
                              <Image
                                alt={row.productName}
                                className="h-full w-full object-cover"
                                height={64}
                                loading="lazy"
                                src={row.imageUrl}
                                unoptimized
                                width={64}
                              />
                            ) : (
                              <span className="text-[10px] font-semibold text-[#8a96a3]">NO IMG</span>
                            )}
                          </span>
                          <div>
                            <p className="font-semibold">{row.productName}</p>
                            <p className="mt-1 text-xs font-semibold italic text-[#172026]">
                              order qty / on-hand
                            </p>
                          </div>
                        </div>
                      </td>
                      {group.sizes.map((size) => {
                        const cell = row.items.get(size);
                        const canAdd = row.availableSizes.has(size);
                        return (
                          <td
                            className={`min-w-24 border-l border-[#dfe4ea] px-2 py-2 text-right ${
                              !cell && !canAdd ? "bg-[#f3f5f7] text-[#9aa4af]" : ""
                            }`}
                            key={size}
                            style={
                              cell || canAdd
                                ? editableQtyHeatStyle(cell?.orderedQty ?? 0, group.maxQty)
                                : undefined
                            }
                          >
                            {cell ? (
                              <>
                                <input
                                  aria-label={`${row.productName} ${size} order quantity`}
                                  className="h-9 w-20 rounded-md border border-black/20 bg-white/90 px-2 text-right font-mono text-sm font-semibold text-[#172026] outline-none focus:border-[#255f85]"
                                  min="0"
                                  onChange={(event) =>
                                    updateMatrixQty(
                                      cell.lineIndexes,
                                      Number(event.target.value) || 0,
                                    )
                                  }
                                  step="0.0001"
                                  type="number"
                                  value={cell.orderedQty}
                                />
                                <p className="mt-1 font-mono text-sm font-semibold italic">
                                  {formatQty(cell.onHand)}
                                </p>
                              </>
                            ) : canAdd ? (
                              <button
                                className="h-9 rounded-md border border-white/30 px-2 text-xs font-semibold text-white transition hover:bg-white/10"
                                onClick={() => openMatrixCellAdd(row.productName, size)}
                                type="button"
                              >
                                + Add
                              </button>
                            ) : (
                              <span aria-label={`${row.productName} ${size} is not available`}>—</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="border-l border-[#dfe4ea] px-3 py-3 text-right font-mono font-semibold">
                        {formatQty(row.totalQty)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          <div
            className="rounded-lg border border-[#dfe4ea] bg-[#fbfcfd] p-4"
            ref={matrixAddRef}
          >
            <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
              <label className={`${labelClass} flex-1`}>
                Add SKU below Supplier Quote
                <input
                  className={inputClass}
                  onChange={(event) => {
                    setMatrixAddTarget(null);
                    setMatrixSearchQuery(event.target.value);
                    setMatrixAddMessage("");
                  }}
                  placeholder="Search SKU or product name"
                  value={matrixSearchQuery}
                />
              </label>
              <p className="text-xs text-[#667380]">
                Choose qty, review on-hand, then press the black Add button.
              </p>
            </div>

            {matrixAddTarget ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-[#172026] px-3 py-2 text-xs font-semibold text-white">
                  Adding {matrixAddTarget.productName} / {matrixAddTarget.size}
                </span>
                <button
                  className="rounded-md border border-[#cfd6df] bg-white px-3 py-2 text-xs font-semibold"
                  onClick={() => {
                    setMatrixAddTarget(null);
                    setMatrixAddMessage("");
                  }}
                  type="button"
                >
                  Show all search results
                </button>
              </div>
            ) : null}
            {matrixSearchQuery.trim().length > 0 && matrixSearchQuery.trim().length < 2 ? (
              <p className="mt-3 text-sm text-[#667380]">Type at least 2 characters to search.</p>
            ) : null}
            {matrixTargetLoading ? (
              <p className="mt-3 text-sm text-[#667380]">Searching catalog...</p>
            ) : null}
            {visibleMatrixCatalogItems.length > 0 ? (
              <div className="mt-3 grid max-h-[420px] gap-2 overflow-auto">
                {visibleMatrixCatalogItems.map((item) => {
                  const alreadyAdded = existingSkus.has(item.sku);
                  return (
                    <div
                      className="grid gap-3 rounded-md border border-[#e2e7ed] bg-white p-3 md:grid-cols-[48px_minmax(240px,1fr)_110px_110px_auto] md:items-center"
                      key={item.sku}
                    >
                      <span className="grid size-12 place-items-center overflow-hidden rounded-md border border-[#dfe4ea] bg-[#f6f7f9]">
                        {item.imageUrl ? (
                          <Image
                            alt={item.productTitle}
                            className="h-full w-full object-cover"
                            height={48}
                            src={item.imageUrl}
                            unoptimized
                            width={48}
                          />
                        ) : (
                          <span className="text-[9px] font-semibold text-[#8a96a3]">IMG</span>
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{item.productTitle}</p>
                        <p className="mt-1 font-mono text-xs text-[#667380]">{item.sku}</p>
                      </div>
                      <div className="rounded-md bg-[#eef4f8] px-3 py-2 text-right">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#667380]">
                          On-hand
                        </p>
                        <p className="font-mono font-semibold text-[#255f85]">
                          {formatQty(item.onHand)}
                        </p>
                      </div>
                      <label className={labelClass}>
                        Qty
                        <input
                          className={`${inputClass} w-full text-right font-mono`}
                          disabled={alreadyAdded}
                          min="0"
                          onChange={(event) =>
                            setMatrixAddQtyBySku((current) => ({
                              ...current,
                              [item.sku]: event.target.value,
                            }))
                          }
                          step="0.0001"
                          type="number"
                          value={
                            matrixAddQtyBySku[item.sku] ??
                            String(item.recommendedQty || "")
                          }
                        />
                      </label>
                      <button
                        className={buttonClass}
                        disabled={alreadyAdded}
                        onClick={() => addCatalogLineFromMatrix(item)}
                        type="button"
                      >
                        {alreadyAdded ? "In draft" : "+ Add"}
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : null}
            {matrixAddTarget &&
            !matrixTargetLoading &&
            matrixSearchQuery.trim().length >= 2 &&
            visibleMatrixCatalogItems.length === 0 ? (
              <p className="mt-3 rounded-md bg-[#fff4e5] px-3 py-2 text-sm font-semibold text-[#946200]">
                No catalog SKU matched {matrixAddTarget.productName} / {matrixAddTarget.size}.
                Try a manual SKU search in the box above.
              </p>
            ) : null}
            {matrixAddMessage ? (
              <p
                className={`mt-3 rounded-md px-3 py-2 text-sm font-semibold ${
                  matrixAddMessage.startsWith("Added")
                    ? "bg-[#eaf6ef] text-[#1f6b3d]"
                    : "bg-[#fff4e5] text-[#946200]"
                }`}
              >
                {matrixAddMessage}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 border-t border-[#e2e7ed] pt-4 sm:flex-row sm:items-center sm:justify-between">
            <ActionMessage state={state} />
            <button className={buttonClass} disabled={pending} type="submit">
              <LoadingLabel loading={pending} loadingText="Saving...">
                Save All Draft &amp; Matrix Changes
              </LoadingLabel>
            </button>
          </div>
        </div>
      </section>
    </form>
  );
}

export function LandedCostAllocationForm({
  currency,
  freightTotal,
  landedCostNote,
  otherLandedCostTotal,
  poId,
}: {
  currency: string;
  freightTotal: number;
  landedCostNote: string;
  otherLandedCostTotal: number;
  poId: string;
}) {
  const [state, formAction, pending] = useActionState(
    allocatePoLandedCostAction,
    initialState,
  );

  return (
    <form action={formAction} className="grid gap-3">
      <input name="poId" type="hidden" value={poId} />
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_1.5fr_auto]">
        <label className={labelClass}>
          Freight total
          <input
            className={inputClass}
            defaultValue={freightTotal || ""}
            min="0"
            name="freightTotal"
            placeholder={currency}
            step="0.0001"
            type="number"
          />
        </label>
        <label className={labelClass}>
          Other landed cost
          <input
            className={inputClass}
            defaultValue={otherLandedCostTotal || ""}
            min="0"
            name="otherLandedCostTotal"
            placeholder={currency}
            step="0.0001"
            type="number"
          />
        </label>
        <label className={labelClass}>
          Note
          <input
            className={inputClass}
            defaultValue={landedCostNote}
            name="landedCostNote"
            placeholder="Invoice, shipping, duty, allocation basis"
          />
        </label>
        <button className={buttonClass} disabled={pending} type="submit">
          <LoadingLabel loading={pending} loadingText="Allocating...">
            Allocate
          </LoadingLabel>
        </button>
      </div>
      <ActionMessage state={state} />
    </form>
  );
}

function PaymentAmountFields({
  amount,
  amountThb,
  amountName = "amount",
  currency,
  exchangeRate,
  exchangeRateName = "exchangeRate",
  isDraftRow = false,
}: {
  amount: number | string | null | undefined;
  amountThb?: number | string | null | undefined;
  amountName?: string;
  currency: string | null | undefined;
  exchangeRate: number | string | null | undefined;
  exchangeRateName?: string;
  isDraftRow?: boolean;
}) {
  const normalizedCurrency = String(currency || "THB").trim().toUpperCase();
  const savedExchangeRate = Number(exchangeRate ?? 0);
  const nextAmountValue = amount === null || amount === undefined ? "" : String(amount);
  const inferredRate =
    normalizedCurrency !== "THB" && Number(amount ?? 0) > 0 && Number(amountThb ?? 0) > 0
      ? Number(amountThb) / Number(amount)
      : 0;
  const nextRateValue =
    exchangeRate === null || exchangeRate === undefined || savedExchangeRate <= 0
      ? normalizedCurrency === "THB"
        ? "1"
        : inferredRate > 1
          ? String(Number(inferredRate.toFixed(6)))
          : ""
      : String(exchangeRate);
  const [amountValue, setAmountValue] = useState(nextAmountValue);
  const [rateValue, setRateValue] = useState(nextRateValue);
  const amountNumber = Number(amountValue || 0);
  const rateNumber = Number(rateValue || 0);
  const shouldValidateFx = !isDraftRow || amountNumber > 0;
  const thbAmount =
    amountValue === nextAmountValue && rateValue === nextRateValue && Number(amountThb ?? 0) > 0
      ? Number(amountThb)
      : Number.isFinite(amountNumber) && Number.isFinite(rateNumber) ? amountNumber * rateNumber : 0;
  const hasInvalidForeignFx = shouldValidateFx && normalizedCurrency !== "THB" && rateNumber <= 1;
  const savedFxLabel = normalizedCurrency === "THB"
    ? "THB uses FX 1"
    : savedExchangeRate > 0
      ? `Last saved FX: ${savedExchangeRate}`
      : "No saved FX yet";

  return (
    <>
      <td className="px-3 py-3">
        <input
          className={`${inputClass} text-right font-mono`}
          min="0"
          name={amountName}
          onChange={(event) => setAmountValue(event.target.value)}
          step="0.0001"
          type="number"
          value={amountValue}
        />
      </td>
      <td className="px-3 py-3">
        <input
          className={`${inputClass} text-right font-mono ${hasInvalidForeignFx ? "border-[#d64545]" : ""}`}
          min="0.000001"
          name={exchangeRateName}
          onChange={(event) => setRateValue(event.target.value)}
          step="0.000001"
          type="number"
          value={rateValue}
        />
        <p className="mt-1 text-xs text-[#667380]">{savedFxLabel}</p>
        {hasInvalidForeignFx ? (
          <p className="mt-1 text-xs font-semibold text-[#b42318]">
            FX rate missing or invalid for {normalizedCurrency}
          </p>
        ) : null}
      </td>
      <td className="px-3 py-3 text-right font-mono font-semibold">
        {hasInvalidForeignFx ? (
          <span className="text-[#b42318]">FX required</span>
        ) : (
          `${formatMoney(thbAmount)} THB`
        )}
      </td>
    </>
  );
}

function StyledPaymentSelect({
  classForValue,
  defaultValue,
  name,
  options,
}: {
  classForValue: (value: string) => string;
  defaultValue: string;
  name: string;
  options: Array<{ label: string; value: string }>;
}) {
  const [value, setValue] = useState(defaultValue);

  return (
    <select
      className={`${inputClass} appearance-none pr-8 shadow-sm transition ${classForValue(value)}`}
      name={name}
      onChange={(event) => setValue(event.target.value)}
      value={value}
    >
      {options.map((option) => (
        <option key={`${name}-${option.value || "blank"}`} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function SyncedPaymentInput({
  className = inputClass,
  name,
  type = "text",
  value,
}: {
  className?: string;
  name: string;
  type?: string;
  value: string;
}) {
  const [inputValue, setInputValue] = useState(value);

  return (
    <input
      className={className}
      name={name}
      onChange={(event) => setInputValue(event.target.value)}
      type={type}
      value={inputValue}
    />
  );
}

export function AddPaymentForm({
  currency,
  poId,
  paymentTerms,
  today,
}: {
  currency: string;
  poId: string;
  paymentTerms?: string;
  today: string;
}) {
  const [state, formAction, pending] = useActionState(addPoPaymentAction, initialState);
  const options = paymentTypeOptionsWithBlank(paymentTerms);

  return (
    <form action={formAction} className="grid gap-3">
      <input name="poId" type="hidden" value={poId} />
      <div className="grid gap-3 lg:grid-cols-[0.8fr_0.9fr_0.8fr_0.65fr_0.75fr_1fr_1fr_auto]">
        <label className={labelClass}>
          Date
          <input className={inputClass} defaultValue={today} name="paymentDate" type="date" />
        </label>
        <label className={labelClass}>
          Type
          <select className={inputClass} defaultValue="" name="paymentType">
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Amount
          <input className={inputClass} min="0" name="amount" required step="0.0001" type="number" />
        </label>
        <label className={labelClass}>
          Currency
          <input className={inputClass} defaultValue={currency} name="currency" />
        </label>
        <label className={labelClass}>
          Exchange rate
          <input className={inputClass} defaultValue="1" min="0.000001" name="exchangeRate" step="0.000001" type="number" />
          <span className="text-[11px] normal-case tracking-normal text-[#667380]">
            Use 1 for THB. Foreign currency needs the real FX rate before saving.
          </span>
        </label>
        <label className={labelClass}>
          Paid by
          <input className={inputClass} name="paidBy" placeholder="Name" />
        </label>
        <label className={labelClass}>
          Reference
          <input className={inputClass} name="reference" placeholder="Slip / invoice" />
        </label>
        <button className={buttonClass} disabled={pending} type="submit">
          <LoadingLabel loading={pending} loadingText="Saving...">
            Add Payment
          </LoadingLabel>
        </button>
      </div>
      <label className={labelClass}>
        Note
        <input className={inputClass} name="note" placeholder="Payment note" />
      </label>
      <ActionMessage state={state} />
    </form>
  );
}

export function PaymentScheduleForm({
  currency,
  payments,
  paymentTerms,
  poAmount,
  poId,
}: {
  currency: string;
  payments: PaymentRowItem[];
  paymentTerms?: string;
  poAmount: number;
  poId: string;
}) {
  const router = useRouter();
  const nextDraftKeyIndex = useRef(0);
  const [localPayments, setLocalPayments] = useState(() => sortPoPayments(payments));
  const [draftKeys, setDraftKeys] = useState(() => [initialPaymentDraftKey]);
  const previousPaymentsSignature = useRef("");
  const paymentsSignature = useMemo(
    () =>
      payments
        .map((payment) =>
          [
            payment.id,
            payment.payment_status,
            payment.xero_status,
            payment.payment_date,
            payment.due_date,
            payment.amount,
            payment.exchange_rate,
            payment.amount_thb,
            payment.currency,
            payment.reference,
            payment.note,
          ].join("|"),
        )
        .join("::"),
    [payments],
  );
  const sortedPaymentsFromProps = useMemo(() => sortPoPayments(payments), [payments]);
  const [state, formAction, pending] = useActionState(
    async (previousState: PoActionState, formData: FormData) => {
      const nextState = await updatePoPaymentsAction(previousState, formData);
      if (nextState.ok && nextState.payments) {
        setLocalPayments(sortPoPayments(nextState.payments));
        nextDraftKeyIndex.current = 0;
        setDraftKeys([initialPaymentDraftKey]);
        router.refresh();
      }
      return nextState;
    },
    initialState,
  );
  useEffect(() => {
    if (previousPaymentsSignature.current === paymentsSignature) {
      return;
    }
    previousPaymentsSignature.current = paymentsSignature;
    setLocalPayments(sortedPaymentsFromProps);
  }, [paymentsSignature, sortedPaymentsFromProps]);

  const sortedPayments = sortPoPayments(localPayments);
  const rows = [
    ...sortedPayments.map((payment) => ({ payment, rowKey: `existing-${payment.id}` })),
    ...draftKeys.map((draftKey) => ({ payment: null, rowKey: draftKey })),
  ];
  const options = paymentTypeOptions(
    paymentTerms,
    sortedPayments.map((payment) => payment.payment_type ?? ""),
  );
  const optionsForNewRows = paymentTypeOptionsWithBlank(
    paymentTerms,
    sortedPayments.map((payment) => payment.payment_type ?? ""),
  );
  const paidTotal = localPayments
    .filter((payment) => (payment.payment_status ?? "paid") !== "planned")
    .reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
  const paidTotalThb = localPayments
    .filter((payment) => (payment.payment_status ?? "paid") !== "planned")
    .reduce(
      (sum, payment) =>
        sum + Number(payment.amount_thb ?? Number(payment.amount ?? 0) * Number(payment.exchange_rate ?? 1)),
      0,
    );
  const plannedTotalThb = localPayments
    .filter((payment) => (payment.payment_status ?? "paid") === "planned")
    .reduce(
      (sum, payment) =>
        sum + Number(payment.amount_thb ?? Number(payment.amount ?? 0) * Number(payment.exchange_rate ?? 1)),
      0,
    );
  const balance = Math.max(0, poAmount - paidTotal);
  const nextDue = sortedPayments.find(
    (payment) => (payment.payment_status ?? "paid") === "planned" && payment.due_date,
  );

  return (
    <form action={formAction} className="grid gap-4">
      <input name="poId" type="hidden" value={poId} />
      <div className="grid gap-3 md:grid-cols-5">
        {[
          ["Paid", paidTotal],
          ["Paid THB", paidTotalThb],
          ["Planned THB", plannedTotalThb],
          ["Balance", balance],
          ["Next due", nextDue?.due_date ?? "-"],
        ].map(([label, value]) => (
          <div className="rounded-md border border-[#e2e7ed] bg-[#fbfcfd] p-3" key={label}>
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#64707d]">{label}</p>
            <p className="mt-1 font-mono text-lg font-semibold">
              {typeof value === "number"
                ? `${formatMoney(value)} ${label === "Paid THB" || label === "Planned THB" ? "THB" : currency}`
                : value}
            </p>
          </div>
        ))}
      </div>
      <button
        className="h-10 justify-self-start rounded-md border border-[#cfd6df] bg-white px-3 text-xs font-semibold text-[#364252]"
        onClick={() => {
          setDraftKeys((current) => {
            const key = createAddedPaymentDraftKey(nextDraftKeyIndex.current);
            nextDraftKeyIndex.current += 1;
            return [...current, key];
          });
        }}
        type="button"
      >
        Add payment line
      </button>
      <div className="overflow-x-auto">
        <table className="min-w-[1560px] text-left text-sm">
          <thead className="bg-[#f3f5f7] text-xs uppercase tracking-[0.12em] text-[#65717f]">
            <tr>
              <th className="px-3 py-3 font-semibold">Payment</th>
              <th className="px-3 py-3 font-semibold">Status</th>
              <th className="px-3 py-3 font-semibold">Xero</th>
              <th className="px-3 py-3 font-semibold">Paid date</th>
              <th className="px-3 py-3 font-semibold">Due reminder</th>
              <th className="px-3 py-3 font-semibold">Type</th>
              <th className="px-3 py-3 text-right font-semibold">Amount</th>
              <th className="px-3 py-3 text-right font-semibold">Exchange rate</th>
              <th className="px-3 py-3 text-right font-semibold">THB paid</th>
              <th className="px-3 py-3 font-semibold">Currency</th>
              <th className="px-3 py-3 font-semibold">Reference</th>
              <th className="px-3 py-3 font-semibold">Note</th>
              <th className="px-3 py-3 font-semibold">Delete</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#edf1f5]">
            {rows.map(({ payment, rowKey }, index) => {
              const rowOptions = payment ? options : optionsForNewRows;
              const rowError = state.paymentErrors?.[rowKey];

              return (
              <tr key={rowKey}>
                <td className="px-3 py-3 font-semibold">
                  Payment {index + 1}
                  {rowError ? (
                    <p className="mt-1 text-xs font-semibold text-[#b42318]">{rowError}</p>
                  ) : null}
                </td>
                <td className="px-3 py-3">
                  <input name="paymentRowKey" type="hidden" value={rowKey} />
                  <input name={`paymentId:${rowKey}`} type="hidden" value={payment?.id ?? ""} />
                  <StyledPaymentSelect
                    classForValue={getPaymentStatusSelectClass}
                    defaultValue={payment?.payment_status ?? "planned"}
                    key={`${rowKey}:status:${payment?.payment_status ?? "planned"}`}
                    name={`paymentStatus:${rowKey}`}
                    options={[
                      { label: "Paid", value: "paid" },
                      { label: "Planned", value: "planned" },
                    ]}
                  />
                </td>
                <td className="px-3 py-3">
                  <StyledPaymentSelect
                    classForValue={getXeroStatusSelectClass}
                    defaultValue={
                      payment?.xero_status === "draft" || payment?.xero_status === "uploaded"
                        ? payment.xero_status
                        : "pending"
                    }
                    key={`${rowKey}:xero:${payment?.xero_status ?? "pending"}`}
                    name={`xeroStatus:${rowKey}`}
                    options={[
                      { label: "pending", value: "pending" },
                      { label: "draft", value: "draft" },
                      { label: "uploaded", value: "uploaded" },
                    ]}
                  />
                </td>
                <td className="px-3 py-3">
                  <SyncedPaymentInput
                    key={`${rowKey}:payment-date:${payment?.payment_date ?? ""}`}
                    name={`paymentDate:${rowKey}`}
                    type="date"
                    value={dateInputValue(payment?.payment_date)}
                  />
                </td>
                <td className="px-3 py-3">
                  <SyncedPaymentInput
                    key={`${rowKey}:due-date:${payment?.due_date ?? ""}`}
                    name={`dueDate:${rowKey}`}
                    type="date"
                    value={dateInputValue(payment?.due_date)}
                  />
                </td>
                <td className="px-3 py-3">
                  <StyledPaymentSelect
                    classForValue={getPaymentTypeSelectClass}
                    defaultValue={payment?.payment_type ?? ""}
                    key={`${rowKey}:type:${payment?.payment_type ?? ""}`}
                    name={`paymentType:${rowKey}`}
                    options={rowOptions}
                  />
                </td>
                <PaymentAmountFields
                  amount={payment?.amount ?? ""}
                  amountThb={payment?.amount_thb}
                  amountName={`amount:${rowKey}`}
                  currency={payment?.currency ?? currency}
                  exchangeRate={
                    payment?.exchange_rate ??
                    (String(payment?.currency ?? currency).trim().toUpperCase() === "THB" ? 1 : null)
                  }
                  exchangeRateName={`exchangeRate:${rowKey}`}
                  isDraftRow={!payment?.id}
                  key={`${rowKey}:amount:${payment?.amount ?? ""}:${payment?.exchange_rate ?? ""}:${payment?.amount_thb ?? ""}:${payment?.currency ?? currency}`}
                />
                <td className="px-3 py-3">
                  <SyncedPaymentInput
                    key={`${rowKey}:currency:${payment?.currency ?? currency}`}
                    name={`currency:${rowKey}`}
                    value={payment?.currency ?? currency}
                  />
                  <p className="mt-1 text-xs text-[#667380]">
                    THB uses FX 1. Foreign currency needs real FX.
                  </p>
                </td>
                <td className="px-3 py-3">
                  <SyncedPaymentInput
                    key={`${rowKey}:reference:${payment?.reference ?? ""}`}
                    name={`reference:${rowKey}`}
                    value={payment?.reference ?? ""}
                  />
                  <input name={`paidBy:${rowKey}`} type="hidden" value={payment?.paid_by ?? ""} />
                </td>
                <td className="px-3 py-3">
                  <SyncedPaymentInput
                    key={`${rowKey}:note:${payment?.note ?? ""}`}
                    name={`note:${rowKey}`}
                    value={payment?.note ?? ""}
                  />
                </td>
                <td className="px-3 py-3">
                  {payment?.id ? (
                    <label className="flex items-center gap-2 text-xs font-semibold text-[#9f2a2a]">
                      <input name="deletePaymentId" type="checkbox" value={payment.id} />
                      Delete
                    </label>
                  ) : (
                    <span className="text-xs text-[#8a96a3]">New</span>
                  )}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between gap-3">
        <ActionMessage state={state} />
        <button className={buttonClass} disabled={pending} type="submit">
          <LoadingLabel loading={pending} loadingText="Saving...">
            Save Payments
          </LoadingLabel>
        </button>
      </div>
    </form>
  );
}

export function StatusActionForm({
  poId,
  itemUuid,
  currentStatus,
  allowClosed = true,
}: {
  poId: string;
  itemUuid?: string;
  currentStatus: string;
  allowClosed?: boolean;
}) {
  const [state, formAction, pending] = useActionState(changePoStatusAction, initialState);
  const availableStatuses = statusOptions.filter(
    (status) =>
      status !== "closed" ||
      allowClosed ||
      currentStatus.toLowerCase() === "closed",
  );

  return (
    <form action={formAction} className="grid gap-2">
      <input name="poId" type="hidden" value={poId} />
      {itemUuid ? <input name="itemUuid" type="hidden" value={itemUuid} /> : null}
      <div className="flex min-w-[220px] gap-2">
        <select className={inputClass} defaultValue={currentStatus.toLowerCase()} name="toStatus">
          {availableStatuses.map((status) => (
            <option key={status} value={status}>
              {statusOptionLabel(status)}
            </option>
          ))}
        </select>
        <button className={buttonClass} disabled={pending} type="submit">
          <LoadingLabel loading={pending} loadingText="Saving...">
            Save
          </LoadingLabel>
        </button>
      </div>
      <ActionMessage state={state} />
    </form>
  );
}

export function DeleteDraftPoForm({
  isDraft,
  poId,
}: {
  isDraft: boolean;
  poId: string;
}) {
  const [state, formAction, pending] = useActionState(deleteDraftPoAction, initialState);

  if (!isDraft) {
    return null;
  }

  return (
    <form
      action={formAction}
      className="mt-2 grid gap-2"
      onSubmit={(event) => {
        const confirmed = window.confirm(
          `Delete draft PO ${poId}? This removes the draft header and lines.`,
        );
        if (!confirmed) {
          event.preventDefault();
        }
      }}
    >
      <input name="poId" type="hidden" value={poId} />
      <button
        className="inline-flex h-9 items-center justify-center rounded-md border border-[#efcaca] bg-[#fff7f7] px-3 text-xs font-semibold text-[#9f2a2a] disabled:cursor-not-allowed disabled:opacity-50"
        disabled={pending}
        type="submit"
      >
        <LoadingLabel loading={pending} loadingText="Deleting...">
          Delete Draft
        </LoadingLabel>
      </button>
      <ActionMessage state={state} />
    </form>
  );
}

export function ReceiveItemForm({
  itemUuid,
  outstandingQty,
}: {
  itemUuid?: string;
  outstandingQty: number;
}) {
  const [state, formAction, pending] = useActionState(receivePoItemAction, initialState);

  if (!itemUuid) {
    return <span className="text-xs text-[#8a96a3]">Import-only line</span>;
  }

  return (
    <form action={formAction} className="grid gap-2">
      <input name="itemUuid" type="hidden" value={itemUuid} />
      <div className="flex min-w-[260px] gap-2">
        <input
          className={inputClass}
          max={outstandingQty}
          min="0.0001"
          name="receivedQty"
          placeholder="Qty"
          required
          step="0.0001"
          type="number"
        />
        <input className={inputClass} name="receivedBy" placeholder="By" />
        <button className={buttonClass} disabled={pending} type="submit">
          <LoadingLabel loading={pending} loadingText="Receiving...">
            Receive
          </LoadingLabel>
        </button>
      </div>
      <ActionMessage state={state} />
    </form>
  );
}

export function RemovePoReceiptForm({
  poId,
  receiptId,
}: {
  poId: string;
  receiptId: string;
}) {
  const [state, formAction, pending] = useActionState(removePoReceiptAction, initialState);

  return (
    <form
      action={formAction}
      className="mt-2"
      onSubmit={(event) => {
        if (!window.confirm("Remove this receipt round?")) {
          event.preventDefault();
        }
      }}
    >
      <input name="poId" type="hidden" value={poId} />
      <input name="receiptId" type="hidden" value={receiptId} />
      <button
        className="h-8 rounded-md border border-[#efcaca] bg-[#fff7f7] px-2 text-xs font-semibold text-[#9f2a2a] disabled:opacity-50"
        disabled={pending}
        type="submit"
      >
        <LoadingLabel loading={pending} loadingText="Removing...">
          Remove
        </LoadingLabel>
      </button>
      <ActionMessage state={state} />
    </form>
  );
}

export function BatchReceiveFormBar({
  defaultReceiptDate,
  formId,
  poId,
}: {
  defaultReceiptDate: string;
  formId: string;
  poId: string;
}) {
  const [state, formAction, pending] = useActionState(
    batchReceivePoItemsAction,
    initialState,
  );

  return (
    <div className="grid gap-3 border-b border-[#e2e7ed] p-5">
      <form action={formAction} className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_auto]" id={formId}>
        <input name="poId" type="hidden" value={poId} />
        <label className={labelClass}>
          Receipt Date
          <input
            className={inputClass}
            defaultValue={defaultReceiptDate}
            name="receiptDate"
            required
            type="date"
          />
        </label>
        <label className={labelClass}>
          Received By
          <input className={inputClass} name="receivedBy" placeholder="Receiver name" />
        </label>
        <label className={labelClass}>
          Receipt Note
          <input className={inputClass} name="note" placeholder="Optional note for this batch" />
        </label>
        <button className={buttonClass} disabled={pending} type="submit">
          <LoadingLabel loading={pending} loadingText="Saving...">
            Save Receipts
          </LoadingLabel>
        </button>
      </form>
      <button
        className="h-10 justify-self-start rounded-md border border-[#2563eb] bg-[#2563eb] px-4 text-sm font-semibold text-white shadow-sm transition hover:border-[#1d4ed8] hover:bg-[#1d4ed8]"
        onClick={() => {
          window.dispatchEvent(
            new CustomEvent(fillAllReceivingEvent, { detail: { formId } }),
          );
        }}
        type="button"
      >
        Fill All Outstanding
      </button>
      <ActionMessage state={state} />
    </div>
  );
}

export function BatchReceiveLineFields({
  formId,
  itemUuid,
  outstandingQty,
}: {
  formId: string;
  itemUuid?: string;
  outstandingQty: number;
}) {
  const [receivedQty, setReceivedQty] = useState("");
  useEffect(() => {
    function fillOutstanding(event: Event) {
      const detail = (event as CustomEvent<{ formId?: string }>).detail;
      if (detail?.formId !== formId) {
        return;
      }
      setReceivedQty(outstandingQty > 0 ? String(outstandingQty) : "");
    }

    window.addEventListener(fillAllReceivingEvent, fillOutstanding);
    return () => window.removeEventListener(fillAllReceivingEvent, fillOutstanding);
  }, [formId, outstandingQty]);

  if (!itemUuid) {
    return <span className="text-xs text-[#8a96a3]">Import-only line</span>;
  }

  return (
    <div className="flex min-w-[240px] items-center gap-2">
      <input form={formId} name="batchItemUuid" type="hidden" value={itemUuid} />
      <input
        className={inputClass}
        form={formId}
        max={outstandingQty}
        min="0"
        name="batchReceivedQty"
        onChange={(event) => setReceivedQty(event.target.value)}
        placeholder="0"
        step="0.0001"
        type="number"
        value={receivedQty}
      />
      <button
        className="h-10 rounded-md border border-[#cfd6df] bg-white px-3 text-xs font-semibold text-[#364252]"
        onClick={() => setReceivedQty(outstandingQty > 0 ? String(outstandingQty) : "")}
        type="button"
      >
        Fill
      </button>
      <button
        className="h-10 rounded-md border border-[#cfd6df] bg-white px-3 text-xs font-semibold text-[#667380]"
        onClick={() => setReceivedQty("")}
        type="button"
      >
        Clear
      </button>
    </div>
  );
}

export function PrintDocumentButton({
  label,
  mode,
  poId,
  supplierName,
}: {
  label: string;
  mode: "quote" | "receiving";
  poId: string;
  supplierName: string;
}) {
  const [printing, setPrinting] = useState(false);

  return (
    <button
      className="inline-flex h-10 items-center justify-center rounded-md bg-[#172026] px-4 text-sm font-semibold text-white"
      onClick={async () => {
        const originalTitle = document.title;
        const printTitle = buildPrintFilename(mode, supplierName, poId);
        let cleanedUp = false;
        let fallbackTimer: number | null = null;
        const cleanupPrintState = () => {
          if (cleanedUp) {
            return;
          }
          cleanedUp = true;
          if (fallbackTimer) {
            window.clearTimeout(fallbackTimer);
          }
          document.title = originalTitle;
          delete document.documentElement.dataset.printMode;
          setPrinting(false);
          window.removeEventListener("afterprint", cleanupPrintState);
        };

        setPrinting(true);
        document.documentElement.dataset.printMode = mode;
        document.title = printTitle;
        window.dispatchEvent(new CustomEvent(printIntentEvent));
        window.addEventListener("afterprint", cleanupPrintState, { once: true });
        fallbackTimer = window.setTimeout(cleanupPrintState, 8000);
        await waitForPrintImages(mode);
        window.print();
        window.setTimeout(cleanupPrintState, 500);
      }}
      type="button"
    >
      <LoadingLabel loading={printing} loadingText="Preparing...">
        {label}
      </LoadingLabel>
    </button>
  );
}

async function waitForPrintImages(mode: "quote" | "receiving") {
  await new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
  });

  const selector = `.print-${mode} img`;
  const images = Array.from(document.querySelectorAll<HTMLImageElement>(selector));
  if (images.length === 0) {
    return;
  }

  await Promise.race([
    Promise.all(
      images.map((image) => {
        if (image.complete && image.naturalWidth > 0) {
          return Promise.resolve();
        }
        return new Promise<void>((resolve) => {
          const done = () => resolve();
          image.addEventListener("load", done, { once: true });
          image.addEventListener("error", done, { once: true });
        });
      }),
    ),
    new Promise<void>((resolve) => window.setTimeout(resolve, 2000)),
  ]);
}

export function PrintIntentContent({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const markReady = () => setReady(true);

    window.addEventListener(printIntentEvent, markReady);
    return () => window.removeEventListener(printIntentEvent, markReady);
  }, []);

  return ready ? children : null;
}

function buildPrintFilename(
  mode: "quote" | "receiving",
  supplierName: string,
  poId: string,
) {
  const prefix = mode === "quote" ? "PQ" : "GR";
  const supplierShortName =
    supplierName
      .replace(/\bco\.?,?\s*ltd\.?\b/gi, "")
      .replace(/\bco\.?\s*ltd\.?\b/gi, "")
      .replace(/\blimited\b/gi, "")
      .replace(/\bltd\.?\b/gi, "")
      .replace(/\bcompany\b/gi, "")
      .replace(/[^a-z0-9]+/gi, " ")
      .trim()
      .split(/\s+/)
      .join("-")
      .replace(/-+/g, "-")
      .slice(0, 32)
      .replace(/^-|-$/g, "") || "Supplier";
  const last4Po =
    poId
      .match(/[a-z0-9]/gi)
      ?.slice(-4)
      .join("") || "PO";

  return `${prefix}-${supplierShortName}-${last4Po}.pdf`;
}

export function DraftApprovalEmailButton({ emailText }: { emailText: string }) {
  const [open, setOpen] = useState(false);
  const [copying, setCopying] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copyEmail() {
    setOpen(true);
    setCopying(true);
    try {
      await navigator.clipboard.writeText(emailText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    } finally {
      setCopying(false);
    }
  }

  return (
    <div className="grid gap-2">
      <button
        className="inline-flex h-10 items-center justify-center rounded-md border border-[#cfd6df] bg-white px-4 text-sm font-semibold text-[#364252]"
        onClick={copyEmail}
        type="button"
      >
        <LoadingLabel loading={copying} loadingText="Copying...">
          {copied ? "Copied e-mail" : "Draft e-mail"}
        </LoadingLabel>
      </button>
      {open ? (
        <textarea
          className="min-h-52 w-full rounded-md border border-[#cfd6df] bg-[#fbfcfd] p-3 text-sm leading-6 text-[#172026]"
          onFocus={(event) => event.target.select()}
          readOnly
          value={emailText}
        />
      ) : null}
    </div>
  );
}
