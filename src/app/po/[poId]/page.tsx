import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, ClipboardList, PackageCheck, ReceiptText } from "lucide-react";
import {
  AddPoItemForm,
  BatchReceiveFormBar,
  BatchReceiveLineFields,
  DraftApprovalEmailButton,
  LandedCostAllocationForm,
  PoHeaderRefsForm,
  PoDraftLinesForm,
  PaymentScheduleForm,
  PrintDocumentButton,
  RemovePoReceiptForm,
  SmartAddPoItemForm,
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

const formatDecimal = (value: number, digits = 1) =>
  new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
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
const formatDate = (value: string | null) => {
  if (!value) {
    return "No date";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeZone: "Asia/Bangkok",
  }).format(new Date(`${value}T00:00:00`));
};

function addDays(dateValue: string, days: number) {
  const date = new Date(`${dateValue.slice(0, 10)}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

const companyLines = [
  "Siam Martial Arts Training Center Co., LTD.",
  "72/46 Moo 3, Choeng Thale, Thalang, Phuket 83110, Thailand",
  "Head Office | Tax ID: 0835564003295 | Tel: 076-604-229",
  "www.bangtaofightstore.com",
];

const nonProductPaymentTypes = new Set(["freight", "shipping", "fine", "penalty", "other", "other_cost"]);
const isProductPayment = (type: string | null | undefined) =>
  !nonProductPaymentTypes.has(String(type ?? "").trim().toLowerCase());

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

type DetailItem = NonNullable<Awaited<ReturnType<typeof getPoPortalDetailData>>>["items"][number];
const SIZE_PATTERN = "3XL|2XL|XXS|XS|XL|L|M|S";
const CORE_SIZE_COLUMNS = ["XXS", "XS", "S", "M", "L", "XL", "2XL", "3XL"];

function itemSize(item: DetailItem) {
  const source = [item.variantTitle, item.fullName, item.productTitle].join(" ");
  const match = source.match(new RegExp(`(?:^|[\\s/-])(${SIZE_PATTERN})(?:$|[\\s/-])`, "i"));
  return match?.[1].toUpperCase() ?? "OS";
}

function matrixProductName(item: DetailItem) {
  return item.productTitle
    .replace(new RegExp(`\\s*[/|-]\\s*(${SIZE_PATTERN})\\s*$`, "i"), "")
    .trim();
}

function itemTagGroup(item: DetailItem) {
  const taggedItem = item as DetailItem & { tags?: string[] };
  const tags = Array.isArray(taggedItem.tags) ? taggedItem.tags : [];
  return tags.find((tag) => tag.trim())?.trim() ?? "Untagged";
}

function quoteMatrixRows(items: DetailItem[]) {
  const rows = new Map<
    string,
    {
      groupTag: string;
      imageUrl: string | null;
      items: Map<
        string,
        {
          onHand: number;
          orderedQty: number;
          price: number;
        }
      >;
      productName: string;
      totalQty: number;
    }
  >();

  for (const item of items) {
    const productName = matrixProductName(item);
    const groupTag = itemTagGroup(item);
    const key = `${groupTag.toLowerCase()}::${productName.toLowerCase()}`;
    const row =
      rows.get(key) ??
      {
        groupTag,
        imageUrl: item.imageUrl ?? null,
        items: new Map(),
        productName,
        totalQty: 0,
      };
    const size = itemSize(item);
    const current = row.items.get(size) ?? { onHand: 0, orderedQty: 0, price: 0 };

    current.orderedQty += item.qty;
    current.onHand += item.onHand ?? 0;
    current.price = current.price || item.unitPrice;
    row.totalQty += item.qty;
    if (!row.imageUrl && item.imageUrl) {
      row.imageUrl = item.imageUrl;
    }

    row.items.set(size, current);
    rows.set(key, row);
  }

  const extraSizes = Array.from(
    new Set(
      Array.from(rows.values()).flatMap((row) =>
        Array.from(row.items.keys()).filter((size) => !CORE_SIZE_COLUMNS.includes(size)),
      ),
    ),
  ).sort();

  const rowValues = Array.from(rows.values());
  const groups = Array.from(
    rowValues
      .reduce((groupMap, row) => {
        groupMap.set(row.groupTag, [...(groupMap.get(row.groupTag) ?? []), row]);
        return groupMap;
      }, new Map<string, typeof rowValues>())
      .entries(),
  )
    .map(([groupTag, groupRows]) => {
      const groupSizes = [
        ...CORE_SIZE_COLUMNS,
        ...Array.from(
          new Set(
            groupRows.flatMap((row) =>
              Array.from(row.items.keys()).filter((size) => !CORE_SIZE_COLUMNS.includes(size)),
            ),
          ),
        ).sort(),
      ];
      const groupMaxQty = Math.max(
        0,
        ...groupRows.flatMap((row) =>
          Array.from(row.items.values()).map((item) => item.orderedQty),
        ),
      );

      return {
        groupTag,
        maxQty: groupMaxQty,
        rows: groupRows.sort((a, b) => a.productName.localeCompare(b.productName)),
        sizes: groupSizes,
      };
    })
    .sort((a, b) => a.groupTag.localeCompare(b.groupTag));
  const maxQty = Math.max(
    0,
    ...rowValues.flatMap((row) =>
      Array.from(row.items.values()).map((item) => item.orderedQty),
    ),
  );

  return {
    groups,
    maxQty,
    rows: rowValues.sort((a, b) => a.productName.localeCompare(b.productName)),
    sizes: [...CORE_SIZE_COLUMNS, ...extraSizes],
  };
}

function receivingMatrixRows(
  items: DetailItem[],
  receipts: NonNullable<Awaited<ReturnType<typeof getPoPortalDetailData>>>["receipts"],
) {
  const rows = new Map<
    string,
    {
      groupTag: string;
      imageUrl: string | null;
      items: DetailItem[];
      productName: string;
    }
  >();
  const receiptByItemId = new Map<string, typeof receipts>();

  for (const receipt of receipts) {
    if (!receipt.po_item_id) {
      continue;
    }
    receiptByItemId.set(receipt.po_item_id, [
      ...(receiptByItemId.get(receipt.po_item_id) ?? []),
      receipt,
    ]);
  }

  for (const item of items) {
    const productName = matrixProductName(item);
    const groupTag = itemTagGroup(item);
    const key = `${groupTag.toLowerCase()}::${productName.toLowerCase()}`;
    const row =
      rows.get(key) ??
      {
        groupTag,
        imageUrl: item.imageUrl ?? null,
        items: [],
        productName,
      };

    row.items.push(item);
    if (!row.imageUrl && item.imageUrl) {
      row.imageUrl = item.imageUrl;
    }
    rows.set(key, row);
  }

  const receiptRows = Array.from(rows.values()).map((row) => {
    const orderedBySize = new Map<string, number>();
    const outstandingBySize = new Map<string, number>();
    const receivedRoundMap = new Map<string, { label: string; values: Map<string, number> }>();
    let hasReceipts = false;

    for (const item of row.items) {
      const size = itemSize(item);
      orderedBySize.set(size, (orderedBySize.get(size) ?? 0) + item.qty);
      outstandingBySize.set(size, (outstandingBySize.get(size) ?? 0) + item.outstandingQty);

      const lineReceipts = item.itemUuid
        ? [...(receiptByItemId.get(item.itemUuid) ?? [])].sort((a, b) =>
            String(a.received_at ?? "").localeCompare(String(b.received_at ?? "")),
          )
        : [];

      lineReceipts.forEach((receipt, index) => {
        hasReceipts = true;
        const roundNo = index + 1;
        const key = `round-${roundNo}`;
        const current =
          receivedRoundMap.get(key) ??
          {
            label: `Received round ${roundNo}`,
            values: new Map<string, number>(),
          };
        current.values.set(
          size,
          (current.values.get(size) ?? 0) + Number(receipt.received_qty ?? 0),
        );
        receivedRoundMap.set(key, current);
      });
    }

    const lines = [
      { label: "Ordered", values: orderedBySize },
      ...(hasReceipts
        ? Array.from(receivedRoundMap.values())
        : [{ label: "Receive round 1", values: orderedBySize }]),
    ];

    if (hasReceipts) {
      const outstandingTotal = Array.from(outstandingBySize.values()).reduce(
        (sum, qty) => sum + qty,
        0,
      );
      if (outstandingTotal > 0) {
        lines.push({ label: "Receive next round", values: outstandingBySize });
      }
    }

    return {
      groupTag: row.groupTag,
      imageUrl: row.imageUrl,
      lines,
      productName: row.productName,
    };
  });

  const extraSizes = Array.from(
    new Set(
      receiptRows.flatMap((row) =>
        row.lines.flatMap((line) =>
          Array.from(line.values.keys()).filter((size) => !CORE_SIZE_COLUMNS.includes(size)),
        ),
      ),
    ),
  ).sort();
  const sizes = [...CORE_SIZE_COLUMNS, ...extraSizes];
  const maxQty = Math.max(
    0,
    ...receiptRows.flatMap((row) =>
      row.lines.flatMap((line) => Array.from(line.values.values())),
    ),
  );
  const groups = Array.from(
    receiptRows
      .reduce((groupMap, row) => {
        groupMap.set(row.groupTag, [...(groupMap.get(row.groupTag) ?? []), row]);
        return groupMap;
      }, new Map<string, typeof receiptRows>())
      .entries(),
  )
    .map(([groupTag, groupRows]) => {
      const groupSizes = [
        ...CORE_SIZE_COLUMNS,
        ...Array.from(
          new Set(
            groupRows.flatMap((row) =>
              row.lines.flatMap((line) =>
                Array.from(line.values.keys()).filter((size) => !CORE_SIZE_COLUMNS.includes(size)),
              ),
            ),
          ),
        ).sort(),
      ];
      const groupMaxQty = Math.max(
        0,
        ...groupRows.flatMap((row) =>
          row.lines.flatMap((line) => Array.from(line.values.values())),
        ),
      );

      return {
        groupTag,
        maxQty: groupMaxQty,
        rows: groupRows.sort((a, b) => a.productName.localeCompare(b.productName)),
        sizes: groupSizes,
      };
    })
    .sort((a, b) => a.groupTag.localeCompare(b.groupTag));

  return {
    groups,
    maxQty,
    rows: receiptRows.sort((a, b) => a.productName.localeCompare(b.productName)),
    sizes,
  };
}

function qtyHeatStyle(value: number, maxValue: number) {
  if (!value) {
    return {
      backgroundColor: "#111827",
      color: "#ffffff",
    };
  }

  const ratio = maxValue > 0 ? Math.min(1, value / maxValue) : 0;
  const hue = 4 + ratio * 128;
  const saturation = 62;
  const lightness = 93 - ratio * 8;

  return {
    backgroundColor: `hsl(${hue} ${saturation}% ${lightness}%)`,
    color: "#172026",
  };
}

function approvalEmailText({
  balance,
  coverDays,
  order,
  paidTotal,
}: {
  balance: number;
  coverDays: number | null;
  order: NonNullable<Awaited<ReturnType<typeof getPoPortalDetailData>>>["order"];
  paidTotal: number;
}) {
  const coverLine =
    coverDays === null
      ? "Coverage: Demand HM data is not available for every line, so coverage days cannot be calculated reliably."
      : `Coverage: this PO covers approximately ${formatDecimal(coverDays, 0)} days of demand based on current Demand HM.`;

  return [
    "Subject: ขออนุมัติจ่ายเงิน PO " + order.poId,
    "",
    "เรียนคุณวิลล์",
    "",
    `รบกวนขออนุมัติจ่ายเงินสำหรับ PO ${order.poId}`,
    `Supplier: ${order.supplierName}`,
    `PO Date: ${order.poDate ? order.poDate.slice(0, 10) : "-"}`,
    order.quotationReference ? `Quotation: ${order.quotationReference}` : null,
    order.supplierInvoiceNo ? `Supplier invoice: ${order.supplierInvoiceNo}` : null,
    "",
    `PO amount: ${formatCurrency(order.poAmountForeign, order.currency)}`,
    `Paid already: ${formatCurrency(paidTotal, order.currency)}`,
    `Request approval amount / balance: ${formatCurrency(balance, order.currency)}`,
    coverLine,
    "",
    "เหตุผล: เป็นรายการสั่งซื้อเพื่อเติม stock ตาม PO workflow และยอดคงเหลือหลังหักยอดที่ชำระแล้ว",
    "",
    "ขอบคุณครับ",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

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
  const matrix = quoteMatrixRows(data.items);
  const receivingMatrix = receivingMatrixRows(data.items, data.receipts);
  const maxLeadTimeDays = Math.max(
    0,
    ...data.items.map((item) =>
      Math.round(Number((item as DetailItem & { leadTimeDays?: number }).leadTimeDays ?? 0)),
    ),
  );
  const expectedReceivingNote =
    order.poDate && maxLeadTimeDays > 0
      ? `Expected receiving target: approximately ${addDays(order.poDate, maxLeadTimeDays)} (PO date + ${maxLeadTimeDays} days, using the longest SKU lead time set in the system). Note: actual KPI lead time should be counted from the payment date that starts production, not from this PO date.`
      : "Expected receiving target: SKU lead time is not set in the system. Note: actual KPI lead time should be counted from the payment date that starts production, not from this PO date.";
  const detailCatalogItems = data.catalogItems.filter(
    (item) =>
      item.supplierCode === order.supplierCode ||
      item.supplierName.toLowerCase() === order.supplierName.toLowerCase(),
  );
  const paidTotal = data.payments
    .filter((payment) => (payment.payment_status ?? "paid") !== "planned")
    .reduce(
    (sum, payment) => sum + Number(payment.amount ?? 0),
      0,
    );
  const paidTotalThb = data.payments
    .filter((payment) => (payment.payment_status ?? "paid") !== "planned")
    .reduce(
      (sum, payment) =>
        sum + Number(payment.amount_thb ?? Number(payment.amount ?? 0) * Number(payment.exchange_rate ?? 1)),
      0,
    );
  const productPaidTotalThb = data.payments
    .filter(
      (payment) =>
        (payment.payment_status ?? "paid") !== "planned" &&
        isProductPayment(payment.payment_type),
    )
    .reduce(
      (sum, payment) =>
        sum + Number(payment.amount_thb ?? Number(payment.amount ?? 0) * Number(payment.exchange_rate ?? 1)),
      0,
    );
  const paymentBalance = Math.max(0, order.poAmountForeign - paidTotal);
  const paymentBalanceThb = Math.max(0, order.poAmountThb - productPaidTotalThb);
  const demandTotal = data.items.reduce(
    (sum, item) => sum + Number(item.demandIndexHm ?? 0),
    0,
  );
  const orderCoverDays =
    demandTotal > 0 ? data.items.reduce((sum, item) => sum + item.qty, 0) / demandTotal : null;
  const approvalEmail = approvalEmailText({
    balance: paymentBalance,
    coverDays: orderCoverDays,
    order,
    paidTotal,
  });
  const receiptsByItemId = new Map<string, typeof data.receipts>();
  for (const receipt of data.receipts) {
    const itemId = receipt.po_item_id;
    if (!itemId) {
      continue;
    }
    receiptsByItemId.set(itemId, [...(receiptsByItemId.get(itemId) ?? []), receipt]);
  }

  return (
    <main className="min-h-screen bg-[#f6f7f9] text-[#172026]">
      <div className="screen-only">
      <header className="border-b border-[#d9dde3] bg-white">
        <div className="mx-auto flex w-full max-w-none flex-col gap-5 px-4 py-5 sm:px-6 2xl:px-8 lg:flex-row lg:items-center lg:justify-between">
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
            <PrintDocumentButton label="Print Quote" mode="quote" />
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-none gap-5 px-4 py-5 sm:px-6 2xl:px-8">
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-4">
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
              detail: `product paid ${formatCurrency(productPaidTotalThb, "THB")} / balance ${formatCurrency(paymentBalanceThb, "THB")}`,
              icon: ClipboardList,
              label: "Amount",
              value: formatCurrency(order.poAmountThb, "THB"),
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

        <section className="grid gap-5 xl:grid-cols-[0.7fr_1.3fr] 2xl:grid-cols-[0.55fr_1.45fr]">
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
                ["Quotation", order.quotationReference || "-"],
                ["Supplier INV", order.supplierInvoiceNo || "-"],
                ["Est. delivery", order.estimatedDeliveryDate ? formatDate(order.estimatedDeliveryDate) : "-"],
                ["Est. arrived", order.estimatedArrivedDate ? formatDate(order.estimatedArrivedDate) : "-"],
                ["Date received", order.actualReceivedDate ? formatDate(order.actualReceivedDate) : "-"],
              ].map(([label, value]) => (
                <div className="grid grid-cols-[120px_1fr] gap-4" key={label}>
                  <p className="font-semibold text-[#667380]">{label}</p>
                  <p>{value}</p>
                </div>
              ))}
              {order.supplierDiscussionNote ? (
                <div className="grid grid-cols-[120px_1fr] gap-4">
                  <p className="font-semibold text-[#667380]">Supplier note</p>
                  <p className="whitespace-pre-wrap">{order.supplierDiscussionNote}</p>
                </div>
              ) : null}
              {data.source === "supabase" ? (
                <div className="grid gap-4 border-t border-[#e2e7ed] pt-4">
                  <PoHeaderRefsForm
                    actualReceivedDate={order.actualReceivedDate}
                    estimatedArrivedDate={order.estimatedArrivedDate}
                    estimatedDeliveryDate={order.estimatedDeliveryDate}
                    poId={order.poId}
                    quotationReference={order.quotationReference}
                    supplierDiscussionNote={order.supplierDiscussionNote}
                    supplierInvoiceNo={order.supplierInvoiceNo}
                  />
                  <StatusActionForm
                    allowClosed={order.receivedQty > 0}
                    currentStatus={order.workStatus || "draft"}
                    poId={order.poId}
                  />
                  {order.receivedQty <= 0 ? (
                    <p className="rounded-md bg-[#fff4e5] px-3 py-2 text-xs font-semibold text-[#946200]">
                      Closed status appears after this PO has received stock.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-lg border border-[#dfe4ea] bg-white shadow-sm">
            <div className="border-b border-[#e2e7ed] p-5">
              <h2 className="text-lg font-semibold">Add Line</h2>
              <p className="mt-1 text-sm text-[#667380]">
                Adds another draft line to this PO. Use Save Draft Details below
                to refine qty, costs, and remarks in one pass.
              </p>
            </div>
            <div className="p-5">
              {data.source === "supabase" ? (
                detailCatalogItems.length > 0 ? (
                  <SmartAddPoItemForm
                    catalogItems={detailCatalogItems}
                    currency={order.currency}
                    poId={order.poId}
                    supplierCode={order.supplierCode}
                    supplierName={order.supplierName}
                  />
                ) : (
                  <AddPoItemForm poId={order.poId} />
                )
              ) : (
                <p className="rounded-md bg-[#fff4e5] px-3 py-2 text-sm font-medium text-[#946200]">
                  Live edits require Supabase PO data.
                </p>
              )}
            </div>
          </div>
        </section>

        {data.source === "supabase" ? (
          <section className="min-w-0 rounded-lg border border-[#dfe4ea] bg-white shadow-sm">
            <div className="border-b border-[#e2e7ed] p-5">
              <h2 className="text-lg font-semibold">Payment</h2>
              <p className="mt-1 text-sm text-[#667380]">
                Track payment 1-4, planned due dates, paid amounts, and balance.
                Planned rows can be used as reminders before payment is made.
              </p>
            </div>
            <div className="p-5">
              <PaymentScheduleForm
                currency={order.currency}
                payments={data.payments}
                paymentTerms={order.paymentTerms}
                poAmount={order.poAmountForeign}
                poId={order.poId}
              />
              <div className="mt-4 rounded-lg border border-[#dfe4ea] bg-[#fbfcfd] p-4">
                <div className="mb-3 grid gap-1 text-sm text-[#52606d]">
                  <p className="font-semibold text-[#172026]">Approval e-mail draft</p>
                  <p>
                    Cover {orderCoverDays === null ? "-" : `${formatDecimal(orderCoverDays, 0)} days`} / request{" "}
                    {formatCurrency(paymentBalance, order.currency)}
                  </p>
                </div>
                <DraftApprovalEmailButton emailText={approvalEmail} />
              </div>
            </div>
          </section>
        ) : null}

        {data.source === "supabase" ? (
          <section className="min-w-0 rounded-lg border border-[#dfe4ea] bg-white shadow-sm" id="draft-lines">
            <div className="border-b border-[#e2e7ed] p-5">
              <h2 className="text-lg font-semibold">Draft Line Details</h2>
              <p className="mt-1 text-sm text-[#667380]">
                Edit SKU, product name, order qty, unit price, freight/unit, and
                remarks while the PO is still open. This keeps the draft in one PO
                even when supplier details arrive in pieces.
              </p>
            </div>
            <PoDraftLinesForm items={data.items} poId={order.poId} />
          </section>
        ) : null}

        {data.source === "supabase" ? (
          <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
            <div className="rounded-lg border border-[#dfe4ea] bg-white shadow-sm">
              <div className="border-b border-[#e2e7ed] p-5">
                <h2 className="text-lg font-semibold">Landed Cost Allocation</h2>
                <p className="mt-1 text-sm text-[#667380]">
                  Enter imported landed cost once the invoice/shipping total is known.
                  The system divides it by total ordered qty and updates freight/unit
                  across all lines.
                </p>
              </div>
              <div className="p-5">
                <LandedCostAllocationForm
                  currency={order.currency}
                  freightTotal={order.freightTotal}
                  landedCostNote={order.landedCostNote}
                  otherLandedCostTotal={order.otherLandedCostTotal}
                  poId={order.poId}
                />
              </div>
            </div>

            <div className="rounded-lg border border-[#dfe4ea] bg-white shadow-sm">
              <div className="border-b border-[#e2e7ed] p-5">
                <h2 className="text-lg font-semibold">Payment Log</h2>
                <p className="mt-1 text-sm text-[#667380]">
                  Record deposits, before-shipment, after-received, and balance
                  payments without changing PO status.
                </p>
              </div>
              <div className="p-5">
                <p className="rounded-md bg-[#fbfcfd] px-3 py-2 text-sm text-[#667380]">
                  Use the Payment section above to edit paid and planned rows.
                </p>
              </div>
            </div>
          </section>
        ) : null}

        <section className="min-w-0 rounded-lg border border-[#dfe4ea] bg-white shadow-sm">
          <div className="border-b border-[#e2e7ed] p-5">
            <h2 className="text-lg font-semibold">Supplier Quote Matrix</h2>
            <p className="mt-1 text-sm text-[#667380]">
              Horizontal working view grouped by product. Raw PO lines remain below.
            </p>
          </div>
          <div className="grid gap-5 p-5">
            {matrix.groups.map((group) => (
              <div className="overflow-x-auto rounded-lg border border-[#e2e7ed]" key={group.groupTag}>
                <div className="border-b border-[#e2e7ed] bg-[#fbfcfd] px-4 py-3">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-[#364252]">
                    {group.groupTag}
                  </h3>
                </div>
                <table className="min-w-full border-collapse text-left text-sm">
                  <thead className="bg-[#f3f5f7] text-xs uppercase tracking-[0.12em] text-[#65717f]">
                    <tr>
                      <th className="border-b border-[#dfe4ea] px-4 py-3 font-semibold">Product</th>
                      {group.sizes.map((size) => (
                        <th
                          className="border-b border-l border-[#dfe4ea] px-3 py-3 text-right font-semibold"
                          key={size}
                        >
                          {size}
                        </th>
                      ))}
                      <th className="border-b border-l border-[#dfe4ea] px-3 py-3 text-right font-semibold">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((row) => (
                      <tr className="border-b border-[#edf1f5]" key={row.productName}>
                        <td className="min-w-[360px] px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-md border border-[#dfe4ea] bg-[#f6f7f9]">
                              {row.imageUrl ? (
                                <Image
                                  alt={row.productName}
                                  className="h-full w-full object-cover"
                                  height={64}
                                  loading="lazy"
                                  src={row.imageUrl}
                                  width={64}
                                />
                              ) : (
                                <span className="text-[10px] font-semibold text-[#8a96a3]">NO IMG</span>
                              )}
                            </div>
                            <div>
                              <p className="font-semibold">{row.productName}</p>
                              <p className="mt-1 text-xs font-semibold italic text-[#172026]">on-hand</p>
                            </div>
                          </div>
                        </td>
                        {group.sizes.map((size) => {
                          const cell = row.items.get(size);
                          return (
                            <td
                              className="min-w-20 border-l border-[#dfe4ea] px-3 py-3 text-right"
                              key={size}
                              style={qtyHeatStyle(cell?.orderedQty ?? 0, group.maxQty)}
                            >
                              <p className="font-mono font-semibold">{cell ? formatNumber(cell.orderedQty) : ""}</p>
                              <p className="mt-1 font-mono text-sm font-semibold italic text-[#172026]">
                                {cell ? formatNumber(cell.onHand) : ""}
                              </p>
                            </td>
                          );
                        })}
                        <td className="border-l border-[#dfe4ea] px-3 py-3 text-right font-mono font-semibold">
                          {formatNumber(row.totalQty)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </section>

        <section className="min-w-0 rounded-lg border border-[#dfe4ea] bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-[#e2e7ed] p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Lines & Receiving</h2>
              <p className="mt-1 text-sm text-[#667380]">
                Receive against active lines and keep status changes line-level.
              </p>
            </div>
            <PrintDocumentButton label="Goods Receipt" mode="receiving" />
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
                  <th className="px-4 py-3 font-semibold">Receipt Rounds</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf1f5]">
                {data.items.map((item) => {
                  const lineReceipts = item.itemUuid
                    ? receiptsByItemId.get(item.itemUuid) ?? []
                    : [];

                  return (
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
                    <td className="min-w-[240px] px-4 py-3 align-top">
                      {lineReceipts.length > 0 ? (
                        <div className="grid gap-2">
                          {lineReceipts.map((receipt, index) => (
                            <div
                              className="rounded-md border border-[#e2e7ed] bg-[#fbfcfd] px-3 py-2 text-xs"
                              key={receipt.id}
                            >
                              <p className="font-mono font-semibold text-[#172026]">
                                Round {lineReceipts.length - index}:{" "}
                                {formatNumber(Number(receipt.received_qty ?? 0))} units
                              </p>
                              <p className="mt-1 text-[#667380]">
                                {formatDateTime(receipt.received_at)} /{" "}
                                {receipt.received_by || "No receiver"}
                              </p>
                              {receipt.note ? (
                                <p className="mt-1 text-[#52606d]">{receipt.note}</p>
                              ) : null}
                              {data.source === "supabase" ? (
                                <RemovePoReceiptForm
                                  poId={order.poId}
                                  receiptId={receipt.id}
                                />
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-[#8a96a3]">No receipts yet</span>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          <div className="rounded-lg border border-[#dfe4ea] bg-white shadow-sm">
            <div className="border-b border-[#e2e7ed] p-5">
              <h2 className="text-lg font-semibold">Payment History</h2>
              <p className="mt-1 text-sm text-[#667380]">
                Total recorded: {formatCurrency(paidTotalThb, "THB")}
              </p>
            </div>
            <div className="divide-y divide-[#edf1f5]">
              {data.payments.length > 0 ? (
                data.payments.map((payment) => (
                  <div className="grid gap-1 p-5 text-sm" key={payment.id}>
                    <p className="font-mono font-semibold">
                      {formatCurrency(Number(payment.amount ?? 0), payment.currency ?? order.currency)}
                      {" / "}
                      {formatCurrency(
                        Number(payment.amount_thb ?? Number(payment.amount ?? 0) * Number(payment.exchange_rate ?? 1)),
                        "THB",
                      )}
                    </p>
                    <p className="text-[#667380]">
                      {formatDate(payment.payment_date)} / {payment.payment_type || "payment"}
                      {` / FX ${formatDecimal(Number(payment.exchange_rate ?? 1), 4)}`}
                      {payment.paid_by ? ` / ${payment.paid_by}` : ""}
                    </p>
                    {payment.reference ? <p>Ref: {payment.reference}</p> : null}
                    {payment.note ? <p>{payment.note}</p> : null}
                  </div>
                ))
              ) : (
                <p className="p-5 text-sm text-[#667380]">No payments recorded yet.</p>
              )}
            </div>
          </div>

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

          <div className="rounded-lg border border-[#dfe4ea] bg-white shadow-sm xl:col-span-2">
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
      </div>
      <PrintMatrixDocument
        expectedReceivingNote={expectedReceivingNote}
        matrix={matrix}
        order={order}
        title="Supplier Quote"
        type="quote"
      />
      <PrintMatrixDocument
        expectedReceivingNote={expectedReceivingNote}
        matrix={matrix}
        order={order}
        receivingMatrix={receivingMatrix}
        title="Goods Receiving Note"
        type="receiving"
      />
    </main>
  );
}

function PrintMatrixDocument({
  expectedReceivingNote,
  matrix,
  order,
  receivingMatrix,
  title,
  type,
}: {
  expectedReceivingNote: string;
  matrix: ReturnType<typeof quoteMatrixRows>;
  order: NonNullable<Awaited<ReturnType<typeof getPoPortalDetailData>>>["order"];
  receivingMatrix?: ReturnType<typeof receivingMatrixRows>;
  title: string;
  type: "quote" | "receiving";
}) {
  const printMatrix = type === "receiving" ? receivingMatrix : null;

  return (
    <section className={`print-only print-${type}`}>
      <div className="print-header">
        <div>
          {companyLines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
        <div className="print-title">
          <h1>{title}</h1>
          <p>PO: {order.poId}</p>
          <p>Supplier: {order.supplierName}</p>
          <p>Date: {order.poDate ? order.poDate.slice(0, 10) : "-"}</p>
          {order.quotationReference ? <p>Quotation: {order.quotationReference}</p> : null}
          {order.supplierInvoiceNo ? <p>Supplier INV: {order.supplierInvoiceNo}</p> : null}
        </div>
      </div>
      {type === "quote" ? <p className="print-leadtime-note">{expectedReceivingNote}</p> : null}
      <div className="print-matrix-stack">
        {type === "receiving" && printMatrix
          ? printMatrix.groups.map((group) => (
              <table className="print-matrix" key={group.groupTag}>
                <caption>{group.groupTag}</caption>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Image</th>
                    <th>Round</th>
                    {group.sizes.map((size) => (
                      <th key={size}>{size}</th>
                    ))}
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.flatMap((row) =>
                    row.lines.map((line, lineIndex) => {
                      const rowSpan = row.lines.length;
                      const lineTotal = Array.from(line.values.values()).reduce(
                        (sum, qty) => sum + qty,
                        0,
                      );

                      return (
                        <tr key={`${group.groupTag}-${row.productName}-${line.label}`}>
                          {lineIndex === 0 ? (
                            <>
                              <td rowSpan={rowSpan}>{row.productName}</td>
                              <td rowSpan={rowSpan}>
                                {row.imageUrl ? (
                                  <Image
                                    alt={row.productName}
                                    className="print-product-image"
                                    height={96}
                                    loading="eager"
                                    src={row.imageUrl}
                                    unoptimized
                                    width={96}
                                  />
                                ) : (
                                  ""
                                )}
                              </td>
                            </>
                          ) : null}
                          <td className="print-round-label">{line.label}</td>
                          {group.sizes.map((size) => {
                            const qty = line.values.get(size) ?? 0;
                            return (
                              <td key={size} style={qtyHeatStyle(qty, group.maxQty)}>
                                {qty || ""}
                              </td>
                            );
                          })}
                          <td>{lineTotal || ""}</td>
                        </tr>
                      );
                    }),
                  )}
                </tbody>
              </table>
            ))
          : matrix.groups.map((group) => (
              <table className="print-matrix" key={group.groupTag}>
                <caption>{group.groupTag}</caption>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Image</th>
                    {group.sizes.map((size) => (
                      <th key={size}>{size}</th>
                    ))}
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((row) => (
                    <tr key={`${group.groupTag}-${row.productName}`}>
                      <td>{row.productName}</td>
                      <td>
                        {row.imageUrl ? (
                          <Image
                            alt={row.productName}
                            className="print-product-image"
                            height={96}
                            loading="eager"
                            src={row.imageUrl}
                            unoptimized
                            width={96}
                          />
                        ) : (
                          ""
                        )}
                      </td>
                      {group.sizes.map((size) => {
                        const orderedQty = row.items.get(size)?.orderedQty ?? 0;
                        return (
                          <td key={size} style={qtyHeatStyle(orderedQty, group.maxQty)}>
                            {orderedQty || ""}
                          </td>
                        );
                      })}
                      <td>{row.totalQty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}
      </div>
      {type === "receiving" ? (
        <div className="print-signatures">
          <span>Prepared by</span>
          <span>Received by</span>
          <span>Checked by</span>
        </div>
      ) : null}
    </section>
  );
}
