import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, ClipboardList, PackageCheck, ReceiptText } from "lucide-react";
import {
  AddPoItemForm,
  BatchReceiveFormBar,
  BatchReceiveLineFields,
  StatusActionForm,
} from "@/app/po/po-forms";
import { formatNumber } from "@/lib/baseline-data";
import { getPoPortalDetailData } from "@/lib/po-portal";

export const dynamic = "force-dynamic";

const formatCurrency = (value: number, currency: string) =>
  new Intl.NumberFormat("en-US", {
    currency: currency || "THB",
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
    style: "currency",
  }).format(value);

const formatDateTime = (value: string | null) => {
  if (!value) {
    return "No date";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(new Date(value));
};

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

export default async function PoDetailPage({
  params,
}: {
  params: Promise<{ poId: string }>;
}) {
  const { poId } = await params;
  const data = await getPoPortalDetailData(decodeURIComponent(poId));

  if (!data) {
    notFound();
  }

  const order = data.order;
  const batchReceiveFormId = `batch-receive-${order.poId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;

  return (
    <main className="min-h-screen bg-[#f6f7f9] text-[#172026]">
      <header className="border-b border-[#d9dde3] bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-5 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64707d]">
              PO detail
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal">{order.poId}</h1>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-md bg-[#eef4f8] px-2 py-1 text-xs font-semibold text-[#255f85]">
                {data.source === "supabase" ? "Live Supabase PO workflow" : "AppSheet fallback"}
              </span>
              <span className={`rounded-md px-2 py-1 text-xs font-semibold ${statusClass(order.workStatus)}`}>
                {order.workStatus || "No status"}
              </span>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#52606d]">
              {order.poTitle || order.supplierName} / {order.supplierName} /{" "}
              {order.poDate ? order.poDate.slice(0, 10) : "No date"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              className="inline-flex items-center gap-2 rounded-md border border-[#cfd6df] bg-[#f9fafb] px-4 py-2 text-sm font-semibold text-[#364252]"
              href="/po"
            >
              <ArrowLeft size={16} />
              PO Portal
            </Link>
            <Link
              className="inline-flex items-center gap-2 rounded-md border border-[#cfd6df] bg-[#f9fafb] px-4 py-2 text-sm font-semibold text-[#364252]"
              href="/"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-5 py-6 sm:px-8">
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              detail: `${formatNumber(order.itemCount)} lines`,
              icon: ClipboardList,
              label: "Ordered",
              value: formatNumber(order.totalQty),
            },
            {
              detail: "legacy + web receipts",
              icon: PackageCheck,
              label: "Received",
              value: formatNumber(order.receivedQty),
            },
            {
              detail: "remaining open qty",
              icon: ReceiptText,
              label: "Outstanding",
              value: formatNumber(order.outstandingQty),
            },
            {
              detail: order.currency,
              icon: ClipboardList,
              label: "Amount",
              value: formatCurrency(order.poAmountForeign, order.currency),
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
                    <p className="text-sm font-medium text-[#5d6a78]">{metric.label}</p>
                    <p className="mt-2 text-3xl font-semibold">{metric.value}</p>
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

        <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-lg border border-[#dfe4ea] bg-white shadow-sm">
            <div className="border-b border-[#e2e7ed] p-5">
              <h2 className="text-lg font-semibold">Header</h2>
              <p className="mt-1 text-sm text-[#667380]">Supplier, owner, status, and payment snapshot.</p>
            </div>
            <div className="grid gap-4 p-5 text-sm">
              {[
                ["Supplier", `${order.supplierName} (${order.supplierCode})`],
                ["Owner", order.owner || "-"],
                ["Requester", order.requester || "-"],
                ["Payment", order.paymentTerms || "-"],
                ["Currency", order.currency || "-"],
              ].map(([label, value]) => (
                <div className="grid grid-cols-[120px_1fr] gap-4" key={label}>
                  <p className="font-semibold text-[#667380]">{label}</p>
                  <p>{value}</p>
                </div>
              ))}
              {data.source === "supabase" ? (
                <div className="pt-2">
                  <StatusActionForm currentStatus={order.workStatus || "draft"} poId={order.poId} />
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-lg border border-[#dfe4ea] bg-white shadow-sm">
            <div className="border-b border-[#e2e7ed] p-5">
              <h2 className="text-lg font-semibold">Add Line</h2>
              <p className="mt-1 text-sm text-[#667380]">Adds a draft line to this PO.</p>
            </div>
            <div className="p-5">
              {data.source === "supabase" ? (
                <AddPoItemForm poId={order.poId} />
              ) : (
                <p className="rounded-md bg-[#fff4e5] px-3 py-2 text-sm font-medium text-[#946200]">
                  Live edits require Supabase PO data.
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="min-w-0 rounded-lg border border-[#dfe4ea] bg-white shadow-sm">
          <div className="border-b border-[#e2e7ed] p-5">
            <h2 className="text-lg font-semibold">Lines & Receiving</h2>
            <p className="mt-1 text-sm text-[#667380]">Receive against active lines and keep status changes line-level.</p>
          </div>
          {data.source === "supabase" ? (
            <BatchReceiveFormBar formId={batchReceiveFormId} poId={order.poId} />
          ) : null}
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#f3f5f7] text-xs uppercase tracking-[0.12em] text-[#65717f]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Line</th>
                  <th className="px-4 py-3 font-semibold">Product</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Qty</th>
                  <th className="px-4 py-3 text-right font-semibold">On-hand</th>
                  <th className="px-4 py-3 text-right font-semibold">Received</th>
                  <th className="px-4 py-3 text-right font-semibold">Outstanding</th>
                  <th className="px-4 py-3 font-semibold">Receive Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf1f5]">
                {data.items.map((item) => (
                  <tr key={item.poItemId || item.itemUuid || `${item.poId}-${item.lineNo}`}>
                    <td className="px-4 py-3 font-mono text-xs">{item.lineNo || "-"}</td>
                    <td className="px-4 py-3">
                      <div className="flex min-w-[360px] items-center gap-3">
                        <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-md border border-[#dfe4ea] bg-[#f6f7f9]">
                          {item.imageUrl ? (
                            <Image
                              alt={item.productTitle || item.sku}
                              className="h-full w-full object-cover"
                              height={56}
                              loading="lazy"
                              src={item.imageUrl}
                              width={56}
                            />
                          ) : (
                            <span className="text-[10px] font-semibold text-[#8a96a3]">NO IMG</span>
                          )}
                        </div>
                        <div>
                          <p className="font-medium">{item.productTitle}</p>
                          <p className="mt-1 text-xs text-[#6b7785]">{item.variantTitle || item.fullName}</p>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs">
                            <span className="rounded-md bg-[#f3f5f7] px-2 py-1 font-mono text-[#364252]">
                              {item.sku}
                            </span>
                            <span className="rounded-md bg-[#eef4f8] px-2 py-1 font-semibold text-[#255f85]">
                              on-hand {formatNumber(item.onHand ?? 0)}
                            </span>
                            <span className="rounded-md bg-[#f7f2e9] px-2 py-1 font-semibold text-[#73510d]">
                              price {formatCurrency(item.unitPrice, item.currency)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-md px-2 py-1 text-xs font-semibold ${statusClass(item.status)}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{formatNumber(item.qty)}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-[#255f85]">
                      {formatNumber(item.onHand ?? 0)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{formatNumber(item.receivedQty)}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-[#1f6b3d]">
                      {formatNumber(item.outstandingQty)}
                    </td>
                    <td className="px-4 py-3 align-top">
                      {data.source === "supabase" ? (
                        <BatchReceiveLineFields
                          formId={batchReceiveFormId}
                          itemUuid={item.itemUuid}
                          outstandingQty={item.outstandingQty}
                        />
                      ) : (
                        <span className="text-xs text-[#8a96a3]">Fallback only</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-lg border border-[#dfe4ea] bg-white shadow-sm">
            <div className="border-b border-[#e2e7ed] p-5">
              <h2 className="text-lg font-semibold">Receipt History</h2>
            </div>
            <div className="divide-y divide-[#edf1f5]">
              {data.receipts.length > 0 ? (
                data.receipts.map((receipt) => (
                  <div className="grid gap-1 p-5 text-sm" key={receipt.id}>
                    <p className="font-mono font-semibold">{formatNumber(Number(receipt.received_qty ?? 0))} units</p>
                    <p className="text-[#667380]">
                      {formatDateTime(receipt.received_at)} / {receipt.received_by || "No receiver"}
                    </p>
                    {receipt.note ? <p>{receipt.note}</p> : null}
                  </div>
                ))
              ) : (
                <p className="p-5 text-sm text-[#667380]">No web-app receipts yet.</p>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-[#dfe4ea] bg-white shadow-sm">
            <div className="border-b border-[#e2e7ed] p-5">
              <h2 className="text-lg font-semibold">Status History</h2>
            </div>
            <div className="divide-y divide-[#edf1f5]">
              {data.statusEvents.length > 0 ? (
                data.statusEvents.map((event) => (
                  <div className="grid gap-1 p-5 text-sm" key={event.id}>
                    <p>
                      <span className="font-semibold">{event.from_status || "start"}</span> -&gt;{" "}
                      <span className="font-semibold">{event.to_status}</span>
                    </p>
                    <p className="text-[#667380]">
                      {formatDateTime(event.created_at)} / {event.actor || "No actor"}
                    </p>
                    {event.note ? <p>{event.note}</p> : null}
                  </div>
                ))
              ) : (
                <p className="p-5 text-sm text-[#667380]">No status events yet.</p>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
