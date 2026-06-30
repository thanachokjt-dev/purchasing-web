import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Coins,
  Clock3,
  Database,
  PackageCheck,
  ReceiptText,
  RefreshCw,
  Truck,
  WalletCards,
} from "lucide-react";
import { MissingCostSkuTable } from "@/app/dashboard/missing-cost-sku-table";
import { SupplierTagSalesQtyComparisonTable } from "@/app/dashboard/supplier-tag-sales-qty-table";
import { PoSidebarNav } from "@/app/po/sidebar-nav";
import { requireUser } from "@/lib/auth";
import {
  getPoDashboardData,
  type DashboardCardTone,
  type PoSizeMixBucket,
  type PoSizeMixCard,
  type PoSizeMixUnknownLine,
  type ShopifySyncSourceSummary,
} from "@/lib/po-dashboard";
import { canAccessDashboard, defaultLandingForUser } from "@/lib/role-nav";
import { getDashboardStockValueData, type StockValueData } from "@/lib/stock-value-data";
import { getSupplierTagSalesQtyComparisonData } from "@/lib/supplier-sales-qty-data";

export const dynamic = "force-dynamic";

type DashboardSearchParams = {
  stockCostError?: string;
  stockCostSaved?: string;
  stockCostSku?: string;
};

const numberFormatter = new Intl.NumberFormat("en-US");
const currencyFormatter = new Intl.NumberFormat("en-US", {
  currency: "THB",
  maximumFractionDigits: 0,
  style: "currency",
});

const toneClasses: Record<DashboardCardTone, string> = {
  blue: "border-blue-200 bg-blue-50 text-blue-800",
  gray: "border-slate-200 bg-slate-50 text-slate-700",
  green: "border-emerald-200 bg-emerald-50 text-emerald-800",
  red: "border-red-200 bg-red-50 text-red-800",
  yellow: "border-amber-200 bg-amber-50 text-amber-900",
};

const iconToneClasses: Record<DashboardCardTone, string> = {
  blue: "bg-blue-100 text-blue-700",
  gray: "bg-slate-100 text-slate-600",
  green: "bg-emerald-100 text-emerald-700",
  red: "bg-red-100 text-red-700",
  yellow: "bg-amber-100 text-amber-700",
};

function formatNumber(value: number) {
  return numberFormatter.format(Math.round(value));
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatSizeMixGroup(value: string) {
  const labels: Record<string, string> = {
    adult_apparel_curve: "General Adult Apparel Curve",
    gloves_oz: "Gloves Ordered by Oz",
    mma_gloves_size: "MMA Gloves Ordered by Size",
    shin_guards_size: "Shin Guards Ordered by Size",
    shirts_tops_size: "Shirts / Tops Ordered by Size",
    shorts_size: "Shorts Ordered by Size",
    singlets_size: "Singlets Ordered by Size",
  };
  return labels[value] ?? value;
}

function formatCurrency(value: number | null) {
  if (value === null) {
    return "N/A";
  }
  return currencyFormatter.format(value);
}

function formatMoneyValue(value: number) {
  return currencyFormatter.format(Math.round(value));
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "N/A";
  }
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(new Date(value));
}

function formatDate(value: string | null) {
  if (!value) {
    return "N/A";
  }
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: "Asia/Bangkok",
  }).format(new Date(`${value.slice(0, 10)}T00:00:00+07:00`));
}

