"use client";

import { useMemo, useState } from "react";
import type {
  SupplierSalesQtyComparisonRow,
  SupplierTagSalesQtyComparisonData,
  SupplierTagSalesQtyComparisonGroup,
} from "@/lib/supplier-sales-qty-data";

const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const numberFormatter = new Intl.NumberFormat("en-US");

function formatNumber(value: number) {
  return numberFormatter.format(Math.round(value));
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatDate(value: string | null) {
  if (!value) {
    return "N/A";
  }
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: "Asia/Bangkok",
  }).format(new Date(`${value.slice(0, 10)}T00:00:00+07:00`));
}

function formatYoy(row: SupplierSalesQtyComparisonRow) {
  if (row.yoyStatus === "new") {
    return "New";
  }
  if (row.yoyStatus === "none" || row.yoyPercent === null) {
    return "-";
  }
  return formatPercent(row.yoyPercent * 100);
}

function formatSignedNumber(value: number) {
  if (value > 0) {
    return `+${formatNumber(value)}`;
  }
  return formatNumber(value);
}

function formatOptionalNumber(value: number | null) {
  return value === null ? "-" : formatNumber(value);
}

function formatOptionalSignedNumber(value: number | null) {
  return value === null ? "-" : formatSignedNumber(value);
}

function totalMonthly(monthly: Array<number | null>) {
  return monthly.reduce<number>((sum, value) => sum + (value ?? 0), 0);
}

function averageMonthly(monthly: Array<number | null>, totalQty: number) {
  const monthCount = monthly.filter((value) => value !== null).length;
  return monthCount > 0 ? totalQty / monthCount : null;
}

function rowToneClass(row: SupplierSalesQtyComparisonRow, data: { previousYear: number }, isGrandTotal?: boolean) {
  if (isGrandTotal) {
    return row.year === data.previousYear ? "bg-blue-50/80 font-semibold" : "bg-emerald-50/80 font-semibold";
  }
  return row.year === data.previousYear ? "bg-blue-50/50" : "bg-emerald-50/50";
}

function changeBadgeClass(row: SupplierSalesQtyComparisonRow) {
  if (row.yoyStatus === "new") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }
  if ((row.diffQty ?? 0) < 0) {
    return "border-red-200 bg-red-50 text-red-700";
  }
  if ((row.diffQty ?? 0) > 0) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function ChangeBadge({ children, row }: { children: string; row: SupplierSalesQtyComparisonRow }) {
  return (
    <span className={`inline-flex min-w-12 justify-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${changeBadgeClass(row)}`}>
      {children}
    </span>
  );
}

function optionLabel(label: string, count: number) {
  return count === 0 ? `${label}: All` : `${label}: ${count} selected`;
}

function toggleSelection(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value].sort((a, b) => a.localeCompare(b));
}

function sortSupplierTagGroups(groups: SupplierTagSalesQtyComparisonGroup[]) {
  return [...groups].sort(
    (a, b) =>
      a.supplier.localeCompare(b.supplier) ||
      (b.rows[1]?.totalQty ?? 0) - (a.rows[1]?.totalQty ?? 0) ||
      (b.rows[0]?.totalQty ?? 0) - (a.rows[0]?.totalQty ?? 0) ||
      a.tag.localeCompare(b.tag),
  );
}

const supplierPastelClasses = [
  "border-l-blue-300 bg-blue-50/80",
  "border-l-emerald-300 bg-emerald-50/80",
  "border-l-purple-300 bg-purple-50/80",
  "border-l-orange-300 bg-orange-50/80",
  "border-l-pink-300 bg-pink-50/80",
  "border-l-teal-300 bg-teal-50/80",
  "border-l-yellow-300 bg-yellow-50/80",
] as const;

function supplierHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function getSupplierPastelClass(supplierName: string, isGrandTotal?: boolean) {
  if (isGrandTotal) {
    return "border-l-slate-300 bg-slate-100/80";
  }
  return supplierPastelClasses[supplierHash(supplierName) % supplierPastelClasses.length];
}

