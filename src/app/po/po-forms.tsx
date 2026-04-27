"use client";

import { useActionState } from "react";
import {
  addPoItemAction,
  batchReceivePoItemsAction,
  changePoStatusAction,
  createPoAction,
  receivePoItemAction,
  type PoActionState,
} from "@/app/po/actions";

type SupplierOption = {
  supplierCode: string;
  supplierName: string;
  currency: string;
  paymentTerms: string;
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
  suppliers,
  today,
}: {
  suppliers: SupplierOption[];
  today: string;
}) {
  const [state, formAction, pending] = useActionState(createPoAction, initialState);

  return (
    <form action={formAction} className="grid gap-4">
      <div className="grid gap-3 lg:grid-cols-4">
        <label className={labelClass}>
          PO ID
          <input className={inputClass} name="poId" placeholder="auto if blank" />
        </label>
        <label className={labelClass}>
          PO Date
          <input className={inputClass} defaultValue={today} name="poDate" type="date" />
        </label>
        <label className={labelClass}>
          Supplier
          <select className={inputClass} name="supplierCode" required>
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

      <div className="grid gap-3 lg:grid-cols-[1fr_1fr_0.7fr_0.7fr_0.7fr]">
        <label className={labelClass}>
          SKU
          <input className={inputClass} name="sku" required />
        </label>
        <label className={labelClass}>
          Product
          <input className={inputClass} name="productTitle" />
        </label>
        <label className={labelClass}>
          Qty
          <input className={inputClass} min="0.0001" name="orderedQty" required step="0.0001" type="number" />
        </label>
        <label className={labelClass}>
          Price
          <input className={inputClass} min="0" name="unitPrice" step="0.0001" type="number" />
        </label>
        <label className={labelClass}>
          Currency
          <input className={inputClass} defaultValue="THB" name="currency" />
        </label>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
        <label className={labelClass}>
          Remark
          <input className={inputClass} name="remark" />
        </label>
        <button className={buttonClass} disabled={pending} type="submit">
          {pending ? "Creating..." : "Open PO"}
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
      <div className="grid gap-2 md:grid-cols-[1fr_1fr_0.65fr_0.65fr_auto]">
        <input className={inputClass} name="sku" placeholder="SKU" required />
        <input className={inputClass} name="productTitle" placeholder="Product" />
        <input className={inputClass} min="0.0001" name="orderedQty" placeholder="Qty" required step="0.0001" type="number" />
        <input className={inputClass} min="0" name="unitPrice" placeholder="Price" step="0.0001" type="number" />
        <button className={buttonClass} disabled={pending} type="submit">
          Add line
        </button>
      </div>
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
  if (!itemUuid) {
    return <span className="text-xs text-[#8a96a3]">Import-only line</span>;
  }

  return (
    <div className="flex min-w-[160px] items-center gap-2">
      <input form={formId} name="batchItemUuid" type="hidden" value={itemUuid} />
      <input
        className={inputClass}
        defaultValue={outstandingQty > 0 ? outstandingQty : ""}
        form={formId}
        max={outstandingQty}
        min="0"
        name="batchReceivedQty"
        step="0.0001"
        type="number"
      />
    </div>
  );
}