function formatDuration(seconds: number | null) {
  if (seconds === null) {
    return "N/A";
  }
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function statusTone(status: string): DashboardCardTone {
  if (status === "success" || status === "fresh") {
    return "green";
  }
  if (status === "failed") {
    return "red";
  }
  if (status === "running") {
    return "blue";
  }
  if (status === "stale" || status === "warning") {
    return "yellow";
  }
  return "gray";
}

function formatStatusLabel(status: string) {
  return status === "success" ? "success" : status;
}

type SummaryCardProps = {
  detail: string;
  icon: typeof Activity;
  label: string;
  tone: DashboardCardTone;
  value: string;
};

function SummaryCard({ detail, icon: Icon, label, tone, value }: SummaryCardProps) {
  return (
    <article className="rounded-lg border border-[#dfe4ea] bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[#5d6a78]">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-normal text-[#172026]">{value}</p>
        </div>
        <span className={`grid size-10 shrink-0 place-items-center rounded-md ${iconToneClasses[tone]}`}>
          <Icon size={20} />
        </span>
      </div>
      <p className="mt-3 text-sm leading-5 text-[#667380]">{detail}</p>
    </article>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<DashboardSearchParams>;
}) {
  const params = await searchParams;
  const currentUser = await requireUser("/dashboard");
  if (!canAccessDashboard(currentUser)) {
    redirect(
      `/access-denied?from=${encodeURIComponent("/dashboard")}&next=${encodeURIComponent(
        defaultLandingForUser(currentUser),
      )}`,
    );
  }

  const [dashboard, stockValue, supplierTagSalesQty] = await Promise.all([
    getPoDashboardData(),
    getDashboardStockValueData(),
    getSupplierTagSalesQtyComparisonData(),
  ]);
  const syncTone = statusTone(dashboard.sync.dataFreshness);

  const poCards = [
    {
      detail: "Open, non-cancelled POs from the PO summary read model.",
      icon: ClipboardList,
      label: "Open POs",
      tone: "blue" as const,
      value: formatNumber(dashboard.poOverview.openPoCount),
    },
    {
      detail: "POs currently marked in production.",
      icon: RefreshCw,
      label: "In Production",
      tone: "blue" as const,
      value: formatNumber(dashboard.poOverview.inProduction),
    },
    {
      detail: "POs in final payment / ready-to-ship follow-up.",
      icon: CheckCircle2,
      label: "Ready to Ship",
      tone: dashboard.poOverview.readyToShip > 0 ? ("yellow" as const) : ("gray" as const),
      value: formatNumber(dashboard.poOverview.readyToShip),
    },
    {
      detail: "POs currently in delivery / transit.",
      icon: Truck,
      label: "In Transit",
      tone: "green" as const,
      value: formatNumber(dashboard.poOverview.inTransit),
    },
    {
      detail: "Open POs with outstanding receiving quantity.",
      icon: PackageCheck,
      label: "Receiving Pending",
      tone: dashboard.poOverview.receivingPending > 0 ? ("yellow" as const) : ("green" as const),
      value: formatNumber(dashboard.poOverview.receivingPending),
    },
    {
      detail: "Active incoming plus pending approval quantity.",
      icon: Database,
      label: "Outstanding Qty",
      tone: "blue" as const,
      value: formatNumber(dashboard.poOverview.outstandingQty),
    },
    {
      detail: "Summed from open PO THB values when the read model is small enough.",
      icon: WalletCards,
      label: "Open PO Value",
      tone: dashboard.poOverview.openPoValueThb === null ? ("gray" as const) : ("green" as const),
      value: formatCurrency(dashboard.poOverview.openPoValueThb),
    },
  ];

  const paymentCards = [
    {
      detail: "Planned payments with due date before today.",
      icon: AlertTriangle,
      label: "Overdue Payments",
      tone: dashboard.payments.overduePayments > 0 ? ("red" as const) : ("green" as const),
      value: formatNumber(dashboard.payments.overduePayments),
    },
    {
      detail: "Planned payments due within the next 7 days.",
      icon: Clock3,
      label: "Due This Week",
      tone: dashboard.payments.dueThisWeek > 0 ? ("yellow" as const) : ("green" as const),
      value: formatNumber(dashboard.payments.dueThisWeek),
    },
    {
      detail: "Planned payments due within the next 30 days.",
      icon: ReceiptText,
      label: "Due Next 30 Days",
      tone: "blue" as const,
      value: formatNumber(dashboard.payments.dueNext30Days),
    },
    {
      detail: "Planned payment amount from PO Portal metrics.",
      icon: WalletCards,
      label: "Planned Total",
      tone: "blue" as const,
      value: formatCurrency(dashboard.payments.plannedTotalThb),
    },
    {
      detail: "Paid amount on open POs from PO Portal metrics.",
      icon: CheckCircle2,
      label: "Paid Total",
      tone: "green" as const,
      value: formatCurrency(dashboard.payments.paidTotalThb),
    },
    {
      detail: "Foreign currency payment rows with missing/placeholder FX.",
      icon: AlertTriangle,
      label: "Missing FX",
      tone: dashboard.payments.missingFxCount > 0 ? ("red" as const) : ("green" as const),
      value: formatNumber(dashboard.payments.missingFxCount),
    },
    {
      detail: "Payment rows still pending Xero tracking.",
      icon: ReceiptText,
      label: "Xero Pending",
      tone: dashboard.payments.xeroPendingCount > 0 ? ("yellow" as const) : ("green" as const),
      value: formatNumber(dashboard.payments.xeroPendingCount),
    },
    {
      detail: "Payment rows marked as draft in Xero.",
      icon: ReceiptText,
      label: "Xero Draft",
      tone: dashboard.payments.xeroDraftCount > 0 ? ("blue" as const) : ("gray" as const),
      value: formatNumber(dashboard.payments.xeroDraftCount),
    },
    {
      detail: "Payment rows marked uploaded/finalized.",
      icon: CheckCircle2,
      label: "Xero Uploaded",
      tone: "green" as const,
      value: formatNumber(dashboard.payments.xeroUploadedCount),
    },
  ];

  const receivingCards = [
    {
      detail: "Open POs with quantity still outstanding.",
      icon: PackageCheck,
      label: "POs Waiting to Receive",
      tone: dashboard.receiving.posWaitingToReceive > 0 ? ("yellow" as const) : ("green" as const),
      value: formatNumber(dashboard.receiving.posWaitingToReceive),
    },
    {
      detail: "Active incoming plus pending approval quantity.",
      icon: Truck,
      label: "Outstanding Receiving Qty",
      tone: "blue" as const,
      value: formatNumber(dashboard.receiving.outstandingReceivingQty),
    },
    {
      detail: "Active/pending line count from the PO summary read model.",
      icon: Database,
      label: "Lines With Outstanding Qty",
      tone: "blue" as const,
      value: formatNumber(dashboard.receiving.linesWithOutstandingQty),
    },
    {
      detail: "Most recent receipt date found locally.",
      icon: Clock3,
      label: "Last Goods Receipt",
      tone: dashboard.receiving.lastGoodsReceiptDate ? ("green" as const) : ("gray" as const),
      value: formatDate(dashboard.receiving.lastGoodsReceiptDate),
    },
    {
      detail: "Receipt rows created in the last 7 local days.",
      icon: CheckCircle2,
      label: "Recently Received",
      tone: dashboard.receiving.recentlyReceivedCount > 0 ? ("green" as const) : ("gray" as const),
      value: formatNumber(dashboard.receiving.recentlyReceivedCount),
    },
  ];

  const etaCards = [
    {
      detail: "Incoming ETA lines scheduled in the next 7 days.",
      icon: Truck,
      label: "Arriving Soon",
      tone: dashboard.incomingEta.arrivingSoon > 0 ? ("blue" as const) : ("gray" as const),
      value: formatNumber(dashboard.incomingEta.arrivingSoon),
    },
    {
      detail: "Incoming ETA lines scheduled before today.",
      icon: AlertTriangle,
      label: "Late ETA",
      tone: dashboard.incomingEta.lateEta > 0 ? ("red" as const) : ("green" as const),
      value: formatNumber(dashboard.incomingEta.lateEta),
    },
    {
      detail: "Incoming lines without an ETA.",
      icon: Clock3,
      label: "No ETA",
      tone: dashboard.incomingEta.noEta > 0 ? ("yellow" as const) : ("green" as const),
      value: formatNumber(dashboard.incomingEta.noEta),
    },
    {
      detail: "Next scheduled incoming ETA date.",
      icon: Clock3,
      label: "Next Expected Arrival",
      tone: dashboard.incomingEta.nextExpectedArrival ? ("green" as const) : ("gray" as const),
      value: formatDate(dashboard.incomingEta.nextExpectedArrival),
    },
  ];

  return (
    <main className="min-h-screen bg-[#f4f6f8] text-[#172026] lg:grid lg:grid-cols-[200px_minmax(0,1fr)]">
      <PoSidebarNav active="dashboard" />
      <div className="min-w-0">
        <header className="border-b border-[#d9dde3] bg-white">
          <div className="flex w-full flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64707d]">
                Control Room
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-normal">Dashboard</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#52606d]">
                Fast PO Portal overview using local read-model data only.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                className="inline-flex h-10 items-center rounded-md border border-[#cfd6df] bg-[#f9fafb] px-3 text-sm font-semibold text-[#364252]"
                href="/po"
              >
                PO Portal
              </Link>
              <Link
                className="inline-flex h-10 items-center rounded-md border border-[#cfd6df] bg-[#f9fafb] px-3 text-sm font-semibold text-[#364252]"
                href="/dashboard/legacy"
              >
                Legacy Dashboard
              </Link>
            </div>
          </div>
        </header>

        <div className="grid gap-5 px-4 py-5 sm:px-6">
          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
            <article className="rounded-lg border border-[#dfe4ea] bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#64707d]">
                    System / Shopify Sync Status
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold">Shopify Sync Health</h2>
                  <p className="mt-2 text-sm text-[#5c6875]">
                    Catalog/inventory and orders/sales-line syncs are checked independently.
                  </p>
                </div>
                <span
                  className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold capitalize ${toneClasses[syncTone]}`}
                >
                  {dashboard.sync.dataFreshness}
                </span>
              </div>
              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                <ShopifySyncCard
                  metrics={[
                    ["Products Synced", dashboard.sync.catalogInventory.productsSynced],
                    ["Variants Synced", dashboard.sync.catalogInventory.variantsSynced],
                    ["Inventory Rows", dashboard.sync.catalogInventory.inventoryRowsSynced],
                  ]}
                  summary={dashboard.sync.catalogInventory}
                  title="Catalog / Inventory Sync"
                />
                <ShopifySyncCard
                  metrics={[
                    ["Orders Seen", dashboard.sync.ordersSales.ordersSeen],
                    ["Sales Lines Seen", dashboard.sync.ordersSales.salesLinesSeen],
                  ]}
                  summary={dashboard.sync.ordersSales}
                  title="Orders / Sales Lines Sync"
                />
              </div>
              {dashboard.sync.dataFreshness === "warning" ? (
                <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  Check Vercel Cron /api/sync/daily and CRON_SECRET.
                </div>
              ) : null}
              {!dashboard.sync.syncLogFound ? (
                <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                  No reliable Shopify sync history was found in `sync_runs` for the required sources.
                </div>
              ) : null}
            </article>

            <article className="rounded-lg border border-[#dfe4ea] bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#64707d]">
                    Needs Attention
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold">Action List</h2>
                </div>
                <span className="grid size-10 place-items-center rounded-md bg-amber-100 text-amber-700">
                  <AlertTriangle size={20} />
                </span>
              </div>
              <div className="mt-4 grid gap-2">
                {dashboard.attentionItems.map((item) => {
                  const content = (
                    <div className={`rounded-md border p-3 ${toneClasses[item.tone]}`}>
                      <p className="text-sm font-semibold">{item.label}</p>
                      <p className="mt-1 text-sm opacity-85">{item.detail}</p>
                    </div>
                  );
                  return item.href ? (
                    <Link href={item.href} key={`${item.label}-${item.detail}`}>
                      {content}
                    </Link>
                  ) : (
                    <div key={`${item.label}-${item.detail}`}>{content}</div>
                  );
                })}
              </div>
            </article>
          </section>

          <DashboardSection title="PO Overview">
            {poCards.map((card) => (
              <SummaryCard {...card} key={card.label} />
            ))}
          </DashboardSection>

          <InventoryStockValueSection data={stockValue} stockCostStatus={params} />

          <SupplierTagSalesQtyComparisonTable data={supplierTagSalesQty} />

          <PoSizeMixOverview cards={dashboard.sizeMix.cards} sizeMix={dashboard.sizeMix} />

          <DashboardSection title="Payment Overview">
            {paymentCards.map((card) => (
              <SummaryCard {...card} key={card.label} />
            ))}
          </DashboardSection>

          <DashboardSection title="Receiving Overview">
            {receivingCards.map((card) => (
              <SummaryCard {...card} key={card.label} />
            ))}
          </DashboardSection>

          <DashboardSection title="Incoming / ETA Overview">
            {etaCards.map((card) => (
              <SummaryCard {...card} key={card.label} />
            ))}
          </DashboardSection>

          {dashboard.warnings.length > 0 ? (
            <section className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 shadow-sm">
              <h2 className="font-semibold">Dashboard Query Notes</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {dashboard.warnings.slice(0, 6).map((warning) => (
                  <li key={`${warning.label}-${warning.message}`}>
                    <span className="font-medium">{warning.label}:</span> {warning.message}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>
    </main>
  );
}

function ShopifySyncCard({
  metrics,
  summary,
  title,
}: {
  metrics: Array<[string, number | null]>;
  summary: ShopifySyncSourceSummary;
  title: string;
}) {
  const sourceTone = statusTone(summary.dataFreshness);
  const metricValue = (value: number | null) => {
    if (!summary.syncLogFound) {
      return "Unknown";
    }
    return value === null ? "N/A" : formatNumber(value);
  };

  return (
    <section className="rounded-lg border border-[#e1e6ec] bg-[#f9fafb] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-[#172026]">{title}</h3>
          <p className="mt-1 text-xs text-[#667380]">Diagnostic source: {summary.source}</p>
        </div>
        <span
          className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${toneClasses[sourceTone]}`}
        >
          {summary.dataFreshness}
        </span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <SyncDetail label="Status" value={formatStatusLabel(summary.lastStatus)} />
        <SyncDetail label="Duration" value={formatDuration(summary.durationSeconds)} />
        <SyncDetail label="Last Run" value={formatDateTime(summary.lastSyncTime)} />
        <SyncDetail label="Last Success" value={formatDateTime(summary.lastSuccessfulSyncTime)} />
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map(([label, value]) => (
          <SyncDetail label={label} value={metricValue(value)} key={label} />
        ))}
      </div>
      {summary.errorMessage ? (
        <div className="mt-3 whitespace-pre-line break-words rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {summary.errorMessage}
        </div>
      ) : null}
    </section>
  );
}

function SyncDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[#e1e6ec] bg-white p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-[#6b7683]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[#172026]">{value}</p>
    </div>
  );
}

function InventoryStockValueSection({
  data,
  stockCostStatus,
}: {
  data: StockValueData;
  stockCostStatus: DashboardSearchParams;
}) {
  const cards = [
    {
      detail: "Positive-stock SKUs from current_inventory_by_sku.",
      icon: Database,
      label: "Total Current Inventory Qty",
      tone: "blue" as const,
      value: formatNumber(data.summary.totalCurrentQty),
    },
    {
      detail: "Current qty multiplied by effective purchase unit cost.",
      icon: Coins,
      label: "Estimated Stock Value",
      tone: data.summary.estimatedStockValue > 0 ? ("green" as const) : ("gray" as const),
      value: formatMoneyValue(data.summary.estimatedStockValue),
    },
    {
      detail: "Inventory quantity with valid effective purchase cost.",
      icon: CheckCircle2,
      label: "Valued Qty",
      tone: data.summary.valuedQty > 0 ? ("green" as const) : ("gray" as const),
      value: formatNumber(data.summary.valuedQty),
    },
    {
      detail: "Inventory quantity with missing or invalid effective purchase cost.",
      icon: AlertTriangle,
      label: "Missing Cost Qty",
      tone: data.summary.missingCostQty > 0 ? ("yellow" as const) : ("green" as const),
      value: formatNumber(data.summary.missingCostQty),
    },
    {
      detail: "Valued quantity divided by total current inventory quantity.",
      icon: Activity,
      label: "Cost Coverage %",
      tone: data.summary.costCoveragePercent >= 80 ? ("green" as const) : data.summary.costCoveragePercent > 0 ? ("yellow" as const) : ("gray" as const),
      value: formatPercent(data.summary.costCoveragePercent),
    },
  ];

  return (
    <section className="rounded-lg border border-[#dfe4ea] bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#64707d]">
            Inventory Stock Value
          </p>
          <h2 className="mt-2 text-xl font-semibold text-[#172026]">Current Stock Valuation MVP</h2>
          <p className="mt-2 text-sm text-[#5c6875]">
            Uses positive Shopify stock and effective purchase cost: recent PO average from 2026-04-01 onward, with Latest purchase / unit fallback.
          </p>
        </div>
        <div className="rounded-md border border-[#dfe4ea] bg-[#f9fafb] px-3 py-2 text-xs font-medium text-[#5d6a78]">
          Missing costs stay visible and are not valued as zero.
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => (
          <SummaryCard {...card} key={card.label} />
        ))}
      </div>

      {data.warnings.length > 0 ? (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {data.warnings.slice(0, 3).join(" ")}
        </div>
      ) : null}

      {stockCostStatus.stockCostSaved === "1" ? (
        <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
          Saved SKU cost override{stockCostStatus.stockCostSku ? ` for ${stockCostStatus.stockCostSku}` : ""}.
        </div>
      ) : null}
      {stockCostStatus.stockCostError ? (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">
          {stockCostStatus.stockCostSku ? `${stockCostStatus.stockCostSku}: ` : ""}
          {stockCostStatus.stockCostError}
        </div>
      ) : null}

      <div className="mt-5 grid gap-5 2xl:grid-cols-2">
        <StockValueMixTable rows={data.supplierMix} title="Supplier Stock Value Mix" />
        <StockValueMixTable rows={data.categoryMix} title="Category Stock Value Mix" />
      </div>

      <div className="mt-5">
        <MissingCostSkuTable rows={data.missingCostSkus} stockCostStatus={stockCostStatus} />
      </div>
    </section>
  );
}

