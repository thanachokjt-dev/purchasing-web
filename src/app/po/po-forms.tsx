"use client";

import Image from "next/image";
import { useActionState, useMemo, useState } from "react";
import {
  addPoItemAction,
  addPoPaymentAction,
  allocatePoLandedCostAction,
  batchReceivePoItemsAction,
  changePoStatusAction,
  createPoAction,
  receivePoItemAction,
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
  const [state, formAction, pending] = useActionState(addPoItemAction, initialState);
  const [query, setQuery] = useState("");
  const [sku, setSku] = useState("");
  const [productTitle, setProductTitle] = useState("");
  const [variantTitle, setVariantTitle] = useState("");
  const [orderedQty, setOrderedQty] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [freightUnitCost, setFreightUnitCost] = useState("");
  const [lineCurrency, setLineCurrency] = useState(currency || "THB");
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
      .slice(0, 10);
  }, [catalogItems, query, supplierCode, supplierKey]);
  const selectedItem = filteredCatalogItems.find((item) => item.sku === sku);

  function selectCatalogItem(item: CatalogItemOption) {
    setQuery(`${item.sku} - ${item.productTitle}`);
    setSku(item.sku);
    setProductTitle(item.productTitle);
    setVariantTitle(item.variantTitle);
    setOrderedQty(item.recommendedQty ? String(item.recommendedQty) : "");
    setUnitPrice(String(item.lastUnitPrice || item.shopifyPrice || ""));
    setFreightUnitCost(item.lastFreightUnitCost ? String(item.lastFreightUnitCost) : "");
    setLineCurrency(item.currency || currency || "THB");
  }

  return (
    <form action={formAction} className="grid gap-3">
      <input name="poId" type="hidden" value={poId} />
      <input name="sku" type="hidden" value={sku} />
      <input name="variantTitle" type="hidden" value={variantTitle} />
      <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr_0.45fr_0.55fr_0.55fr_0.45fr_auto]">
        <div className={`${labelClass} relative`}>
          SKU / Product search
          <input
            className={inputClass}
            onChange={(event) => {
              setQuery(event.target.value);
              setSku(event.target.value.trim());
            }}
            placeholder="Search SKU or product name"
            required
            value={query}
          />
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
                    Round 10 {item.recommendedQty || "-"} /{" "}
                    {item.lastPoId
                      ? `last ${item.lastPoId} @ ${item.lastUnitPrice}`
                      : "Shopify catalog"}
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
          Freight/unit
          <input
            className={inputClass}
            min="0"
            name="freightUnitCost"
            onChange={(event) => setFreightUnitCost(event.target.value)}
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
            onChange={(event) => setLineCurrency(event.target.value)}
            value={lineCurrency}
          />
        </label>
        <button className={buttonClass} disabled={pending} type="submit">
          Add line
        </button>
      </div>
      {selectedItem ? (
        <div className="grid gap-2 rounded-md border border-[#e2e7ed] bg-[#fbfcfd] p-3 text-xs text-[#52606d] sm:grid-cols-4">
          <p>
            Round 10:{" "}
            <span className="font-mono font-semibold text-[#172026]">
              {selectedItem.recommendedQty || "-"}
            </span>
          </p>
          <p>
            Last PO:{" "}
            <span className="font-mono font-semibold text-[#172026]">
              {selectedItem.lastPoId || "-"}
            </span>
          </p>
          <p>
            Last unit:{" "}
            <span className="font-mono font-semibold text-[#172026]">
              {selectedItem.lastUnitPrice || "-"}
            </span>
          </p>
          <p>
            Last freight:{" "}
            <span className="font-mono font-semibold text-[#172026]">
              {selectedItem.lastFreightUnitCost || "-"}
            </span>
          </p>
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

  return (
    <form action={formAction}>
      <input name="poId" type="hidden" value={poId} />
      <div className="overflow-x-auto">
        <table className="min-w-[1250px] text-left text-sm">
          <thead className="bg-[#f3f5f7] text-xs uppercase tracking-[0.12em] text-[#65717f]">
            <tr>
              <th className="px-4 py-3 font-semibold">Line</th>
              <th className="px-4 py-3 font-semibold">SKU</th>
              <th className="px-4 py-3 font-semibold">Product</th>
              <th className="px-4 py-3 text-right font-semibold">Qty</th>
              <th className="px-4 py-3 text-right font-semibold">Unit</th>
              <th className="px-4 py-3 text-right font-semibold">Freight/unit</th>
              <th className="px-4 py-3 text-right font-semibold">Landed/unit</th>
              <th className="px-4 py-3 text-right font-semibold">Line amount</th>
              <th className="px-4 py-3 font-semibold">Remark</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#edf1f5]">
            {items.map((item) => (
              <tr key={item.itemUuid ?? `${poId}-${item.lineNo}`}>
                <td className="px-4 py-3 font-mono text-xs">{item.lineNo || "-"}</td>
                <td className="min-w-[170px] px-4 py-3">
                  <input name="itemUuid" type="hidden" value={item.itemUuid ?? ""} />
                  <input className={inputClass} defaultValue={item.sku} name="sku" required />
                </td>
                <td className="min-w-[280px] px-4 py-3">
                  <input
                    className={inputClass}
                    defaultValue={item.productTitle}
                    name="productTitle"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    className={`${inputClass} text-right font-mono`}
                    defaultValue={item.qty}
                    min="0"
                    name="orderedQty"
                    step="0.0001"
                    type="number"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    className={`${inputClass} text-right font-mono`}
                    defaultValue={item.unitPrice}
                    min="0"
                    name="unitPrice"
                    step="0.0001"
                    type="number"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    className={`${inputClass} text-right font-mono`}
                    defaultValue={item.freightUnitCost ?? 0}
                    min="0"
                    name="freightUnitCost"
                    step="0.0001"
                    type="number"
                  />
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {(item.landedUnitCost ?? item.unitPrice + (item.freightUnitCost ?? 0)).toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {item.lineAmount.toFixed(2)} {item.currency}
                </td>
                <td className="min-w-[220px] px-4 py-3">
                  <input className={inputClass} defaultValue={item.remark} name="remark" />
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