function sumMonthly(groups: SupplierTagSalesQtyComparisonGroup[], rowIndex: number) {
  return Array.from({ length: 12 }, (_, monthIndex): number | null => {
    let hasActualMonth = false;
    let total = 0;
    for (const group of groups) {
      const value = group.rows[rowIndex]?.monthlyQty[monthIndex] ?? null;
      if (value !== null) {
        hasActualMonth = true;
        total += value;
      }
    }
    return hasActualMonth ? total : null;
  });
}

function grandTotalRow({
  currentComparisonTotal,
  monthly,
  previousComparisonTotal,
  showComparison,
  year,
}: {
  currentComparisonTotal: number;
  monthly: Array<number | null>;
  previousComparisonTotal: number;
  showComparison: boolean;
  year: number;
}): SupplierSalesQtyComparisonRow {
  const totalQty = totalMonthly(monthly);
  if (!showComparison) {
    return {
      averageMonthlyQty: averageMonthly(monthly, totalQty),
      comparisonTotalQty: previousComparisonTotal,
      diffQty: null,
      monthlyQty: monthly,
      totalQty,
      year,
      yoyPercent: null,
      yoyStatus: "none",
    };
  }

  const diffQty = currentComparisonTotal - previousComparisonTotal;
  return {
    averageMonthlyQty: averageMonthly(monthly, totalQty),
    comparisonTotalQty: currentComparisonTotal,
    diffQty,
    monthlyQty: monthly,
    totalQty,
    year,
    yoyPercent: previousComparisonTotal > 0 ? diffQty / previousComparisonTotal : null,
    yoyStatus: previousComparisonTotal > 0 ? "percent" : currentComparisonTotal > 0 ? "new" : "none",
  };
}

function filteredGrandTotal(groups: SupplierTagSalesQtyComparisonGroup[], data: SupplierTagSalesQtyComparisonData): SupplierTagSalesQtyComparisonGroup | null {
  if (groups.length === 0) {
    return null;
  }

  const previousMonthly = sumMonthly(groups, 0);
  const currentMonthly = sumMonthly(groups, 1);
  const previousComparisonTotal = groups.reduce((sum, group) => sum + (group.rows[0]?.comparisonTotalQty ?? 0), 0);
  const currentComparisonTotal = groups.reduce((sum, group) => sum + (group.rows[1]?.comparisonTotalQty ?? 0), 0);

  return {
    isGrandTotal: true,
    rows: [
      grandTotalRow({
        currentComparisonTotal,
        monthly: previousMonthly,
        previousComparisonTotal,
        showComparison: false,
        year: data.previousYear,
      }),
      grandTotalRow({
        currentComparisonTotal,
        monthly: currentMonthly,
        previousComparisonTotal,
        showComparison: true,
        year: data.currentYear,
      }),
    ],
    supplier: "Grand Total",
    tag: "Filtered",
  };
}

