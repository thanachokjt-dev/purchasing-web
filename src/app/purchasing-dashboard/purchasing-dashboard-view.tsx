"use client";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import {
  expenseCategories,
  expenseBreakdown,
  expenseSourceLabel,
  type PurchasingDashboardData,
} from "@/lib/purchasing-dashboard-model";

const money = (value: number) =>
  value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const qty = (value: number) =>
  value.toLocaleString("en-US", { maximumFractionDigits: 2 });
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
const cell = "px-4 py-3 text-right tabular-nums whitespace-nowrap";
const panel = "rounded-xl border border-slate-200 bg-white";
const control = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";
const monthCells = [
  "bg-sky-50/60",
  "bg-violet-50/60",
  "bg-amber-50/60",
  "bg-emerald-50/60",
];
const monthHeaders = [
  "bg-sky-100 text-sky-900",
  "bg-violet-100 text-violet-900",
  "bg-amber-100 text-amber-900",
  "bg-emerald-100 text-emerald-900",
];
const totalCell = `${cell} bg-red-50 font-semibold text-red-800`;
const compactMoney = (value: number) =>
  new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);

export function DashboardRefresh() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60"
      aria-label="Refresh latest PO and payment data"
    >
      <RefreshCw className={`size-4 ${pending ? "animate-spin" : ""}`} />
      {pending ? "Refreshing…" : "Refresh"}
    </button>
  );
}

export function Sparkline({
  values,
  color = "#2563eb",
}: {
  values: number[];
  color?: string;
}) {
  const max = Math.max(...values, 1);
  const points = values
    .map((value, index) => `${6 + index * 32},${34 - (value / max) * 28}`)
    .join(" ");
  return (
    <svg
      width="110"
      height="40"
      viewBox="0 0 110 40"
      role="img"
      aria-label={`Four-month trend: ${values.map(money).join(", ")}`}
    >
      <title>{values.map(money).join(" → ")}</title>
      <path d="M6 34H102" stroke="#e2e8f0" />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {values.map((value, index) => (
        <circle
          key={index}
          cx={6 + index * 32}
          cy={34 - (value / max) * 28}
          r="2.8"
          fill={color}
        />
      ))}
    </svg>
  );
}

