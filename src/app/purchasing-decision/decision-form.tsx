"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { LoadingLabel, type FormServerAction } from "@/app/loading-controls";

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

function formatOneDecimal(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 1,
  }).format(value);
}

function coverageText(value: number | null) {
  return value === null ? "-" : `${formatNumber(Math.floor(value))}d`;
}

function durationUnitText(value: number | null, unit: "m" | "w") {
  return value === null ? "-" : `${formatOneDecimal(value)}${unit}`;
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

function alertLabel(status: string) {
  if (status === "order_now") {
    return "Order now";
  }
  if (status === "watch") {
    return "Watch";
  }
  if (status === "hidden") {
    return "Hidden";
  }
  return "Healthy";
}

function alertClass(status: string) {
  if (status === "order_now") {
    return "bg-[#fff1e8] text-[#9a3412]";
  }
  if (status === "watch") {
    return "bg-[#fff4e5] text-[#946200]";
  }
  if (status === "hidden") {
    return "bg-[#eef0f3] text-[#5c6670]";
  }
  return "bg-[#eaf6ef] text-[#1f6b3d]";
}

export function DecisionSaveButton() {
  const { pending } = useFormStatus();

  return (
    <button
      className="inline-flex h-10 items-center justify-center rounded-md bg-[#172026] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
      disabled={pending}
      type="submit"
    >
      <LoadingLabel loading={pending} loadingText="Saving...">
        Save visible rows
      </LoadingLabel>
    </button>
  );
}

export function DecisionCreatePoButton({
  formAction,
}: {
  formAction: FormServerAction;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      className="inline-flex h-10 items-center justify-center rounded-md bg-[#172026] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
      disabled={pending}
      formAction={formAction}
      type="submit"
    >
      <LoadingLabel loading={pending} loadingText="Creating...">
        Create PO
      </LoadingLabel>
    </button>
  );
}

export function DecisionSearchBox({
  initialValue,
  options,
}: {
  initialValue: string;
  options: { imageUrl: string | null; label: string; skuCount: number }[];
}) {
  const [value, setValue] = useState(initialValue);
  const [open, setOpen] = useState(false);
  const normalizedValue = value.trim().toLowerCase();
  const filteredOptions = options
    .filter((option) => option.label.toLowerCase().includes(normalizedValue))
    .slice(0, 20);

  return (
    <label className="relative grid gap-1">
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#65717f]">
        Search
      </span>
      <input
        autoComplete="new-password"
        autoCorrect="off"
        className="h-9 w-full rounded-md border border-[#cfd6df] bg-white px-2 text-sm text-[#172026] outline-none focus:border-[#255f85]"
        name="q"
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onChange={(event) => {
          setValue(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Main name"
        spellCheck={false}
        value={value}
      />
      {open && filteredOptions.length ? (
        <div className="absolute top-full z-40 mt-1 max-h-80 w-[360px] overflow-y-auto rounded-md border border-[#cfd6df] bg-white p-1 shadow-lg">
          {filteredOptions.map((option) => (
            <button
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-[#f3f5f7]"
              key={option.label}
              onClick={() => {
                setValue(option.label);
                setOpen(false);
              }}
              type="button"
            >
              {option.imageUrl ? (
                <Image
                  alt=""
                  className="size-9 rounded border border-[#dfe4ea] object-cover"
                  height={36}
                  src={option.imageUrl}
                  width={36}
                />
              ) : (
                <span className="grid size-9 place-items-center rounded border border-[#dfe4ea] bg-[#f3f5f7] text-[10px] text-[#7a8794]">
                  SKU
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-[#172026]">
                  {option.label}
                </span>
                <span className="text-xs text-[#7a8794]">
                  {option.skuCount} SKUs
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </label>
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

export function HideSelectionButtons() {
  function setHidden(checked: boolean) {
    document
      .querySelectorAll<HTMLInputElement>("[data-decision-hide='sku']")
      .forEach((input) => {
        input.checked = checked;
      });
  }

  return (
    <div className="grid gap-1">
      <span>Hide</span>
      <div className="flex items-center gap-1 normal-case tracking-normal">
        <button
          className="h-7 rounded-md border border-[#cfd6df] bg-white px-2 text-[11px] font-semibold text-[#364252]"
          onClick={() => setHidden(true)}
          type="button"
        >
          Select all
        </button>
        <button
          className="h-7 rounded-md border border-[#cfd6df] bg-white px-2 text-[11px] font-semibold text-[#667380]"
          onClick={() => setHidden(false)}
          type="button"
        >
          Clear
        </button>
      </div>
    </div>
  );
}

export function DemandFormulaHeaderButton({
  capAtSellingDayAverage,
  lifetimeWeight,
  recentFloorPercent,
  sellingDayWeight,
}: {
  capAtSellingDayAverage: boolean;
  lifetimeWeight: number;
  recentFloorPercent: number;
  sellingDayWeight: number;
}) {
  const [open, setOpen] = useState(false);
  const [life, setLife] = useState(String(lifetimeWeight));
  const [selling, setSelling] = useState(String(sellingDayWeight));
  const [floor, setFloor] = useState(String(recentFloorPercent));
  const [cap, setCap] = useState(capAtSellingDayAverage);
  const [applying, setApplying] = useState(false);

  function applyFormula() {
    setApplying(true);
    const params = new URLSearchParams(window.location.search);
    params.set("lifetimeWeight", life || "35");
    params.set("sellingWeight", selling || "65");
    params.set("recentFloor", floor || "75");
    params.set("capSelling", cap ? "true" : "false");
    window.location.search = params.toString();
  }

  function resetFormula() {
    setLife("35");
    setSelling("65");
    setFloor("75");
    setCap(true);
  }

  return (
    <>
      <button
        className="inline-flex items-center justify-end text-right font-semibold underline decoration-dotted underline-offset-4"
        onClick={() => setOpen(true)}
        type="button"
      >
        Demand HM
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 px-4">
          <div className="w-full max-w-xl rounded-lg border border-[#dfe4ea] bg-white p-5 text-left text-sm normal-case tracking-normal shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-[#172026]">Demand HM Formula</h3>
                <p className="mt-1 text-[#667380]">
                  Weighted demand blends conservative lifetime sales with selling-day demand,
                  then uses recent 30D momentum as a floor.
                </p>
              </div>
              <button
                className="rounded-md border border-[#cfd6df] px-2 py-1 text-xs font-semibold text-[#52606d]"
                onClick={() => setOpen(false)}
                type="button"
              >
                Close
              </button>
            </div>
            <div className="mt-4 grid gap-3 rounded-md bg-[#fbfcfd] p-3 font-mono text-xs text-[#42505c]">
              <p>lifetimeAvg = total sold / days from first sale to last sale</p>
              <p>sellingDayAvg = total sold / days that actually sold</p>
              <p>base = lifetimeAvg x lifetime% + sellingDayAvg x selling-day%</p>
              <p>slow movers reduce selling-day weight by sales reliability</p>
              <p>floor = Demand 30D x recent floor%</p>
              <p>Demand HM = max(base, floor), optionally capped at sellingDayAvg</p>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#64707d]">
                Lifetime %
                <input
                  className="h-10 rounded-md border border-[#cfd6df] px-3 font-mono text-sm"
                  min="0"
                  max="100"
                  onChange={(event) => setLife(event.target.value)}
                  type="number"
                  value={life}
                />
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#64707d]">
                Selling-day %
                <input
                  className="h-10 rounded-md border border-[#cfd6df] px-3 font-mono text-sm"
                  min="0"
                  max="100"
                  onChange={(event) => setSelling(event.target.value)}
                  type="number"
                  value={selling}
                />
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#64707d]">
                30D floor %
                <input
                  className="h-10 rounded-md border border-[#cfd6df] px-3 font-mono text-sm"
                  min="0"
                  max="200"
                  onChange={(event) => setFloor(event.target.value)}
                  type="number"
                  value={floor}
                />
              </label>
            </div>
            <label className="mt-4 flex items-center gap-2 text-sm font-semibold text-[#52606d]">
              <input
                checked={cap}
                className="size-4 accent-[#172026]"
                onChange={(event) => setCap(event.target.checked)}
                type="checkbox"
              />
              Cap Demand HM at selling-day demand
            </label>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <button
                className="h-10 rounded-md border border-[#cfd6df] px-4 text-sm font-semibold text-[#52606d]"
                onClick={resetFormula}
                type="button"
              >
                Reset 35/65
              </button>
              <button
                className="h-10 rounded-md bg-[#172026] px-4 text-sm font-semibold text-white"
                onClick={applyFormula}
                type="button"
              >
                <LoadingLabel loading={applying} loadingText="Applying...">
                  Apply Formula
                </LoadingLabel>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function AlertFilterSelect({
  options,
  selectedAlerts,
}: {
  options: { label: string; value: string }[];
  selectedAlerts: string[];
}) {
  const initialSelection =
    selectedAlerts.length && !selectedAlerts.includes("all")
      ? selectedAlerts
      : options.map((option) => option.value);
  const [selected, setSelected] = useState(initialSelection);
  const allSelected = selected.length === options.length;
  const valuesForSubmit = allSelected ? ["all"] : selected;
  const label = allSelected
    ? "All alerts"
    : options
        .filter((option) => selected.includes(option.value))
        .map((option) => option.label)
        .join(", ") || "No alerts";

  function toggle(value: string) {
    setSelected((current) => {
      if (!current.includes(value)) {
        return [...current, value];
      }
      if (current.length === 1) {
        return current;
      }

      return current.filter((item) => item !== value);
    });
  }

  return (
    <div className="grid gap-1">
      {valuesForSubmit.map((value) => (
        <input key={value} name="alert" type="hidden" value={value} />
      ))}
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#65717f]">
        Alert
      </span>
      <details className="group relative">
        <summary className="flex h-9 cursor-pointer list-none items-center justify-between gap-2 rounded-md border border-[#cfd6df] bg-white px-2 text-sm text-[#172026] outline-none group-open:border-[#255f85]">
          <span className="truncate">{label}</span>
          <span aria-hidden="true" className="text-xs text-[#65717f]">
            v
          </span>
        </summary>
        <div className="absolute right-0 z-30 mt-1 grid w-56 gap-1 rounded-md border border-[#cfd6df] bg-white p-2 shadow-lg">
          <button
            className="rounded-md px-2 py-1 text-left text-xs font-semibold text-[#255f85] hover:bg-[#eef4f8]"
            onClick={() => setSelected(options.map((option) => option.value))}
            type="button"
          >
            Select all
          </button>
          {options.map((option) => (
            <label
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-[#172026] hover:bg-[#f3f5f7]"
              key={option.value}
            >
              <input
                checked={selected.includes(option.value)}
                className="size-4 accent-[#172026]"
                onChange={() => toggle(option.value)}
                type="checkbox"
              />
              {option.label}
            </label>
          ))}
        </div>
      </details>
    </div>
  );
}

export function DecisionPlanningCells({
  calculatedDemandIndexHm,
  comingQty,
  demandIndexOverride,
  firstSaleDate,
  leadTimeDays,
  leadTimeSource,
  lifetimeDailyAverage,
  lastSaleDate,
  orderCycleDays,
  orderQtyMode,
  onHandUnits,
  reorderPointUnits,
  ropAlert,
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
  demandIndexOverride: number | null;
  firstSaleDate: string | null;
  leadTimeDays: number;
  leadTimeSource: "sku" | "supplier" | "default";
  lifetimeDailyAverage: number;
  lastSaleDate: string | null;
  orderCycleDays: number;
  orderQtyMode: "raw" | "rounded";
  onHandUnits: number;
  reorderPointUnits: number;
  ropAlert: "order_now" | "watch" | "healthy" | "hidden";
  safetyDays: number;
  safetySource: "sku" | "supplier" | "default";
  sellingDayAverage: number;
  sellingDays: number;
  sku: string;
  supplierLeadTimeDays: number | null;
  supplierSafetyDays: number | null;
}) {
  const [demand, setDemand] = useState(
    demandIndexOverride === null ? "" : formatDecimal(demandIndexOverride, 4),
  );
  const [acceptedDemandOverride, setAcceptedDemandOverride] = useState(
    demandIndexOverride !== null,
  );
  const [safety, setSafety] = useState(String(safetyDays));
  const [lead, setLead] = useState(String(leadTimeDays));
  const [cycle, setCycle] = useState(String(orderCycleDays));
  const liveDemand = demand ? numberOrZero(demand) : calculatedDemandIndexHm;
  const liveReorderPoint = useMemo(() => {
    const nextValue = Math.ceil(liveDemand * (numberOrZero(safety) + numberOrZero(lead)));
    return Number.isFinite(nextValue) ? Math.max(0, nextValue) : reorderPointUnits;
  }, [lead, liveDemand, reorderPointUnits, safety]);
  const liveRawQty = useMemo(() => {
    const nextValue = Math.ceil(
      liveDemand *
        (numberOrZero(safety) + numberOrZero(lead) + numberOrZero(cycle)),
    );
    return Number.isFinite(nextValue) ? Math.max(0, nextValue) : 0;
  }, [cycle, lead, liveDemand, safety]);
  const netRawQty = Math.max(0, liveRawQty - comingQty);
  const netRoundedQty = roundUpToTen(netRawQty);
  const [selectedMode, setSelectedMode] = useState<"raw" | "rounded">(orderQtyMode);
  const [manualOrderQty, setManualOrderQty] = useState<string | null>(null);
  const computedOrderQty = String(
    selectedMode === "raw" ? netRawQty : netRoundedQty,
  );
  const orderQty = manualOrderQty ?? computedOrderQty;
  const orderQtyNumber = numberOrZero(orderQty);
  const coverDays = liveDemand > 0 ? onHandUnits / liveDemand : null;
  const coverWeeks = coverDays === null ? null : coverDays / 7;
  const coverMonths = coverDays === null ? null : coverDays / 30;
  const atOrderCoverageDays =
    liveDemand > 0 ? (comingQty + orderQtyNumber) / liveDemand : null;

  function chooseMode(mode: "raw" | "rounded") {
    setSelectedMode(mode);
    setManualOrderQty(null);
  }

  return (
    <>
      <td className="px-3 py-3 align-top">
        <input
          name="calculatedDemandIndexHm"
          type="hidden"
          value={formatDecimal(calculatedDemandIndexHm, 4)}
        />
        <input
          name="demandOverrideAccepted"
          type="hidden"
          value={acceptedDemandOverride && demand ? "true" : "false"}
        />
        <input
          className={compactInputClass}
          min="0"
          name="demandIndexHm"
          onChange={(event) => {
            setDemand(event.target.value);
            setAcceptedDemandOverride(Boolean(event.target.value));
          }}
          placeholder={formatDecimal(calculatedDemandIndexHm, 4)}
          step="0.0001"
          title={`Calculated ${formatDecimal(calculatedDemandIndexHm, 4)} from ${firstSaleDate ?? "-"} to ${lastSaleDate ?? "-"} plus ${sellingDays} selling days`}
          type="number"
          value={demand}
        />
        <button
          className="mt-1 w-full rounded border border-[#cfd6df] px-1 py-0.5 text-[10px] font-semibold text-[#52606d]"
          onClick={() => {
            setDemand(formatDecimal(calculatedDemandIndexHm, 4));
            setAcceptedDemandOverride(true);
          }}
          type="button"
        >
          Fill calc {formatDecimal(calculatedDemandIndexHm, 2)}
        </button>
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
        <input name="orderQtyMode" type="hidden" value={selectedMode} />
        <input
          name="poRawQty"
          type="hidden"
          value={netRawQty}
        />
        <input
          name="poRoundedQty"
          type="hidden"
          value={orderQty}
        />
        <div className="grid gap-1 text-xs text-[#52606d]">
          <label className="flex items-center gap-2">
            <input
              checked={selectedMode === "raw"}
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
      <td className="px-3 py-3 text-right align-top font-mono text-sm text-[#172026]">
        {coverageText(coverDays)}
      </td>
      <td className="px-3 py-3 text-right align-top font-mono text-sm text-[#172026]">
        {durationUnitText(coverWeeks, "w")}
      </td>
      <td className="px-3 py-3 text-right align-top font-mono text-sm text-[#172026]">
        {durationUnitText(coverMonths, "m")}
      </td>
      <td className="px-3 py-3 align-top">
        <span
          className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${alertClass(
            ropAlert,
          )}`}
        >
          {alertLabel(ropAlert)}
        </span>
      </td>
      <td className="px-3 py-3 text-right align-top font-mono text-sm text-[#172026]">
        <p>{coverageText(atOrderCoverageDays)}</p>
        <p className="mt-1 text-[10px] text-[#7a8794]">
          coming {formatNumber(comingQty)} + order {formatNumber(orderQtyNumber)}
        </p>
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
