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
  demandIndexHm,
  leadTimeDays,
  leadTimeSource,
  orderCycleDays,
  reorderPointUnits,
  safetyDays,
  safetySource,
  supplierLeadTimeDays,
  supplierSafetyDays,
}: {
  calculatedDemandIndexHm: number;
  demandIndexHm: number;
  leadTimeDays: number;
  leadTimeSource: "sku" | "supplier" | "default";
  orderCycleDays: number;
  reorderPointUnits: number;
  safetyDays: number;
  safetySource: "sku" | "supplier" | "default";
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

  return (
    <>
      <td className="px-3 py-3 align-top">
        <input
          className={compactInputClass}
          min="0"
          name="demandIndexHm"
          onChange={(event) => setDemand(event.target.value)}
          step="0.0001"
          title={`Calculated ${formatDecimal(calculatedDemandIndexHm, 4)}`}
          type="number"
          value={demand}
        />
        <p className="mt-1 text-right font-mono text-[10px] text-[#7a8794]">
          calc {formatDecimal(calculatedDemandIndexHm, 2)}
        </p>
      </td>
      <td className="px-3 py-3 align-top">
        <input name="safetySource" type="hidden" value={safetySource} />
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
          {safetySource === "supplier" && supplierSafetyDays !== null
            ? `sup ${supplierSafetyDays}`
            : safetySource}
        </p>
      </td>
      <td className="px-3 py-3 align-top">
        <input name="leadTimeSource" type="hidden" value={leadTimeSource} />
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
          {leadTimeSource === "supplier" && supplierLeadTimeDays !== null
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
    </>
  );
}

export function TagMultiSelect({
  initialTags,
  options,
}: {
  initialTags: string[];
  options: string[];
}) {
  const [selected, setSelected] = useState(
    initialTags.filter((tag) => options.includes(tag)),
  );

  function toggle(tag: string) {
    setSelected((current) =>
      current.includes(tag)
        ? current.filter((item) => item !== tag)
        : [...current, tag],
    );
  }

  return (
    <div className="grid gap-2">
      <input name="tags" type="hidden" value={selected.join(", ")} />
      <div className="flex max-h-24 min-w-[260px] flex-wrap gap-1 overflow-auto rounded-md border border-[#cfd6df] bg-white p-2">
        {options.map((tag) => {
          const active = selected.includes(tag);
          return (
            <button
              className={`rounded-md border px-2 py-1 text-xs font-semibold ${
                active
                  ? "border-[#172026] bg-[#172026] text-white"
                  : "border-[#dfe4ea] bg-[#fbfcfd] text-[#52606d]"
              }`}
              key={tag}
              onClick={() => toggle(tag)}
              type="button"
            >
              {tag}
            </button>
          );
        })}
      </div>
    </div>
  );
}
