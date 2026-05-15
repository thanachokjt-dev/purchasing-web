import type { EstimatedComparableDemand } from "@/lib/new-product-opening-buy";

function formatNumber(value: number, digits = 0) {
  return value.toLocaleString("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function formatDecimal(value: number) {
  return formatNumber(value, value >= 10 ? 2 : 4);
}

export function EstimatedDemandPanel({ estimate }: { estimate: EstimatedComparableDemand | null }) {
  if (!estimate) {
    return (
      <section className="rounded-lg border border-[#dfe4ea] bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Estimated Comparable Index</h2>
        <p className="mt-2 text-sm text-[#667380]">Plan not found.</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-[#dfe4ea] bg-white shadow-sm">
      <div className="border-b border-[#e2e7ed] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Estimated Comparable Index</h2>
            <p className="mt-1 text-sm text-[#667380]">
              These figures are planning estimates based on selected comparable reference products. They are not real demand for the new product.
            </p>
          </div>
          <span className="rounded-md bg-[#fff4e5] px-2 py-1 text-xs font-semibold text-[#946200]">
            Read-only preview
          </span>
        </div>
        <p className="mt-2 text-sm text-[#667380]">
          Weighted demand uses the same comparable SKU Demand HM shown in Purchasing Decision, multiplied by each comparable product weight and divided by the total weight with demand data. Missing Demand HM SKUs are excluded from the weighted average and shown in the notes.
        </p>
      </div>

      <div className="grid gap-3 border-b border-[#edf1f5] p-5 md:grid-cols-2 xl:grid-cols-5">
        {[
          ["Demand source", "Purchasing Decision Demand HM"],
          ["Reference SKUs", String(estimate.summary.comparableCount)],
          ["With demand index", String(estimate.summary.skusWithSalesData)],
          ["Missing index", String(estimate.summary.skusMissingSalesData)],
          ["Total sold", formatNumber(estimate.summary.totalComparableSalesQty)],
        ].map(([title, value]) => (
          <div className="rounded-lg border border-[#edf1f5] bg-[#f8fafc] p-3" key={title}>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64707d]">{title}</p>
            <p className="mt-2 text-sm font-semibold text-[#172026]">{value}</p>
          </div>
        ))}
      </div>

      {estimate.warnings.length > 0 ? (
        <div className="border-b border-[#edf1f5] bg-[#fffaf0] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#946200]">Planning notes</p>
          <ul className="mt-2 grid gap-1 text-sm text-[#6f4f00]">
            {estimate.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="p-5">
        <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-[#64707d]">
          Estimated Comparable Index by Size / Color
        </h3>
        <div className="mt-3 overflow-x-auto rounded-lg border border-[#edf1f5]">
          <table className="min-w-full divide-y divide-[#edf1f5] text-sm">
            <thead className="bg-[#f8fafc] text-left text-xs font-semibold uppercase tracking-[0.08em] text-[#64707d]">
              <tr>
                <th className="px-4 py-3">Section</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Size</th>
                <th className="px-4 py-3">Color</th>
                <th className="px-4 py-3 text-right">SKU Count</th>
                <th className="px-4 py-3 text-right">Total Sold</th>
                <th className="px-4 py-3 text-right">Weighted Demand HM</th>
                <th className="px-4 py-3 text-right">Base Qty</th>
                <th className="px-4 py-3 text-right">Coverage Days</th>
                <th className="px-4 py-3 text-right">Adjusted Suggested Qty</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf1f5]">
              {estimate.groups.length > 0 ? (
                estimate.groups.map((group) => (
                  <tr key={`${group.sectionLabel}-${group.productName}-${group.size}-${group.color}`}>
                    <td className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#255f85]">
                      {group.sectionLabel}
                    </td>
                    <td className="px-4 py-3 font-semibold">{group.productName}</td>
                    <td className="px-4 py-3 font-semibold">{group.size}</td>
                    <td className="px-4 py-3">{group.color}</td>
                    <td className="px-4 py-3 text-right font-mono">{group.comparableSkuCount}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatNumber(group.totalSold)}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatDecimal(group.weightedDailyIndex)}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatNumber(group.baseOpeningQtyPreview, 1)}</td>
                    <td className="px-4 py-3 text-right font-mono">{group.targetCoverageDays}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">
                      {formatNumber(group.estimatedOpeningQtyPreview, 1)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-5 text-sm text-[#667380]" colSpan={10}>
                    Add comparable reference products to see an estimated comparable index.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="border-t border-[#edf1f5] p-5">
        <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-[#64707d]">
          Comparable SKU Detail
        </h3>
        <div className="mt-3 overflow-x-auto rounded-lg border border-[#edf1f5]">
          <table className="min-w-full divide-y divide-[#edf1f5] text-sm">
            <thead className="bg-[#f8fafc] text-left text-xs font-semibold uppercase tracking-[0.08em] text-[#64707d]">
              <tr>
                <th className="px-4 py-3">Comparable Product</th>
                <th className="px-4 py-3">Demand Source</th>
                <th className="px-4 py-3">Detected Section</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Size</th>
                <th className="px-4 py-3">Color</th>
                <th className="px-4 py-3 text-right">Total Sold</th>
                <th className="px-4 py-3 text-right">Days Used</th>
                <th className="px-4 py-3 text-right">Demand HM</th>
                <th className="px-4 py-3 text-right">Weight</th>
                <th className="px-4 py-3 text-right">Weighted Demand HM</th>
                <th className="px-4 py-3 text-right">Final Weighted Index</th>
                <th className="px-4 py-3 text-right">Target Days</th>
                <th className="px-4 py-3 text-right">Base Qty</th>
                <th className="px-4 py-3 text-right">Adjusted Qty</th>
                <th className="px-4 py-3">Data Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf1f5]">
              {estimate.details.length > 0 ? (
                estimate.details.map((detail) => (
                  <tr key={detail.sku}>
                    <td className="px-4 py-3 font-semibold">{detail.comparableProduct}</td>
                    <td className="px-4 py-3 font-mono text-xs">{detail.demandSource}</td>
                    <td className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#255f85]">
                      {detail.sectionLabel}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{detail.sku}</td>
                    <td className="px-4 py-3">{detail.size}</td>
                    <td className="px-4 py-3">{detail.color}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatNumber(detail.totalSold)}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatNumber(detail.daysUsed)}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatDecimal(detail.demandHm)}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatDecimal(detail.weight)}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatDecimal(detail.weightedDailyIndex)}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatDecimal(detail.finalWeightedIndex)}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatNumber(detail.targetCoverageDays)}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatNumber(detail.baseQty, 1)}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatNumber(detail.adjustedSuggestedQty, 1)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-md px-2 py-1 text-xs font-semibold ${
                        detail.planningQtySold > 0
                          ? "bg-[#eaf6ef] text-[#1f6b3d]"
                          : "bg-[#fff1f0] text-[#b42318]"
                      }`}
                      >
                        {detail.dataStatus}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-5 text-sm text-[#667380]" colSpan={16}>
                    No comparable SKU detail available yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
