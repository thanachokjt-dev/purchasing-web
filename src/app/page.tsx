import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Database,
  Settings2,
} from "lucide-react";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { getDashboardData } from "@/lib/dashboard-data";
import { formatNumber } from "@/lib/baseline-data";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

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

async function saveManualSupplierMapping(formData: FormData) {
  "use server";

  const sku = String(formData.get("sku") ?? "").trim();
  const supplier = String(formData.get("supplier") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();

  if (!sku || !supplier) {
    return;
  }

  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return;
  }

  await supabase.from("manual_supplier_mappings").upsert(
    {
      sku,
      supplier,
      note: note || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "sku" },
  );

  revalidatePath("/");
}

export default async function Home() {
  const data = await getDashboardData();
  const thaiTotal = data.thaiTshirtMatrix.reduce((sum, row) => sum + row.total, 0);
  const queueMappedManually = data.buyerReviewQueue.filter(
    (line) => line.supplierSource === "manual",
  ).length;
  const queueMappedFromExcel = data.buyerReviewQueue.filter(
    (line) => line.supplierSource === "excel",
  ).length;
  const queueMappedFromVendor = data.buyerReviewQueue.filter(
    (line) => line.supplierSource === "shopify_vendor",
  ).length;
  const queueActiveIncoming = data.buyerReviewQueue.reduce(
    (sum, line) => sum + line.activeIncomingQty,
    0,
  );
  const queueNetSuggested = data.buyerReviewQueue.reduce(
    (sum, line) => sum + line.netSuggestedQty,
    0,
  );

  return (
    <main className="min-h-screen bg-[#f6f7f9] text-[#172026]">
      <header className="border-b border-[#d9dde3] bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-5 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64707d]">
              Phase 1 · Shopify sync + read-only dashboard
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-[#172026]">
              Purchasing Control Room
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#52606d]">
              Read-only view for daily Shopify inventory, demand signals, reorder
              alerts, and supplier split validation before creating RFQ or PO
              workflows.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Link
              className="inline-flex items-center gap-2 rounded-md border border-[#cfd6df] bg-[#f9fafb] px-3 py-2 font-medium text-[#364252]"
              href="/po"
            >
              <ClipboardList size={16} />
              PO Portal
            </Link>
            <span className="inline-flex items-center gap-2 rounded-md border border-[#cfd6df] bg-[#f9fafb] px-3 py-2 font-medium text-[#364252]">
              <Clock3 size={16} />
              Daily sync target 05:00 ICT
            </span>
            <span className="inline-flex items-center gap-2 rounded-md border border-[#cfd6df] bg-[#f9fafb] px-3 py-2 font-medium text-[#364252]">
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
                key={metric.label}
                className="rounded-lg border border-[#dfe4ea] bg-white p-4 shadow-sm"
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
                Read-only
              </span>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {data.syncSources.map((source) => {
                const Icon = source.icon;
                return (
                  <div
                    key={source.name}
                    className="rounded-md border border-[#e2e7ed] bg-[#fbfcfd] p-4"
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
              Phase 1 can run with Excel baseline while credentials are prepared.
            </p>
            <div className="mt-5 grid gap-2">
              {Object.entries(data.env).map(([key, enabled]) => (
                <div
                  key={key}
                  className="flex items-center justify-between gap-3 rounded-md border border-[#e2e7ed] px-3 py-2"
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
                Demand formulas exclude cancelled, refunded, voided, and missing-SKU
                lines before calculating reorder signals.
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
                detail: `${formatNumber(data.demandQuality.countableLines)} countable in dashboard sample`,
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
                key={item.label}
                className="rounded-md border border-[#e2e7ed] bg-[#fbfcfd] p-4"
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

        {data.buyerReviewQueue.length > 0 ? (
          <section className="min-w-0 rounded-lg border border-[#dfe4ea] bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-[#e2e7ed] p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[#172026]">
                  Buyer Review Queue
                </h2>
                <p className="mt-1 text-sm text-[#667380]">
                  Consolidated action list from active reorder signals and OOS
                  comeback candidates, net of active incoming PO quantities.
                </p>
              </div>
              <span className="rounded-md bg-[#172026] px-3 py-2 text-xs font-semibold text-white">
                {formatNumber(data.buyerReviewQueue.length)} SKUs ·{" "}
                {formatNumber(queueMappedManually)} manual ·{" "}
                {formatNumber(queueMappedFromExcel)} Excel ·{" "}
                {formatNumber(queueMappedFromVendor)} vendor · incoming{" "}
                {formatNumber(queueActiveIncoming)} · net{" "}
                {formatNumber(queueNetSuggested)}
              </span>
            </div>
            <div className="border-b border-[#e2e7ed] bg-[#fbfcfd] p-5">
              {data.manualSupplierMappingReady ? (
                <form
                  action={saveManualSupplierMapping}
                  className="grid gap-3 md:grid-cols-[minmax(140px,0.8fr)_minmax(180px,1fr)_minmax(180px,1fr)_auto]"
                >
                  <label className="grid gap-1">
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#65717f]">
                      SKU
                    </span>
                    <input
                      className="h-10 rounded-md border border-[#cfd6df] bg-white px-3 text-sm text-[#172026] outline-none focus:border-[#255f85]"
                      name="sku"
                      placeholder="BT-..."
                      required
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#65717f]">
                      Supplier
                    </span>
                    <input
                      className="h-10 rounded-md border border-[#cfd6df] bg-white px-3 text-sm text-[#172026] outline-none focus:border-[#255f85]"
                      name="supplier"
                      placeholder="Supplier name"
                      required
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#65717f]">
                      Note
                    </span>
                    <input
                      className="h-10 rounded-md border border-[#cfd6df] bg-white px-3 text-sm text-[#172026] outline-none focus:border-[#255f85]"
                      name="note"
                      placeholder="Optional"
                    />
                  </label>
                  <button
                    className="mt-5 h-10 rounded-md bg-[#172026] px-4 text-sm font-semibold text-white"
                    type="submit"
                  >
                    Save
                  </button>
                </form>
              ) : (
                <p className="text-sm text-[#667380]">
                  Apply `supabase/migrations/003_manual_supplier_mappings.sql`
                  to enable manual supplier overrides.
                </p>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[#f3f5f7] text-xs uppercase tracking-[0.12em] text-[#65717f]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Priority</th>
                    <th className="px-4 py-3 font-semibold">SKU</th>
                    <th className="px-4 py-3 font-semibold">Product</th>
                    <th className="px-4 py-3 font-semibold">Reason</th>
                    <th className="px-4 py-3 text-right font-semibold">Stock</th>
                    <th className="px-4 py-3 text-right font-semibold">30D</th>
                    <th className="px-4 py-3 text-right font-semibold">Cover</th>
                    <th className="px-4 py-3 text-right font-semibold">Suggest</th>
                    <th className="px-4 py-3 text-right font-semibold">Incoming</th>
                    <th className="px-4 py-3 text-right font-semibold">Net</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf1f5]">
                  {data.buyerReviewQueue.map((line) => (
                    <tr key={`${line.source}-${line.sku}`}>
                      <td className="px-4 py-3">
                        <span
                          className={
                            line.priority === "critical"
                              ? "inline-flex rounded-md bg-[#fff1e8] px-2 py-1 text-xs font-semibold text-[#9a3412]"
                              : line.priority === "high"
                                ? "inline-flex rounded-md bg-[#fff4e5] px-2 py-1 text-xs font-semibold text-[#946200]"
                                : "inline-flex rounded-md bg-[#eef4f8] px-2 py-1 text-xs font-semibold text-[#255f85]"
                          }
                        >
                          {line.priority === "critical"
                            ? "Critical"
                            : line.priority === "high"
                              ? "High"
                              : "Watch"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-[#42505c]">
                        {line.sku}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-[#172026]">{line.product}</p>
                        <p className="mt-1 text-xs text-[#6b7785]">
                          {line.supplier ?? "Supplier mapping pending"} ·{" "}
                          {line.source === "comeback" ? "Comeback" : "Reorder"}
                          {line.supplierSource === "manual"
                            ? " · manual override"
                            : line.supplierSource === "shopify_vendor"
                            ? " · vendor fallback"
                            : line.supplierSource === "excel"
                              ? " · Excel supplier"
                              : ""}
                        </p>
                        <p className="mt-1 text-xs text-[#6b7785]">
                          {line.currency ? `${line.currency}` : "Currency pending"}
                          {line.moq ? ` · MOQ ${line.moq}` : ""}
                          {line.supplierLeadTimeDays
                            ? ` · LT ${formatNumber(line.supplierLeadTimeDays)}d`
                            : ""}
                          {line.paymentTerms ? ` · ${line.paymentTerms}` : ""}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-[#52606d]">{line.reason}</td>
                      <td className="px-4 py-3 text-right font-mono">
                        {formatNumber(line.stockOnHand)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {line.sold30 === null ? "-" : formatNumber(line.sold30)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {line.coverageDays === null
                          ? "-"
                          : `${Math.floor(line.coverageDays)}d`}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-[#1f6b3d]">
                        {formatNumber(line.suggestedQty)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        <p>{formatNumber(line.activeIncomingQty)}</p>
                        {line.pendingApprovalQty > 0 ? (
                          <p className="mt-1 text-xs text-[#946200]">
                            +{formatNumber(line.pendingApprovalQty)} pending
                          </p>
                        ) : null}
                      </td>
                      <td
                        className={
                          line.netSuggestedQty > 0
                            ? "px-4 py-3 text-right font-mono font-semibold text-[#1f6b3d]"
                            : "px-4 py-3 text-right font-mono font-semibold text-[#667380]"
                        }
                      >
                        {formatNumber(line.netSuggestedQty)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {data.demandLines.length > 0 ? (
          <section className="min-w-0 rounded-lg border border-[#dfe4ea] bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-[#e2e7ed] p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[#172026]">
                  Live Shopify Demand
                </h2>
                <p className="mt-1 text-sm text-[#667380]">
                  Sales quantity grouped by SKU from the latest daily sync window.
                </p>
              </div>
              <span className="rounded-md bg-[#eef4f8] px-3 py-2 font-mono text-xs font-semibold text-[#255f85]">
                {data.demandWindowLabel}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[#f3f5f7] text-xs uppercase tracking-[0.12em] text-[#65717f]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">SKU</th>
                    <th className="px-4 py-3 font-semibold">Product</th>
                    <th className="px-4 py-3 text-right font-semibold">Sold</th>
                    <th className="px-4 py-3 text-right font-semibold">Orders</th>
                    <th className="px-4 py-3 text-right font-semibold">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf1f5]">
                  {data.demandLines.map((line) => (
                    <tr key={line.sku}>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-[#42505c]">
                        {line.sku}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-[#172026]">{line.product}</p>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-[#1f6b3d]">
                        {formatNumber(line.quantity)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {formatNumber(line.orderCount)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {formatCurrency(line.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {data.demandInsights.length > 0 ? (
          <section className="min-w-0 rounded-lg border border-[#dfe4ea] bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-[#e2e7ed] p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[#172026]">
                  Reorder Signal
                </h2>
                <p className="mt-1 text-sm text-[#667380]">
                  Read-only estimate using 30-day average daily sales, 60-day lead
                  time, and 14 safety stock days.
                </p>
              </div>
              <span className="rounded-md bg-[#fff4e5] px-3 py-2 text-xs font-semibold text-[#946200]">
                Draft formula
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[#f3f5f7] text-xs uppercase tracking-[0.12em] text-[#65717f]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">SKU</th>
                    <th className="px-4 py-3 font-semibold">Product</th>
                    <th className="px-4 py-3 text-right font-semibold">7D</th>
                    <th className="px-4 py-3 text-right font-semibold">30D</th>
                    <th className="px-4 py-3 text-right font-semibold">90D</th>
                    <th className="px-4 py-3 text-right font-semibold">ADS</th>
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
                        <p
                          className={
                            line.status === "order_now"
                              ? "mt-1 text-xs font-semibold text-[#9a3412]"
                              : line.status === "watch"
                                ? "mt-1 text-xs font-semibold text-[#946200]"
                                : "mt-1 text-xs font-semibold text-[#1f6b3d]"
                          }
                        >
                          {line.status === "order_now"
                            ? "Order now"
                            : line.status === "watch"
                              ? "Watch"
                              : "Healthy"}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {formatNumber(line.sold7)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {formatNumber(line.sold30)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {formatNumber(line.sold90)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {line.ads30.toFixed(2)}
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
          </section>
        ) : null}

        {data.comebackSignals.length > 0 ? (
          <section className="min-w-0 rounded-lg border border-[#dfe4ea] bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-[#e2e7ed] p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[#172026]">
                  OOS Comeback Signal
                </h2>
                <p className="mt-1 text-sm text-[#667380]">
                  Stockout-aware estimate for SKUs with no stock now but meaningful
                  sales history since 2025.
                </p>
              </div>
              <span className="rounded-md bg-[#fff4e5] px-3 py-2 text-xs font-semibold text-[#946200]">
                Uses confidence factor
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[#f3f5f7] text-xs uppercase tracking-[0.12em] text-[#65717f]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">SKU</th>
                    <th className="px-4 py-3 font-semibold">Product</th>
                    <th className="px-4 py-3 text-right font-semibold">Last sold</th>
                    <th className="px-4 py-3 text-right font-semibold">Quiet</th>
                    <th className="px-4 py-3 text-right font-semibold">Hist</th>
                    <th className="px-4 py-3 text-right font-semibold">Best mo.</th>
                    <th className="px-4 py-3 text-right font-semibold">Index</th>
                    <th className="px-4 py-3 text-right font-semibold">Conf.</th>
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
                          Stockout comeback
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {line.lastSoldDate}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {formatNumber(line.quietDays)}d
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {formatNumber(line.historicalSold)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {formatNumber(line.bestMonthSold)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {line.demandIndex.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {Math.round(line.confidence * 100)}%
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-[#1f6b3d]">
                        {formatNumber(line.suggestedQty)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        <section className="grid min-w-0 gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="min-w-0 rounded-lg border border-[#dfe4ea] bg-white shadow-sm">
            <div className="border-b border-[#e2e7ed] p-5">
              <h2 className="text-lg font-semibold text-[#172026]">Supplier Split</h2>
              <p className="mt-1 text-sm text-[#667380]">
                Suggested qty grouped by supplier from the Excel decision baseline.
              </p>
            </div>
            <div className="divide-y divide-[#edf1f5]">
              {data.supplierSummaries.map((supplier) => (
                <div
                  key={supplier.supplier}
                  className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_auto]"
                >
                  <div>
                    <p className="font-medium text-[#172026]">{supplier.supplier}</p>
                    <p className="mt-1 text-sm text-[#667380]">{supplier.leadTimeNote}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-right">
                    <div>
                      <p className="text-xs uppercase tracking-[0.12em] text-[#74808c]">
                        Variants
                      </p>
                      <p className="font-mono font-semibold text-[#172026]">
                        {supplier.variants}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.12em] text-[#74808c]">
                        Qty
                      </p>
                      <p className="font-mono font-semibold text-[#172026]">
                        {formatNumber(supplier.suggestedQty)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.12em] text-[#74808c]">
                        FX
                      </p>
                      <p className="font-mono font-semibold text-[#172026]">
                        {supplier.currency}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="min-w-0 rounded-lg border border-[#dfe4ea] bg-white shadow-sm">
            <div className="flex items-start justify-between gap-4 border-b border-[#e2e7ed] p-5">
              <div>
                <h2 className="text-lg font-semibold text-[#172026]">Top Reorder Alerts</h2>
                <p className="mt-1 text-sm text-[#667380]">
                  Demand uses live Shopify sales when the SKU appears in the latest sync.
                </p>
              </div>
              <Settings2 className="text-[#64707d]" size={20} />
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[#f3f5f7] text-xs uppercase tracking-[0.12em] text-[#65717f]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">SKU</th>
                    <th className="px-4 py-3 font-semibold">Product</th>
                    <th className="px-4 py-3 text-right font-semibold">Demand</th>
                    <th className="px-4 py-3 text-right font-semibold">Stock</th>
                    <th className="px-4 py-3 text-right font-semibold">Excel</th>
                    <th className="px-4 py-3 text-right font-semibold">Net</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf1f5]">
                  {data.topReorderLines.map((line) => (
                    <tr key={line.sku}>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-[#42505c]">
                        {line.sku}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-[#172026]">{line.product}</p>
                        <p className="mt-1 text-xs text-[#6b7785]">
                          {line.supplier} · {line.tag}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {line.demandIndex.toFixed(line.demandIndex >= 10 ? 2 : 4)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{line.onHand}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-[#255f85]">
                        {formatNumber(line.excelQty)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-[#1f6b3d]">
                        {formatNumber(line.netQty)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="min-w-0 rounded-lg border border-[#dfe4ea] bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-[#e2e7ed] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[#172026]">
                Thai T-shirt Supplier Matrix
              </h2>
              <p className="mt-1 text-sm text-[#667380]">
                Read-only reconstruction of `RE-ORDER THAIT-SHIRT` for validation.
              </p>
            </div>
            <span className="rounded-md bg-[#eef4f8] px-3 py-2 font-mono text-sm font-semibold text-[#255f85]">
              Total {formatNumber(thaiTotal)}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#f3f5f7] text-xs uppercase tracking-[0.12em] text-[#65717f]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Product</th>
                  {["XS", "S", "M", "L", "XL", "2XL", "Total"].map((size) => (
                    <th key={size} className="px-4 py-3 text-right font-semibold">
                      {size}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf1f5]">
                {data.thaiTshirtMatrix.map((row) => (
                  <tr key={row.product}>
                    <td className="px-4 py-3 font-medium text-[#172026]">{row.product}</td>
                    <td className="px-4 py-3 text-right font-mono">{row.xs}</td>
                    <td className="px-4 py-3 text-right font-mono">{row.s}</td>
                    <td className="px-4 py-3 text-right font-mono">{row.m}</td>
                    <td className="px-4 py-3 text-right font-mono">{row.l}</td>
                    <td className="px-4 py-3 text-right font-mono">{row.xl}</td>
                    <td className="px-4 py-3 text-right font-mono">{row.twoXl}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">
                      {row.total}
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
                key={warning.title}
                className="rounded-lg border border-[#f0d9aa] bg-[#fffaf0] p-4"
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

        <section className="rounded-lg border border-[#dfe4ea] bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[#172026]">Phase 1 API Surface</h2>
              <p className="mt-1 text-sm text-[#667380]">
                Backend endpoints are present for health checks and protected sync calls.
              </p>
            </div>
            <a
              className="inline-flex items-center gap-2 rounded-md bg-[#172026] px-4 py-2 text-sm font-semibold text-white"
              href="/api/health"
            >
              Health endpoint
              <ArrowUpRight size={16} />
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
