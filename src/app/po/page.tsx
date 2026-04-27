import Link from "next/link";
import {
  ArrowLeft,
  ClipboardList,
  Factory,
  PackageCheck,
  Truck,
} from "lucide-react";
import { getPoPortalData } from "@/lib/po-portal";
import { formatNumber } from "@/lib/baseline-data";

export const dynamic = "force-dynamic";

const formatCurrency = (value: number, currency: string) =>
  new Intl.NumberFormat("en-US", {
    currency: currency || "THB",
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
    style: "currency",
  }).format(value);

const formatPercent = (value: number) =>
  new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
    style: "percent",
  }).format(value);

const statusClass = (status: string) => {
  const normalized = status.toLowerCase();
  if (normalized === "delivery") {
    return "bg-[#eaf6ef] text-[#1f6b3d]";
  }
  if (normalized === "inpro" || normalized === "final_payment") {
    return "bg-[#fff4e5] text-[#946200]";
  }
  if (normalized === "waiting_for_approve") {
    return "bg-[#eef4f8] text-[#255f85]";
  }
  return "bg-[#f3f5f7] text-[#52606d]";
};

export default async function PoPortalPage() {
  const data = await getPoPortalData();

  return (
    <main className="min-h-screen bg-[#f6f7f9] text-[#172026]">
      <header className="border-b border-[#d9dde3] bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-5 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64707d]">
              Phase 2 preview · AppSheet PO export
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal">
              PO Portal
            </h1>
            <span className="mt-3 inline-flex rounded-md bg-[#eef4f8] px-2 py-1 text-xs font-semibold text-[#255f85]">
              {data.source === "supabase"
                ? "Live Supabase PO workflow"
                : "AppSheet PO export fallback"}
            </span>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#52606d]">
              Read-only view of PO lifecycle data from `Po-Portals.xlsx`, including
              supplier terms, receiving progress, active incoming quantities, and
              pending approvals.
            </p>
          </div>
          <Link
            className="inline-flex items-center gap-2 self-start rounded-md border border-[#cfd6df] bg-[#f9fafb] px-4 py-2 text-sm font-semibold text-[#364252]"
            href="/"
          >
            <ArrowLeft size={16} />
            Dashboard
          </Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-5 py-6 sm:px-8">
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              detail: `${formatNumber(data.metrics.supplierCount)} suppliers`,
              icon: ClipboardList,
              label: "Purchase orders",
              value: formatNumber(data.metrics.poCount),
            },
            {
              detail: "active PO statuses only",
              icon: Truck,
              label: "Incoming units",
              value: formatNumber(data.metrics.activeIncomingTotal),
            },
            {
              detail: "waiting for approval",
              icon: Factory,
              label: "Pending units",
              value: formatNumber(data.metrics.pendingApprovalTotal),
            },
            {
              detail: `${formatNumber(data.metrics.receivedTotal)} received from ${formatNumber(
                data.metrics.orderedTotal,
              )} ordered`,
              icon: PackageCheck,
              label: "Receiving rate",
              value: formatPercent(data.metrics.receivedRate),
            },
          ].map((metric) => {
            const Icon = metric.icon;
            return (
              <article
                className="rounded-lg border border-[#dfe4ea] bg-white p-4 shadow-sm"
                key={metric.label}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-[#5d6a78]">
                      {metric.label}
                    </p>
                    <p className="mt-2 text-3xl font-semibold">{metric.value}</p>
                  </div>
                  <span className="grid size-10 place-items-center rounded-md bg-[#eef4f8] text-[#255f85]">
                    <Icon size={20} />
                  </span>
                </div>
                <p className="mt-3 text-sm leading-5 text-[#667380]">
                  {metric.detail}
                </p>
              </article>
            );
          })}
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.7fr_1.3fr]">
          <div className="rounded-lg border border-[#dfe4ea] bg-white shadow-sm">
            <div className="border-b border-[#e2e7ed] p-5">
              <h2 className="text-lg font-semibold">PO Status Pipeline</h2>
              <p className="mt-1 text-sm text-[#667380]">
                Line-level status from AppSheet `PO_ITEMS`.
              </p>
            </div>
            <div className="divide-y divide-[#edf1f5]">
              {data.statusSummaries.map((row) => (
                <div
                  className="grid grid-cols-[1fr_auto] gap-3 px-5 py-4"
                  key={row.status}
                >
                  <div>
                    <span
                      className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${statusClass(
                        row.status,
                      )}`}
                    >
                      {row.status}
                    </span>
                    <p className="mt-2 text-sm text-[#667380]">
                      {formatNumber(row.poCount)} POs · {formatNumber(row.lineCount)} lines
                    </p>
                  </div>
                  <p className="self-center text-right font-mono font-semibold">
                    {formatNumber(row.outstandingQty)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="min-w-0 rounded-lg border border-[#dfe4ea] bg-white shadow-sm">
            <div className="border-b border-[#e2e7ed] p-5">
              <h2 className="text-lg font-semibold">Active PO Workbench</h2>
              <p className="mt-1 text-sm text-[#667380]">
                POs with active incoming or waiting approval quantities.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[#f3f5f7] text-xs uppercase tracking-[0.12em] text-[#65717f]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">PO</th>
                    <th className="px-4 py-3 font-semibold">Supplier</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 text-right font-semibold">Lines</th>
                    <th className="px-4 py-3 text-right font-semibold">Incoming</th>
                    <th className="px-4 py-3 text-right font-semibold">Pending</th>
                    <th className="px-4 py-3 text-right font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf1f5]">
                  {data.activeOrders.map((order) => (
                    <tr key={order.poId}>
                      <td className="whitespace-nowrap px-4 py-3">
                        <p className="font-mono text-xs font-semibold text-[#172026]">
                          {order.poId}
                        </p>
                        <p className="mt-1 text-xs text-[#6b7785]">
                          {order.poDate ? order.poDate.slice(0, 10) : "No date"}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{order.supplierName}</p>
                        <p className="mt-1 text-xs text-[#6b7785]">
                          {order.supplierCode} · {order.currency}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {order.statuses.map((status) => (
                            <span
                              className={`rounded-md px-2 py-1 text-xs font-semibold ${statusClass(
                                status,
                              )}`}
                              key={status}
                            >
                              {status}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {formatNumber(order.itemCount)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-[#1f6b3d]">
                        {formatNumber(order.activeIncomingQty)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-[#946200]">
                        {formatNumber(order.pendingApprovalQty)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {formatCurrency(order.poAmountForeign, order.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="min-w-0 rounded-lg border border-[#dfe4ea] bg-white shadow-sm">
          <div className="border-b border-[#e2e7ed] p-5">
            <h2 className="text-lg font-semibold">Open Receiving Lines</h2>
            <p className="mt-1 text-sm text-[#667380]">
              Largest outstanding item lines that are not closed.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#f3f5f7] text-xs uppercase tracking-[0.12em] text-[#65717f]">
                <tr>
                  <th className="px-4 py-3 font-semibold">PO</th>
                  <th className="px-4 py-3 font-semibold">SKU</th>
                  <th className="px-4 py-3 font-semibold">Product</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Qty</th>
                  <th className="px-4 py-3 text-right font-semibold">Received</th>
                  <th className="px-4 py-3 text-right font-semibold">Outstanding</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf1f5]">
                {data.openItems.map((item) => (
                  <tr key={item.poItemId || `${item.poId}-${item.sku}-${item.lineNo}`}>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                      {item.poId}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                      {item.sku}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{item.productTitle}</p>
                      <p className="mt-1 text-xs text-[#6b7785]">
                        {item.variantTitle || item.fullName}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-md px-2 py-1 text-xs font-semibold ${statusClass(
                          item.status,
                        )}`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {formatNumber(item.qty)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {formatNumber(item.receivedQty)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-[#1f6b3d]">
                      {formatNumber(item.outstandingQty)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
