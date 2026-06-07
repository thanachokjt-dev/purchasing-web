import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import {
  FIXED_LANDCOST_ESTIMATE,
  getCostPriceMonitorData,
} from "@/lib/cost-price-monitor";
import { canAccessCostPriceMonitor, defaultLandingForUser } from "@/lib/role-nav";
import {
  catalogScopeLine,
  formatEtaDate,
  formatThb,
  generatedCatalogDate,
  resolveCatalogRows,
  toNonNegativeNumber,
  type CatalogIncomingEta,
} from "@/lib/cost-price-catalog";

export const dynamic = "force-dynamic";

type PrintSearchParams = {
  category?: string;
  direction?: string;
  estimatedLandCost?: string;
  group?: string;
  lowMarginOnly?: string;
  missingCostOnly?: string;
  poStatus?: string;
  q?: string;
  selected?: string | string[];
  sort?: string;
  supplier?: string | string[];
  visibility?: string;
};

function marginClass(value: number | null) {
  if (value === null) {
    return "text-[#667380]";
  }
  if (value < 20) {
    return "font-semibold text-red-700";
  }
  if (value < 35) {
    return "font-semibold text-amber-700";
  }
  return "font-semibold text-emerald-700";
}

function marginText(value: number | null) {
  return value === null ? "N/A" : `${value.toFixed(1)}%`;
}

function IncomingEtaBlock({ incoming }: { incoming: CatalogIncomingEta }) {
  return (
    <div className="min-w-[150px] whitespace-normal text-[11px] leading-[1.4] text-[#44515f]">
      <p><span className="font-semibold text-[#172026]">Expected arrival:</span> {formatEtaDate(incoming.etaDate)}</p>
      <p><span className="font-semibold text-[#172026]">Timing:</span> {incoming.timing}</p>
      <p><span className="font-semibold text-[#172026]">Quarter:</span> {incoming.quarter}</p>
      <p>
        {incoming.poCount > 1 ? (
          <span>{incoming.poCount} incoming PO records</span>
        ) : (
          <>
            <span className="font-semibold text-[#172026]">PO:</span>{" "}
            <span className="break-normal">{incoming.poReference}</span>
          </>
        )}
        {incoming.additionalPoCount > 0 ? ` | Additional incoming POs: ${incoming.additionalPoCount}` : ""}
      </p>
      <div className="mt-2 max-w-[190px]">
        <div className="flex items-center justify-between text-[10px] font-semibold uppercase text-[#667380]">
          <span>Today</span>
          <span>{incoming.quarter}</span>
          <span>ETA</span>
        </div>
        <div className="mt-1 flex h-2 overflow-hidden rounded-full border border-[#cfd6df] bg-[#edf1f5]">
          <span className="h-full w-2 rounded-full bg-[#172026]" />
          <span className="h-full flex-1 bg-[#d7e7f2]" />
          <span className="h-full w-2 rounded-full bg-[#255f85]" />
        </div>
        <p className="mt-1 text-[10px] font-semibold text-[#255f85]">{incoming.timing}</p>
      </div>
    </div>
  );
}

