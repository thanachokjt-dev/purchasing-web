"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { LoadingLabel, type FormServerAction } from "@/app/loading-controls";

const compactInputClass =
  "h-9 w-20 rounded-md border border-[#cfd6df] bg-white px-2 text-right font-mono text-sm text-[#172026] outline-none focus:border-[#255f85]";
const fillDemandEvent = "purchasing-decision:fill-demand-calc";
const qtyModeEvent = "purchasing-decision:set-qty-mode";

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

function stockAlertLabel(status: string) {
  if (status === "dead_stock") {
    return "Dead stock";
  }
  if (status === "heavy_overstock") {
    return "Heavy over";
  }
  if (status === "overstock") {
    return "Overstock";
  }
  if (status === "under_target") {
    return "Under target";
  }
  if (status === "hidden") {
    return "Hidden";
  }

  return "Healthy";
}

function stockAlertClass(status: string) {
  if (status === "dead_stock") {
    return "bg-[#f8e8e8] text-[#9f2323]";
  }
  if (status === "heavy_overstock") {
    return "bg-[#fff1e8] text-[#9a3412]";
  }
  if (status === "overstock") {
    return "bg-[#fff4e5] text-[#946200]";
  }
  if (status === "under_target") {
    return "bg-[#e9f1fb] text-[#255f85]";
  }
  if (status === "hidden") {
    return "bg-[#eef0f3] text-[#5c6670]";
  }

  return "bg-[#eaf6ef] text-[#1f6b3d]";
}

