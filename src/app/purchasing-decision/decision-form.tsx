"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

const compactInputClass =
  "h-9 w-20 rounded-md border border-[#cfd6df] bg-white px-2 text-right font-mono text-sm text-[#172026] outline-none focus:border-[#255f85]";

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(value);
}

function formatDecimal(value: number, digits = 2) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

function numberOrZero(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function roundUpToTen(value: number) {
  if (value <= 0) {
    return 0;
  }

  return Math.ceil(value / 10) * 10;
}

export function DecisionSaveButton() {
  const { pending } = useFormStatus();

  return (
    <button
      className="inline-flex h-10 items-center justify-center rounded-md bg-[#172026] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
      disabled={pending}
      type="submit"
    >
      {pending ? "Saving..." : "Save visible rows"}
    </button>
  );
}

export function DecisionCreatePoButton() {
  const { pending } = useFormStatus();

  return (
    <button
      className="inline-flex h-10 items-center justify-center rounded-md bg-[#172026] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
      disabled={pending}
      form="decision-create-po-form"
      type="submit"
    >
      {pending ? "Creating..." : "Create PO"}
    </button>
  );
}

export function SelectionButtons() {
  function setSelection(checked: boolean) {
    document
      .querySelectorAll<HTMLInputElement>("[data-decision-select='sku']")
      .forEach((input) => {
        input.checked = checked;
      });
  }

  return (
    <div className="flex items-center gap-2">
      <button
        className="h-10 rounded-md border border-[#cfd6df] bg-white px-3 text-xs font-semibold text-[#364252]"
        onClick={() => setSelection(true)}
        type="button"
      >
        Select all
      </button>
      <button
        className="h-10 rounded-md border border-[#cfd6df] bg-white px-3 text-xs font-semibold text-[#667380]"
        onClick={() => setSelection(false)}
        type="button"
      >
        Clear
      </button>
    </div>
  );
}

export function DecisionPlanningCells({
  calculatedDemandIndexHm,
  comingQty,
  demandIndexHm,
  firstSaleDate,
  leadTimeDays,
  leadTimeSource,
  lifetimeDailyAverage,
  lastSaleDate,
  orderCycleDays,
  reorderPointUnits,
  safetyDays,
  safetySource,
  sellingDayAverage,
  sellingDays,
  sku,
  supplierLeadTimeDays,
  supplierSafetyDays,
}: {
  calculatedDemandIndexHm: number;
  comingQty: number;
  demandIndexHm: number;
  firstSaleDate: string | null;
  leadTimeDays: number;
  leadTimeSource: "sku" | "supplier" | "default";
  lifetimeDailyAverage: number;
  lastSaleDate: string | null;
  orderCycleDays: number;
  reorderPointUnits: number;
  safetyDays: number;
  safetySource: "sku" | "supplier" | "default";
  sellingDayAverage: number;
  sellingDays: number;
  sku: string;
  supplierLeadTimeDays: number | null;
  supplierSafetyDays: number | null;
}) {
  const [demand, setDemand] = useState(formatDecimal(demandIndexHm, 4));
  const [safety, setSafety] = useState(String(safetyDays));
  const [lead, setLead] = useState(String(leadTimeDays));
  const [cycle, setCycle] = useState(String(orderCycleDays));
  const liveReorderPoint = useMemo(() => {
    const nextValue = Math.ceil(numberOrZero(demand) * (numberOrZero(safety) + numberOrZero(lead)));
    return Number.isFinite(nextValue) ? Math.max(0, nextValue) : reorderPointUnits;
  }, [demand, lead, reorderPointUnits, safety]);
  const liveRawQty = useMemo(() => {
    const nextValue = Math.ceil(
      numberOrZero(demand) *
        (numberOrZero(safety) + numberOrZero(lead) + numberOrZero(cycle)),
    );
    return Number.isFinite(nextValue) ? Math.max(0, nextValue) : 0;
  }, [cycle, demand, lead, safety]);
  const netRawQty = Math.max(0, liveRawQty - comingQty);
  const netRoundedQty = roundUpToTen(netRawQty);
  const [selectedMode, setSelectedMode] = useState<"raw" | "rounded">("rounded");
  const [manualOrderQty, setManualOrderQty] = useState<string | null>(null);
  const computedOrderQty = String(
    selectedMode === "raw" ? netRawQty : netRoundedQty,
  );
  const orderQty = manualOrderQty ?? computedOrderQty;

  function chooseMode(mode: "raw" | "rounded") {
    setSelectedMode(mode);
    setManualOrderQty(null);
  }

  return (
    <>
      <td className="px-3 py-3 align-top">
        <input
          className={compactInputClass}
          min="0"
          name="demandIndexHm"
          onChange={(event) => setDemand(event.target.value)}
          step="0.0001"
          title={`Calculated ${formatDecimal(calculatedDemandIndexHm, 4)} from ${firstSaleDate ?? "-"} to ${lastSaleDate ?? "-"} plus ${sellingDays} selling days`}
          type="number"
          value={demand}
        />
        <p className="mt-1 text-right font-mono text-[10px] text-[#7a8794]">
          calc {formatDecimal(calculatedDemandIndexHm, 2)}
        </p>
        <p className="mt-1 text-right font-mono text-[10px] text-[#7a8794]">
          {formatDecimal(lifetimeDailyAverage, 2)} / {formatDecimal(sellingDayAverage, 2)}
        </p>
      </td>
      <td className="px-3 py-3 align-top">
        <input name="safetySource" type="hidden" value={safetySource} />
        <input name="originalSafetyDays" type="hidden" value={safetyDays} />
        <input
          name="supplierSafetyDays"
          type="hidden"
          value={supplierSafetyDays ?? ""}
        />
        <input
          className={compactInputClass}
          min="0"
          name="safetyDays"
          onChange={(event) => setSafety(event.target.value)}
          type="number"
          value={safety}
        />
        <p className="mt-1 text-right font-mono text-[10px] text-[#7a8794]">
          {safetySource === "sku" && supplierSafetyDays !== null
            ? `sku / sup ${supplierSafetyDays}`
            : safetySource === "supplier" && supplierSafetyDays !== null
            ? `sup ${supplierSafetyDays}`
            : safetySource}
        </p>
      </td>
      <td className="px-3 py-3 align-top">
        <input name="leadTimeSource" type="hidden" value={leadTimeSource} />
        <input name="originalLeadTimeDays" type="hidden" value={leadTimeDays} />
        <input
          name="supplierLeadTimeDays"
          type="hidden"
          value={supplierLeadTimeDays ?? ""}
        />
        <input
          className={compactInputClass}
          min="0"
          name="leadTimeDays"
          onChange={(event) => setLead(event.target.value)}
          type="number"
          value={lead}
        />
        <p className="mt-1 text-right font-mono text-[10px] text-[#7a8794]">
          {leadTimeSource === "sku" && supplierLeadTimeDays !== null
            ? `sku / sup ${supplierLeadTimeDays}`
            : leadTimeSource === "supplier" && supplierLeadTimeDays !== null
            ? `sup ${supplierLeadTimeDays}`
            : leadTimeSource}
        </p>
      </td>
      <td className="px-3 py-3 align-top">
        <input
          className={compactInputClass}
          min="0"
          name="orderCycleDays"
          onChange={(event) => setCycle(event.target.value)}
          type="number"
          value={cycle}
        />
      </td>
      <td className="px-3 py-3 text-right align-top font-mono text-sm font-semibold text-[#172026]">
        <p>{formatNumber(liveReorderPoint)}</p>
        <p className="mt-1 text-[10px] font-medium text-[#7a8794]">
          (Safety + Lead) x HM
        </p>
      </td>
      <td className="px-3 py-3 text-right align-top font-mono text-sm text-[#172026]">
        <p>{formatNumber(netRawQty)}</p>
        {comingQty > 0 ? (
          <p className="mt-1 text-[10px] text-[#946200]">
            {formatNumber(liveRawQty)} - coming {formatNumber(comingQty)}
          </p>
        ) : null}
      </td>
      <td className="px-3 py-3 align-top text-right">
        <input
          className={compactInputClass}
          min="0"
          name="manualRopUnits"
          onChange={(event) => setManualOrderQty(event.target.value)}
          placeholder={String(netRoundedQty)}
          type="number"
          value={orderQty}
        />
      </td>
      <td className="px-3 py-3 align-top">
        <input
          form="decision-create-po-form"
          name="poRawQty"
          type="hidden"
          value={netRawQty}
        />
        <input
          form="decision-create-po-form"
          name="poRoundedQty"
          type="hidden"
          value={orderQty}
        />
        <div className="grid gap-1 text-xs text-[#52606d]">
          <label className="flex items-center gap-2">
            <input
              checked={selectedMode === "raw"}
              form="decision-create-po-form"
              name={`qtyChoice:${sku}`}
              onClick={() => chooseMode("raw")}
              onChange={() => chooseMode("raw")}
              type="radio"
              value="raw"
            />
            Raw
          </label>
          <label className="flex items-center gap-2">
            <input
              checked={selectedMode === "rounded"}
              form="decision-create-po-form"
              name={`qtyChoice:${sku}`}
              onClick={() => chooseMode("rounded")}
              onChange={() => chooseMode("rounded")}
              type="radio"
              value="rounded"
            />
            Round 10
          </label>
        </div>
      </td>
    </>
  );
}

const tagSelectClass =
  "h-8 w-full rounded-md border border-[#cfd6df] bg-white px-2 text-xs text-[#172026] outline-none focus:border-[#255f85]";

export function TagDropdownSelect({
  initialTags,
  options,
}: {
  initialTags: string[];
  options: string[];
}) {
  const [selected, setSelected] = useState(
    initialTags.find((tag) => options.includes(tag)) ?? "",
  );

  return (
    <div className="min-w-[190px]">
      <input name="tags" type="hidden" value={selected} />
      <select
        className={tagSelectClass}
        onChange={(event) => setSelected(event.target.value)}
        value={selected}
      >
        <option value="">Select tag</option>
        {options.map((tag) => (
          <option key={tag} value={tag}>
            {tag}
          </option>
        ))}
      </select>
    </div>
  );
}
