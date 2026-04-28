"use client";

import Image from "next/image";
import { useActionState, useMemo, useState } from "react";
import type { DragEvent } from "react";
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
  updatePoHeaderRefsAction,
  updatePoDraftLinesAction,
  type PoActionState,
} from "@/app/po/actions";

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

const initialState: PoActionState = { ok: false, message: "" };
const statusOptions = [
  "draft",
  "waiting_for_approve",
  "inpro",
  "delivery",
  "final_payment",
  "closed",
  "cancelled",
];

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

export function CreatePoForm({
  catalogItems,
  suggestedPoId,
  suppliers,
  today,
}: {
  catalogItems: CatalogItemOption[];
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
  const selectedSupplierName = selectedSupplier?.supplierName.toLowerCase() ?? "";
  const filteredCatalogItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return catalogItems
      .filter((item) => {
        const matchesSupplier =
          !supplierCode ||
          item.supplierCode === supplierCode ||
          item.supplierName.toLowerCase() === selectedSupplierName;
        const matchesQuery =
          !normalizedQuery || item.searchText.includes(normalizedQuery);

        return matchesSupplier && matchesQuery;
      })
      .slice(0, 10);
  }, [catalogItems, query, selectedSupplierName, supplierCode]);

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
          {query && filteredCatalogItems.length > 0 ? (
            <div className="absolute left-0 right-0 top-[64px] z-20 max-h-72 overflow-auto rounded-md border border-[#cfd6df] bg-white shadow-lg">
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
          {pending ? "Creating..." : "Open Draft PO"}
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
          Add line
        </button>
      </div>
      <ActionMessage state={state} />
    </form>
  );
}

export function PoHeaderRefsForm({
  poId,
  quotationReference,
  supplierInvoiceNo,
}: {
  poId: string;
  quotationReference: string;
  supplierInvoiceNo: string;
}) {
  const [state, formAction, pending] = useActionState(
    updatePoHeaderRefsAction,
    initialState,
  );

  return (
    <form action={formAction} className="grid gap-3">
      <input name="poId" type="hidden" value={poId} />
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
      <button className={buttonClass} disabled={pending} type="submit">
        {pending ? "Saving..." : "Save refs"}
      </button>
      <ActionMessage state={state} />
    </form>
  );
}

