import Link from "next/link";
import { redirect } from "next/navigation";
import { Fragment } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BadgeDollarSign,
  ClipboardList,
  Database,
  Download,
  FileText,
  Printer,
  Search,
} from "lucide-react";
import { saveCostPriceOverridesAction } from "@/app/cost-price-monitor/actions";
import {
  ManualOverrideForm,
  RowOverrideSubmitButton,
} from "@/app/cost-price-monitor/manual-override-form";
import {
  CostPriceMonitorSelectionProvider,
  EstimatedLandCostInput,
  RowSelectionCheckbox,
  SelectAllRowsCheckbox,
  SelectedRowsSummary,
  SelectionActionLink,
} from "@/app/cost-price-monitor/selection-controls";
import { PoSidebarNav } from "@/app/po/sidebar-nav";
import { requireUser } from "@/lib/auth";
import {
  AVG_PURCHASE_COST_CUTOFF_DATE,
  FIXED_LANDCOST_ESTIMATE,
  getCostPriceMonitorData,
  LOW_MARGIN_CRITICAL_PCT,
  LOW_MARGIN_WARNING_PCT,
  type CostPriceMonitorRow,
} from "@/lib/cost-price-monitor";
import { canAccessCostPriceMonitor, defaultLandingForUser } from "@/lib/role-nav";

export const dynamic = "force-dynamic";

type PageSearchParams = {
  category?: string;
  direction?: string;
  group?: string;
  lowMarginOnly?: string;
  missingCostOnly?: string;
  overrideError?: string;
  overrideSaved?: string;
  page?: string;
  poStatus?: string;
  q?: string;
  sort?: string;
  supplier?: string | string[];
  visibility?: string;
};

const inputClass =
  "h-10 w-full rounded-md border border-[#cfd6df] bg-white px-3 text-sm text-[#172026] outline-none focus:border-[#255f85]";
const smallInputClass =
  "h-8 w-full rounded-md border border-[#cfd6df] bg-white px-2 text-xs text-[#172026] outline-none focus:border-[#255f85]";
const labelClass = "grid gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#64707d]";
const buttonClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#172026] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButtonClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#cfd6df] bg-white px-4 text-sm font-semibold text-[#364252]";

function numberValue(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

function qtyValue(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function moneyValue(value: number) {
  return value > 0 ? numberValue(value) : "0";
}

function averagePurchaseSourceLabel(source: CostPriceMonitorRow["averagePurchasePriceSource"]) {
  if (source === "manual") {
    return "Manual override";
  }
  if (source === "recent_avg") {
    return "Recent avg";
  }
  if (source === "latest_fallback") {
    return "Latest cost fallback";
  }
  return "Missing recent cost";
}

function rollupModeLabel(mode: CostPriceMonitorRow["rollupMode"]) {
  return mode === "stock_weighted" ? "Weighted" : "No stock fallback";
}

function variantCostSourceLabel(source: CostPriceMonitorRow["skuDetails"][number]["effectivePurchasePriceSource"]) {
  if (source === "manual") {
    return "Manual override";
  }
  if (source === "recent_avg") {
    return "Recent avg";
  }
  if (source === "latest_fallback") {
    return "Latest cost fallback";
  }
  return "Missing cost";
}

function marginValue(value: number | null) {
  return value === null ? "N/A" : `${value.toFixed(1)}%`;
}

function sourceLabel(source: CostPriceMonitorRow["latestPurchasePriceSource"], manualLabel = "Manual") {
  if (source === "manual") {
    return manualLabel;
  }
  if (source === "missing") {
    return "Missing cost";
  }
  return "";
}

function badgeClass(label: string) {
  if (label === "Hidden") {
    return "border-slate-200 bg-slate-100 text-slate-700";
  }
  if (label === "Critical margin" || label === "Missing cost" || label === "Missing recent cost") {
    return "border-red-200 bg-red-50 text-red-800";
  }
  if (label === "Low margin" || label === "No landed cost" || label === "No recent PO") {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }
  if (label === "Manual cost") {
    return "border-blue-200 bg-blue-50 text-blue-800";
  }
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function visibilityLabel(value: CostPriceMonitorRow["visibility"]) {
  return value === "hidden" ? "Hidden" : "Active";
}

function visibilityClass(value: CostPriceMonitorRow["visibility"]) {
  return value === "hidden"
    ? "border-slate-200 bg-slate-100 text-slate-700"
    : "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function marginClass(value: number | null) {
  if (value === null) {
    return "text-[#667380]";
  }
  if (value < LOW_MARGIN_CRITICAL_PCT) {
    return "font-semibold text-red-700";
  }
  if (value < LOW_MARGIN_WARNING_PCT) {
    return "font-semibold text-amber-700";
  }
  return "font-semibold text-emerald-700";
}

type QueryValue = string | string[] | null | undefined;

function paramsToQuery(params: PageSearchParams, overrides: Partial<Record<keyof PageSearchParams, QueryValue>> = {}) {
  const query = new URLSearchParams();
  const merged = { ...params, ...overrides };
  for (const [key, value] of Object.entries(merged)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item) {
          query.append(key, item);
        }
      }
    } else {
      query.set(key, value);
    }
  }
  return query.toString();
}

