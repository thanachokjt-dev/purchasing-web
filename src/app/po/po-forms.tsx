"use client";

import Image from "next/image";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
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
  removePoReceiptAction,
  updatePoHeaderRefsAction,
  updatePoDraftLinesAction,
  updatePoPaymentsAction,
  type PoActionState,
} from "@/app/po/actions";
import { LoadingLabel } from "@/app/loading-controls";

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
  supplierCode: string;
  supplierName: string;
  currency: string;
  shopifyPrice: number;
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
  imageUrl?: string | null;
  lineNo: string;
  sku: string;
  productTitle: string;
  qty: number;
  unitPrice: number;
  freightUnitCost?: number;
  landedUnitCost?: number;
  lineAmount: number;
  currency: string;
  remark: string;
  sortPosition?: number;
};

type PaymentRowItem = {
  id: string;
  payment_date: string | null;
  payment_type: string | null;
  payment_status?: string | null;
  due_date?: string | null;
  amount: number | string | null;
  exchange_rate?: number | string | null;
  amount_thb?: number | string | null;
  currency: string | null;
  paid_by: string | null;
  reference: string | null;
  note: string | null;
};

const initialState: PoActionState = { ok: false, message: "" };
const printIntentEvent = "po-detail:print-intent";
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
  return item.itemUuid || `${item.sku}:${item.lineNo}`;
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

const inputClass =
  "h-10 rounded-md border border-[#cfd6df] bg-white px-3 text-sm text-[#172026] outline-none focus:border-[#255f85]";
