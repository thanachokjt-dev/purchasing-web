import Link from "next/link";
import {
  ArrowLeft,
  CalendarClock,
  ClipboardList,
  Factory,
  PackageCheck,
  Truck,
  WalletCards,
} from "lucide-react";
import { getPoPortalData } from "@/lib/po-portal";
import { formatNumber } from "@/lib/baseline-data";
import { PendingSubmitButton } from "@/app/loading-controls";
import {
  AddPoItemForm,
  CreatePoForm,
  DeleteDraftPoForm,
  PoStatusFilterSelect,
  QuickPoCommentForm,
  StatusActionForm,
} from "@/app/po/po-forms";

export const dynamic = "force-dynamic";

const SORT_KEYS = new Set([
  "po",
  "date",
  "supplier",
  "status",
  "lines",
  "incoming",
  "pending",
  "amount",
]);

const DEFAULT_PO_STATUS_OPTIONS = [
  "draft",
  "waiting_for_approve",
  "follow_up",
  "inpro",
  "delivery",
  "final_payment",
  "closed",
  "cancelled",
];

const statusLabels: Record<string, string> = {
  cancelled: "Cancelled",
  closed: "Closed",
  delivery: "Delivery",
  draft: "Draft",
  final_payment: "Final payment",
  follow_up: "Follow-up",
  inpro: "In progress",
  unknown: "Unknown",
  waiting_for_approve: "Waiting approve",
};

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

function normalizeValues(value?: string | string[]) {
  return (Array.isArray(value) ? value : value ? [value] : [])
    .flatMap((item) => item.split(","))
    .map((item) => normalizeStatusLabel(item))
    .filter(Boolean);
}

function normalizeSelectedStatuses(value?: string | string[]) {
  const statuses = Array.from(new Set(normalizeValues(value)));
  return statuses.length === 0 || statuses.includes("all") ? ["all"] : statuses;
}