function pathWithParams(params: PageSearchParams, overrides: Partial<Record<keyof PageSearchParams, QueryValue>> = {}) {
  const query = paramsToQuery(params, overrides);
  return query ? `/cost-price-monitor?${query}` : "/cost-price-monitor";
}

function sortHref(params: PageSearchParams, key: string) {
  const nextDirection = params.sort === key && params.direction !== "asc" ? "asc" : "desc";
  return pathWithParams(params, { direction: nextDirection, page: "1", sort: key });
}

function SortHeader({
  children,
  params,
  sortKey,
}: {
  children: string;
  params: PageSearchParams;
  sortKey: string;
}) {
  const active = params.sort === sortKey || (!params.sort && sortKey === "latest_purchase_date");
  const Icon = params.direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <Link className="inline-flex items-center gap-1 hover:text-[#174ea6]" href={sortHref(params, sortKey)}>
      {children}
      {active ? <Icon size={12} /> : null}
    </Link>
  );
}

function OptionList({ options }: { options: string[] }) {
  return (
    <>
      <option value="">All</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </>
  );
}

function supplierSummary(selectedSuppliers: string[]) {
  if (selectedSuppliers.length === 0) {
    return "All suppliers";
  }
  if (selectedSuppliers.length <= 2) {
    return selectedSuppliers.join(" + ");
  }
  return `${selectedSuppliers.length} suppliers selected`;
}

function SupplierMultiSelect({
  options,
  params,
  selectedSuppliers,
}: {
  options: string[];
  params: PageSearchParams;
  selectedSuppliers: string[];
}) {
  const selected = new Set(selectedSuppliers);
  return (
    <div className={labelClass}>
      Supplier
      <details className="relative">
        <summary className={`${inputClass} flex cursor-pointer list-none items-center justify-between`}>
          <span className="truncate normal-case tracking-normal text-[#172026]">{supplierSummary(selectedSuppliers)}</span>
          <span className="text-[#7a8794]">v</span>
        </summary>
        <div className="absolute z-20 mt-2 grid max-h-72 w-80 gap-2 overflow-auto rounded-md border border-[#cfd6df] bg-white p-3 text-sm normal-case tracking-normal shadow-lg">
          <Link
            className="rounded-md bg-[#edf6fb] px-3 py-2 text-xs font-semibold text-[#255f85]"
            href={pathWithParams(params, { page: "1", supplier: [] })}
          >
            Select All suppliers
          </Link>
          {options.map((option) => (
            <label className="flex items-center gap-2 text-[#364252]" key={option}>
              <input defaultChecked={selected.has(option)} name="supplier" type="checkbox" value={option} />
              <span>{option}</span>
            </label>
          ))}
          <p className="border-t border-[#edf1f5] pt-2 text-xs text-[#667380]">
            Leave all suppliers unchecked to show all suppliers.
          </p>
        </div>
      </details>
    </div>
  );
}