function MonthlyChart({ data }: { data: PurchasingDashboardData }) {
  const highest = Math.max(...data.monthly, 1);
  const step = 10 ** Math.floor(Math.log10(highest));
  const max = Math.ceil(highest / step) * step;
  const height = 210;
  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">
              Monthly payment activity
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Actual paid · THB including VAT
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500">
            Current month is partial
          </span>
        </div>
        <svg
          viewBox="0 0 760 315"
          className="mx-auto mt-3 h-[240px] w-full max-w-[920px] sm:h-[290px]"
          role="img"
          aria-label="Four-month stacked chart of actual payments"
        >
          {[0, 0.25, 0.5, 0.75, 1].map((fraction) => (
            <g key={fraction}>
              <line
                x1="85"
                x2="745"
                y1={260 - fraction * height}
                y2={260 - fraction * height}
                stroke="#e2e8f0"
                strokeDasharray="3 4"
              />
              <text
                x="75"
                y={264 - fraction * height}
                textAnchor="end"
                fill="#64748b"
                fontSize="12"
              >
                {compactMoney(max * fraction)}
              </text>
            </g>
          ))}
          {data.period.months.map((month, index) => {
            let bottom = 260;
            const x = 125 + index * 160;
            return (
              <g key={month.key}>
                {data.categories.map((category) => {
                  const value = category.monthly[index],
                    h = (value / max) * height;
                  bottom -= h;
                  return (
                    <Link
                      key={category.key}
                      href={`/purchasing-dashboard?view=details&category=${category.key}`}
                    >
                      <rect
                        x={x + 14}
                        y={bottom}
                        width="58"
                        height={h}
                        fill={category.color}
                        className="transition-opacity hover:opacity-75"
                      >
                        <title>{`${month.label} · ${category.label}: ${money(value)} THB`}</title>
                      </rect>
                    </Link>
                  );
                })}
                <text
                  x={x + 43}
                  y={250 - (data.monthly[index] / max) * height}
                  textAnchor="middle"
                  fill="#172026"
                  fontSize="12"
                  fontWeight="600"
                >
                  <title>{`${month.label}: ${money(data.monthly[index])} THB`}</title>
                  {compactMoney(data.monthly[index])}
                </text>
                <text
                  x={x + 43}
                  y="292"
                  textAnchor="middle"
                  fill="#64748b"
                  fontSize="13"
                >
                  {month.label}
                </text>
              </g>
            );
          })}
        </svg>
        <p className="text-center text-[11px] text-slate-400">
          Hover for exact amounts · Select a category to explore payments
        </p>
      </div>
      <aside
        className="border-t border-slate-100 bg-slate-50/60 p-5 lg:border-t-0 lg:border-l sm:p-6"
        aria-label="Four-month payment breakdown"
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          Four-month total
        </p>
        <div className="mt-2 flex items-baseline gap-2">
          <p className="text-2xl font-semibold tracking-tight tabular-nums text-slate-900">
            {money(data.grossPaid)}
          </p>
          <span className="text-xs text-slate-400">THB</span>
        </div>
        <p className="mt-1 text-[11px] text-slate-500">
          {data.paymentCount} paid payments · {data.poCount} POs
        </p>
        <div className="mt-5 space-y-3.5">
          {data.categories.map((category) => (
            <Link
              key={category.key}
              href={`/purchasing-dashboard?view=details&category=${category.key}`}
              className="group block rounded-md outline-offset-4"
            >
              <div className="flex items-start justify-between gap-2 text-xs">
                <span className="flex min-w-0 items-center gap-2 text-slate-600 group-hover:text-slate-900">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: category.color }}
                  />
                  {category.label}
                </span>
                <span className="shrink-0 font-medium tabular-nums text-slate-800">
                  {money(category.total)}
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-200/70">
                  <div
                    className="h-full rounded-full"
                    style={{
                      background: category.color,
                      width: `${data.grossPaid ? (category.total / data.grossPaid) * 100 : 0}%`,
                    }}
                  />
                </div>
                <span className="w-9 text-right text-[10px] tabular-nums text-slate-400">
                  {data.grossPaid
                    ? ((category.total / data.grossPaid) * 100).toFixed(1)
                    : "0.0"}
                  %
                </span>
              </div>
            </Link>
          ))}
        </div>
      </aside>
    </div>
  );
}

