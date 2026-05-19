"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import type { PoMarginCheckRow } from "@/lib/po-portal";

type PreparedMarginRow = PoMarginCheckRow & {
  effectiveSalePrice: number;
  hasOverride: boolean;
  historicalFreightLandedUnit: number | null;
  historicalFreightMargin: number | null;
  landedMargin: number | null;
  margin: number | null;
};

type ProductSummaryRow = {
  avgCurrentFreightUnit: number;
  avgLandedUnitCost: number;
  avgSalePrice: number | null;
  avgUnitCost: number;
  decision: "good" | "low" | "missing_price" | "watch";
  effectiveSalePrice: number;
  hasOverride: boolean;
  historicalFreightLandedUnit: number | null;
  historicalFreightMargin: number | null;
  imageUrl: string | null;
  landedMargin: number | null;
  latestFreightUnitAvg: number | null;
  margin: number | null;
  productTitle: string;
  sectionLabel: string;
  skuCount: number;
  totalQty: number;
};

function formatNumber(value: number, digits = 2) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

function formatQty(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(value);
}

function marginPercent(salePrice: number, cost: number) {
  if (!Number.isFinite(salePrice) || salePrice <= 0) {
    return null;
  }
  return ((salePrice - cost) / salePrice) * 100;
}

function formatMoney(value: number | null) {
  return value === null ? "N/A" : formatNumber(value);
}

function formatPercent(value: number | null) {
  return value === null ? "N/A" : `${formatNumber(value, 1)}%`;
}

function decisionForMargin(value: number | null): ProductSummaryRow["decision"] {
  if (value === null) {
    return "missing_price";
  }
  if (value >= 65) {
    return "good";
  }
  if (value >= 50) {
    return "watch";
  }
  return "low";
}

function decisionLabel(value: ProductSummaryRow["decision"]) {
  if (value === "good") {
    return "Good";
  }
  if (value === "watch") {
    return "Watch";
  }
  if (value === "low") {
    return "Low";
  }
  return "Missing price";
}

function decisionClass(value: ProductSummaryRow["decision"]) {
  if (value === "good") {
    return "bg-[#eaf6ef] text-[#1f6b3d]";
  }
  if (value === "watch") {
    return "bg-[#fff8e6] text-[#946200]";
  }
  if (value === "low") {
    return "bg-[#fff1f0] text-[#b42318]";
  }
  return "bg-[#eef0f3] text-[#5c6670]";
}

function marginClass(value: number | null) {
  if (value === null) {
    return "text-[#8a96a3]";
  }
  if (value < 50) {
    return "text-[#b42318]";
  }
  if (value < 65) {
    return "text-[#b54708]";
  }
  return "text-[#1f6b3d]";
}

function weightedAverage(
  rows: PreparedMarginRow[],
  getValue: (row: PreparedMarginRow) => number | null,
) {
  const totals = rows.reduce(
    (current, row) => {
      const value = getValue(row);
      if (value === null || !Number.isFinite(value) || row.totalQty <= 0) {
        return current;
      }
      return {
        qty: current.qty + row.totalQty,
        value: current.value + value * row.totalQty,
      };
    },
    { qty: 0, value: 0 },
  );
  return totals.qty > 0 ? totals.value / totals.qty : null;
}

