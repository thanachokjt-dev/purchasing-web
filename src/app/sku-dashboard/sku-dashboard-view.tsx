"use client";

import { useMemo, useRef, useState } from "react";
import type { SkuDashboardFilters, SkuDashboardResult } from "@/lib/sku-dashboard-model";

const quantity = (value: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
const money = (value: number) => `THB ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value)}`;
const percent = (value: number) => `${value.toFixed(1)}%`;
const monthLabel = (value: string) => new Intl.DateTimeFormat("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
const dateLabel = (value: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
const datePresets: Array<[string, number]> = [["30 days", 30], ["90 days", 90], ["180 days", 180]];

function YoY({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) return <span className="text-xs text-slate-500">{current > 0 ? "New vs last year" : "No change vs last year"}</span>;
  const change = ((current - previous) / Math.abs(previous)) * 100;
  return <span className={`text-xs font-semibold ${change >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
    {change >= 0 ? "+" : ""}{percent(change)} vs last year
  </span>;
}

function MetricCard({ label, value, detail, tone = "blue", comparison }: {
  label: string; value: string; detail?: string; tone?: "blue" | "green" | "amber" | "violet";
  comparison?: { current: number; previous: number };
}) {
  const tones = { blue: "border-blue-100 bg-blue-50/50", green: "border-emerald-100 bg-emerald-50/50", amber: "border-amber-100 bg-amber-50/50", violet: "border-violet-100 bg-violet-50/50" };
  return <article className={`min-w-0 rounded-xl border p-4 ${tones[tone]}`}>
    <p className="text-xs font-medium text-slate-600">{label}</p>
    <p className="mt-2 truncate text-[clamp(1.15rem,1.7vw,1.6rem)] font-bold tracking-tight text-[#142c49]" title={value}>{value}</p>
    {comparison ? <div className="mt-1"><YoY {...comparison} /></div> : detail ? <p className="mt-1 text-xs text-slate-500">{detail}</p> : null}
  </article>;
}

function skuLabel(item: SkuDashboardResult["catalog"][number]) {
  return `${item.itemName}${item.variantName && item.variantName !== "Default Title" ? ` · ${item.variantName}` : ""} (${item.sku})`;
}

function presetStart(end: string, days: number) {
  const date = new Date(`${end}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days + 1);
  return date.toISOString().slice(0, 10);
}

export function SkuDashboardView({ initial }: { initial: SkuDashboardResult }) {
  const [data, setData] = useState(initial);
  const [draft, setDraft] = useState<SkuDashboardFilters>(initial.filters);
  const [skuSearch, setSkuSearch] = useState("");
  const [chartMetric, setChartMetric] = useState<"units" | "revenue">("units");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestRef = useRef<AbortController | null>(null);

  const suppliers = useMemo(() => [...new Set(data.catalog.map((item) => item.supplier))].sort(), [data.catalog]);
  const categories = useMemo(() => [...new Set(data.catalog.map((item) => item.category))].sort(), [data.catalog]);
  const matches = useMemo(() => {
    const query = skuSearch.trim().toLowerCase();
    return data.catalog.filter((item) =>
      (!draft.supplier || item.supplier === draft.supplier) &&
      (!draft.category || item.category === draft.category) &&
      (!query || skuLabel(item).toLowerCase().includes(query)),
    ).slice(0, 80);
  }, [data.catalog, draft.category, draft.supplier, skuSearch]);

  async function applyFilters(next: SkuDashboardFilters) {
    if (next.skus.length > 100) {
      setError("Select up to 100 SKUs at a time.");
      return;
    }
    if (!next.start || !next.end || next.start > next.end || next.end > (data.latestSalesDate ?? "")) {
      setError("Choose a valid start and end date within available sales history.");
      return;
    }
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ start: next.start, end: next.end, compare: String(next.compare) });
    if (next.supplier) params.set("supplier", next.supplier);
    if (next.category) params.set("category", next.category);
    for (const sku of next.skus) params.append("sku", sku);
    try {
      const response = await fetch(`/api/sku-dashboard?${params}`, { signal: controller.signal, cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Sales dashboard could not be updated.");
      setData(result as SkuDashboardResult);
      setDraft((result as SkuDashboardResult).filters);
    } catch (caught) {
      if (controller.signal.aborted) return;
      setError(caught instanceof Error ? caught.message : "Sales dashboard could not be updated.");
    } finally {
      if (requestRef.current === controller) setLoading(false);
    }
  }

  const { summary } = data;
  const showComparison = data.comparisonAvailable;
  const monthlyMax = Math.max(1, ...data.monthly.flatMap((row) => chartMetric === "units"
    ? [row.units, ...(showComparison ? [row.previousUnits] : [])]
    : [row.revenue, ...(showComparison ? [row.previousRevenue] : [])]));
  const topSkus = data.skus.filter((row) => row.units > 0)
    .sort((a, b) => (chartMetric === "units" ? b.units - a.units : b.revenue - a.revenue) || a.sku.localeCompare(b.sku))
    .slice(0, 10);
  const skuMax = Math.max(1, ...topSkus.map((row) => chartMetric === "units" ? row.units : row.revenue));
  const displayMetric = (value: number) => chartMetric === "units" ? quantity(value) : money(value);

  return <div className="grid gap-5 px-4 py-5 sm:px-6">
    <section className="rounded-xl border border-[#dfe4ea] bg-white p-4 shadow-sm sm:p-5" aria-label="SKU dashboard filters">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-[#142c49]">Filters</h2>
          <p className="text-xs text-slate-500">Data through {data.latestSalesDate ? dateLabel(data.latestSalesDate) : "—"}. Choose up to one year.</p>
        </div>
        <div className="flex flex-wrap gap-1.5" aria-label="Date presets">
          {datePresets.map(([label, days]) => (
            <button className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium hover:bg-slate-50" key={label} onClick={() => {
              const end = data.latestSalesDate ?? draft.end;
              setDraft((current) => ({ ...current, start: presetStart(end, days), end }));
            }} type="button">{label}</button>
          ))}
          <button className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium hover:bg-slate-50" onClick={() => {
            const end = data.latestSalesDate ?? draft.end;
            setDraft((current) => ({ ...current, start: `${end.slice(0, 4)}-01-01`, end }));
          }} type="button">YTD</button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1.2fr_1.2fr]">
        <label className="grid gap-1 text-xs font-semibold text-slate-600">From
          <input className="h-10 rounded-lg border border-slate-300 px-3 text-sm font-normal text-slate-900" max={data.latestSalesDate ?? undefined} onChange={(event) => setDraft((current) => ({ ...current, start: event.target.value }))} type="date" value={draft.start} />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-slate-600">To
          <input className="h-10 rounded-lg border border-slate-300 px-3 text-sm font-normal text-slate-900" max={data.latestSalesDate ?? undefined} onChange={(event) => setDraft((current) => ({ ...current, end: event.target.value }))} type="date" value={draft.end} />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-slate-600">Supplier
          <select className="h-10 min-w-0 rounded-lg border border-slate-300 px-2 text-sm font-normal text-slate-900" onChange={(event) => setDraft((current) => ({ ...current, supplier: event.target.value, skus: [] }))} value={draft.supplier}>
            <option value="">All suppliers</option>
            {suppliers.map((supplier) => <option key={supplier} value={supplier}>{supplier}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold text-slate-600">Category
          <select className="h-10 min-w-0 rounded-lg border border-slate-300 px-2 text-sm font-normal text-slate-900" onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value, skus: [] }))} value={draft.category}>
            <option value="">All categories</option>
            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </label>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div>
          <label className="text-xs font-semibold text-slate-600" htmlFor="sku-dashboard-search">Select items by name or SKU</label>
          <input className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" id="sku-dashboard-search" onChange={(event) => setSkuSearch(event.target.value)} placeholder="Search item name, size, or SKU" value={skuSearch} />
          {(skuSearch || draft.skus.length > 0) ? <div className="mt-1 max-h-40 overflow-auto rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
            {matches.length ? matches.map((item) => <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-blue-50" key={item.sku}>
              <input checked={draft.skus.includes(item.sku)} disabled={!draft.skus.includes(item.sku) && draft.skus.length >= 100} onChange={(event) => setDraft((current) => ({
                ...current,
                skus: event.target.checked ? [...current.skus, item.sku] : current.skus.filter((sku) => sku !== item.sku),
              }))} type="checkbox" />
              <span className="min-w-0 truncate" title={skuLabel(item)}>{skuLabel(item)}</span>
            </label>) : <p className="px-2 py-2 text-xs text-slate-500">No matching items.</p>}
          </div> : null}
          <p className="mt-1 text-xs text-slate-500">{draft.skus.length ? `${draft.skus.length} selected` : "All SKUs"}{skuSearch && matches.length === 80 ? " · Showing first 80 matches; narrow the search for more." : ""}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-700"><input checked={draft.compare} onChange={(event) => setDraft((current) => ({ ...current, compare: event.target.checked }))} type="checkbox" />Compare last year</label>
          <button className="h-10 rounded-lg border border-slate-300 px-3 text-sm font-semibold hover:bg-slate-50" onClick={() => setDraft((current) => ({ ...current, skus: [], supplier: "", category: "" }))} type="button">Clear items</button>
          <button className="h-10 rounded-lg bg-[#176cae] px-5 text-sm font-semibold text-white hover:bg-[#11598f] disabled:opacity-60" disabled={loading} onClick={() => void applyFilters(draft)} type="button">{loading ? "Loading…" : "Apply filters"}</button>
        </div>
      </div>
      {error ? <p className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700" role="alert">{error}</p> : null}
    </section>

    <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
      <p><span className="font-semibold text-[#142c49]">{dateLabel(data.filters.start)} – {dateLabel(data.filters.end)}</span>
        {showComparison ? ` · vs ${dateLabel(data.previousStart)} – ${dateLabel(data.previousEnd)}` : ""}</p>
      {data.filters.compare && !showComparison ? <p className="text-amber-700">A full prior-year baseline is unavailable for this range.</p> : null}
    </div>

    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-7" aria-label="Sales summary">
      <MetricCard label="Avg. monthly units" value={quantity(summary.averageMonthlyUnits)} detail="Based on selected days" />
      <MetricCard label="Units sold" value={quantity(summary.units)} comparison={showComparison ? { current: summary.units, previous: summary.previousUnits } : undefined} tone="green" />
      <MetricCard label="Active SKUs" value={quantity(summary.activeSkus)} detail="SKUs with sales" tone="violet" />
      <MetricCard label="Sales revenue" value={money(summary.revenue)} comparison={showComparison ? { current: summary.revenue, previous: summary.previousRevenue } : undefined} tone="amber" />
      <MetricCard label="Estimated COGS" value={summary.estimatedCogs === null ? "—" : money(summary.estimatedCogs)} detail="Covered SKUs only" tone="violet" />
      <MetricCard label="Est. gross profit" value={summary.estimatedGrossProfit === null ? "—" : money(summary.estimatedGrossProfit)} detail="Covered SKUs only" tone="green" />
      <MetricCard label="Est. gross margin" value={summary.estimatedGrossMarginPercent === null ? "—" : percent(summary.estimatedGrossMarginPercent)} detail="Covered revenue only" />
    </section>

    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
      Cost coverage: <strong>{percent(summary.costCoveragePercent)}</strong> of selected sales revenue ({money(summary.coveredRevenue)}).
      COGS and gross profit use current effective SKU landed or purchase cost only where PO costs are verifiably in THB. Foreign-currency and missing-cost SKUs are excluded. These are estimates for covered SKUs, not historical accounting costs.
    </div>

    <div className="grid gap-4 xl:grid-cols-2">
      <section className="min-w-0 rounded-xl border border-[#dfe4ea] bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-[#142c49]">Monthly {chartMetric === "units" ? "units sold" : "revenue"}</h2>
          <div className="flex rounded-lg border border-slate-200 p-0.5 text-xs" aria-label="Chart metric">
            {(["units", "revenue"] as const).map((metric) => <button aria-pressed={chartMetric === metric} className={`rounded-md px-2 py-1 ${chartMetric === metric ? "bg-[#176cae] font-semibold text-white" : "text-slate-600"}`} key={metric} onClick={() => setChartMetric(metric)} type="button">{metric === "units" ? "Units" : "Revenue"}</button>)}
          </div>
        </div>
        {showComparison ? <p className="mt-2 text-xs text-slate-500"><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-[#2587c6]" />Selected period <span className="ml-3 mr-1 inline-block h-2 w-2 rounded-sm bg-slate-300" />Last year</p> : null}
        <div className="mt-5 flex h-64 items-end gap-2 overflow-x-auto border-b border-slate-300 pb-1 sm:gap-3" role="img" aria-label="Monthly sales bars for the selected period and last year">
          {data.monthly.map((row) => {
            const current = chartMetric === "units" ? row.units : row.revenue;
            const previous = chartMetric === "units" ? row.previousUnits : row.previousRevenue;
            return <div className="flex h-full min-w-12 flex-1 flex-col items-center justify-end" key={row.month} title={`${monthLabel(row.month)}: ${displayMetric(current)}${showComparison ? `; last year ${displayMetric(previous)}` : ""}`}>
              <span className="mb-1 text-[10px] font-semibold text-[#176cae]">{chartMetric === "units" ? quantity(current) : new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(current)}</span>
              <div className="flex h-[80%] w-full items-end justify-center gap-1">
                {showComparison ? <div className="w-1/3 rounded-t-sm bg-slate-300" style={{ height: `${Math.max(previous > 0 ? 2 : 0, previous / monthlyMax * 100)}%` }} /> : null}
                <div className={`${showComparison ? "w-1/3" : "w-2/3"} rounded-t-sm bg-[#2587c6]`} style={{ height: `${Math.max(current > 0 ? 2 : 0, current / monthlyMax * 100)}%` }} />
              </div>
              <span className="mt-2 whitespace-nowrap text-[10px] text-slate-600">{monthLabel(row.month)}</span>
            </div>;
          })}
        </div>
        <p className="mt-2 text-xs text-slate-500">First and last months may contain only part of the month.</p>
      </section>

      <section className="min-w-0 rounded-xl border border-[#dfe4ea] bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-base font-bold text-[#142c49]">Top SKUs by {chartMetric === "units" ? "units" : "revenue"}</h2>
        <div className="mt-4 grid gap-3">
          {topSkus.length ? topSkus.map((row) => {
            const value = chartMetric === "units" ? row.units : row.revenue;
            return <div className="grid min-w-0 grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] items-center gap-3 text-xs" key={row.sku}>
              <span className="truncate text-right text-slate-700" title={`${row.itemName} · ${row.variantName} (${row.sku})`}>{row.itemName}<span className="block font-mono text-[10px] text-slate-400">{row.sku}</span></span>
              <div className="flex min-w-0 items-center gap-2"><div className="h-7 min-w-[2px] rounded-r-sm bg-[#2587c6]" style={{ width: `${value / skuMax * 100}%` }} /><strong className="whitespace-nowrap text-[#142c49]">{displayMetric(value)}</strong></div>
            </div>;
          }) : <p className="py-10 text-center text-sm text-slate-500">No SKU sales in this selection.</p>}
        </div>
      </section>
    </div>

    <section className="min-w-0 rounded-xl border border-[#dfe4ea] bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3"><h2 className="font-bold text-[#142c49]">SKU detail</h2><p className="text-xs text-slate-500">All matching SKUs, sorted by units sold.</p></div>
      <div className="max-h-[480px] overflow-auto">
        <table className="min-w-[760px] w-full text-left text-xs">
          <thead className="sticky top-0 bg-slate-50 text-slate-500"><tr><th className="px-4 py-2">Item / SKU</th><th className="px-3 py-2">Supplier</th><th className="px-3 py-2 text-right">Units</th><th className="px-3 py-2 text-right">Revenue</th>{showComparison ? <><th className="px-3 py-2 text-right">LY units</th><th className="px-3 py-2 text-right">LY revenue</th></> : null}<th className="px-4 py-2 text-right">Est. COGS</th></tr></thead>
          <tbody>{data.skus.length ? data.skus.map((row) => <tr className="border-t border-slate-100" key={row.sku}>
            <td className="max-w-[260px] px-4 py-2"><span className="block truncate font-semibold text-[#142c49]" title={row.itemName}>{row.itemName}</span><span className="font-mono text-[10px] text-slate-500">{row.sku}{row.variantName ? ` · ${row.variantName}` : ""}</span></td>
            <td className="max-w-[160px] truncate px-3 py-2" title={row.supplier}>{row.supplier}</td>
            <td className="px-3 py-2 text-right font-semibold">{quantity(row.units)}</td><td className="px-3 py-2 text-right">{money(row.revenue)}</td>
            {showComparison ? <><td className="px-3 py-2 text-right">{quantity(row.previousUnits)}</td><td className="px-3 py-2 text-right">{money(row.previousRevenue)}</td></> : null}
            <td className="px-4 py-2 text-right">{row.estimatedCogs === null ? "—" : money(row.estimatedCogs)}</td>
          </tr>) : <tr><td className="px-4 py-6 text-center text-slate-500" colSpan={showComparison ? 7 : 5}>No sales in this range or filter.</td></tr>}</tbody>
        </table>
      </div>
    </section>
    <p className="text-xs leading-5 text-slate-500">Source: Shopify sales lines summarized by SKU and day. Cancelled, refunded and voided orders are excluded by the existing summary. Item names, supplier and cost come from current purchasing mappings. Values update after the sales sync.</p>
    {data.warnings.length ? <details className="text-xs text-amber-800"><summary className="cursor-pointer font-semibold">Data notes ({data.warnings.length})</summary><ul className="mt-2 list-disc pl-5">{data.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></details> : null}
  </div>;
}