function CategoryTable({ data }: { data: PurchasingDashboardData }) {
  const breakdowns = data.period.months.map((month) =>
    expenseBreakdown(
      data.records.filter((record) => record.date.startsWith(month.key)),
    ),
  );
  const overallBreakdown = expenseBreakdown(data.records);
  const breakdownText = (
    key: string,
    values: ReturnType<typeof expenseBreakdown>,
  ) =>
    key === "vat"
      ? `Explicit ${money(values.explicitVat)} · Included 7% ${money(values.includedVat)}`
      : key === "shipping"
        ? `Freight ${money(values.freight)} · Shipping/customs ${money(values.shippingCustoms)}`
        : "";
  return (
    <section className={`${panel} overflow-hidden`}>
      <h2 className="px-5 pt-5 font-semibold">Four-month expense comparison</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-5 py-3 text-left">Category</th>
              {data.period.months.map((month, index) => (
                <th
                  className={`${cell} ${monthHeaders[index]}`}
                  key={month.key}
                >
                  {month.label}
                </th>
              ))}
              <th className={`${cell} bg-red-100 text-red-900`}>Total THB</th>
              <th className={cell}>Share</th>
              <th className={cell}>Sparkline</th>
            </tr>
          </thead>
          <tbody>
            {data.categories.map((category) => (
              <tr key={category.key} className="border-t border-slate-100">
                <td className="px-5 py-3 whitespace-nowrap">
                  <Link
                    href={`/purchasing-dashboard?view=details&category=${category.key}`}
                    className="font-medium hover:text-blue-700"
                  >
                    {category.label}
                  </Link>
                </td>
                {category.monthly.map((value, index) => (
                  <td className={`${cell} ${monthCells[index]}`} key={index}>
                    {money(value)}
                    {breakdownText(category.key, breakdowns[index]) && (
                      <small className="mt-1 block max-w-[220px] whitespace-normal text-[10px] font-normal text-slate-500">
                        {breakdownText(category.key, breakdowns[index])}
                      </small>
                    )}
                  </td>
                ))}
                <td className={totalCell}>
                  {money(category.total)}
                  {breakdownText(category.key, overallBreakdown) && (
                    <small className="mt-1 block max-w-[220px] whitespace-normal text-[10px] font-normal text-red-700">
                      {breakdownText(category.key, overallBreakdown)}
                    </small>
                  )}
                </td>
                <td className={cell}>
                  {data.grossPaid > 0
                    ? ((category.total / data.grossPaid) * 100).toFixed(1)
                    : "0.0"}
                  %
                </td>
                <td className={cell}>
                  <Sparkline values={category.monthly} color={category.color} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t bg-slate-50 font-semibold">
            <tr>
              <td className="px-5 py-3">Total actual payments</td>
              {data.monthly.map((value, index) => (
                <td key={index} className={`${cell} ${monthCells[index]}`}>
                  {money(value)}
                </td>
              ))}
              <td className={totalCell}>{money(data.grossPaid)}</td>
              <td className={cell}>{data.grossPaid ? "100%" : "0%"}</td>
              <td className={cell}>
                <Sparkline values={data.monthly} color="#0d233f" />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

function NewOrderComparison({ data }: { data: PurchasingDashboardData }) {
  const quantities = data.period.months.map((_, index) =>
    data.newGroups.reduce((total, group) => total + group.quantities[index], 0),
  );
  const costs = data.period.months.map((_, index) =>
    data.newGroups.reduce((total, group) => total + group.costs[index], 0),
  );
  return (
    <section className={`${panel} overflow-hidden`}>
      <div className="px-5 pt-5">
        <h2 className="font-semibold">New product orders by PO date</h2>
        <p className="mt-1 text-xs text-slate-500">
          Order value uses raw THB cost, separately from actual payments. Value
          includes only items with known costs.
        </p>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-5 py-3 text-left">Metric</th>
              {data.period.months.map((month, index) => (
                <th
                  key={month.key}
                  className={`${cell} ${monthHeaders[index]}`}
                >
                  {month.label}
                </th>
              ))}
              <th className={`${cell} bg-red-100 text-red-900`}>Total</th>
              <th className={cell}>Sparkline</th>
            </tr>
          </thead>
          <tbody>
            {[
              {
                label: "New product quantity (units)",
                values: quantities,
                format: qty,
              },
              {
                label: "New product value (THB)",
                values: costs,
                format: money,
              },
            ].map((row) => (
              <tr key={row.label} className="border-t border-slate-100">
                <td className="px-5 py-3 whitespace-nowrap">{row.label}</td>
                {row.values.map((value, index) => (
                  <td key={index} className={`${cell} ${monthCells[index]}`}>
                    {row.format(value)}
                  </td>
                ))}
                <td className={totalCell}>{row.format(sum(row.values))}</td>
                <td className={cell}>
                  <Sparkline values={row.values} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function NewProducts({ data }: { data: PurchasingDashboardData }) {
  const [search, setSearch] = useState(""),
    [category, setCategory] = useState("");
  const categories = [
    ...new Set(data.newGroups.map((group) => group.category)),
  ];
  const groups = data.newGroups.filter(
    (group) =>
      (!category || group.category === category) &&
      `${group.name} ${group.skus.join(" ")}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <section className={`${panel} p-5 sm:p-6`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">First-order products by family</h2>
          <p className="mt-1 text-xs text-slate-500">
            Quantity and order value use the PO date. Payments use the payment
            date. Raw costs exclude landed cost.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            className={control}
            aria-label="Search first-order products"
            placeholder="Search product / SKU"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            className={control}
            aria-label="New product category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="">All product categories</option>
            {categories.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-5 space-y-5">
        {categories
          .filter((value) => !category || value === category)
          .map((value) => {
            const rows = groups.filter((group) => group.category === value);
            if (!rows.length) return null;
            return (
              <div key={value}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {value} · {rows.length} families
                </h3>
                {rows.map((group) => (
                  <details
                    key={group.key}
                    className="mb-2 rounded-lg border border-slate-200"
                  >
                    <summary className="cursor-pointer px-4 py-3">
                      <span className="inline-grid w-[calc(100%-1.5rem)] gap-3 align-middle sm:grid-cols-[minmax(180px,1fr)_90px_100px_145px_145px_110px]">
                        <span className="font-medium text-sm">
                          {group.name}
                          <small className="mt-1 block text-slate-500">
                            {group.skus.length} SKU
                          </small>
                        </span>
                        <span className="text-sm tabular-nums">
                          <small className="block text-slate-500">Qty</small>
                          {qty(sum(group.quantities))}
                        </span>
                        <span className="text-sm">
                          <small className="block text-slate-500">
                            Missing cost
                          </small>
                          {qty(group.missingCostQty)} units
                        </span>
                        <span className="text-sm tabular-nums">
                          <small className="block text-slate-500">
                            Product value THB
                          </small>
                          {money(sum(group.costs))}
                        </span>
                        <span className="text-sm tabular-nums">
                          <small className="block text-slate-500">
                            Paid, excluding VAT
                          </small>
                          {money(sum(group.paid))}
                        </span>
                        <Sparkline values={group.paid} />
                      </span>
                    </summary>
                    <div className="overflow-x-auto border-t border-slate-100">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-4 py-3 text-left">SKU / PO</th>
                            {data.period.months.map((month) => (
                              <th key={month.key} className={cell}>
                                Qty {month.label}
                              </th>
                            ))}
                            <th className={cell}>Raw cost / unit THB</th>
                            <th className={cell}>Product value THB</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.lines.map((line, index) => (
                            <tr
                              key={`${line.poId}-${line.sku}-${index}`}
                              className="border-t border-slate-100"
                            >
                              <td className="px-4 py-3">
                                <span className="block font-medium">
                                  {line.sku}
                                </span>
                                <Link
                                  className="text-blue-600"
                                  href={`/po/${encodeURIComponent(line.poId)}`}
                                >
                                  {line.poId}
                                </Link>
                              </td>
                              {data.period.months.map((month) => (
                                <td key={month.key} className={cell}>
                                  {line.date.startsWith(month.key)
                                    ? qty(line.qty)
                                    : "—"}
                                </td>
                              ))}
                              <td className={cell}>
                                {line.unitThb == null
                                  ? "Missing cost / FX"
                                  : money(line.unitThb)}
                              </td>
                              <td className={cell}>
                                {line.costThb == null
                                  ? "—"
                                  : money(line.costThb)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {!group.lines.length && (
                        <p className="p-4 text-xs text-slate-500">
                          The first PO is outside this four-month period. Only
                          payments made during this period are included. Find
                          the PO in the payment table below.
                        </p>
                      )}
                    </div>
                  </details>
                ))}
              </div>
            );
          })}
        {!groups.length && (
          <p className="py-6 text-center text-sm text-slate-500">
            No products match these filters.
          </p>
        )}
      </div>
    </section>
  );
}

function Payments({
  data,
  initialCategory,
}: {
  data: PurchasingDashboardData;
  initialCategory: string;
}) {
  const [category, setCategory] = useState(initialCategory),
    [month, setMonth] = useState(""),
    [supplier, setSupplier] = useState(""),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(0);
  const rows = useMemo(
    () =>
      data.records
        .filter(
          (row) =>
            (!category || row.category === category) &&
            (!month || row.date.startsWith(month)) &&
            (!supplier || row.supplier === supplier) &&
            `${row.poId} ${row.groupName} ${row.sku} ${row.type} ${row.reference} ${row.note}`
              .toLowerCase()
              .includes(search.toLowerCase()),
        )
        .sort(
          (a, b) =>
            b.date.localeCompare(a.date) || a.poId.localeCompare(b.poId),
        ),
    [data, category, month, supplier, search],
  );
  const pages = Math.max(Math.ceil(rows.length / 50), 1),
    current = Math.min(page, pages - 1);
  const suppliers = [
    ...new Set(data.records.map((row) => row.supplier)),
  ].sort();
  const filteredBreakdown = expenseBreakdown(rows);
  return (
    <section className={`${panel} overflow-hidden`}>
      <div className="p-5">
        <h2 className="font-semibold">Actual payment details</h2>
        <p className="mt-1 text-xs text-slate-500">
          VAT is separated. New and existing products are allocated by
          merchandise value within each PO.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <select
            aria-label="Expense category"
            className={control}
            value={category}
            onChange={(event) => {
              setCategory(event.target.value);
              setPage(0);
            }}
          >
            <option value="">All five categories</option>
            {expenseCategories.map((item) => (
              <option value={item.key} key={item.key}>
                {item.label}
              </option>
            ))}
          </select>
          <select
            aria-label="Payment month"
            className={control}
            value={month}
            onChange={(event) => {
              setMonth(event.target.value);
              setPage(0);
            }}
          >
            <option value="">All four months</option>
            {data.period.months.map((item) => (
              <option value={item.key} key={item.key}>
                {item.label}
              </option>
            ))}
          </select>
          <select
            aria-label="Supplier"
            className={control}
            value={supplier}
            onChange={(event) => {
              setSupplier(event.target.value);
              setPage(0);
            }}
          >
            <option value="">All suppliers</option>
            {suppliers.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <input
            aria-label="Search payments"
            className={control}
            placeholder="Search PO / SKU / payment type"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(0);
            }}
          />
        </div>
        <p className="mt-3 text-sm">
          {qty(rows.length)} allocated entries · Filtered total{" "}
          <strong>
            {money(rows.reduce((total, row) => total + row.amountThb, 0))} THB
          </strong>
        </p>
        {(category === "vat" || category === "shipping") && (
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {(category === "vat"
              ? [
                  ["Explicit VAT / import VAT", filteredBreakdown.explicitVat],
                  ["Included VAT 7%", filteredBreakdown.includedVat],
                ]
              : [
                  ["Freight", filteredBreakdown.freight],
                  ["Shipping / customs", filteredBreakdown.shippingCustoms],
                ]
            ).map(([label, value]) => (
              <span
                key={label}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
              >
                {label}: <strong>{money(Number(value))} THB</strong>
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              {[
                "Payment date",
                "PO / supplier",
                "Payment type",
                "Expense category",
                "Product / SKU",
                "Amount THB",
              ].map((label) => (
                <th
                  key={label}
                  className={`px-4 py-3 whitespace-nowrap ${label === "Amount THB" ? "text-right" : "text-left"}`}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(current * 50, (current + 1) * 50).map((row, index) => (
              <tr
                key={`${row.paymentId}-${index}`}
                className="border-t border-slate-100"
              >
                <td className="px-4 py-3 whitespace-nowrap">{row.date}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/po/${encodeURIComponent(row.poId)}`}
                    className="block font-medium text-blue-600"
                  >
                    {row.poId}
                  </Link>
                  <span className="text-slate-500">{row.supplier}</span>
                </td>
                <td className="px-4 py-3">
                  {row.type}
                  <small className="block text-slate-500">
                    {row.reference}
                  </small>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {
                    expenseCategories.find((item) => item.key === row.category)
                      ?.label
                  }
                  {(row.category === "vat" || row.category === "shipping") && (
                    <small className="mt-1 block text-slate-500">
                      {expenseSourceLabel(row)}
                    </small>
                  )}
                </td>
                <td className="px-4 py-3">
                  {row.groupName ||
                    (row.category === "existing"
                      ? "Unallocated: incomplete merchandise costs"
                      : "—")}
                  <small className="block text-slate-500">{row.sku}</small>
                </td>
                <td className={`${cell} font-medium`}>
                  {money(row.amountThb)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <p className="p-8 text-center text-sm text-slate-500">
            No payments match these filters.
          </p>
        )}
      </div>
      <div className="flex items-center justify-between border-t px-5 py-3 text-sm text-slate-500">
        <span>
          Page {current + 1} / {pages}
        </span>
        <div className="flex gap-2">
          <button
            className={`${control} disabled:opacity-40`}
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
          >
            Previous
          </button>
          <button
            className={`${control} disabled:opacity-40`}
            disabled={current >= pages - 1}
            onClick={() => setPage(current + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}

export function PurchasingDashboardView({
  data,
  detail = false,
  initialCategory = "",
}: {
  data: PurchasingDashboardData;
  detail?: boolean;
  initialCategory?: string;
}) {
  const newQty = sum(data.newGroups.flatMap((group) => group.quantities)),
    newValue = sum(data.newGroups.flatMap((group) => group.costs));
  return (
    <div className="space-y-6 p-4 sm:p-8">
      <p className="text-xs leading-5 text-slate-500">
        Actual payments include Paid rows by payment date. Included VAT is
        separated into the tax category. New products are SKUs in their first PO
        across all history. SKUs are grouped by product family. Excel exports
        the full four-month period.
      </p>
      {data.warnings.length > 0 && (
        <details className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <summary className="cursor-pointer font-medium">
            Data coverage notes ({data.warnings.length})
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {data.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </details>
      )}
      {!detail ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: "Total paid THB",
                value: money(data.grossPaid),
                note: `${data.paymentCount} payments · ${data.poCount} POs`,
              },
              {
                label: "New products ordered",
                value: `${qty(newQty)} units`,
                note: `Raw merchandise value ${money(newValue)} THB`,
              },
              {
                label: "Shipping and customs THB",
                value: money(data.categories[2].total),
                note: "Shipping + freight + customs clearance",
              },
              {
                label: "Total VAT THB",
                value: money(data.categories[3].total),
                note: "Included VAT + import VAT",
              },
            ].map((card) => (
              <article className={`${panel} p-5`} key={card.label}>
                <p className="text-sm text-slate-500">{card.label}</p>
                <p className="mt-3 text-2xl font-semibold tabular-nums">
                  {card.value}
                </p>
                <p className="mt-2 text-xs text-slate-500">{card.note}</p>
              </article>
            ))}
          </div>
          <section className={`${panel} overflow-hidden shadow-sm`}>
            <MonthlyChart data={data} />
          </section>
          <CategoryTable data={data} />
          <NewOrderComparison data={data} />
          <div
            className={`${panel} flex flex-wrap items-center justify-between gap-3 p-5`}
          >
            <div>
              <h2 className="font-semibold">Explore products and payments</h2>
              <p className="mt-1 text-sm text-slate-500">
                {data.newGroups.length} first-order families · Explore SKUs and
                POs in detail
              </p>
            </div>
            <Link
              href="/purchasing-dashboard?view=details"
              className="rounded-lg bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700"
            >
              View details →
            </Link>
          </div>
        </>
      ) : (
        <>
          <CategoryTable data={data} />
          <NewProducts data={data} />
          <Payments data={data} initialCategory={initialCategory} />
        </>
      )}
      <p className="text-xs text-slate-400">
        Latest PO / payment data ·{" "}
        {new Intl.DateTimeFormat("en-GB", {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "Asia/Bangkok",
        }).format(new Date(data.generatedAt))}
      </p>
    </div>
  );
}