function buildProductSummaries(rows: PreparedMarginRow[], overrides: Record<string, string>) {
  const groups = new Map<string, PreparedMarginRow[]>();
  for (const row of rows) {
    const key = `${row.sectionLabel.toLowerCase()}::${row.productTitle.toLowerCase()}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  return Array.from(groups.values())
    .map((groupRows) => {
      const base = groupRows[0]!;
      const totalQty = groupRows.reduce((sum, row) => sum + row.totalQty, 0);
      const override = Number(overrides[base.productTitle] ?? "");
      const hasOverride = Number.isFinite(override) && override > 0;
      const avgSalePrice = weightedAverage(groupRows, (row) => row.shopifySalePrice);
      const effectiveSalePrice = hasOverride ? override : avgSalePrice ?? 0;
      const avgUnitCost = weightedAverage(groupRows, (row) => row.avgUnitCost) ?? 0;
      const avgCurrentFreightUnit =
        weightedAverage(groupRows, (row) => row.avgLandedUnitCost - row.avgUnitCost) ?? 0;
      const avgLandedUnitCost = weightedAverage(groupRows, (row) => row.avgLandedUnitCost) ?? 0;
      const latestFreightUnitAvg = weightedAverage(groupRows, (row) => row.latestFreightUnitAvg);
      const historicalFreightLandedUnit =
        latestFreightUnitAvg === null ? null : avgUnitCost + latestFreightUnitAvg;
      const margin = marginPercent(effectiveSalePrice, avgUnitCost);
      const landedMargin = marginPercent(effectiveSalePrice, avgLandedUnitCost);
      const historicalFreightMargin =
        historicalFreightLandedUnit === null
          ? null
          : marginPercent(effectiveSalePrice, historicalFreightLandedUnit);

      return {
        avgCurrentFreightUnit,
        avgLandedUnitCost,
        avgSalePrice,
        avgUnitCost,
        decision: decisionForMargin(landedMargin),
        effectiveSalePrice,
        hasOverride,
        historicalFreightLandedUnit,
        historicalFreightMargin,
        imageUrl: groupRows.find((row) => row.imageUrl)?.imageUrl ?? null,
        landedMargin,
        latestFreightUnitAvg,
        margin,
        productTitle: base.productTitle,
        sectionLabel: base.sectionLabel,
        skuCount: groupRows.length,
        totalQty,
      } satisfies ProductSummaryRow;
    })
    .sort((a, b) => a.sectionLabel.localeCompare(b.sectionLabel) || a.productTitle.localeCompare(b.productTitle));
}

function summaryCards(rows: ProductSummaryRow[]) {
  const totalQty = rows.reduce((sum, row) => sum + row.totalQty, 0);
  const missingPriceCount = rows.filter((row) => row.avgSalePrice === null || row.avgSalePrice <= 0).length;
  const missingFreightCount = rows.filter((row) => row.latestFreightUnitAvg === null).length;
  const weighted = (
    getValue: (row: ProductSummaryRow) => number | null,
  ) => {
    const totals = rows.reduce(
      (current, row) => {
        const value = getValue(row);
        if (value === null || !Number.isFinite(value) || row.totalQty <= 0) {
          return current;
        }
        return {
          qty: current.qty + row.totalQty,
          value: current.value + value * row.totalQty,
        };
      },
      { qty: 0, value: 0 },
    );
    return totals.qty > 0 ? totals.value / totals.qty : null;
  };

  return [
    ["Weighted Avg Margin %", formatPercent(weighted((row) => row.margin))],
    ["Weighted Avg Current Landed Margin %", formatPercent(weighted((row) => row.landedMargin))],
    ["Weighted Avg Historical Freight Net Margin %", formatPercent(weighted((row) => row.historicalFreightMargin))],
    ["Total PO Qty", formatQty(totalQty)],
    ["Missing Price Count", formatQty(missingPriceCount)],
    ["Missing Freight History Count", formatQty(missingFreightCount)],
  ];
}

export function MarginCheckPanel({ rows }: { rows: PoMarginCheckRow[] }) {
  const [open, setOpen] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  const preparedRows = useMemo(
    () =>
      rows.map((row) => {
        const effectiveSalePrice = row.shopifySalePrice ?? 0;
        const margin = marginPercent(effectiveSalePrice, row.avgUnitCost);
        const landedMargin = marginPercent(effectiveSalePrice, row.avgLandedUnitCost);
        const historicalFreightLandedUnit =
          row.latestFreightUnitAvg === null ? null : row.avgUnitCost + row.latestFreightUnitAvg;
        const historicalFreightMargin =
          historicalFreightLandedUnit === null
            ? null
            : marginPercent(effectiveSalePrice, historicalFreightLandedUnit);

        return {
          ...row,
          effectiveSalePrice,
          hasOverride: false,
          historicalFreightLandedUnit,
          historicalFreightMargin,
          landedMargin,
          margin,
        };
      }),
    [rows],
  );
  const productRows = useMemo(
    () => buildProductSummaries(preparedRows, overrides),
    [overrides, preparedRows],
  );
  const cards = useMemo(() => summaryCards(productRows), [productRows]);

  return (
    <>
      <button
        className="inline-flex items-center justify-center rounded-md border border-[#2563eb] bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:border-[#1d4ed8] hover:bg-[#1d4ed8]"
        onClick={() => setOpen(true)}
        type="button"
      >
        Margin Check
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#172026]/40 p-2">
          <section className="flex h-[96vh] max-h-[96vh] w-[98vw] max-w-none flex-col overflow-hidden rounded-lg border border-[#dfe4ea] bg-white shadow-xl">
            <div className="shrink-0 border-b border-[#e2e7ed] bg-white p-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-[#172026]">Margin Check</h2>
                  <p className="mt-1 text-sm text-[#667380]">
                    Product-level margin summary. Overrides are temporary and do not save to PO or Shopify.
                  </p>
                </div>
                <button
                  className="inline-flex h-10 items-center justify-center rounded-md bg-[#2563eb] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1d4ed8]"
                  onClick={() => setOpen(false)}
                  type="button"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-3">
              <div className="grid shrink-0 gap-2 md:grid-cols-3 xl:grid-cols-6">
                {cards.map(([label, value]) => (
                  <div className="rounded-lg border border-[#dfe4ea] bg-[#fbfcfd] p-2.5" key={label}>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#65717f]">{label}</p>
                    <p className="mt-1 text-lg font-semibold text-[#172026]">{value}</p>
                  </div>
                ))}
              </div>
              <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-[#e2e7ed]">
                <table className="w-full min-w-[1460px] border-collapse text-left text-sm">
                  <thead className="sticky top-0 z-20 bg-[#f3f5f7] text-[11px] uppercase tracking-[0.08em] text-[#65717f] shadow-sm">
                    <tr>
                      <th className="sticky left-0 z-30 min-w-[300px] border-b border-[#dfe4ea] bg-[#f3f5f7] px-3 py-2.5 font-semibold">Product</th>
                      <th className="border-b border-[#dfe4ea] px-3 py-2.5 font-semibold">Variants</th>
                      <th className="border-b border-[#dfe4ea] px-3 py-2.5 text-right font-semibold">Qty</th>
                      <th className="border-b border-[#dfe4ea] px-3 py-2.5 text-right font-semibold">Sale Price</th>
                      <th className="border-b border-[#dfe4ea] px-3 py-2.5 text-right font-semibold">Manual Override</th>
                      <th className="border-b border-[#dfe4ea] px-3 py-2.5 text-right font-semibold">Unit Cost</th>
                      <th className="border-b border-[#dfe4ea] px-3 py-2.5 text-right font-semibold">Current Freight</th>
                      <th className="border-b border-[#dfe4ea] px-3 py-2.5 text-right font-semibold">Landed</th>
                      <th className="border-b border-[#dfe4ea] px-3 py-2.5 text-right font-semibold">Last Hist. Freight</th>
                      <th className="border-b border-[#dfe4ea] px-3 py-2.5 text-right font-semibold">Hist. Landed</th>
                      <th className="border-b border-[#dfe4ea] px-3 py-2.5 text-right font-semibold">Margin</th>
                      <th className="border-b border-[#dfe4ea] px-3 py-2.5 text-right font-semibold">Landed Margin</th>
                      <th className="border-b border-[#dfe4ea] px-3 py-2.5 text-right font-semibold">Hist. Net Margin</th>
                      <th className="border-b border-[#dfe4ea] px-3 py-2.5 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#edf1f5]">
                    {productRows.length ? (
                      productRows.map((row) => (
                        <tr key={`${row.sectionLabel}-${row.productTitle}`}>
                          <td className="sticky left-0 z-10 min-w-[300px] bg-white px-3 py-2.5">
                            <div className="flex items-center gap-3">
                              <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-md border border-[#dfe4ea] bg-[#f6f7f9]">
                                {row.imageUrl ? (
                                  <Image
                                    alt={row.productTitle}
                                    className="h-full w-full object-cover"
                                    height={48}
                                    loading="lazy"
                                    src={row.imageUrl}
                                    width={48}
                                  />
                                ) : (
                                  <span className="text-[10px] font-semibold text-[#8a96a3]">NO IMG</span>
                                )}
                              </div>
                              <div>
                                <p className="font-semibold text-[#172026]">{row.productTitle}</p>
                                <p className="mt-1 text-xs text-[#667380]">{row.sectionLabel}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-sm font-semibold text-[#52606d]">
                            {formatQty(row.skuCount)} {row.skuCount === 1 ? "variant" : "variants"}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono font-semibold">{formatQty(row.totalQty)}</td>
                          <td className="px-3 py-2.5 text-right font-mono">
                            {row.avgSalePrice && row.avgSalePrice > 0 ? (
                              <>
                                <p className="font-semibold">{formatMoney(row.avgSalePrice)}</p>
                                <p className="mt-1 text-[10px] text-[#8a96a3]">weighted avg</p>
                              </>
                            ) : (
                              <span className="font-semibold text-[#b42318]">Missing price</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <input
                              className="h-8 w-24 rounded-md border border-[#cfd6df] bg-white px-2 text-right font-mono text-xs outline-none focus:border-[#255f85]"
                              min="0"
                              onChange={(event) =>
                                setOverrides((current) => ({
                                  ...current,
                                  [row.productTitle]: event.target.value,
                                }))
                              }
                              placeholder="Optional"
                              step="0.0001"
                              type="number"
                              value={overrides[row.productTitle] ?? ""}
                            />
                            {row.hasOverride ? (
                              <p className="mt-1 text-[10px] font-semibold text-[#255f85]">UI-only override</p>
                            ) : null}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono font-semibold">{formatMoney(row.avgUnitCost)}</td>
                          <td className="px-3 py-2.5 text-right font-mono font-semibold">{formatMoney(row.avgCurrentFreightUnit)}</td>
                          <td className="px-3 py-2.5 text-right font-mono font-semibold">{formatMoney(row.avgLandedUnitCost)}</td>
                          <td className="px-3 py-2.5 text-right font-mono font-semibold">{formatMoney(row.latestFreightUnitAvg)}</td>
                          <td className="px-3 py-2.5 text-right font-mono font-semibold">{formatMoney(row.historicalFreightLandedUnit)}</td>
                          <td className={`px-3 py-2.5 text-right font-mono font-bold ${marginClass(row.margin)}`}>
                            {formatPercent(row.margin)}
                          </td>
                          <td className={`px-3 py-2.5 text-right font-mono font-bold ${marginClass(row.landedMargin)}`}>
                            {formatPercent(row.landedMargin)}
                          </td>
                          <td className={`px-3 py-2.5 text-right font-mono font-bold ${marginClass(row.historicalFreightMargin)}`}>
                            {formatPercent(row.historicalFreightMargin)}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={`rounded-md px-2 py-1 text-xs font-semibold ${decisionClass(row.decision)}`}>
                              {decisionLabel(row.decision)}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="px-4 py-8 text-center text-sm text-[#667380]" colSpan={14}>
                          No PO lines available for margin checking.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
