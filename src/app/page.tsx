import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  ClipboardList,
  Database,
  FileSpreadsheet,
  PackageSearch,
  Settings2,
} from "lucide-react";
import Link from "next/link";
import { getDashboardData } from "@/lib/dashboard-data";
import { formatNumber } from "@/lib/baseline-data";

export const dynamic = "force-dynamic";

const envLabels: Record<string, string> = {
  supabaseUrl: "Supabase URL",
  supabaseServiceRoleKey: "Supabase service key",
  shopifyShopDomain: "Shopify shop",
  shopifyAdminAccessToken: "Shopify token",
  syncSecret: "Sync secret",
  cronSecret: "Cron secret",
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(value);

const formatPercent = (value: number) =>
  new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  }).format(value);

function alertClass(status: string) {
  if (status === "order_now") {
    return "text-[#9a3412]";
  }
  if (status === "watch") {
    return "text-[#946200]";
  }
  return "text-[#1f6b3d]";
}

export default async function Home() {
  const data = await getDashboardData();

  return (
    <main className="min-h-screen bg-[#f6f7f9] text-[#172026]">
      <header className="border-b border-[#d9dde3] bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-5 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64707d]">
              Purchasing Control Room
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-[#172026]">
              Inventory Purchasing Dashboard
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#52606d]">
              Operational view for Shopify stock, reorder pressure, supplier exposure,
              and open PO incoming quantity. Purchasing Decision is now the working
              sheet for overrides and hidden event items.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Link
              className="inline-flex h-10 items-center gap-2 rounded-md border border-[#cfd6df] bg-[#f9fafb] px-3 font-medium text-[#364252]"
              href="/purchasing-decision"
            >
              <FileSpreadsheet size={16} />
              Purchasing Decision
            </Link>
            <Link
              className="inline-flex h-10 items-center gap-2 rounded-md border border-[#cfd6df] bg-[#f9fafb] px-3 font-medium text-[#364252]"
              href="/purchasing-setup"
            >
              <Settings2 size={16} />
              Setup
            </Link>
            <Link
              className="inline-flex h-10 items-center gap-2 rounded-md border border-[#cfd6df] bg-[#f9fafb] px-3 font-medium text-[#364252]"
              href="/po"
              rel="noreferrer"
              target="_blank"
            >
              <ClipboardList size={16} />
              PO Portal
            </Link>
            <span className="inline-flex h-10 items-center gap-2 rounded-md border border-[#cfd6df] bg-[#f9fafb] px-3 font-medium text-[#364252]">
              <Database size={16} />
              {data.mode === "supabase" ? "Supabase connected" : "Excel baseline"}
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-5 py-6 sm:px-8">
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {data.metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <article
                className="rounded-lg border border-[#dfe4ea] bg-white p-4 shadow-sm"
                key={metric.label}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-[#5d6a78]">{metric.label}</p>
                    <p className="mt-2 text-3xl font-semibold text-[#172026]">
                      {metric.value}
                    </p>
                  </div>
                  <span className="grid size-10 place-items-center rounded-md bg-[#eef4f8] text-[#255f85]">
                    <Icon size={20} />
                  </span>
                </div>
                <p className="mt-3 text-sm leading-5 text-[#667380]">{metric.detail}</p>
              </article>
            );
          })}
        </section>

        <section className="grid min-w-0 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="min-w-0 rounded-lg border border-[#dfe4ea] bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-[#172026]">Sync Readiness</h2>
                <p className="mt-1 text-sm text-[#667380]">{data.lastSyncAt}</p>
              </div>
              <span className="rounded-md bg-[#eaf6ef] px-3 py-1 text-sm font-medium text-[#1f6b3d]">
                Live read model
              </span>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {data.syncSources.map((source) => {
                const Icon = source.icon;
                return (
                  <div
                    className="rounded-md border border-[#e2e7ed] bg-[#fbfcfd] p-4"
                    key={source.name}
                  >
                    <div className="flex items-start gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-md bg-white text-[#255f85] ring-1 ring-[#dce3ea]">
                        <Icon size={18} />
                      </span>
                      <div>
                        <p className="font-medium text-[#172026]">{source.name}</p>
                        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#6f7a86]">
                          {source.status}
                        </p>
                        <p className="mt-2 text-sm text-[#667380]">{source.description}</p>
                        <p className="mt-2 font-mono text-xs text-[#4b5b68]">{source.rows}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="min-w-0 rounded-lg border border-[#dfe4ea] bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-[#172026]">Environment</h2>
            <p className="mt-1 text-sm text-[#667380]">
              Required keys for sync, dashboard reads, and protected cron calls.
            </p>
            <div className="mt-5 grid gap-2">
              {Object.entries(data.env).map(([key, enabled]) => (
                <div
                  className="flex items-center justify-between gap-3 rounded-md border border-[#e2e7ed] px-3 py-2"
                  key={key}
                >
                  <span className="text-sm font-medium text-[#364252]">
                    {envLabels[key] ?? key}
                  </span>
                  <span
                    className={
                      enabled
                        ? "inline-flex items-center gap-1 rounded-md bg-[#eaf6ef] px-2 py-1 text-xs font-semibold text-[#1f6b3d]"
                        : "inline-flex items-center gap-1 rounded-md bg-[#fff4e5] px-2 py-1 text-xs font-semibold text-[#946200]"
                    }
                  >
                    {enabled ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                    {enabled ? "Ready" : "Missing"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="min-w-0 rounded-lg border border-[#dfe4ea] bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-[#e2e7ed] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[#172026]">
                Demand Data Quality
              </h2>
              <p className="mt-1 text-sm text-[#667380]">
                Cancelled, refunded, voided, and missing-SKU lines are excluded
                before calculating reorder signals.
              </p>
            </div>
            <span className="rounded-md bg-[#eaf6ef] px-3 py-2 text-xs font-semibold text-[#1f6b3d]">
              Filtered demand
            </span>
          </div>
          <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: "Sales lines",
                value: formatNumber(data.demandQuality.totalLines),
                detail: "total in Supabase",
              },
              {
                label: "Sample usable",
                value: `${formatPercent(
                  data.demandQuality.countableLines > 0
                    ? (data.demandQuality.countableLines /
                        (data.demandQuality.countableLines +
                          data.demandQuality.excludedLines)) *
                        100
                    : 0,
                )}%`,
                detail: `${formatNumber(data.demandQuality.countableLines)} countable`,
              },
              {
                label: "Cancelled/refunded",
                value: formatNumber(
                  data.demandQuality.cancelledLines + data.demandQuality.refundedLines,
                ),
                detail: "excluded from demand",
              },
              {
                label: "Missing SKU",
                value: formatNumber(data.demandQuality.missingSkuLines),
                detail: "excluded until mapped",
              },
            ].map((item) => (
              <div
                className="rounded-md border border-[#e2e7ed] bg-[#fbfcfd] p-4"
                key={item.label}
              >
                <p className="text-sm font-medium text-[#5d6a78]">{item.label}</p>
                <p className="mt-2 text-2xl font-semibold text-[#172026]">
                  {item.value}
                </p>
                <p className="mt-2 text-sm text-[#667380]">{item.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid min-w-0 gap-6 xl:grid-cols-[1fr_1fr]">
          {data.demandInsights.length > 0 ? (
            <div className="min-w-0 rounded-lg border border-[#dfe4ea] bg-white shadow-sm">
              <div className="flex items-start justify-between gap-4 border-b border-[#e2e7ed] p-5">
                <div>
                  <h2 className="text-lg font-semibold text-[#172026]">
                    Reorder Signal
                  </h2>
                  <p className="mt-1 text-sm text-[#667380]">
                    Active purchasing SKUs only. Hidden event items from Purchasing
                    Decision are excluded.
                  </p>
                </div>
                <Link
                  className="inline-flex items-center gap-2 rounded-md bg-[#172026] px-3 py-2 text-xs font-semibold text-white"
                  href="/purchasing-decision"
                >
                  Tune controls
                  <ArrowUpRight size={14} />
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-[#f3f5f7] text-xs uppercase tracking-[0.12em] text-[#65717f]">
                    <tr>
                      <th className="px-4 py-3 font-semibold">SKU</th>
                      <th className="px-4 py-3 font-semibold">Product</th>
                      <th className="px-4 py-3 text-right font-semibold">30D</th>
                      <th className="px-4 py-3 text-right font-semibold">Stock</th>
                      <th className="px-4 py-3 text-right font-semibold">Cover</th>
                      <th className="px-4 py-3 text-right font-semibold">Suggest</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#edf1f5]">
                    {data.demandInsights.map((line) => (
                      <tr key={line.sku}>
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-[#42505c]">
                          {line.sku}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-[#172026]">{line.product}</p>
                          <p className={`mt-1 text-xs font-semibold ${alertClass(line.status)}`}>
                            {line.status === "order_now"
                              ? "Order now"
                              : line.status === "watch"
                                ? "Watch"
                                : "Healthy"}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          {formatNumber(line.sold30)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          {formatNumber(line.stockOnHand)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          {line.coverageDays === null
                            ? "-"
                            : `${Math.floor(line.coverageDays)}d`}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-[#1f6b3d]">
                          {formatNumber(line.suggestedQty)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {data.comebackSignals.length > 0 ? (
            <div className="min-w-0 rounded-lg border border-[#dfe4ea] bg-white shadow-sm">
              <div className="flex items-start justify-between gap-4 border-b border-[#e2e7ed] p-5">
                <div>
                  <h2 className="text-lg font-semibold text-[#172026]">
                    OOS Comeback Signal
                  </h2>
                  <p className="mt-1 text-sm text-[#667380]">
                    Stockout candidates with meaningful sales history. Kept as a
                    purchasing signal instead of a main action queue.
                  </p>
                </div>
                <PackageSearch className="text-[#64707d]" size={20} />
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-[#f3f5f7] text-xs uppercase tracking-[0.12em] text-[#65717f]">
                    <tr>
                      <th className="px-4 py-3 font-semibold">SKU</th>
                      <th className="px-4 py-3 font-semibold">Product</th>
                      <th className="px-4 py-3 text-right font-semibold">Quiet</th>
                      <th className="px-4 py-3 text-right font-semibold">Hist</th>
                      <th className="px-4 py-3 text-right font-semibold">Index</th>
                      <th className="px-4 py-3 text-right font-semibold">Suggest</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#edf1f5]">
                    {data.comebackSignals.map((line) => (
                      <tr key={line.sku}>
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-[#42505c]">
                          {line.sku}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-[#172026]">{line.product}</p>
                          <p className="mt-1 text-xs font-semibold text-[#9a3412]">
                            Last sold {line.lastSoldDate}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          {formatNumber(line.quietDays)}d
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          {formatNumber(line.historicalSold)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          {line.demandIndex.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-[#1f6b3d]">
                          {formatNumber(line.suggestedQty)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </section>

        <section className="min-w-0 rounded-lg border border-[#dfe4ea] bg-white shadow-sm">
          <div className="flex items-start justify-between gap-4 border-b border-[#e2e7ed] p-5">
            <div>
              <h2 className="text-lg font-semibold text-[#172026]">Supplier Split</h2>
              <p className="mt-1 text-sm text-[#667380]">
                Supplier exposure from live Shopify inventory and open PO incoming.
                Values use Shopify variant price as an estimate.
              </p>
            </div>
            <Settings2 className="text-[#64707d]" size={20} />
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#f3f5f7] text-xs uppercase tracking-[0.12em] text-[#65717f]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Supplier</th>
                  <th className="px-4 py-3 text-right font-semibold">Variants</th>
                  <th className="px-4 py-3 text-right font-semibold">On-hand</th>
                  <th className="px-4 py-3 text-right font-semibold">Coming</th>
                  <th className="px-4 py-3 text-right font-semibold">Inventory value</th>
                  <th className="px-4 py-3 text-right font-semibold">Coming value</th>
                  <th className="px-4 py-3 text-right font-semibold">Currency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf1f5]">
                {data.supplierSummaries.map((supplier) => (
                  <tr key={supplier.supplier}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#172026]">{supplier.supplier}</p>
                      <p className="mt-1 text-xs text-[#6b7785]">
                        {supplier.leadTimeNote}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {formatNumber(supplier.variants)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {formatNumber(supplier.onHandQty ?? supplier.suggestedQty)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {formatNumber(supplier.activeIncomingQty ?? 0)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-[#172026]">
                      {formatCurrency(supplier.inventoryValue ?? 0)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {formatCurrency(supplier.incomingValue ?? 0)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {supplier.currency}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-3 lg:grid-cols-3">
          {data.validationWarnings.map((warning) => {
            const Icon = warning.icon;
            return (
              <article
                className="rounded-lg border border-[#f0d9aa] bg-[#fffaf0] p-4"
                key={warning.title}
              >
                <div className="flex items-start gap-3">
                  <Icon className="mt-0.5 shrink-0 text-[#a56b00]" size={20} />
                  <div>
                    <h3 className="font-semibold text-[#2b2519]">{warning.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-[#6f5a31]">
                      {warning.description}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}