function stockAlertStatus({
  demand,
  hidden,
  overstockDays,
  overstockUnits,
  stockPosition,
  targetQty,
}: {
  demand: number;
  hidden: boolean;
  overstockDays: number | null;
  overstockUnits: number;
  stockPosition: number;
  targetQty: number;
}) {
  if (hidden) {
    return "hidden";
  }
  if (demand <= 0 && stockPosition > 0) {
    return "dead_stock";
  }
  if (stockPosition <= targetQty) {
    return "under_target";
  }
  if (
    (overstockDays !== null && overstockDays >= 90) ||
    (targetQty > 0 && overstockUnits >= targetQty)
  ) {
    return "heavy_overstock";
  }
  if (
    (overstockDays !== null && overstockDays >= 30) ||
    overstockUnits >= Math.max(10, targetQty * 0.25)
  ) {
    return "overstock";
  }

  return "healthy";
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
  const initialSelections = initialValue
    .split(",")
    .map((item) => item.trim())
    .filter((item) =>
      options.some((option) => option.label.toLowerCase() === item.toLowerCase()),
    );
  const [selected, setSelected] = useState<string[]>(initialSelections);
  const [value, setValue] = useState(initialSelections.length ? "" : initialValue);
  const [open, setOpen] = useState(false);
  const normalizedValue = value.trim().toLowerCase();
  const filteredOptions = options
    .filter(
      (option) =>
        option.label.toLowerCase().includes(normalizedValue) &&
        !selected.some((item) => item.toLowerCase() === option.label.toLowerCase()),
    )
    .slice(0, 20);
  const submitValue = selected.length ? selected.join(",") : value;

  function addSelection(label: string) {
    setSelected((current) =>
      current.some((item) => item.toLowerCase() === label.toLowerCase())
        ? current
        : [...current, label],
    );
    setValue("");
    setOpen(false);
  }

  return (
    <label className="relative z-[90] grid gap-1">
      <input name="q" type="hidden" value={submitValue} />
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#65717f]">
        Search
      </span>
      {selected.length ? (
        <div className="flex max-w-[360px] flex-wrap gap-1">
          {selected.map((label) => (
            <span
              className="inline-flex max-w-full items-center gap-1 rounded-md bg-[#eef4f8] px-2 py-1 text-xs font-semibold text-[#255f85]"
              key={label}
            >
              <span className="truncate">{label}</span>
              <button
                aria-label={`Remove ${label}`}
                className="text-[#52606d]"
                onClick={() =>
                  setSelected((current) => current.filter((item) => item !== label))
                }
                type="button"
              >
                x
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <input
        autoComplete="new-password"
        autoCorrect="off"
        className="h-9 w-full rounded-md border border-[#cfd6df] bg-white px-2 text-sm text-[#172026] outline-none focus:border-[#255f85]"
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
        <div className="absolute top-full z-[100] mt-1 max-h-80 w-[360px] overflow-y-auto rounded-md border border-[#cfd6df] bg-white p-1 shadow-xl">
          {filteredOptions.map((option) => (
            <button
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-[#f3f5f7]"
              key={option.label}
              onClick={() => addSelection(option.label)}
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

export function DemandHmHeaderControls({
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
  return (
    <div className="grid justify-items-end gap-1">
      <DemandFormulaHeaderButton
        capAtSellingDayAverage={capAtSellingDayAverage}
        lifetimeWeight={lifetimeWeight}
        recentFloorPercent={recentFloorPercent}
        sellingDayWeight={sellingDayWeight}
      />
      <button
        className="rounded border border-[#cfd6df] bg-white px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-[#255f85]"
        onClick={() => window.dispatchEvent(new Event(fillDemandEvent))}
        title="Fill calculated Demand HM for every visible row"
        type="button"
      >
        Fill all calc
      </button>
    </div>
  );
}

export function OrderQtyModeHeaderButtons() {
  function setMode(mode: "raw" | "rounded") {
    window.dispatchEvent(
      new CustomEvent(qtyModeEvent, {
        detail: { mode },
      }),
    );
  }

  return (
    <div className="grid gap-1">
      <span>Use</span>
      <div className="flex items-center gap-1 normal-case tracking-normal">
        <button
          className="h-7 rounded-md border border-[#cfd6df] bg-white px-2 text-[11px] font-semibold text-[#364252]"
          onClick={() => setMode("raw")}
          title="Use Order Qty for every visible row"
          type="button"
        >
          Order Qty
        </button>
        <button
          className="h-7 rounded-md border border-[#cfd6df] bg-white px-2 text-[11px] font-semibold text-[#364252]"
          onClick={() => setMode("rounded")}
          title="Use Round 10 for every visible row"
          type="button"
        >
          Round 10
        </button>
      </div>
    </div>
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
      <details className="group relative z-[90]">
        <summary className="flex h-9 cursor-pointer list-none items-center justify-between gap-2 rounded-md border border-[#cfd6df] bg-white px-2 text-sm text-[#172026] outline-none group-open:border-[#255f85]">
          <span className="truncate">{label}</span>
          <span aria-hidden="true" className="text-xs text-[#65717f]">
            v
          </span>
        </summary>
        <div className="absolute right-0 z-[110] mt-1 grid w-56 gap-1 rounded-md border border-[#cfd6df] bg-white p-2 shadow-xl">
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

export function StockFilterSelect({
  options,
  selectedStock,
}: {
  options: { label: string; value: string }[];
  selectedStock: string[];
}) {
  const initialSelection =
    selectedStock.length && !selectedStock.includes("all")
      ? selectedStock
      : options.map((option) => option.value);
  const [selected, setSelected] = useState(initialSelection);
  const allSelected = selected.length === options.length;
  const valuesForSubmit = allSelected ? ["all"] : selected;
  const label = allSelected
    ? "All stock"
    : options
        .filter((option) => selected.includes(option.value))
        .map((option) => option.label)
        .join(", ") || "No stock";

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
        <input key={value} name="stock" type="hidden" value={value} />
      ))}
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#65717f]">
        Stock
      </span>
      <details className="group relative z-[90]">
        <summary className="flex h-9 cursor-pointer list-none items-center justify-between gap-2 rounded-md border border-[#cfd6df] bg-white px-2 text-sm text-[#172026] outline-none group-open:border-[#255f85]">
          <span className="truncate">{label}</span>
          <span aria-hidden="true" className="text-xs text-[#65717f]">
            v
          </span>
        </summary>
        <div className="absolute right-0 z-[110] mt-1 grid w-56 gap-1 rounded-md border border-[#cfd6df] bg-white p-2 shadow-xl">
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
  manualRopUnits,
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
  manualRopUnits: number | null;
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
  useEffect(() => {
    function fillCalculatedDemand() {
      setDemand(formatDecimal(calculatedDemandIndexHm, 4));
      setAcceptedDemandOverride(true);
    }

    window.addEventListener(fillDemandEvent, fillCalculatedDemand);
    return () => window.removeEventListener(fillDemandEvent, fillCalculatedDemand);
  }, [calculatedDemandIndexHm]);
  const liveDemand = demand ? numberOrZero(demand) : calculatedDemandIndexHm;
  const liveReorderPoint = useMemo(() => {
    const nextValue = Math.ceil(liveDemand * (numberOrZero(safety) + numberOrZero(lead)));
    return Number.isFinite(nextValue) ? Math.max(0, nextValue) : reorderPointUnits;
  }, [lead, liveDemand, reorderPointUnits, safety]);
  const liveTargetQty = useMemo(() => {
    const nextValue = Math.ceil(
      liveDemand *
        (numberOrZero(safety) + numberOrZero(lead) + numberOrZero(cycle)),
    );
    return Number.isFinite(nextValue) ? Math.max(0, nextValue) : 0;
  }, [cycle, lead, liveDemand, safety]);
  const orderQtyRaw = Math.max(0, liveTargetQty - onHandUnits - comingQty);
  const orderQtyRounded = roundUpToTen(orderQtyRaw);
  const [selectedMode, setSelectedMode] = useState<"raw" | "rounded">(orderQtyMode);
  const [manualOrderQty, setManualOrderQty] = useState(
    manualRopUnits === null ? "" : String(manualRopUnits),
  );
  useEffect(() => {
    function setBatchQtyMode(event: Event) {
      const mode = (event as CustomEvent<{ mode?: string }>).detail?.mode;
      if (mode === "raw" || mode === "rounded") {
        setSelectedMode(mode);
        setManualOrderQty("");
      }
    }

    window.addEventListener(qtyModeEvent, setBatchQtyMode);
    return () => window.removeEventListener(qtyModeEvent, setBatchQtyMode);
  }, []);
  const computedOrderQty = String(
    selectedMode === "raw" ? orderQtyRaw : orderQtyRounded,
  );
  // Keep computed recommendation display separate from the manual override field.
  // Blank manual input means the row should continue recalculating naturally.
  const hasManualOrderQty = manualOrderQty.trim() !== "";
  const orderQty = hasManualOrderQty ? manualOrderQty : computedOrderQty;
  const orderQtyNumber = numberOrZero(orderQty);
  const coverDays = liveDemand > 0 ? onHandUnits / liveDemand : null;
  const coverWeeks = coverDays === null ? null : coverDays / 7;
  const coverMonths = coverDays === null ? null : coverDays / 30;
  const livePlanningDays = numberOrZero(safety) + numberOrZero(lead) + numberOrZero(cycle);
  const stockPosition = onHandUnits + comingQty;
  const liveOverstockQty = Math.max(0, stockPosition - liveTargetQty);
  const liveOverstockDays =
    liveDemand > 0 ? Math.max(0, stockPosition / liveDemand - livePlanningDays) : null;
  const liveStockAlert = stockAlertStatus({
    demand: liveDemand,
    hidden: ropAlert === "hidden",
    overstockDays: liveOverstockDays,
    overstockUnits: liveOverstockQty,
    stockPosition,
    targetQty: liveTargetQty,
  });
  const atOrderCoverageDays =
    liveDemand > 0 ? (comingQty + orderQtyNumber) / liveDemand : null;

  function chooseMode(mode: "raw" | "rounded") {
    setSelectedMode(mode);
    setManualOrderQty("");
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
        <p>{formatNumber(liveTargetQty)}</p>
        <p className="mt-1 text-[10px] text-[#7a8794]">
          target coverage qty
        </p>
      </td>
      <td className="px-3 py-3 text-right align-top font-mono text-sm text-[#172026]">
        <p>{formatNumber(orderQtyRaw)}</p>
        <p className="mt-1 text-[10px] text-[#946200]">
          {formatNumber(liveTargetQty)} - stock {formatNumber(onHandUnits)} - incoming {formatNumber(comingQty)}
        </p>
      </td>
      <td className="px-3 py-3 align-top text-right">
        <input
          name="manualRopUnitsIntent"
          type="hidden"
          value={hasManualOrderQty ? "manual" : "computed"}
        />
        <input
          className={compactInputClass}
          min="0"
          name="manualRopUnits"
          onChange={(event) => setManualOrderQty(event.target.value)}
          placeholder={computedOrderQty}
          type="number"
          value={manualOrderQty}
        />
        <p className="mt-1 text-right font-mono text-[10px] text-[#7a8794]">
          calc {formatNumber(numberOrZero(computedOrderQty))}
        </p>
        {hasManualOrderQty ? (
          <button
            className="mt-1 w-full rounded border border-[#cfd6df] px-1 py-0.5 text-[10px] font-semibold text-[#52606d]"
            onClick={() => setManualOrderQty("")}
            type="button"
          >
            Clear manual
          </button>
        ) : null}
      </td>
      <td className="px-3 py-3 align-top">
        <input name="orderQtyMode" type="hidden" value={selectedMode} />
        <input
          name="poRawQty"
          type="hidden"
          value={orderQtyRaw}
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
            Order Qty
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
      <td className="px-3 py-3 align-top">
        <span
          className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${stockAlertClass(
            liveStockAlert,
          )}`}
        >
          {stockAlertLabel(liveStockAlert)}
        </span>
        <p className="mt-1 font-mono text-[10px] text-[#7a8794]">
          stock {formatNumber(stockPosition)}
        </p>
      </td>
      <td className="px-3 py-3 text-right align-top font-mono text-sm text-[#172026]">
        {formatNumber(liveOverstockQty)}
      </td>
      <td className="px-3 py-3 text-right align-top font-mono text-sm text-[#172026]">
        {coverageText(liveOverstockDays)}
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
  const selectableOptions = Array.from(new Set([...initialTags, ...options])).filter(Boolean);
  const [selected, setSelected] = useState(
    initialTags.find((tag) => selectableOptions.includes(tag)) ?? "",
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
        {selectableOptions.map((tag) => (
          <option key={tag} value={tag}>
            {tag}
          </option>
        ))}
      </select>
    </div>
  );
}