export default async function CatalogPrintPage({
  searchParams,
}: {
  searchParams: Promise<PrintSearchParams>;
}) {
  const params = await searchParams;
  const currentUser = await requireUser("/cost-price-monitor/print");
  if (!canAccessCostPriceMonitor(currentUser)) {
    redirect(
      `/access-denied?from=${encodeURIComponent("/cost-price-monitor/print")}&next=${encodeURIComponent(
        defaultLandingForUser(currentUser),
      )}`,
    );
  }

  const data = await getCostPriceMonitorData({
    ...params,
    exportAll: true,
    lowMarginOnly: params.lowMarginOnly,
    missingCostOnly: params.missingCostOnly,
    sort: params.sort || "main_name",
  });
  const estimatedLandCost = toNonNegativeNumber(params.estimatedLandCost, FIXED_LANDCOST_ESTIMATE);
  const { catalogRows, incomingEtaByGroup } = await resolveCatalogRows(data.rows, estimatedLandCost, params.group ?? "");
  const hasIncomingEta = incomingEtaByGroup.size > 0;
  const sectionMap = new Map<string, typeof catalogRows>();
  for (const row of catalogRows) {
    const rows = sectionMap.get(row.groupLabel) ?? [];
    rows.push(row);
    sectionMap.set(row.groupLabel, rows);
  }
  const sections = [...sectionMap.entries()];

  return (
    <main className="min-h-screen bg-white p-6 text-[#172026]">
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          .no-print { display: none !important; }
          body { background: white !important; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          section { break-inside: avoid-page; }
        }
      `}</style>
      <script dangerouslySetInnerHTML={{ __html: "window.addEventListener('load', () => setTimeout(() => window.print(), 250));" }} />
      <div className="no-print mb-4 flex gap-2">
        <a className="rounded-md border border-[#cfd6df] px-4 py-2 text-sm font-semibold text-[#364252]" href="/cost-price-monitor">
          Back to Cost Price Monitor
        </a>
      </div>

      <header className="mb-5">
        <h1 className="text-2xl font-semibold tracking-normal">Wholesale Catalog</h1>
        <p className="mt-1 text-sm text-[#52606d]">Product name, picture, cost price, sales price, margin, incoming ETA</p>
        <p className="mt-1 text-xs font-medium text-[#667380]">Generated {generatedCatalogDate()}</p>
        <p className="mt-1 text-xs font-semibold text-[#44515f]">
          Max estimated land cost / unit: {formatThb(estimatedLandCost)}
        </p>
        <p className="mt-2 text-xs font-semibold text-[#44515f]">
          {catalogScopeLine({
            ...params,
            selectedRowCount: data.rows.length,
            suppliers: data.filters.suppliers,
          })}
        </p>
        {hasIncomingEta ? (
          <p className="mt-1 text-xs font-medium text-[#667380]">
            Incoming ETA based on open physical PO records only.
          </p>
        ) : null}
      </header>

      {sections.length > 0 ? (
        <div className="grid gap-6">
          {sections.map(([label, sectionRows]) => (
            <section key={label}>
              <h2 className="mb-2 text-sm font-semibold tracking-normal">Product Group: {label}</h2>
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-y border-[#cfd6df] bg-[#f4f6f8]">
                    <th className="w-[21%] px-3 py-2 font-semibold">Product Name</th>
                    <th className="w-[13%] px-3 py-2 font-semibold">Picture</th>
                    <th className="w-[9%] px-3 py-2 font-semibold">Qty</th>
                    <th className="w-[21%] px-3 py-2 font-semibold">Cost Price</th>
                    <th className="w-[9%] px-3 py-2 font-semibold">Sales Price</th>
                    <th className="w-[8%] px-3 py-2 font-semibold">Margin %</th>
                    <th className="w-[19%] px-3 py-2 font-semibold">Incoming ETA</th>
                  </tr>
                </thead>
                <tbody>
                  {sectionRows.map((catalogRow) => {
                    const {
                      currentQty,
                      estimatedCost,
                      incomingEta,
                      incomingQty,
                      landedAddOn,
                      latestPurchaseCost,
                      marginPct,
                      productName,
                      row,
                      totalQty,
                    } = catalogRow;
                    return (
                      <tr className="border-b border-[#e1e6ec]" key={row.groupKey}>
                        <td className="px-3 py-3 align-middle text-sm font-semibold">{productName}</td>
                        <td className="px-3 py-3 align-middle">
                          <div className="grid size-24 place-items-center overflow-hidden rounded border border-[#dfe4ea] bg-white p-1">
                            {row.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img alt="" className="max-h-full max-w-full object-contain object-center" src={row.imageUrl} />
                            ) : (
                              <span className="text-center text-[11px] font-medium text-[#667380]">No image</span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 align-middle text-[11px] leading-[1.45] text-[#44515f]">
                          <p>Current: {currentQty}</p>
                          <p>Incoming: {incomingQty}</p>
                          <p className="font-semibold text-[#172026]">Total: {totalQty}</p>
                        </td>
                        <td className="px-3 py-3 align-middle">
                          <p className="font-semibold">Latest purchase: {latestPurchaseCost > 0 ? formatThb(latestPurchaseCost) : "Missing cost"}</p>
                          <p className="mt-1 text-[#52606d]">Max est. land cost: {formatThb(landedAddOn)}</p>
                          <p className="mt-1 font-semibold text-[#172026]">
                            Max estimated cost: {estimatedCost > 0 ? formatThb(estimatedCost) : "Missing cost"}
                          </p>
                        </td>
                        <td className="px-3 py-3 align-middle">
                          <p className="font-semibold">{row.sellingPrice > 0 ? formatThb(row.sellingPrice) : "Missing sales price"}</p>
                        </td>
                        <td className={`px-3 py-3 align-middle ${marginClass(marginPct)}`}>{marginText(marginPct)}</td>
                        <td className="px-3 py-3 align-top">
                          {incomingEta ? <IncomingEtaBlock incoming={incomingEta} /> : <span className="text-[#9aa5b1]">-</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      ) : (
        <div className="rounded border border-dashed border-[#cfd6df] px-4 py-8 text-center text-sm text-[#667380]">
          No product groups match the current filters.
        </div>
      )}
    </main>
  );
}
