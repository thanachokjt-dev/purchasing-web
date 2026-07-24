"use client";

import { useMemo, useState } from "react";
import type {
  TopSellerProductDesignData,
  TopSellerProductDesignRow,
} from "@/lib/top-seller-snapshot";

type WindowKey = "30d" | "90d" | "lifetime";

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});
const demandFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 3,
  minimumFractionDigits: 3,
});

const windowOptions: Array<{
  key: WindowKey;
  label: string;
  shortLabel: string;
}> = [
  { key: "30d", label: "Top 30 Days", shortLabel: "Last 30 days" },
  { key: "90d", label: "Top 90 Days", shortLabel: "Last 90 days" },
  { key: "lifetime", label: "Top All Time", shortLabel: "All time" },
];

const categoryHeaderClasses = [
  "border-blue-200 bg-blue-50 text-blue-900",
  "border-emerald-200 bg-emerald-50 text-emerald-900",
  "border-purple-200 bg-purple-50 text-purple-900",
  "border-orange-200 bg-orange-50 text-orange-900",
  "border-pink-200 bg-pink-50 text-pink-900",
  "border-teal-200 bg-teal-50 text-teal-900",
] as const;

function categoryHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Waiting for first snapshot";
  }
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(new Date(value));
}

function optionLabel(label: string, count: number) {
  return count === 0 ? `${label}: All` : `${label}: ${count} selected`;
}

function toggleSelection(values: string[], value: string) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value].sort((a, b) => a.localeCompare(b));
}

function metricForWindow(row: TopSellerProductDesignRow, window: WindowKey) {
  if (window === "30d") {
    return {
      demandIndex: row.demandIndex30,
      soldQty: row.sold30,
    };
  }
  if (window === "90d") {
    return {
      demandIndex: row.demandIndex90,
      soldQty: row.sold90,
    };
  }
  return {
    demandIndex: row.demandIndexLifetime,
    soldQty: row.totalSale,
  };
}