function compareText(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function normalizeStatusLabel(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function displayStatus(value: string) {
  return statusLabels[normalizeStatusLabel(value)] ?? value;
}

function generatedPoId() {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
    String(now.getMilliseconds()).padStart(3, "0"),
  ].join("");
  return `PO-${stamp}`;
}

const statusClass = (status: string) => {
  const normalized = normalizeStatusLabel(status);
  if (normalized === "delivery") {
    return "bg-[#eaf6ef] text-[#1f6b3d]";
  }
  if (normalized === "inpro" || normalized === "final_payment") {
    return "bg-[#fff4e5] text-[#946200]";
  }
  if (normalized === "follow_up") {
    return "bg-[#f1ecff] text-[#6b3fb3]";
  }
  if (normalized === "waiting_for_approve") {
    return "bg-[#eef4f8] text-[#255f85]";
  }
  return "bg-[#f3f5f7] text-[#52606d]";
};

export default async function PoPortalPage({
  searchParams,
}: {
  searchParams: Promise<{
    dir?: string;
    q?: string;
    sort?: string;
    status?: string | string[];
  }>;
}) {
  const data = await getPoPortalData();
  const params = await searchParams;
  const { q = "" } = params;
  const selectedStatuses = normalizeSelectedStatuses(params.status);
  const selectedStatusSet = new Set(selectedStatuses);
  const sortKey = SORT_KEYS.has(params.sort ?? "") ? params.sort ?? "incoming" : "incoming";
  const sortDir = params.dir === "asc" ? "asc" : "desc";
  const today = new Date().toISOString().slice(0, 10);
  const query = q.trim().toLowerCase();
  const filteredWorkbenchOrders = data.workbenchOrders
    .filter((order) => {
      const orderWorkStatus = normalizeStatusLabel(order.workStatus);
      const isClosed = orderWorkStatus === "closed";
      const matchesStatus =
        (selectedStatusSet.has("all") && !isClosed) ||
        selectedStatusSet.has(orderWorkStatus) ||
        order.statuses.some((itemStatus) =>
          selectedStatusSet.has(normalizeStatusLabel(itemStatus)),
        );
      const matchesQuery =
        !query ||
        [
          order.poId,
          order.poTitle,
          order.supplierName,
          order.supplierCode,
          order.quotationReference,
          order.supplierInvoiceNo,
          order.supplierDiscussionNote,
          order.owner,
          order.requester,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);

      return matchesStatus && matchesQuery;
    })
    .sort((a, b) => {
      const direction = sortDir === "asc" ? 1 : -1;
      let result = 0;

      if (sortKey === "po") {
        result = compareText(a.poId, b.poId);
      } else if (sortKey === "date") {
        result = compareText(a.poDate, b.poDate);
      } else if (sortKey === "supplier") {
        result = compareText(a.supplierName, b.supplierName);
      } else if (sortKey === "status") {
        result = compareText(
          a.workStatus || a.statuses[0] || "",
          b.workStatus || b.statuses[0] || "",
        );
      } else if (sortKey === "lines") {
        result = a.itemCount - b.itemCount;
      } else if (sortKey === "pending") {
        result = a.pendingApprovalQty - b.pendingApprovalQty;
      } else if (sortKey === "amount") {
        result = a.poAmountThb - b.poAmountThb;
      } else {
        result = a.activeIncomingQty - b.activeIncomingQty;
      }

      return result * direction || compareText(a.poId, b.poId);
    });
  const detectedStatusOptions = Array.from(
    new Set(
      data.workbenchOrders
        .flatMap((order) => [order.workStatus, ...order.statuses])
        .map((value) => normalizeStatusLabel(value))
        .filter(Boolean),
    ),
  );
  const statusOptions = [
    ...DEFAULT_PO_STATUS_OPTIONS,
    ...Array.from(detectedStatusOptions)
      .filter((status) => !DEFAULT_PO_STATUS_OPTIONS.includes(status))
      .sort(),
  ];
  const hasFilters = Boolean(q.trim()) || !selectedStatusSet.has("all");
  const buildSortHref = (key: string) => {
    const nextParams = new URLSearchParams();
    const nextDir = sortKey === key && sortDir === "asc" ? "desc" : "asc";

    if (q.trim()) {
      nextParams.set("q", q.trim());
    }
    if (!selectedStatusSet.has("all")) {
      nextParams.set("status", selectedStatuses.join(","));
    }
    nextParams.set("sort", key);
    nextParams.set("dir", nextDir);

    return `/po?${nextParams.toString()}`;
  };
  const sortHeader = (key: string, label: string, align: "left" | "right" = "left") => (
    <Link
      className={`inline-flex w-full ${align === "right" ? "justify-end" : ""} underline-offset-2 hover:underline`}
      href={buildSortHref(key)}
    >
      {label}
      {sortKey === key ? ` ${sortDir}` : ""}
    </Link>
  );

  return (
    <main className="min-h-screen bg-[#f6f7f9] text-[#172026]">
      <header className="border-b border-[#d9dde3] bg-white">
        <div className="mx-auto flex max-w-[1800px] flex-col gap-5 px-4 py-5 sm:px-6 2xl:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64707d]">
              Phase 2 preview - AppSheet PO export
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
              Open purchase orders, move work statuses, and receive stock into
              `po_receipts` so incoming quantities come from the PO lifecycle.
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

      <div className="mx-auto grid max-w-[1800px] gap-5 px-4 py-5 sm:px-6 2xl:px-8">
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          {[
            {
              detail: `${formatNumber(data.metrics.supplierCount)} suppliers`,
              icon: ClipboardList,
              label: "Purchase orders",
              value: formatNumber(data.metrics.poCount),
            },
            {
              detail: "in progress / delivery outstanding only",
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
            {
              detail: "paid rows from non-closed PO",
              icon: WalletCards,
              label: "Paid on open PO",
              value: formatCurrency(data.metrics.openPaidAmountThb, "THB"),
            },
            {
              detail: "payment_status = planned",
              icon: CalendarClock,
              label: "Planned payments",
              value: formatCurrency(data.metrics.plannedAmountThb, "THB"),
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

        <section className="rounded-lg border border-[#dfe4ea] bg-white shadow-sm">
          <div className="border-b border-[#e2e7ed] p-5">
            <h2 className="text-lg font-semibold">Open New PO</h2>
            <p className="mt-1 text-sm text-[#667380]">
              Creates a draft PO with the first item line. Add more lines from the
              active workbench after the PO exists.
            </p>
          </div>
          <div className="p-5">
            {data.source === "supabase" ? (
              <CreatePoForm
                catalogItems={data.catalogItems}
                suggestedPoId={generatedPoId()}
                suppliers={data.suppliers}
                today={today}
              />
            ) : (
              <p className="rounded-md bg-[#fff4e5] px-3 py-2 text-sm font-medium text-[#946200]">
                Connect Supabase and import PO data before opening live POs.
              </p>
            )}
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(420px,520px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(460px,540px)_minmax(0,1fr)]">
          <div className="rounded-lg border border-[#dfe4ea] bg-white shadow-sm">
            <div className="border-b border-[#e2e7ed] p-5">
              <h2 className="text-lg font-semibold">PO Status Pipeline</h2>
              <p className="mt-1 text-sm text-[#667380]">
                Supplier incoming counts only unreceived in-progress or delivery lines.
              </p>
            </div>
            <div className="divide-y divide-[#edf1f5]">
              {data.supplierSummaries.map((row) => (
                <div
                  className="grid gap-3 px-5 py-4"
                  key={`${row.supplierCode}-${row.supplierName}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{row.supplierName}</p>
                      <p className="mt-1 text-xs text-[#667380]">
                        {row.supplierCode || "No code"} | {formatNumber(row.poCount)} POs |{" "}
                        {formatNumber(row.lineCount)} lines
                      </p>
                    </div>
                    <p className="text-right font-mono font-semibold">
                      {formatNumber(row.incomingQty)}
                    </p>
                  </div>
                  <div className="grid gap-2 text-xs text-[#667380] sm:grid-cols-2">
                    <p>
                      Term:{" "}
                      <span className="font-semibold text-[#364252]">
                        {row.paymentTerms}
                      </span>
                    </p>
                    <p className="sm:text-right">
                      Open qty:{" "}
                      <span className="font-mono text-[#364252]">
                        {formatNumber(row.totalQty)}
                      </span>
                    </p>
                    <p>
                      Paid:{" "}
                      <span className="font-mono text-[#1f6b3d]">
                        {formatCurrency(row.paidAmountThb, "THB")}
                      </span>
                    </p>
                    <p className="sm:text-right">
                      Planned:{" "}
                      <span className="font-mono text-[#946200]">
                        {formatCurrency(row.plannedAmountThb, "THB")}
                      </span>
                    </p>
                  </div>
                </div>
              ))}
              {data.supplierSummaries.length === 0 ? (
                <p className="px-5 py-6 text-sm text-[#667380]">
                  No active incoming supplier pipeline rows.
                </p>
              ) : null}
            </div>
          </div>

          <div className="min-w-0 rounded-lg border border-[#dfe4ea] bg-white shadow-sm">
            <div className="border-b border-[#e2e7ed] p-5">
              <h2 className="text-lg font-semibold">Active PO Workbench</h2>
              <p className="mt-1 text-sm text-[#667380]">
                POs with active incoming, waiting approval, draft, and open workflow statuses.
              </p>
              <form className="mt-4 grid gap-3 lg:grid-cols-[minmax(280px,1fr)_minmax(300px,520px)_auto]" action="/po">
                <input
                  className="h-10 rounded-md border border-[#cfd6df] bg-white px-3 text-sm outline-none focus:border-[#255f85]"
                  defaultValue={q}
                  name="q"
                  placeholder="Search PO, supplier, owner"
                />
                <PoStatusFilterSelect options={statusOptions} selected={selectedStatuses} />
                <PendingSubmitButton
                  className="inline-flex h-10 items-center justify-center rounded-md bg-[#172026] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  loadingText="Filtering..."
                >
                  Filter
                </PendingSubmitButton>
              </form>
              {hasFilters ? (
                <Link className="mt-3 inline-flex text-sm font-semibold text-[#255f85]" href="/po">
                  Clear filters
                </Link>
              ) : null}
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[1500px] text-left text-sm">
                <thead className="bg-[#f3f5f7] text-xs uppercase tracking-[0.12em] text-[#65717f]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">{sortHeader("po", "PO")}</th>
                    <th className="px-4 py-3 font-semibold">{sortHeader("date", "Date")}</th>
                    <th className="px-4 py-3 font-semibold">
                      {sortHeader("supplier", "Supplier")}
                    </th>
                    <th className="px-4 py-3 font-semibold">Comment</th>
                    <th className="px-4 py-3 font-semibold">
                      {sortHeader("status", "Status")}
                    </th>
                    <th className="px-4 py-3 text-right font-semibold">
                      {sortHeader("lines", "Lines", "right")}
                    </th>
                    <th className="px-4 py-3 text-right font-semibold">
                      {sortHeader("incoming", "Incoming", "right")}
                    </th>
                    <th className="px-4 py-3 text-right font-semibold">
                      {sortHeader("pending", "Pending", "right")}
                    </th>
                    <th className="px-4 py-3 text-right font-semibold">
                      {sortHeader("amount", "Amount", "right")}
                    </th>
                    <th className="px-4 py-3 font-semibold">Update</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf1f5]">
                  {filteredWorkbenchOrders.map((order) => (
                    <tr key={order.poId}>
                      <td className="whitespace-nowrap px-4 py-3">
                        <p className="font-mono text-xs font-semibold text-[#172026]">
                          <Link
                            className="underline-offset-2 hover:underline"
                            href={`/po/${encodeURIComponent(order.poId)}`}
                          >
                            {order.poId}
                          </Link>
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-[#6b7785]">
                        {order.poDate ? order.poDate.slice(0, 10) : "No date"}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{order.supplierName}</p>
                        <p className="mt-1 text-xs text-[#6b7785]">
                          Quotation: {order.quotationReference || "-"}
                        </p>
                        <p className="mt-0.5 text-xs text-[#6b7785]">
                          Supplier INV: {order.supplierInvoiceNo || "-"}
                        </p>
                      </td>
                      <td className="min-w-[320px] px-4 py-3 align-top">
                        {data.source === "supabase" ? (
                          <QuickPoCommentForm
                            actualReceivedDate={order.actualReceivedDate}
                            estimatedArrivedDate={order.estimatedArrivedDate}
                            estimatedDeliveryDate={order.estimatedDeliveryDate}
                            poId={order.poId}
                            quotationReference={order.quotationReference}
                            supplierDiscussionNote={order.supplierDiscussionNote}
                            supplierInvoiceNo={order.supplierInvoiceNo}
                          />
                        ) : (
                          <p
                            className="max-h-24 max-w-[360px] overflow-y-auto whitespace-pre-wrap rounded-md border border-[#e2e7ed] bg-[#fbfcfd] px-3 py-2 text-xs leading-5 text-[#52606d]"
                            title={order.supplierDiscussionNote}
                          >
                            {order.supplierDiscussionNote || "-"}
                          </p>
                        )}
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
                              {displayStatus(status)}
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
                      <td className="px-4 py-3 align-top">
                        {data.source === "supabase" ? (
                          <>
                            <StatusActionForm
                              currentStatus={order.workStatus || order.statuses[0] || "draft"}
                              poId={order.poId}
                            />
                            <AddPoItemForm poId={order.poId} />
                            <DeleteDraftPoForm
                              isDraft={order.workStatus.toLowerCase() === "draft"}
                              poId={order.poId}
                            />
                          </>
                        ) : (
                          <span className="text-xs text-[#8a96a3]">Fallback only</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredWorkbenchOrders.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-sm text-[#667380]" colSpan={10}>
                        No purchase orders match this search.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
