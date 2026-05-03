import { ArrowLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { PrintOverstockReportButton } from "@/app/purchasing-decision/overstock-report/print-button";
import {
  getPurchasingDecisionData,
  type PurchasingDecisionLine,
} from "@/lib/purchasing-decision-data";

export const dynamic = "force-dynamic";
const MIN_REPORT_OVERSTOCK_DAYS = 60;

type ReportParams = {
  capSelling?: string;
  lifetimeWeight?: string;
  q?: string;
  recentFloor?: string;
  sellingWeight?: string;
  status?: string;
  supplier?: string;
  tag?: string;
  visibility?: string;
};

type TagGroup = {
  label: string;
  lines: PurchasingDecisionLine[];
};

type SupplierGroup = {
  supplier: string;
  tags: TagGroup[];
  lines: PurchasingDecisionLine[];
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(value);
}

function formatDecimal(value: number | null, digits = 1) {
  if (value === null) {
    return "-";
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: Number.isInteger(value) ? 0 : digits,
  }).format(value);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(value);
}

function reportDate() {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date());
}

function stockAlertLabel(status: PurchasingDecisionLine["stockAlert"]) {
  if (status === "dead_stock") {
    return "Dead stock";
  }
  if (status === "heavy_overstock") {
    return "Heavy overstock";
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

function stockAlertClass(status: PurchasingDecisionLine["stockAlert"]) {
  if (status === "dead_stock") {
    return "bg-[#f8e8e8] text-[#9f2323]";
  }
  if (status === "heavy_overstock") {
    return "bg-[#fff1e8] text-[#9a3412]";
  }
  if (status === "overstock") {
    return "bg-[#fff4e5] text-[#946200]";
  }

  return "bg-[#e9f1fb] text-[#255f85]";
}

function tagLabel(line: PurchasingDecisionLine) {
  return line.tags.length ? line.tags.join(", ") : "No tag";
}

function isReportLine(line: PurchasingDecisionLine) {
  if (line.totalSale <= 0) {
    return false;
  }
  if (line.stockAlert === "dead_stock") {
    return true;
  }

  return (
    (line.stockAlert === "heavy_overstock" || line.stockAlert === "overstock") &&
    line.overstockDays !== null &&
    line.overstockDays >= MIN_REPORT_OVERSTOCK_DAYS
  );
}

function sortReportLines(a: PurchasingDecisionLine, b: PurchasingDecisionLine) {
  const aDead = a.stockAlert === "dead_stock" ? 1 : 0;
  const bDead = b.stockAlert === "dead_stock" ? 1 : 0;
  const aDays = a.overstockDays ?? 0;
  const bDays = b.overstockDays ?? 0;

  return (
    bDead - aDead ||
    bDays - aDays ||
    b.overstockUnits - a.overstockUnits ||
    a.mainName.localeCompare(b.mainName) ||
    a.sku.localeCompare(b.sku)
  );
}

function groupLines(lines: PurchasingDecisionLine[]) {
  const supplierMap = new Map<string, SupplierGroup>();

  for (const line of lines) {
    const supplier = line.supplier || "Unmapped";
    const group =
      supplierMap.get(supplier) ??
      ({
        lines: [],
        supplier,
        tags: [],
      } satisfies SupplierGroup);
    group.lines.push(line);
    supplierMap.set(supplier, group);
  }

  for (const group of supplierMap.values()) {
    const tagMap = new Map<string, PurchasingDecisionLine[]>();
    for (const line of group.lines) {
      const label = tagLabel(line);
      tagMap.set(label, [...(tagMap.get(label) ?? []), line]);
    }
    group.tags = Array.from(tagMap.entries())
      .map(([label, tagLines]) => ({
        label,
        lines: tagLines.sort(sortReportLines),
      }))
      .sort(
        (a, b) =>
          maxOverstockDays(b.lines) - maxOverstockDays(a.lines) ||
          totalOverstock(b.lines) - totalOverstock(a.lines),
      );
  }

  return Array.from(supplierMap.values()).sort(
    (a, b) =>
      maxOverstockDays(b.lines) - maxOverstockDays(a.lines) ||
      totalOverstock(b.lines) - totalOverstock(a.lines),
  );
}

function totalOverstock(lines: PurchasingDecisionLine[]) {
  return lines.reduce((sum, line) => sum + line.overstockUnits, 0);
}

function totalStockPosition(lines: PurchasingDecisionLine[]) {
  return lines.reduce((sum, line) => sum + line.stockPositionUnits, 0);
}

function totalStockValue(lines: PurchasingDecisionLine[]) {
  return lines.reduce((sum, line) => sum + line.inventoryValue + line.comingValue, 0);
}

function deadStockCount(lines: PurchasingDecisionLine[]) {
  return lines.filter((line) => line.stockAlert === "dead_stock").length;
}

function heavyCount(lines: PurchasingDecisionLine[]) {
  return lines.filter((line) => line.stockAlert === "heavy_overstock").length;
}

function averageOverDays(lines: PurchasingDecisionLine[]) {
  const values = lines
    .map((line) => line.overstockDays)
    .filter((value): value is number => value !== null && value > 0);
  if (!values.length) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function maxOverstockDays(lines: PurchasingDecisionLine[]) {
  return lines.reduce((max, line) => Math.max(max, line.overstockDays ?? 0), 0);
}

function overDaysPercent(line: PurchasingDecisionLine, maxDays: number) {
  if (line.stockAlert === "dead_stock") {
    return 100;
  }
  if (!line.overstockDays || maxDays <= 0) {
    return 0;
  }

  return Math.min(100, Math.max(8, (line.overstockDays / maxDays) * 100));
}

function decisionHref(params: ReportParams) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) {
      query.set(key, value);
    }
  }
  query.set("stock", "any_overstock");
  const queryString = query.toString();

  return queryString ? `/purchasing-decision?${queryString}` : "/purchasing-decision";
}