function CheckboxFilter({
  label,
  onToggle,
  options,
  selected,
}: {
  label: string;
  onToggle: (value: string) => void;
  options: string[];
  selected: string[];
}) {
  const selectedSet = new Set(selected);
  return (
    <details className="relative rounded-md border border-[#dfe4ea] bg-white">
      <summary className="flex h-9 cursor-pointer list-none items-center justify-between gap-3 px-3 text-xs font-semibold text-[#364252]">
        <span>{optionLabel(label, selected.length)}</span>
        <span className="text-[#7a8794]">Select</span>
      </summary>
      <div className="absolute z-30 mt-1 max-h-72 min-w-[260px] overflow-auto rounded-md border border-[#dfe4ea] bg-white p-2 shadow-lg">
        {options.map((option) => (
          <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs text-[#364252] hover:bg-[#f4f6f8]" key={option}>
            <input checked={selectedSet.has(option)} onChange={() => onToggle(option)} type="checkbox" />
            <span>{option}</span>
          </label>
        ))}
      </div>
    </details>
  );
}

export function SupplierTagSalesQtyComparisonTable({ data }: { data: SupplierTagSalesQtyComparisonData }) {
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const supplierOptions = useMemo(
    () => Array.from(new Set(data.tagGroups.map((group) => group.supplier))).sort((a, b) => a.localeCompare(b)),
    [data.tagGroups],
  );
  const tagOptions = useMemo(
    () => Array.from(new Set(data.tagGroups.map((group) => group.tag))).sort((a, b) => a.localeCompare(b)),
    [data.tagGroups],
  );
  const filteredGroups = useMemo(() => {
    const supplierSet = new Set(selectedSuppliers);
    const tagSet = new Set(selectedTags);
    const groups = data.tagGroups.filter((group) => {
      const matchesSupplier = supplierSet.size === 0 || supplierSet.has(group.supplier);
      const matchesTag = tagSet.size === 0 || tagSet.has(group.tag);
      return matchesSupplier && matchesTag;
    });
    return sortSupplierTagGroups(groups);
  }, [data.tagGroups, selectedSuppliers, selectedTags]);
  const grandTotal = useMemo(() => filteredGrandTotal(filteredGroups, data), [data, filteredGroups]);
  const displayGroups = grandTotal ? [...filteredGroups, grandTotal] : filteredGroups;
  const hasActiveFilters = selectedSuppliers.length > 0 || selectedTags.length > 0;

  return (
    <section className="rounded-lg border border-[#dfe4ea] bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#64707d]">
            Supplier Sales Qty by Tags
          </p>
          <h2 className="mt-2 text-xl font-semibold text-[#172026]">Supplier Sales Qty by Tags</h2>
          <p className="mt-2 text-sm text-[#5c6875]">
            Monthly quantity by supplier and primary purchasing tag. Current year shows available months only; previous year shows available historical months. YoY compares current YTD with the same period last year.
          </p>
        </div>
        <div className="rounded-md border border-[#dfe4ea] bg-[#f9fafb] px-3 py-2 text-xs font-medium text-[#5d6a78]">
          {formatDate(data.currentStartDate)} - {formatDate(data.currentEndDate)}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#667380]">
        <span>
          {data.currentLabel}: {formatDate(data.currentStartDate)} - {formatDate(data.currentEndDate)}
        </span>
        <span>
          {data.previousLabel}: {formatDate(data.previousStartDate)} - {formatDate(data.previousEndDate)}
        </span>
        <span>Source: {data.source}</span>
        <span>Tag rule: first active saved planning tag, then first active Shopify tag, else Untagged.</span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <CheckboxFilter
          label="Suppliers"
          onToggle={(value) => setSelectedSuppliers((current) => toggleSelection(current, value))}
          options={supplierOptions}
          selected={selectedSuppliers}
        />
        <CheckboxFilter
          label="Tags"
          onToggle={(value) => setSelectedTags((current) => toggleSelection(current, value))}
          options={tagOptions}
          selected={selectedTags}
        />
        <button
          className="h-9 rounded-md border border-[#cfd6df] bg-[#f9fafb] px-3 text-xs font-semibold text-[#364252] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!hasActiveFilters}
          onClick={() => {
            setSelectedSuppliers([]);
            setSelectedTags([]);
          }}
          type="button"
        >
          Clear filters
        </button>
        <span className="text-xs text-[#667380]">
          Showing {filteredGroups.length} of {data.tagGroups.length} supplier/tag groups
        </span>
      </div>

      {data.warnings.length > 0 ? (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {data.warnings.slice(0, 3).join(" ")}
        </div>
      ) : null}

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-[1580px] border-separate border-spacing-0 text-left text-xs">
          <thead className="text-[#5d6a78]">
            <tr className="border-b border-[#dfe4ea]">
              <th className="sticky left-0 z-10 bg-white py-2 pr-3 font-semibold">Supplier</th>
              <th className="sticky left-[220px] z-10 bg-white py-2 pr-3 font-semibold">Tag</th>
              <th className="sticky left-[380px] z-10 bg-white py-2 pr-3 font-semibold">Year</th>
              {monthLabels.map((month) => (
                <th className="py-2 pr-3 text-right font-semibold" key={month}>
                  {month}
                </th>
              ))}
              <th className="py-2 pr-3 text-right font-semibold">Total</th>
              <th className="py-2 pr-3 text-right font-semibold">Avg / Month</th>
              <th className="py-2 pr-3 text-right font-semibold">Diff vs LY</th>
              <th className="py-2 pr-3 text-right font-semibold">YoY %</th>
            </tr>
          </thead>
          <tbody>
            {displayGroups.length > 0 ? (
              displayGroups.flatMap((group, groupIndex) => {
                const startsNewSupplier = groupIndex === 0 || displayGroups[groupIndex - 1]?.supplier !== group.supplier;
                return (
                group.rows.map((row, index) => (
                  <tr
                    className={`${rowToneClass(row, data, group.isGrandTotal)} ${
                      index === group.rows.length - 1 ? "border-b-4 border-b-white" : "border-b border-b-white/70"
                    } ${startsNewSupplier && index === 0 ? "border-t-4 border-t-white" : ""
                    }`}
                    key={`${group.supplier}-${group.tag}-${row.year}`}
                  >
                    <td
                      className={`sticky left-0 z-10 w-[220px] max-w-[220px] border-b border-l-4 border-white/70 py-2 pr-3 align-top font-semibold text-[#172026] ${getSupplierPastelClass(
                        group.supplier,
                        group.isGrandTotal,
                      )}`}
                    >
                      {index === 0 ? (
                        <span className="flex items-center gap-2">
                          <span className="truncate">{group.supplier}</span>
                        </span>
                      ) : (
                        ""
                      )}
                    </td>
                    <td className="sticky left-[220px] z-10 w-[160px] max-w-[160px] border-b border-white/70 bg-inherit py-2 pr-3 align-top font-semibold text-[#172026]">
                      {index === 0 ? group.tag : ""}
                    </td>
                    <td className="sticky left-[380px] z-10 w-[72px] border-b border-white/70 bg-inherit py-2 pr-3 align-top font-semibold text-[#172026]">{row.year}</td>
                    {row.monthlyQty.map((qty, monthIndex) => (
                      <td className="border-b border-white/70 py-2 pr-3 text-right align-top text-[#44515f]" key={`${group.supplier}-${group.tag}-${row.year}-${monthLabels[monthIndex]}`}>
                        {formatOptionalNumber(qty)}
                      </td>
                    ))}
                    <td className="border-b border-white/70 bg-slate-100/60 py-2 pr-3 text-right align-top font-semibold text-[#172026]">{formatNumber(row.totalQty)}</td>
                    <td className="border-b border-white/70 bg-slate-100/60 py-2 pr-3 text-right align-top font-semibold text-[#172026]">{formatOptionalNumber(row.averageMonthlyQty === null ? null : Math.round(row.averageMonthlyQty))}</td>
                    <td className="border-b border-white/70 bg-slate-100/60 py-2 pr-3 text-right align-top">
                      <ChangeBadge row={row}>{formatOptionalSignedNumber(row.diffQty)}</ChangeBadge>
                    </td>
                    <td className="border-b border-white/70 bg-slate-100/60 py-2 pr-3 text-right align-top">
                      <ChangeBadge row={row}>{formatYoy(row)}</ChangeBadge>
                    </td>
                  </tr>
                ))
                );
              })
            ) : (
              <tr>
                <td className="py-3 text-[#667380]" colSpan={19}>
                  No supplier/tag sales rows match the selected filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