function MultiSelectFilter({
  label,
  onClear,
  onToggle,
  options,
  selected,
}: {
  label: string;
  onClear: () => void;
  onToggle: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  selected: string[];
}) {
  const selectedSet = new Set(selected);
  return (
    <details className="relative rounded-md border border-[#dfe4ea] bg-white">
      <summary className="flex h-10 min-w-44 cursor-pointer list-none items-center justify-between gap-3 px-3 text-xs font-semibold text-[#364252]">
        <span>{optionLabel(label, selected.length)}</span>
        <span className="text-[#7a8794]">Select</span>
      </summary>
      <div className="absolute z-30 mt-1 w-72 rounded-md border border-[#dfe4ea] bg-white p-2 shadow-lg">
        <div className="mb-1 flex items-center justify-between border-b border-[#e7ebef] px-2 pb-2">
          <span className="text-xs font-semibold text-[#5d6a78]">{label}</span>
          <button
            className="text-xs font-semibold text-blue-700 disabled:text-[#9aa4af]"
            disabled={selected.length === 0}
            onClick={onClear}
            type="button"
          >
            Clear all
          </button>
        </div>
        <div className="max-h-64 overflow-auto">
          {options.map((option) => (
            <label
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs text-[#364252] hover:bg-[#f4f6f8]"
              key={option.value}
            >
              <input
                checked={selectedSet.has(option.value)}
                onChange={() => onToggle(option.value)}
                type="checkbox"
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </div>
    </details>
  );
}

export function TopSellerProductDesignTable({
  data,
}: {
  data: TopSellerProductDesignData;
}) {
  const [activeWindow, setActiveWindow] = useState<WindowKey>("30d");
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const supplierOptions = useMemo(
    () =>
      Array.from(new Set(data.rows.flatMap((row) => row.suppliers)))
        .sort((a, b) => a.localeCompare(b))
        .map((value) => ({ label: value, value })),
    [data.rows],
  );
  const tagOptions = useMemo(() => {
    const tags = Array.from(new Set(data.rows.flatMap((row) => row.tags))).sort((a, b) =>
      a.localeCompare(b),
    );
    return [
      ...(data.rows.some((row) => row.tags.length === 0)
        ? [{ label: "Untagged", value: "__untagged" }]
        : []),
      ...tags.map((value) => ({ label: value, value })),
    ];
  }, [data.rows]);

  const filteredRows = useMemo(() => {
    const supplierSet = new Set(selectedSuppliers);
    const tagSet = new Set(selectedTags);
    return data.rows.filter((row) => {
      const matchesSupplier =
        supplierSet.size === 0 || row.suppliers.some((supplier) => supplierSet.has(supplier));
      const matchesTag =
        tagSet.size === 0 ||
        (tagSet.has("__untagged") && row.tags.length === 0) ||
        row.tags.some((tag) => tagSet.has(tag));
      return matchesSupplier && matchesTag;
    });
  }, [data.rows, selectedSuppliers, selectedTags]);

  const categoryGroups = useMemo(() => {
    const groups = new Map<string, TopSellerProductDesignRow[]>();
    for (const row of filteredRows) {
      groups.set(row.category, [...(groups.get(row.category) ?? []), row]);
    }
    return Array.from(groups.entries())
      .map(([category, rows]) => ({
        category,
        rows: [...rows].sort(
          (a, b) =>
            metricForWindow(b, activeWindow).demandIndex -
              metricForWindow(a, activeWindow).demandIndex ||
            metricForWindow(b, activeWindow).soldQty -
              metricForWindow(a, activeWindow).soldQty ||
            a.designName.localeCompare(b.designName) ||
            a.color.localeCompare(b.color),
        ),
      }))
      .sort((a, b) => a.category.localeCompare(b.category));
  }, [activeWindow, filteredRows]);

  const activeWindowLabel =
    windowOptions.find((option) => option.key === activeWindow)?.shortLabel ?? "";
  const hasActiveFilters = selectedSuppliers.length > 0 || selectedTags.length > 0;

  return (
    <section className="rounded-lg border border-[#dfe4ea] bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#64707d]">
            Demand / Reorder Intelligence
          </p>
          <h2 className="mt-2 text-xl font-semibold text-[#172026]">
            Top Seller Product by Design
          </h2>
          <p className="mt-2 max-w-4xl text-sm text-[#5c6875]">
            Sizes are combined into one design and colors stay separate. Ranking uses daily
            demand: 30/90-day sales averages and the same lifetime Demand Index used by
            Reorder Planning.
          </p>
        </div>
        <div className="rounded-md border border-[#dfe4ea] bg-[#f9fafb] px-3 py-2 text-xs font-medium text-[#5d6a78]">
          Snapshot: {formatDateTime(data.refreshedAt)}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {windowOptions.map((option) => (
          <button
            className={`h-10 rounded-md border px-4 text-sm font-semibold transition ${
              activeWindow === option.key
                ? "border-[#172026] bg-[#172026] text-white"
                : "border-[#d5dbe2] bg-white text-[#44515f] hover:bg-[#f4f6f8]"
            }`}
            key={option.key}
            onClick={() => setActiveWindow(option.key)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <MultiSelectFilter
          label="Suppliers"
          onClear={() => setSelectedSuppliers([])}
          onToggle={(value) =>
            setSelectedSuppliers((current) => toggleSelection(current, value))
          }
          options={supplierOptions}
          selected={selectedSuppliers}
        />
        <MultiSelectFilter
          label="Tags"
          onClear={() => setSelectedTags([])}
          onToggle={(value) => setSelectedTags((current) => toggleSelection(current, value))}
          options={tagOptions}
          selected={selectedTags}
        />
        {hasActiveFilters ? (
          <button
            className="h-10 rounded-md border border-[#d5dbe2] bg-[#f9fafb] px-3 text-xs font-semibold text-[#44515f]"
            onClick={() => {
              setSelectedSuppliers([]);
              setSelectedTags([]);
            }}
            type="button"
          >
            Clear filters
          </button>
        ) : null}
        <span className="ml-auto text-xs font-medium text-[#667380]">
          {filteredRows.length} design/color groups
        </span>
      </div>

      {data.warnings.length > 0 ? (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {data.warnings.slice(0, 2).join(" ")}
        </div>
      ) : null}

      <div className="mt-5 grid gap-5">
        {categoryGroups.length > 0 ? (
          categoryGroups.map((group) => {
            const categoryClass =
              categoryHeaderClasses[categoryHash(group.category) % categoryHeaderClasses.length];
            return (
              <section
                className="overflow-hidden rounded-lg border border-[#dfe4ea]"
                key={group.category}
              >
                <div
                  className={`flex items-center justify-between gap-3 border-b px-4 py-3 ${categoryClass}`}
                >
                  <h3 className="text-sm font-semibold">{group.category}</h3>
                  <span className="text-xs font-semibold">
                    {group.rows.length} design/color groups
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-[1060px] text-left text-xs">
                    <thead className="bg-[#f9fafb] text-[#5d6a78]">
                      <tr className="border-b border-[#dfe4ea]">
                        <th className="w-16 px-3 py-2.5 text-center font-semibold">Rank</th>
                        <th className="px-3 py-2.5 font-semibold">Design</th>
                        <th className="px-3 py-2.5 font-semibold">Color</th>
                        <th className="px-3 py-2.5 font-semibold">Supplier</th>
                        <th className="px-3 py-2.5 font-semibold">Tags</th>
                        <th className="px-3 py-2.5 text-right font-semibold">SKUs</th>
                        <th className="px-3 py-2.5 text-right font-semibold">
                          Qty Sold ({activeWindowLabel})
                        </th>
                        <th className="px-3 py-2.5 text-right font-semibold">
                          Demand Index / day
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.rows.map((row, index) => {
                        const metric = metricForWindow(row, activeWindow);
                        return (
                          <tr
                            className="border-b border-[#e6ebf0] last:border-b-0"
                            key={row.groupKey}
                          >
                            <td className="px-3 py-3 text-center align-top">
                              <span
                                className={`inline-flex size-7 items-center justify-center rounded-full font-semibold ${
                                  index < 3
                                    ? "bg-[#172026] text-white"
                                    : "bg-[#eef1f4] text-[#52606d]"
                                }`}
                              >
                                {index + 1}
                              </span>
                            </td>
                            <td className="px-3 py-3 align-top">
                              <div className="flex items-start gap-3">
                                {row.imageUrl ? (
                                  <div
                                    aria-label={`${row.designName} product image`}
                                    className="size-11 shrink-0 rounded-md border border-[#dfe4ea] bg-white bg-contain bg-center bg-no-repeat"
                                    role="img"
                                    style={{ backgroundImage: `url("${row.imageUrl}")` }}
                                  />
                                ) : (
                                  <div className="grid size-11 shrink-0 place-items-center rounded-md border border-[#dfe4ea] bg-[#f4f6f8] text-[10px] font-semibold text-[#8a96a3]">
                                    No image
                                  </div>
                                )}
                                <span className="max-w-[260px] font-semibold leading-5 text-[#172026]">
                                  {row.designName}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-3 align-top font-medium text-[#44515f]">
                              {row.color === "No color" ? "—" : row.color}
                            </td>
                            <td className="max-w-[220px] px-3 py-3 align-top text-[#44515f]">
                              {row.suppliers.length > 0 ? row.suppliers.join(", ") : "Unmapped"}
                            </td>
                            <td className="max-w-[300px] px-3 py-3 align-top">
                              <div className="flex flex-wrap gap-1">
                                {row.tags.length > 0 ? (
                                  row.tags.map((tag) => (
                                    <span
                                      className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 font-medium text-blue-800"
                                      key={tag}
                                    >
                                      {tag}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-[#8a96a3]">Untagged</span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-3 text-right align-top text-[#44515f]">
                              {numberFormatter.format(row.skuCount)}
                            </td>
                            <td className="px-3 py-3 text-right align-top font-semibold text-[#172026]">
                              {numberFormatter.format(metric.soldQty)}
                            </td>
                            <td className="px-3 py-3 text-right align-top">
                              <span className="inline-flex rounded-md bg-emerald-50 px-2 py-1 font-semibold text-emerald-800">
                                {demandFormatter.format(metric.demandIndex)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })
        ) : (
          <div className="rounded-md border border-dashed border-[#cfd6df] bg-[#f9fafb] p-8 text-center text-sm text-[#667380]">
            {data.rows.length === 0
              ? "No Top Seller snapshot yet. Apply migration 063 and run the sales-demand backfill once."
              : "No product designs match the selected Supplier and Tags filters."}
          </div>
        )}
      </div>
    </section>
  );
}