export default async function OverstockReportPage({
  searchParams,
}: {
  searchParams: Promise<ReportParams>;
}) {
  const params = await searchParams;
  const data = await getPurchasingDecisionData({
    capSelling: params.capSelling,
    itemStatus: params.status ?? "all",
    lifetimeWeight: params.lifetimeWeight,
    limit: null,
    q: params.q ?? "",
    recentFloor: params.recentFloor,
    sellingWeight: params.sellingWeight,
    stock: "any_overstock",
    supplier: params.supplier ?? "all",
    tag: params.tag ?? "all",
    visibility: "all",
  });
  const reportLines = data.lines.filter(isReportLine);
  const groups = groupLines(reportLines);
  const generatedDate = reportDate();

  return (
    <main className="overstock-report min-h-screen bg-[#f6f7f9] text-[#172026]">
      <div className="report-screen-actions sticky top-0 z-50 border-b border-[#d9dde3] bg-white/95 backdrop-blur">
        <div className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64707d]">
              Purchasing Report
            </p>
            <h1 className="mt-1 text-2xl font-semibold">Overstock & Dead Stock</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              className="inline-flex h-10 items-center gap-2 rounded-md border border-[#cfd6df] bg-[#f9fafb] px-3 text-sm font-semibold text-[#364252]"
              href={decisionHref(params)}
            >
              <ArrowLeft size={16} />
              Decision sheet
            </Link>
            <PrintOverstockReportButton />
          </div>
        </div>
      </div>

      <section className="mx-auto grid max-w-[1480px] gap-5 px-5 py-5">
        <header className="rounded-lg border border-[#dfe4ea] bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64707d]">
                Overstock & Dead Stock Report
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-normal">
                Supplier action list
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#52606d]">
                Grouped by supplier, then tag. Excludes new items with zero total
                sale; overstock items appear only when over target by at least{" "}
                {MIN_REPORT_OVERSTOCK_DAYS} days. Hidden items are included in this
                report when they meet the stock condition.
              </p>
            </div>
            <div className="text-sm text-[#52606d] lg:text-right">
              <p className="font-semibold text-[#172026]">Generated {generatedDate}</p>
              <p>Visibility: all, including hidden</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { label: "Report SKUs", value: formatNumber(reportLines.length) },
              { label: "Suppliers", value: formatNumber(groups.length) },
              { label: "Dead stock", value: formatNumber(deadStockCount(reportLines)) },
              { label: "Heavy overstock", value: formatNumber(heavyCount(reportLines)) },
              { label: "Over units", value: formatNumber(totalOverstock(reportLines)) },
            ].map((metric) => (
              <div
                className="rounded-md border border-[#dfe4ea] bg-[#fbfcfd] p-3"
                key={metric.label}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#65717f]">
                  {metric.label}
                </p>
                <p className="mt-2 text-2xl font-semibold">{metric.value}</p>
              </div>
            ))}
          </div>
        </header>

        {groups.length ? (
          groups.map((group) => (
            <section
              className="overstock-supplier-section rounded-lg border border-[#dfe4ea] bg-white shadow-sm"
              key={group.supplier}
            >
              <div className="flex flex-col gap-3 border-b border-[#dfe4ea] bg-[#172026] px-4 py-3 text-white lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#b9c3cc]">
                    Supplier
                  </p>
                  <h3 className="mt-1 text-xl font-semibold">{group.supplier}</h3>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-5">
                  <SupplierMetric label="SKUs" value={formatNumber(group.lines.length)} />
                  <SupplierMetric
                    label="Stock pos."
                    value={formatNumber(totalStockPosition(group.lines))}
                  />
                  <SupplierMetric
                    label="Over qty"
                    value={formatNumber(totalOverstock(group.lines))}
                  />
                  <SupplierMetric
                    label="Avg over"
                    value={`${formatDecimal(averageOverDays(group.lines), 0)}d`}
                  />
                  <SupplierMetric
                    label="Value"
                    value={`THB ${formatMoney(totalStockValue(group.lines))}`}
                  />
                </div>
              </div>

              <div className="grid gap-4 p-4">
                {group.tags.map((tagGroup) => (
                  <section className="overstock-tag-section" key={tagGroup.label}>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <h4 className="text-sm font-semibold uppercase tracking-[0.12em] text-[#42505c]">
                        {tagGroup.label}
                      </h4>
                      <p className="text-xs font-semibold text-[#65717f]">
                        {formatNumber(tagGroup.lines.length)} SKUs | over{" "}
                        {formatNumber(totalOverstock(tagGroup.lines))}
                      </p>
                    </div>
                    <div className="overflow-hidden rounded-md border border-[#dfe4ea]">
                      {(() => {
                        const maxDays = maxOverstockDays(tagGroup.lines);

                        return (
                      <table className="w-full border-collapse text-left text-xs">
                        <thead className="bg-[#f3f5f7] uppercase tracking-[0.08em] text-[#65717f]">
                          <tr>
                            <th className="w-[74px] px-2 py-2">Image</th>
                            <th className="min-w-[240px] px-2 py-2">Product</th>
                            <th className="px-2 py-2">Alert</th>
                            <th className="px-2 py-2 text-right">On-hand</th>
                            <th className="px-2 py-2 text-right">Coming</th>
                            <th className="px-2 py-2 text-right">Stock</th>
                            <th className="px-2 py-2 text-right">Demand HM</th>
                            <th className="px-2 py-2 text-right">Target</th>
                            <th className="px-2 py-2 text-right">Over Qty</th>
                            <th className="px-2 py-2 text-right">Over Days</th>
                            <th className="min-w-[170px] px-2 py-2">Note</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#edf1f5]">
                          {tagGroup.lines.map((line) => (
                            <tr key={line.sku}>
                              <td className="px-2 py-2 align-top">
                                <div className="grid size-14 place-items-center overflow-hidden rounded-md border border-[#dfe4ea] bg-[#f6f7f9]">
                                  {line.imageUrl ? (
                                    <Image
                                      alt={line.productName}
                                      className="h-full w-full object-cover"
                                      height={56}
                                      loading="eager"
                                      src={line.imageUrl}
                                      unoptimized
                                      width={56}
                                    />
                                  ) : (
                                    <span className="text-[10px] text-[#7a8794]">SKU</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-2 py-2 align-top">
                                <p className="font-semibold text-[#172026]">
                                  {line.mainName || line.productName}
                                </p>
                                <p className="mt-1 font-mono text-[11px] text-[#65717f]">
                                  {line.sku}
                                </p>
                                <p className="mt-1 text-[11px] text-[#7a8794]">
                                  {line.itemStatus}
                                </p>
                              </td>
                              <td className="px-2 py-2 align-top">
                                <span
                                  className={`inline-flex rounded-md px-2 py-1 text-[11px] font-semibold ${stockAlertClass(
                                    line.stockAlert,
                                  )}`}
                                >
                                  {stockAlertLabel(line.stockAlert)}
                                </span>
                              </td>
                              <td className="px-2 py-2 text-right align-top font-mono">
                                {formatNumber(line.onHandUnits)}
                              </td>
                              <td className="px-2 py-2 text-right align-top font-mono">
                                {formatNumber(line.coming)}
                              </td>
                              <td className="px-2 py-2 text-right align-top font-mono font-semibold">
                                {formatNumber(line.stockPositionUnits)}
                              </td>
                              <td className="px-2 py-2 text-right align-top font-mono">
                                {formatDecimal(line.demandIndexHm, 2)}
                              </td>
                              <td className="px-2 py-2 text-right align-top font-mono">
                                {formatNumber(line.ropUnitsRaw)}
                              </td>
                              <td className="px-2 py-2 text-right align-top font-mono font-semibold text-[#9a3412]">
                                {formatNumber(line.overstockUnits)}
                              </td>
                              <td className="px-2 py-2 text-right align-top font-mono">
                                <div className="relative min-w-24 overflow-hidden rounded-md border border-[#ead2bd] bg-[#fffaf5] px-2 py-1 text-right">
                                  <div
                                    className="absolute inset-y-0 left-0 bg-[#f3b17a]"
                                    style={{
                                      width: `${overDaysPercent(line, maxDays)}%`,
                                    }}
                                  />
                                  <span className="relative z-10 font-semibold text-[#7c2d12]">
                                    {line.overstockDays === null
                                      ? "Dead"
                                      : `${formatDecimal(line.overstockDays, 0)}d`}
                                  </span>
                                </div>
                              </td>
                              <td className="px-2 py-2 align-top text-[#52606d]">
                                {line.note || line.hideReason || "-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                        );
                      })()}
                    </div>
                  </section>
                ))}
              </div>
            </section>
          ))
        ) : (
          <section className="rounded-lg border border-[#dfe4ea] bg-white p-8 text-center text-[#52606d]">
            No overstock or dead stock items found for this report.
          </section>
        )}
      </section>
    </main>
  );
}

function SupplierMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#b9c3cc]">
        {label}
      </p>
      <p className="mt-1 font-mono text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