function PriceCell({
  manualLabel,
  source,
  value,
}: {
  manualLabel?: string;
  source: CostPriceMonitorRow["latestPurchasePriceSource"];
  value: number;
}) {
  const label = sourceLabel(source, manualLabel);
  return (
    <div>
      <p className="font-semibold text-[#172026]">{moneyValue(value)}</p>
      {label ? <p className="mt-0.5 text-[11px] font-medium text-[#667380]">{label}</p> : null}
    </div>
  );
}

function SummaryCard({
  detail,
  icon: Icon,
  label,
  value,
}: {
  detail: string;
  icon: typeof Database;
  label: string;
  value: string;
}) {
  return (
    <article className="rounded-lg border border-[#dfe4ea] bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[#5d6a78]">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-normal text-[#172026]">{value}</p>
        </div>
        <span className="grid size-10 shrink-0 place-items-center rounded-md bg-[#edf6fb] text-[#255f85]">
          <Icon size={20} />
        </span>
      </div>
      <p className="mt-2 text-sm text-[#667380]">{detail}</p>
    </article>
  );
}

export default async function CostPriceMonitorPage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  const params = await searchParams;
  const currentUser = await requireUser("/cost-price-monitor");
  if (!canAccessCostPriceMonitor(currentUser)) {
    redirect(
      `/access-denied?from=${encodeURIComponent("/cost-price-monitor")}&next=${encodeURIComponent(
        defaultLandingForUser(currentUser),
      )}`,
    );
  }

  const data = await getCostPriceMonitorData({
    ...params,
    lowMarginOnly: params.lowMarginOnly,
    missingCostOnly: params.missingCostOnly,
  });
  const currentPath = pathWithParams(params, { overrideError: null, overrideSaved: null });
  const actionQuery = paramsToQuery(params, { overrideError: null, overrideSaved: null, page: "" });
  const exportHref = actionQuery ? `/api/cost-price-monitor/export?${actionQuery}` : "/api/cost-price-monitor/export";
  const catalogExportHref = actionQuery
    ? `/api/cost-price-monitor/catalog-export?${actionQuery}`
    : "/api/cost-price-monitor/catalog-export";
  const printHref = actionQuery ? `/cost-price-monitor/print?${actionQuery}` : "/cost-price-monitor/print";

  return (
    <CostPriceMonitorSelectionProvider
      defaultEstimatedLandCost={FIXED_LANDCOST_ESTIMATE}
      key={data.filters.visibility}
      pageGroupKeys={data.rows.map((row) => row.groupKey)}
    >
    <main className="min-h-screen bg-[#f4f6f8] text-[#172026] lg:grid lg:grid-cols-[200px_minmax(0,1fr)]">
      <PoSidebarNav active="cost-price-monitor" />
      <div className="min-w-0">
        <header className="border-b border-[#d9dde3] bg-white">
          <div className="flex w-full flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64707d]">
                Purchasing
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-normal">Cost Price Monitor</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#52606d]">
                Product-family purchase prices, landed costs, margins, PO references, and stock quantity.
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <EstimatedLandCostInput />
              <SelectionActionLink className={secondaryButtonClass} baseHref={printHref} target="_blank">
                <Printer size={16} />
                Print Wholesale Catalog
              </SelectionActionLink>
              <SelectionActionLink className={secondaryButtonClass} baseHref={catalogExportHref}>
                <Download size={16} />
                Export Catalog Excel
              </SelectionActionLink>
              <SelectionActionLink className={secondaryButtonClass} baseHref={exportHref}>
                <Download size={16} />
                Export Excel
              </SelectionActionLink>
              <Link className={secondaryButtonClass} href="/po">
                PO Portal
              </Link>
              <Link className={secondaryButtonClass} href="/dashboard">
                Dashboard
              </Link>
            </div>
          </div>
        </header>

        <div className="grid gap-5 px-4 py-5 sm:px-6">
          {params.overrideError ? (
            <section className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
              {params.overrideError}
            </section>
          ) : null}
          {params.overrideSaved === "1" ? (
            <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
              Manual overrides saved.
            </section>
          ) : null}

          {data.warnings.length > 0 ? (
            <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-semibold">Cost monitor notes</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {data.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              detail="Product families after current filters."
              icon={Database}
              label="Total Product Groups"
              value={qtyValue(data.summary.totalGroups)}
            />
            <SummaryCard
              detail="No PO or manual cost basis."
              icon={AlertTriangle}
              label="Missing Cost"
              value={qtyValue(data.summary.missingCostGroups)}
            />
            <SummaryCard
              detail="At least one manual override is active."
              icon={BadgeDollarSign}
              label="Manual Cost"
              value={qtyValue(data.summary.manualCostGroups)}
            />
            <SummaryCard
              detail={`Margin below ${LOW_MARGIN_WARNING_PCT}%.`}
              icon={FileText}
              label="Low Margin"
              value={qtyValue(data.summary.lowMarginGroups)}
            />
          </section>

          <section className="rounded-lg border border-[#dfe4ea] bg-white p-4 shadow-sm">
            <form action="/cost-price-monitor" className="grid gap-3 lg:grid-cols-[1.5fr_1fr_1fr_1fr_1fr_1fr_auto]">
              <label className={labelClass}>
                SKU / Main Name Search
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 text-[#7a8794]" size={16} />
                  <input className={`${inputClass} pl-9`} defaultValue={params.q ?? ""} name="q" placeholder="Main name, SKU, supplier" />
                </div>
              </label>
              <SupplierMultiSelect options={data.supplierOptions} params={params} selectedSuppliers={data.filters.suppliers} />
              <label className={labelClass}>
                Category
                <select className={inputClass} defaultValue={params.category ?? ""} name="category">
                  <OptionList options={data.categoryOptions} />
                </select>
              </label>
              <label className={labelClass}>
                Product Group
                <select className={inputClass} defaultValue={params.group ?? ""} name="group">
                  <OptionList options={data.groupOptions} />
                </select>
              </label>
              <label className={labelClass}>
                PO Status
                <select className={inputClass} defaultValue={params.poStatus ?? ""} name="poStatus">
                  <OptionList options={data.poStatusOptions} />
                </select>
              </label>
              <label className={labelClass}>
                Visibility
                <select className={inputClass} defaultValue={data.filters.visibility} name="visibility">
                  <option value="active">Active only</option>
                  <option value="hidden">Hidden only</option>
                  <option value="all">All</option>
                </select>
              </label>
              <div className="grid gap-2 self-end">
                <button className={buttonClass} type="submit">
                  Apply
                </button>
              </div>
              <div className="flex flex-wrap gap-4 lg:col-span-7">
                <label className="inline-flex items-center gap-2 text-sm font-medium text-[#44515f]">
                  <input defaultChecked={params.missingCostOnly === "1"} name="missingCostOnly" type="checkbox" value="1" />
                  Missing cost only
                </label>
                <label className="inline-flex items-center gap-2 text-sm font-medium text-[#44515f]">
                  <input defaultChecked={params.lowMarginOnly === "1"} name="lowMarginOnly" type="checkbox" value="1" />
                  Low margin only
                </label>
                <input name="sort" type="hidden" value={data.sortKey} />
                <input name="direction" type="hidden" value={data.sortDirection} />
              </div>
            </form>
          </section>

          <section className="overflow-hidden rounded-lg border border-[#dfe4ea] bg-white shadow-sm">
            <ManualOverrideForm action={saveCostPriceOverridesAction} disabled={!data.overrideReady}>
            <input name="returnTo" type="hidden" value={currentPath} />
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e1e6ec] px-4 py-3">
              <div>
                <h2 className="text-lg font-semibold">Product Family Cost Table</h2>
                <p className="mt-1 text-sm text-[#667380]">
                  Showing {qtyValue(data.rows.length)} of {qtyValue(data.totalRows)} matching product groups.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <SelectedRowsSummary />
                <Link
                  className={secondaryButtonClass}
                  href={pathWithParams(params, { page: String(Math.max(1, data.page - 1)) })}
                >
                  Previous
                </Link>
                <span className="inline-flex h-10 items-center rounded-md border border-[#dfe4ea] px-3 font-semibold text-[#44515f]">
                  Page {data.page} / {data.pageCount}
                </span>
                <Link
                  className={secondaryButtonClass}
                  href={pathWithParams(params, { page: String(Math.min(data.pageCount, data.page + 1)) })}
                >
                  Next
                </Link>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[2000px] text-left text-xs">
                <thead className="bg-[#f8fafc] text-[#5d6a78]">
                  <tr className="border-b border-[#e1e6ec]">
                    <th className="w-10 px-3 py-3 text-center font-semibold">
                      <SelectAllRowsCheckbox />
                    </th>
                    <th className="px-3 py-3 font-semibold">
                      <SortHeader params={params} sortKey="main_name">Main Name / Product Family</SortHeader>
                    </th>
                    <th className="px-3 py-3 font-semibold">
                      <SortHeader params={params} sortKey="color">Color</SortHeader>
                    </th>
                    <th className="px-3 py-3 font-semibold">Visibility</th>
                    <th className="px-3 py-3 text-right font-semibold">SKU count</th>
                    <th className="px-3 py-3 font-semibold">SKUs / variants</th>
                    <th className="px-3 py-3 text-right font-semibold">
                      <SortHeader params={params} sortKey="stock_qty">Total stock qty</SortHeader>
                    </th>
                    <th className="px-3 py-3 font-semibold">
                      <SortHeader params={params} sortKey="supplier">Supplier</SortHeader>
                    </th>
                    <th className="px-3 py-3 font-semibold">
                      <SortHeader params={params} sortKey="category">Category</SortHeader>
                    </th>
                    <th className="px-3 py-3 font-semibold">Product Group</th>
                    <th className="px-3 py-3 text-right font-semibold">
                      <span className="block">Purchase / unit</span>
                      <span className="mt-1 block text-[11px] font-medium normal-case leading-snug text-[#667380]">
                        Valid PO cost lines from {AVG_PURCHASE_COST_CUTOFF_DATE} onward
                      </span>
                    </th>
                    <th className="px-3 py-3 text-right font-semibold">
                      <SortHeader params={params} sortKey="latest_purchase_price">Latest purchase / unit</SortHeader>
                    </th>
                    <th className="px-3 py-3 text-right font-semibold">Landed / unit</th>
                    <th className="px-3 py-3 text-right font-semibold">
                      <SortHeader params={params} sortKey="latest_landed_cost">Latest landed / unit</SortHeader>
                    </th>
                    <th className="px-3 py-3 text-right font-semibold">Selling price</th>
                    <th className="px-3 py-3 text-right font-semibold">
                      <SortHeader params={params} sortKey="margin_pct">Margin %</SortHeader>
                    </th>
                    <th className="px-3 py-3 font-semibold">Latest invoice / quote</th>
                    <th className="px-3 py-3 font-semibold">Latest PO status</th>
                    <th className="px-3 py-3 font-semibold">
                      <SortHeader params={params} sortKey="latest_purchase_date">Latest purchase date</SortHeader>
                    </th>
                    <th className="px-3 py-3 font-semibold">Manual cost override</th>
                    <th className="px-3 py-3 font-semibold">Note / remark</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.length > 0 ? (
                    data.rows.map((row) => (
                      <Fragment key={row.groupKey}>
                      <tr
                        className="border-b border-[#edf1f5] align-top"
                        data-group-key={row.groupKey}
                        data-override-row
                      >
                        <td className="px-3 py-3 text-center">
                          <RowSelectionCheckbox groupKey={row.groupKey} />
                        </td>
                        <td className="max-w-[260px] px-3 py-3">
                          <p className="font-semibold text-[#172026]">{row.mainName}</p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {row.badges.map((badge) => (
                              <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${badgeClass(badge)}`} key={badge}>
                                {badge}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="max-w-[120px] px-3 py-3 font-medium text-[#44515f]">{row.color}</td>
                        <td className="px-3 py-3">
                          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${visibilityClass(row.visibility)}`}>
                            {visibilityLabel(row.visibility)}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right font-semibold text-[#172026]">{qtyValue(row.skuCount)}</td>
                        <td className="max-w-[180px] px-3 py-3 text-[#44515f]">{row.skuSummary || `${row.skuCount} SKUs`}</td>
                        <td className="px-3 py-3 text-right font-semibold text-[#172026]">{qtyValue(row.stockQty)}</td>
                        <td className="max-w-[170px] px-3 py-3 text-[#44515f]">{row.supplier}</td>
                        <td className="max-w-[150px] px-3 py-3 text-[#44515f]">{row.category}</td>
                        <td className="max-w-[180px] px-3 py-3 text-[#44515f]">{row.productGroup}</td>
                        <td className="px-3 py-3 text-right">
                          <p className="font-semibold text-[#172026]">{moneyValue(row.averagePurchasePrice)}</p>
                          <p className="mt-1 text-[11px] font-medium text-[#667380]">
                            {rollupModeLabel(row.rollupMode)} · {averagePurchaseSourceLabel(row.averagePurchasePriceSource)}
                          </p>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <PriceCell source={row.latestPurchasePriceSource} value={row.latestPurchasePrice} />
                        </td>
                        <td className="px-3 py-3 text-right">
                          <p className="font-semibold text-[#172026]">{moneyValue(row.averageLandedCost)}</p>
                          <p className="mt-1 text-[11px] font-medium text-[#667380]">{rollupModeLabel(row.rollupMode)}</p>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <PriceCell manualLabel="Manual + land" source={row.latestLandedCostSource} value={row.latestLandedCost} />
                        </td>
                        <td className="px-3 py-3 text-right">
                          <PriceCell source={row.sellingPriceSource} value={row.sellingPrice} />
                          <p className="mt-1 text-[11px] font-medium text-[#667380]">{rollupModeLabel(row.rollupMode)}</p>
                        </td>
                        <td className={`px-3 py-3 text-right ${marginClass(row.marginPct)}`}>
                          <p>{marginValue(row.marginPct)}</p>
                          <p className="mt-1 text-[11px] font-medium text-[#667380]">{rollupModeLabel(row.rollupMode)}</p>
                        </td>
                        <td className="max-w-[160px] px-3 py-3">
                          {row.latestPoId ? (
                            <Link className="inline-flex items-center gap-1 font-semibold text-[#174ea6] hover:underline" href={row.href}>
                              <ClipboardList size={13} />
                              {row.latestInvoiceQuoteReference || row.latestPoId}
                            </Link>
                          ) : (
                            <span className="text-[#667380]">N/A</span>
                          )}
                        </td>
                        <td className="px-3 py-3 font-medium text-[#44515f]">{row.latestPoStatus}</td>
                        <td className="px-3 py-3 text-[#44515f]">{row.latestPurchaseDate || "N/A"}</td>
                        <td className="min-w-[260px] px-3 py-3">
                          <div className="grid grid-cols-3 gap-2">
                            <input name="groupKey" type="hidden" value={row.groupKey} />
                            <input name="mainName" type="hidden" value={row.mainName} />
                            <input name="color" type="hidden" value={row.color} />
                            <input name="supplier" type="hidden" value={row.supplier} />
                            <input name="category" type="hidden" value={row.category} />
                            <input name="productGroup" type="hidden" value={row.productGroup} />
                            <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#64707d]">
                              Group purchase default
                              <input
                                className={smallInputClass}
                                data-override-input="true"
                                defaultValue={row.manualPurchasePrice ?? ""}
                                min="0"
                                name="manualPurchasePrice"
                                step="0.0001"
                                type="number"
                              />
                            </label>
                            <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#64707d]">
                              Group landed default
                              <input
                                className={smallInputClass}
                                data-override-input="true"
                                defaultValue={row.manualLandedCost ?? ""}
                                min="0"
                                name="manualLandedCost"
                                step="0.0001"
                                type="number"
                              />
                            </label>
                            <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#64707d]">
                              Group selling default
                              <input
                                className={smallInputClass}
                                data-override-input="true"
                                defaultValue={row.manualSellingPrice ?? ""}
                                min="0"
                                name="manualSellingPrice"
                                step="0.0001"
                                type="number"
                              />
                            </label>
                            {data.overrideReady ? (
                              <RowOverrideSubmitButton
                                className="col-span-3 h-8 rounded-md bg-[#172026] px-3 text-xs font-semibold text-white disabled:opacity-50"
                                groupKey={row.groupKey}
                                loadingText="Saving"
                              >
                                Save group default
                              </RowOverrideSubmitButton>
                            ) : (
                              <button
                                className="col-span-3 h-8 rounded-md bg-[#9aa5b1] px-3 text-xs font-semibold text-white"
                                disabled
                                type="button"
                              >
                                Migration required
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="min-w-[220px] px-3 py-3">
                          <div className="grid gap-2">
                            <input
                              className={smallInputClass}
                              data-override-input="true"
                              defaultValue={row.note}
                              name="note"
                              placeholder="Cost cleanup note"
                            />
                            {data.overrideReady ? (
                              <RowOverrideSubmitButton
                                className="h-8 rounded-md border border-[#cfd6df] bg-white px-3 text-xs font-semibold text-[#364252] disabled:opacity-50"
                                groupKey={row.groupKey}
                                loadingText="Saving"
                              >
                                Save note
                              </RowOverrideSubmitButton>
                            ) : (
                              <button
                                className="h-8 rounded-md border border-[#cfd6df] bg-[#eef0f3] px-3 text-xs font-semibold text-[#667380]"
                                disabled
                                type="button"
                              >
                                Migration required
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      <tr className="border-b border-[#edf1f5] bg-[#fbfcfd]">
                        <td className="px-3 py-3" colSpan={21}>
                          <details>
                            <summary className="cursor-pointer text-xs font-semibold text-[#174ea6]">
                              SKU / Variant details ({row.skuDetails.length})
                            </summary>
                            <div className="mt-3 overflow-x-auto rounded-md border border-[#e1e6ec] bg-white">
                              <table className="min-w-[1500px] text-left text-xs">
                                <thead className="bg-[#f8fafc] text-[#5d6a78]">
                                  <tr className="border-b border-[#e1e6ec]">
                                    <th className="px-3 py-2 font-semibold">SKU</th>
                                    <th className="px-3 py-2 font-semibold">Variant / size / color</th>
                                    <th className="px-3 py-2 text-right font-semibold">Current stock qty</th>
                                    <th className="px-3 py-2 text-right font-semibold">Recent avg purchase / unit</th>
                                    <th className="px-3 py-2 text-right font-semibold">Latest purchase / unit</th>
                                    <th className="px-3 py-2 text-right font-semibold">Effective purchase / unit</th>
                                    <th className="px-3 py-2 text-right font-semibold">Effective landed / unit</th>
                                    <th className="px-3 py-2 text-right font-semibold">Shopify selling price</th>
                                    <th className="px-3 py-2 text-right font-semibold">Effective selling price</th>
                                    <th className="px-3 py-2 text-right font-semibold">Margin %</th>
                                    <th className="px-3 py-2 font-semibold">Cost source/status</th>
                                    <th className="px-3 py-2 font-semibold">SKU override</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {row.skuDetails.map((detail) => (
                                    <tr className="border-b border-[#edf1f5] align-top last:border-b-0" data-sku={detail.sku} data-sku-override-row key={detail.sku}>
                                      <td className="px-3 py-2 font-mono text-[11px] text-[#172026]">
                                        {detail.sku}
                                        <input name="skuOverrideSku" type="hidden" value={detail.sku} />
                                        <input name="skuOverrideGroupKey" type="hidden" value={row.groupKey} />
                                      </td>
                                      <td className="max-w-[180px] px-3 py-2 text-[#44515f]">{detail.variantTitle || detail.sku}</td>
                                      <td className="px-3 py-2 text-right font-semibold text-[#172026]">{qtyValue(detail.currentQty)}</td>
                                      <td className="px-3 py-2 text-right text-[#44515f]">{moneyValue(detail.recentAveragePurchasePrice)}</td>
                                      <td className="px-3 py-2 text-right text-[#44515f]">{moneyValue(detail.latestPurchasePrice)}</td>
                                      <td className="px-3 py-2 text-right font-semibold text-[#172026]">{moneyValue(detail.effectivePurchasePrice)}</td>
                                      <td className="px-3 py-2 text-right font-semibold text-[#172026]">{moneyValue(detail.effectiveLandedCost)}</td>
                                      <td className="px-3 py-2 text-right text-[#44515f]">{moneyValue(detail.shopifySellingPrice)}</td>
                                      <td className="px-3 py-2 text-right font-semibold text-[#172026]">{moneyValue(detail.effectiveSellingPrice)}</td>
                                      <td className={`px-3 py-2 text-right ${marginClass(detail.marginPct)}`}>{marginValue(detail.marginPct)}</td>
                                      <td className="px-3 py-2 text-[#44515f]">{variantCostSourceLabel(detail.effectivePurchasePriceSource)}</td>
                                      <td className="min-w-[330px] px-3 py-2">
                                        <div className="grid grid-cols-4 gap-2">
                                          <input
                                            className={smallInputClass}
                                            data-override-input="true"
                                            defaultValue={detail.manualPurchasePrice ?? ""}
                                            min="0"
                                            name="skuManualPurchasePrice"
                                            placeholder="Purchase"
                                            step="0.0001"
                                            type="number"
                                          />
                                          <input
                                            className={smallInputClass}
                                            data-override-input="true"
                                            defaultValue={detail.manualLandedCost ?? ""}
                                            min="0"
                                            name="skuManualLandedCost"
                                            placeholder="Landed"
                                            step="0.0001"
                                            type="number"
                                          />
                                          <input
                                            className={smallInputClass}
                                            data-override-input="true"
                                            defaultValue={detail.manualSellingPrice ?? ""}
                                            min="0"
                                            name="skuManualSellingPrice"
                                            placeholder="Selling"
                                            step="0.0001"
                                            type="number"
                                          />
                                          {data.overrideReady ? (
                                            <RowOverrideSubmitButton
                                              className="h-8 rounded-md bg-[#172026] px-2 text-xs font-semibold text-white disabled:opacity-50"
                                              loadingText="Saving"
                                              sku={detail.sku}
                                            >
                                              Save SKU
                                            </RowOverrideSubmitButton>
                                          ) : (
                                            <button className="h-8 rounded-md bg-[#9aa5b1] px-2 text-xs font-semibold text-white" disabled type="button">
                                              Migration required
                                            </button>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </details>
                        </td>
                      </tr>
                      </Fragment>
                    ))
                  ) : (
                    <tr>
                      <td className="px-3 py-8 text-center text-sm text-[#667380]" colSpan={21}>
                        No product group cost rows match the current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            </ManualOverrideForm>
          </section>
        </div>
      </div>
    </main>
    </CostPriceMonitorSelectionProvider>
  );
}