function StockValueMixTable({ rows, title }: { rows: StockValueData["supplierMix"]; title: string }) {
  return (
    <section className="rounded-lg border border-[#dfe4ea] bg-[#f9fafb] p-4">
      <h3 className="text-sm font-semibold text-[#172026]">{title}</h3>
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-[860px] text-left text-xs">
          <thead className="text-[#5d6a78]">
            <tr className="border-b border-[#dfe4ea]">
              <th className="py-2 pr-3 font-semibold">{title.startsWith("Supplier") ? "Supplier" : "Category"}</th>
              <th className="py-2 pr-3 text-right font-semibold">Current Qty</th>
              <th className="py-2 pr-3 text-right font-semibold">Valued Qty</th>
              <th className="py-2 pr-3 text-right font-semibold">Missing Cost Qty</th>
              <th className="py-2 pr-3 text-right font-semibold">Cost Coverage %</th>
              <th className="py-2 pr-3 text-right font-semibold">Estimated Stock Value</th>
              <th className="py-2 text-right font-semibold">% of Total Value</th>
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows.map((row) => (
                <tr className="border-b border-[#e6ebf0] last:border-b-0" key={row.label}>
                  <td className="max-w-[220px] py-2 pr-3 align-top font-semibold text-[#172026]">{row.label}</td>
                  <td className="py-2 pr-3 text-right align-top text-[#44515f]">{formatNumber(row.currentQty)}</td>
                  <td className="py-2 pr-3 text-right align-top text-[#44515f]">{formatNumber(row.valuedQty)}</td>
                  <td className="py-2 pr-3 text-right align-top text-[#44515f]">{formatNumber(row.missingCostQty)}</td>
                  <td className="py-2 pr-3 text-right align-top font-semibold text-[#172026]">{formatPercent(row.costCoveragePercent)}</td>
                  <td className="py-2 pr-3 text-right align-top font-semibold text-[#172026]">{formatMoneyValue(row.estimatedStockValue)}</td>
                  <td className="py-2 text-right align-top text-[#44515f]">{formatPercent(row.percentOfTotalEstimatedValue)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="py-3 text-[#667380]" colSpan={7}>
                  No positive-stock inventory found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PoSizeMixOverview({
  cards,
  sizeMix,
}: {
  cards: PoSizeMixCard[];
  sizeMix: Awaited<ReturnType<typeof getPoDashboardData>>["sizeMix"];
}) {
  const hasData = cards.some((card) => card.totalQty > 0);

  return (
    <section className="rounded-lg border border-[#dfe4ea] bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#64707d]">
            PO History
          </p>
          <h2 className="mt-2 text-xl font-semibold text-[#172026]">
            Historical PO Size Mix Overview
          </h2>
          <p className="mt-2 text-sm text-[#5c6875]">
            Based on PO line quantities across current and closed purchase orders.
          </p>
        </div>
        <div className="rounded-md border border-[#dfe4ea] bg-[#f9fafb] px-3 py-2 text-xs font-medium text-[#5d6a78]">
          Ordered qty sample: {formatNumber(sizeMix.sampleQty)}
        </div>
      </div>

      {!hasData ? (
        <div className="mt-4 rounded-md border border-[#e1e6ec] bg-[#f9fafb] p-4 text-sm text-[#5d6a78]">
          No historical PO size mix data found.
        </div>
      ) : (
        <>
          {sizeMix.lowSampleSize ? (
            <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Low sample size. Treat this as a rough estimate.
            </div>
          ) : null}

          <div className="mt-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {cards.map((card) => (
              <PoSizeMixCardView card={card} key={card.group} />
            ))}
          </div>

          <div className="mt-4 rounded-lg border border-[#dfe4ea] bg-[#f9fafb] p-4">
            <h3 className="text-sm font-semibold text-[#172026]">Key takeaways</h3>
            {sizeMix.takeaways.length > 0 ? (
              <ul className="mt-2 grid gap-1.5 text-sm text-[#44515f]">
                {sizeMix.takeaways.map((takeaway) => (
                  <li key={takeaway}>{takeaway}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-[#667380]">Not enough classified PO quantity for takeaways yet.</p>
            )}
          </div>
        </>
      )}

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#667380]">
        {sizeMix.notes.map((note) => (
          <span key={note}>{note}</span>
        ))}
      </div>
    </section>
  );
}

function PoSizeMixCardView({ card }: { card: PoSizeMixCard }) {
  return (
    <article className="overflow-hidden rounded-lg border border-[#dfe4ea] bg-white">
      <div className="bg-[#102235] px-4 py-3 text-white">
        <h3 className="text-sm font-semibold">{card.title}</h3>
        <p className="mt-1 text-xs text-[#c6d3df]">Total ordered qty: {formatNumber(card.totalQty)}</p>
      </div>
      <div className="grid gap-2 p-4">
        {card.rows.length > 0 ? (
          card.rows.map((row) => <PoSizeMixBar row={row} key={`${card.group}-${row.bucket}`} />)
        ) : (
          <p className="text-sm text-[#667380]">No matching PO data.</p>
        )}
        {card.unknownLines.length > 0 ? <PoSizeMixUnknownLines lines={card.unknownLines} /> : null}
      </div>
    </article>
  );
}

function PoSizeMixBar({ row }: { row: PoSizeMixBucket }) {
  const isTopBucket = row.rank <= 2;

  return (
    <div className="grid grid-cols-[76px_minmax(0,1fr)_52px] items-center gap-2 text-xs" title={`${row.bucket}: ${formatNumber(row.qty)} ordered`}>
      <span className={isTopBucket ? "font-semibold text-[#172026]" : "font-medium text-[#44515f]"}>
        {row.bucket}
      </span>
      <div className="h-2.5 overflow-hidden rounded-full bg-[#e6ebf0]">
        <div
          className={isTopBucket ? "h-full rounded-full bg-[#102235]" : "h-full rounded-full bg-[#7d8da0]"}
          style={{ width: `${Math.max(1, Math.min(100, row.pct))}%` }}
        />
      </div>
      <span className={isTopBucket ? "text-right font-semibold text-[#172026]" : "text-right font-medium text-[#44515f]"}>
        {formatPercent(row.pct)}
      </span>
    </div>
  );
}

function PoSizeMixUnknownLines({ lines }: { lines: PoSizeMixUnknownLine[] }) {
  return (
    <details className="mt-2 rounded-md border border-amber-200 bg-amber-50/70">
      <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-amber-950">
        Review Unknown lines
      </summary>
      <div className="border-t border-amber-200 bg-white p-3">
        <div className="overflow-x-auto">
          <table className="min-w-[960px] text-left text-xs">
            <thead className="text-[#5d6a78]">
              <tr className="border-b border-[#e1e6ec]">
                <th className="py-2 pr-3 font-semibold">Group</th>
                <th className="py-2 pr-3 font-semibold">PO / Quote</th>
                <th className="py-2 pr-3 font-semibold">Supplier</th>
                <th className="py-2 pr-3 font-semibold">SKU</th>
                <th className="py-2 pr-3 font-semibold">Product / Item name</th>
                <th className="py-2 pr-3 font-semibold">Variant / Option / Size</th>
                <th className="py-2 pr-3 text-right font-semibold">Ordered Qty</th>
                <th className="py-2 pr-3 font-semibold">Parse reason</th>
                <th className="py-2 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr className="border-b border-[#edf1f5] last:border-b-0" key={`${line.group}-${line.poId}-${line.sku}-${line.itemName}-${line.orderedQty}`}>
                  <td className="max-w-[150px] py-2 pr-3 align-top text-[#44515f]">{formatSizeMixGroup(line.group)}</td>
                  <td className="max-w-[140px] py-2 pr-3 align-top font-medium text-[#172026]">{line.poReference || line.poId}</td>
                  <td className="max-w-[150px] py-2 pr-3 align-top text-[#44515f]">{line.supplierName}</td>
                  <td className="max-w-[140px] py-2 pr-3 align-top font-mono text-[11px] text-[#172026]">{line.sku || "N/A"}</td>
                  <td className="max-w-[220px] py-2 pr-3 align-top text-[#172026]">{line.itemName || "N/A"}</td>
                  <td className="max-w-[180px] py-2 pr-3 align-top text-[#44515f]">{line.variantText || "N/A"}</td>
                  <td className="py-2 pr-3 text-right align-top font-semibold text-[#172026]">{formatNumber(line.orderedQty)}</td>
                  <td className="max-w-[160px] py-2 pr-3 align-top text-[#6b4e16]">{line.parseReason}</td>
                  <td className="py-2 align-top">
                    <Link className="font-semibold text-[#174ea6] hover:underline" href={line.href}>
                      Open PO
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </details>
  );
}

function DashboardSection({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">{children}</div>
    </section>
  );
}