const labelClass = "grid gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#64707d]";
const buttonClass =
  "inline-flex h-10 items-center justify-center rounded-md bg-[#172026] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50";

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
  const [sku, setSku] = useState("");
  const [productTitle, setProductTitle] = useState("");
  const [variantTitle, setVariantTitle] = useState("");
  const [orderedQty, setOrderedQty] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [freightUnitCost, setFreightUnitCost] = useState("");
  const [currency, setCurrency] = useState("THB");
  const selectedSupplier = suppliers.find(
    (supplier) => supplier.supplierCode === supplierCode,
  );
  const { items: filteredCatalogItems, loading: catalogLoading } = useCatalogSearch({
    limit: 10,
    query,
    supplierCode,
    supplierName: selectedSupplier?.supplierName ?? "",
  });

  function selectCatalogItem(item: CatalogItemOption) {
    setQuery(`${item.sku} - ${item.productTitle}`);
    setSku(item.sku);
    setProductTitle(item.productTitle);
    setVariantTitle(item.variantTitle);
    setOrderedQty(item.recommendedQty ? String(item.recommendedQty) : "");
    setUnitPrice(String(item.lastUnitPrice || item.shopifyPrice || ""));
    setFreightUnitCost(item.lastFreightUnitCost ? String(item.lastFreightUnitCost) : "");
    setCurrency(item.currency || selectedSupplier?.currency || "THB");
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
              setSku("");
              setProductTitle("");
              setVariantTitle("");
              setOrderedQty("");
              setUnitPrice("");
              setFreightUnitCost("");
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

      <div className="grid gap-3 lg:grid-cols-[1.2fr_1.1fr_0.55fr_0.65fr_0.65fr_0.55fr]">
        <div className={`${labelClass} relative`}>
          SKU / Product search
          <input
            className={inputClass}
            onChange={(event) => {
              setQuery(event.target.value);
              setSku(event.target.value.trim());
            }}
            placeholder={
              supplierCode
                ? "Search SKU or product name"
                : "Select supplier first"
            }
            required
            value={query}
          />
          <input name="sku" type="hidden" value={sku} />
          <input name="variantTitle" type="hidden" value={variantTitle} />
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
                  onClick={() => selectCatalogItem(item)}
                  type="button"
                >
                  <span className="row-span-3 grid size-12 place-items-center overflow-hidden rounded-md border border-[#dfe4ea] bg-[#f6f7f9]">
                    {item.imageUrl ? (
                      <Image
                        alt={item.productTitle}
                        className="h-full w-full object-cover"
                        height={48}
                        src={item.imageUrl}
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
        <label className={labelClass}>
          Product
          <input
            className={inputClass}
            name="productTitle"
            onChange={(event) => setProductTitle(event.target.value)}
            value={productTitle}
          />
        </label>
        <label className={labelClass}>
          Qty
          <input
            className={inputClass}
            min="0.0001"
            name="orderedQty"
            onChange={(event) => setOrderedQty(event.target.value)}
            required
            step="0.0001"
            type="number"
            value={orderedQty}
          />
        </label>
        <label className={labelClass}>
          Price
          <input
            className={inputClass}
            min="0"
            name="unitPrice"
            onChange={(event) => setUnitPrice(event.target.value)}
            step="0.0001"
            type="number"
            value={unitPrice}
          />
        </label>
        <label className={labelClass}>
          Freight / unit
          <input
            className={inputClass}
            min="0"
            name="freightUnitCost"
            onChange={(event) => setFreightUnitCost(event.target.value)}
            placeholder="after landed cost"
            step="0.0001"
            type="number"
            value={freightUnitCost}
          />
        </label>
        <label className={labelClass}>
          Currency
          <input
            className={inputClass}
            name="currency"
            onChange={(event) => setCurrency(event.target.value)}
            value={currency}
          />
        </label>
      </div>

      <div className="grid gap-3 rounded-md border border-[#e2e7ed] bg-[#fbfcfd] p-3 text-sm md:grid-cols-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#64707d]">
            Purchasing Decision Round 10
          </p>
          <p className="mt-1 font-mono text-[#172026]">
            {filteredCatalogItems.find((item) => item.sku === sku)?.recommendedQty ||
              "-"}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#64707d]">
            Last PO unit price
          </p>
          <p className="mt-1 font-mono text-[#172026]">
            {filteredCatalogItems.find((item) => item.sku === sku)?.lastUnitPrice ||
              "-"}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#64707d]">
            Last freight / unit
          </p>
          <p className="mt-1 font-mono text-[#172026]">
            {filteredCatalogItems.find((item) => item.sku === sku)
              ?.lastFreightUnitCost || "-"}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#64707d]">
            Last PO
          </p>
          <p className="mt-1 font-mono text-[#172026]">
            {filteredCatalogItems.find((item) => item.sku === sku)?.lastPoId ||
              "-"}
          </p>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
        <label className={labelClass}>
          Remark
          <input className={inputClass} name="remark" />
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
      [item.sku]: current[item.sku] ?? String(item.lastUnitPrice || item.shopifyPrice || ""),
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
                        value={priceBySku[item.sku] ?? String(item.lastUnitPrice || item.shopifyPrice || "")}
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
}: {
  items: DraftLineItem[];
  poId: string;
}) {
  const [state, formAction, pending] = useActionState(
    updatePoDraftLinesAction,
    initialState,
  );
  const [lines, setLines] = useState(items);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [adjustPercent, setAdjustPercent] = useState("");
  const [logisticCost, setLogisticCost] = useState("");
  const [vatMode, setVatMode] = useState<"none" | "include" | "exclude">("none");
  const [exchangeRates, setExchangeRates] = useState(["", "", ""]);
  const [exchangeMode, setExchangeMode] = useState<"none" | "thai" | "foreign">("none");
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
    updateLine(index, { unitPrice: value });
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

  return (
    <form action={formAction}>
      <input name="poId" type="hidden" value={poId} />
      {deletedIds.map((id) => (
        <input key={id} name="deleteItemUuid" type="hidden" value={id} />
      ))}
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
                key={item.itemUuid ?? `${poId}-${item.lineNo}`}
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
  amountName = "amount",
  currency,
  exchangeRate,
  exchangeRateName = "exchangeRate",
}: {
  amount: number | string | null | undefined;
  amountName?: string;
  currency: string | null | undefined;
  exchangeRate: number | string | null | undefined;
  exchangeRateName?: string;
}) {
  const [amountValue, setAmountValue] = useState(amount === null || amount === undefined ? "" : String(amount));
  const [rateValue, setRateValue] = useState(
    exchangeRate === null || exchangeRate === undefined ? "1" : String(exchangeRate),
  );
  const amountNumber = Number(amountValue || 0);
  const rateNumber = Number(rateValue || 0);
  const thbAmount =
    Number.isFinite(amountNumber) && Number.isFinite(rateNumber) ? amountNumber * rateNumber : 0;
  const normalizedCurrency = String(currency || "THB").trim().toUpperCase();
  const hasInvalidForeignFx = normalizedCurrency !== "THB" && rateNumber <= 1;

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
  const [state, formAction, pending] = useActionState(
    updatePoPaymentsAction,
    initialState,
  );
  const sortedPayments = [...payments].sort((a, b) =>
    String(a.payment_date ?? a.due_date ?? "").localeCompare(
      String(b.payment_date ?? b.due_date ?? ""),
    ),
  );
  const [extraRows, setExtraRows] = useState(1);
  const rows = [
    ...sortedPayments,
    ...Array.from({ length: Math.max(1, extraRows) }, () => null),
  ];
  const options = paymentTypeOptions(
    paymentTerms,
    sortedPayments.map((payment) => payment.payment_type ?? ""),
  );
  const optionsForNewRows = paymentTypeOptionsWithBlank(
    paymentTerms,
    sortedPayments.map((payment) => payment.payment_type ?? ""),
  );
  const paidTotal = payments
    .filter((payment) => (payment.payment_status ?? "paid") !== "planned")
    .reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
  const paidTotalThb = payments
    .filter((payment) => (payment.payment_status ?? "paid") !== "planned")
    .reduce(
      (sum, payment) =>
        sum + Number(payment.amount_thb ?? Number(payment.amount ?? 0) * Number(payment.exchange_rate ?? 1)),
      0,
    );
  const plannedTotalThb = payments
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
        onClick={() => setExtraRows((current) => current + 1)}
        type="button"
      >
        Add payment line
      </button>
      <div className="overflow-x-auto">
        <table className="min-w-[1480px] text-left text-sm">
          <thead className="bg-[#f3f5f7] text-xs uppercase tracking-[0.12em] text-[#65717f]">
            <tr>
              <th className="px-3 py-3 font-semibold">Payment</th>
              <th className="px-3 py-3 font-semibold">Status</th>
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
            {rows.map((payment, index) => {
              const rowKey = payment?.id ? `existing-${payment.id}` : `new-${index}`;
              const rowOptions = payment ? options : optionsForNewRows;

              return (
              <tr key={rowKey}>
                <td className="px-3 py-3 font-semibold">Payment {index + 1}</td>
                <td className="px-3 py-3">
                  <input name="paymentRowKey" type="hidden" value={rowKey} />
                  <input name={`paymentId:${rowKey}`} type="hidden" value={payment?.id ?? ""} />
                  <select
                    className={inputClass}
                    defaultValue={payment?.payment_status ?? "paid"}
                    name={`paymentStatus:${rowKey}`}
                  >
                    <option value="paid">Paid</option>
                    <option value="planned">Planned</option>
                  </select>
                </td>
                <td className="px-3 py-3">
                  <input
                    className={inputClass}
                    defaultValue={payment?.payment_date ?? ""}
                    name={`paymentDate:${rowKey}`}
                    type="date"
                  />
                </td>
                <td className="px-3 py-3">
                  <input
                    className={inputClass}
                    defaultValue={payment?.due_date ?? ""}
                    name={`dueDate:${rowKey}`}
                    type="date"
                  />
                </td>
                <td className="px-3 py-3">
                  <select
                    className={inputClass}
                    defaultValue={payment?.payment_type ?? ""}
                    name={`paymentType:${rowKey}`}
                  >
                    {rowOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </td>
                <PaymentAmountFields
                  amount={payment?.amount ?? ""}
                  amountName={`amount:${rowKey}`}
                  currency={payment?.currency ?? currency}
                  exchangeRate={payment?.exchange_rate ?? 1}
                  exchangeRateName={`exchangeRate:${rowKey}`}
                />
                <td className="px-3 py-3">
                  <input
                    className={inputClass}
                    defaultValue={payment?.currency ?? currency}
                    name={`currency:${rowKey}`}
                  />
                  <p className="mt-1 text-xs text-[#667380]">
                    THB uses FX 1. Foreign currency needs real FX.
                  </p>
                </td>
                <td className="px-3 py-3">
                  <input
                    className={inputClass}
                    defaultValue={payment?.reference ?? ""}
                    name={`reference:${rowKey}`}
                  />
                  <input name={`paidBy:${rowKey}`} type="hidden" value={payment?.paid_by ?? ""} />
                </td>
                <td className="px-3 py-3">
                  <input
                    className={inputClass}
                    defaultValue={payment?.note ?? ""}
                    name={`note:${rowKey}`}
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
      onClick={() => {
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
        window.requestAnimationFrame(() => {
          window.print();
          window.setTimeout(cleanupPrintState, 500);
        });
      }}
      type="button"
    >
      <LoadingLabel loading={printing} loadingText="Preparing...">
        {label}
      </LoadingLabel>
    </button>
  );
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