export function SmartAddPoItemForm({
  catalogItems,
  currency,
  poId,
  supplierCode,
  supplierName,
}: {
  catalogItems: CatalogItemOption[];
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
  const supplierKey = supplierName.toLowerCase();
  const filteredCatalogItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return catalogItems
      .filter((item) => {
        const matchesSupplier =
          item.supplierCode === supplierCode ||
          item.supplierName.toLowerCase() === supplierKey;
        const matchesQuery =
          !normalizedQuery || item.searchText.includes(normalizedQuery);

        return matchesSupplier && matchesQuery;
      })
      .slice(0, 40);
  }, [catalogItems, query, supplierCode, supplierKey]);
  const mainNameGroups = useMemo(() => {
    const groups = new Map<string, CatalogItemOption[]>();
    for (const item of filteredCatalogItems) {
      const key = item.mainName || item.productTitle;
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }
    return Array.from(groups.entries());
  }, [filteredCatalogItems]);

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
          {pending ? "Adding..." : `Add ${selectedSkus.length || ""} line${selectedSkus.length === 1 ? "" : "s"}`}
        </button>
      </div>

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

  function updateLine(index: number, patch: Partial<DraftLineItem>) {
    setLines((current) =>
      current.map((line, lineIndex) =>
        lineIndex === index ? { ...line, ...patch } : line,
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
    setLines((current) => current.filter((_, lineIndex) => lineIndex !== index));
  }

  function adjustAllQty() {
    const percent = Number(adjustPercent);
    if (!Number.isFinite(percent)) {
      return;
    }
    const factor = 1 + percent / 100;
    setLines((current) =>
      current.map((line) => ({
        ...line,
        qty: Math.max(0, Math.round(line.qty * factor)),
      })),
    );
  }

  function applyVat(mode: "include" | "exclude") {
    const factor = mode === "include" ? 1.07 : 1 / 1.07;
    setLines((current) =>
      current.map((line) => ({
        ...line,
        unitPrice: Number((line.unitPrice * factor).toFixed(4)),
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
        <button className="h-10 rounded-md border border-[#cfd6df] bg-white px-3 text-xs font-semibold" onClick={() => applyVat("include")} type="button">
          Include VAT 7%
        </button>
        <button className="h-10 rounded-md border border-[#cfd6df] bg-white px-3 text-xs font-semibold" onClick={() => applyVat("exclude")} type="button">
          Exclude VAT 7%
        </button>
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
            {lines.map((item, index) => (
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
                    onChange={(event) => updateLine(index, { unitPrice: Number(event.target.value) || 0 })}
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
                    onChange={(event) => updateLine(index, { freightUnitCost: Number(event.target.value) || 0 })}
                    step="0.0001"
                    type="number"
                    value={item.freightUnitCost ?? 0}
                  />
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {(item.unitPrice + (item.freightUnitCost ?? 0)).toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {formatMoney(item.qty * item.unitPrice)} {item.currency}
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
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-3 border-t border-[#e2e7ed] p-5 sm:flex-row sm:items-center sm:justify-between">
        <ActionMessage state={state} />
        <button className={buttonClass} disabled={pending} type="submit">
          {pending ? "Saving..." : "Save Draft Details"}
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
          {pending ? "Allocating..." : "Allocate"}
        </button>
      </div>
      <ActionMessage state={state} />
    </form>
  );
}

export function AddPaymentForm({
  currency,
  poId,
  today,
}: {
  currency: string;
  poId: string;
  today: string;
}) {
  const [state, formAction, pending] = useActionState(addPoPaymentAction, initialState);

  return (
    <form action={formAction} className="grid gap-3">
      <input name="poId" type="hidden" value={poId} />
      <div className="grid gap-3 lg:grid-cols-[0.8fr_0.8fr_0.8fr_0.7fr_1fr_1fr_auto]">
        <label className={labelClass}>
          Date
          <input className={inputClass} defaultValue={today} name="paymentDate" type="date" />
        </label>
        <label className={labelClass}>
          Type
          <select className={inputClass} defaultValue="deposit" name="paymentType">
            <option value="deposit">deposit</option>
            <option value="before_ship">before_ship</option>
            <option value="after_received">after_received</option>
            <option value="balance">balance</option>
            <option value="other">other</option>
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
          Paid by
          <input className={inputClass} name="paidBy" placeholder="Name" />
        </label>
        <label className={labelClass}>
          Reference
          <input className={inputClass} name="reference" placeholder="Slip / invoice" />
        </label>
        <button className={buttonClass} disabled={pending} type="submit">
          {pending ? "Saving..." : "Add Payment"}
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

export function StatusActionForm({
  poId,
  itemUuid,
  currentStatus,
}: {
  poId: string;
  itemUuid?: string;
  currentStatus: string;
}) {
  const [state, formAction, pending] = useActionState(changePoStatusAction, initialState);

  return (
    <form action={formAction} className="grid gap-2">
      <input name="poId" type="hidden" value={poId} />
      {itemUuid ? <input name="itemUuid" type="hidden" value={itemUuid} /> : null}
      <div className="flex min-w-[220px] gap-2">
        <select className={inputClass} defaultValue={currentStatus.toLowerCase()} name="toStatus">
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <button className={buttonClass} disabled={pending} type="submit">
          Save
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
        {pending ? "Deleting..." : "Delete Draft"}
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
          Receive
        </button>
      </div>
      <ActionMessage state={state} />
    </form>
  );
}

export function BatchReceiveFormBar({
  formId,
  poId,
}: {
  formId: string;
  poId: string;
}) {
  const [state, formAction, pending] = useActionState(
    batchReceivePoItemsAction,
    initialState,
  );

  return (
    <div className="grid gap-3 border-b border-[#e2e7ed] p-5">
      <form action={formAction} className="grid gap-3 lg:grid-cols-[1fr_1fr_auto]" id={formId}>
        <input name="poId" type="hidden" value={poId} />
        <label className={labelClass}>
          Received By
          <input className={inputClass} name="receivedBy" placeholder="Receiver name" />
        </label>
        <label className={labelClass}>
          Receipt Note
          <input className={inputClass} name="note" placeholder="Optional note for this batch" />
        </label>
        <button className={buttonClass} disabled={pending} type="submit">
          {pending ? "Saving..." : "Save Receipts"}
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

export function PrintPageButton() {
  return (
    <button
      className="inline-flex h-10 items-center justify-center rounded-md bg-[#172026] px-4 text-sm font-semibold text-white"
      onClick={() => window.print()}
      type="button"
    >
      Print Quote
    </button>
  );
}
