import { ArrowLeft, Download, EyeOff, Filter, Printer, Save, SlidersHorizontal } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import {
  createPoFromDecisionAction,
  savePurchasingDecisionAction,
} from "@/app/purchasing-decision/actions";
import {
  AlertFilterSelect,
  DecisionCreatePoButton,
  DecisionSearchBox,
  DemandHmHeaderControls,
  DecisionPlanningCells,
  DecisionSaveButton,
  BulkPlanningControls,
  HideSelectionButtons,
  OrderQtyModeHeaderButtons,
  SelectionButtons,
  StockFilterSelect,
  TagDropdownSelect,
} from "@/app/purchasing-decision/decision-form";
import { PoSidebarNav } from "@/app/po/sidebar-nav";
import {
  getPurchasingDecisionData,
} from "@/lib/purchasing-decision-data";
import { PendingSubmitButton } from "@/app/loading-controls";
import { formatNumber } from "@/lib/baseline-data";
import { requireUser } from "@/lib/auth";
import { canAccessAdminControlTower, defaultLandingForRole } from "@/lib/role-nav";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const inputClass =
  "h-9 w-full rounded-md border border-[#cfd6df] bg-white px-2 text-sm text-[#172026] outline-none focus:border-[#255f85]";
const readOnlyMetricClass = "px-3 py-3 text-right font-mono text-sm text-[#172026]";
const stickyHeaderBase = "sticky top-0 bg-[#f3f5f7] px-3 py-3 font-semibold";
const stickyCellBase = "sticky px-3 py-3 align-top shadow-[1px_0_0_#edf1f5]";
const alertOptions = ["order_now", "watch", "healthy", "hidden"].map((value) => ({
  label: alertLabel(value),
  value,
}));
const stockOptions = [
  { label: "Any overstock", value: "any_overstock" },
  { label: "Heavy overstock", value: "heavy_overstock" },
  { label: "Overstock", value: "overstock" },
  { label: "Dead stock", value: "dead_stock" },
  { label: "Healthy", value: "healthy" },
  { label: "Under target", value: "under_target" },
];

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(value);
}

function formatDecimal(value: number, digits = 2) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

function qtyValue(value: number) {
  return Number.isFinite(value) ? String(value) : "0";
}

function alertLabel(status: string) {
  if (status === "order_now") {
    return "Order now";
  }
  if (status === "watch") {
    return "Watch";
  }
  if (status === "hidden") {
    return "Hidden";
  }
  return "Healthy";
}

function normalizeSelectedAlerts(alert: string | string[] | undefined) {
  const values = Array.isArray(alert) ? alert : [alert ?? "all"];
  const selected = values
    .flatMap((value) => String(value).split(","))
    .map((value) => value.trim())
    .filter(Boolean);

  return selected.length ? selected : ["all"];
}

function normalizeSelectedStock(stock: string | string[] | undefined) {
  const values = Array.isArray(stock) ? stock : [stock ?? "all"];
  const selected = values
    .flatMap((value) => String(value).split(","))
    .map((value) => value.trim())
    .filter(Boolean);

  return selected.length ? selected : ["all"];
}

function sameText(left: string, right: string) {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function statusHelpText(itemStatus: string, shopifyItemStatus: string) {
  if (!itemStatus) {
    return "No status";
  }
  if (!shopifyItemStatus || sameText(itemStatus, shopifyItemStatus)) {
    return `Shopify: ${shopifyItemStatus || itemStatus}`;
  }

  return `Sheet override: ${itemStatus} | Shopify: ${shopifyItemStatus}`;
}

function statusHelpClass(itemStatus: string, shopifyItemStatus: string) {
  if (!shopifyItemStatus || sameText(itemStatus, shopifyItemStatus)) {
    return "text-[#7a8794]";
  }

  return "text-[#255f85]";
}

function appendParam(params: URLSearchParams, key: string, value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    value.forEach((item) => {
      if (item) {
        params.append(key, item);
      }
    });
    return;
  }
  if (value) {
    params.set(key, value);
  }
}

function decisionReturnTo(params: {
  alert?: string | string[];
  capSelling?: string;
  lifetimeWeight?: string;
  q?: string;
  recentFloor?: string;
  round10?: string;
  sellingWeight?: string;
  status?: string;
  stock?: string | string[];
  supplier?: string;
  tag?: string;
  visibility?: string;
}) {
  const nextParams = new URLSearchParams();
  appendParam(nextParams, "alert", params.alert);
  appendParam(nextParams, "capSelling", params.capSelling);
  appendParam(nextParams, "lifetimeWeight", params.lifetimeWeight);
  appendParam(nextParams, "q", params.q);
  appendParam(nextParams, "recentFloor", params.recentFloor);
  appendParam(nextParams, "round10", params.round10);
  appendParam(nextParams, "sellingWeight", params.sellingWeight);
  appendParam(nextParams, "status", params.status);
  appendParam(nextParams, "stock", params.stock);
  appendParam(nextParams, "supplier", params.supplier);
  appendParam(nextParams, "tag", params.tag);
  appendParam(nextParams, "visibility", params.visibility);
  const query = nextParams.toString();
  return query ? `/purchasing-decision?${query}` : "/purchasing-decision";
}

function decisionExportHref(params: {
  alert?: string | string[];
  capSelling?: string;
  lifetimeWeight?: string;
  q?: string;
  recentFloor?: string;
  round10?: string;
  sellingWeight?: string;
  status?: string;
  stock?: string | string[];
  supplier?: string;
  tag?: string;
  visibility?: string;
}) {
  const nextParams = new URLSearchParams();
  appendParam(nextParams, "alert", params.alert);
  appendParam(nextParams, "capSelling", params.capSelling);
  appendParam(nextParams, "lifetimeWeight", params.lifetimeWeight);
  appendParam(nextParams, "q", params.q);
  appendParam(nextParams, "recentFloor", params.recentFloor);
  appendParam(nextParams, "round10", params.round10);
  appendParam(nextParams, "sellingWeight", params.sellingWeight);
  appendParam(nextParams, "status", params.status);
  appendParam(nextParams, "stock", params.stock);
  appendParam(nextParams, "supplier", params.supplier);
  appendParam(nextParams, "tag", params.tag);
  appendParam(nextParams, "visibility", params.visibility);
  const query = nextParams.toString();
  return query
    ? `/api/purchasing-decision/export?${query}`
    : "/api/purchasing-decision/export";
}

function decisionExportAllHref() {
  return "/api/purchasing-decision/export?visibility=all&round10=all";
}

function decisionOverstockReportHref(params: {
  alert?: string | string[];
  capSelling?: string;
  lifetimeWeight?: string;
  q?: string;
  recentFloor?: string;
  round10?: string;
  sellingWeight?: string;
  status?: string;
  supplier?: string;
  tag?: string;
  visibility?: string;
}) {
  const nextParams = new URLSearchParams();
  appendParam(nextParams, "alert", params.alert);
  appendParam(nextParams, "capSelling", params.capSelling);
  appendParam(nextParams, "lifetimeWeight", params.lifetimeWeight);
  appendParam(nextParams, "q", params.q);
  appendParam(nextParams, "recentFloor", params.recentFloor);
  appendParam(nextParams, "round10", params.round10);
  appendParam(nextParams, "sellingWeight", params.sellingWeight);
  appendParam(nextParams, "status", params.status);
  appendParam(nextParams, "supplier", params.supplier);
  appendParam(nextParams, "tag", params.tag);
  appendParam(nextParams, "visibility", params.visibility);
  const query = nextParams.toString();

  return query
    ? `/purchasing-decision/overstock-report?${query}`
    : "/purchasing-decision/overstock-report";
}

export default async function PurchasingDecisionPage({
  searchParams,
}: {
  searchParams: Promise<{
    alert?: string | string[];
    capSelling?: string;
    lifetimeWeight?: string;
    q?: string;
    poError?: string;
    recentFloor?: string;
    round10?: string;
    saved?: string;
    savedRows?: string;
    sellingWeight?: string;
    status?: string;
    stock?: string | string[];
    supplier?: string;
    tag?: string;
    visibility?: string;
  }>;
}) {
  const currentUser = await requireUser("/purchasing-decision");
  if (!canAccessAdminControlTower(currentUser)) {
    redirect(`/access-denied?from=${encodeURIComponent("/purchasing-decision")}&next=${encodeURIComponent(defaultLandingForRole(currentUser.role))}`);
  }
  const params = await searchParams;
  const q = params.q ?? "";
  const supplier = params.supplier ?? "all";
  const tag = params.tag ?? "all";
  const status = params.status ?? "all";
  const stock = normalizeSelectedStock(params.stock);
  const alert = normalizeSelectedAlerts(params.alert);
  const visibility = params.visibility ?? "active";
  const round10 = params.round10 ?? "positive";
  const poError = params.poError ?? "";
  const savedRows = Number(params.savedRows ?? 0);
  const savedMessage =
    params.saved === "1"
      ? `Saved ${formatNumber(Number.isFinite(savedRows) ? savedRows : 0)} visible rows.`
      : "";
  const returnTo = decisionReturnTo(params);
  const exportHref = decisionExportHref(params);
  const exportAllHref = decisionExportAllHref();
  const overstockReportHref = decisionOverstockReportHref(params);
  const createPoFormId = "decision-create-po-form";
  const data = await getPurchasingDecisionData({
    alert,
    capSelling: params.capSelling,
    itemStatus: status,
    lifetimeWeight: params.lifetimeWeight,
    q,
    recentFloor: params.recentFloor,
    round10,
    sellingWeight: params.sellingWeight,
    stock,
    supplier,
    tag,
    visibility,
  });

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f6f7f9] text-[#172026] lg:grid lg:grid-cols-[200px_minmax(0,1fr)]">
      <PoSidebarNav active="reorder" />
      <div className="min-w-0 max-w-full overflow-x-hidden">
      <header className="border-b border-[#d9dde3] bg-white">
        <div className="flex w-full flex-col gap-5 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64707d]">
              Purchasing Decision
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-[#172026]">
              Reorder Planning Workspace
            </h1>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-[#52606d]">
              Shopify stays read-only for stock and sales. This page stores the
              purchasing-only layer: supplier override, main name, tags, lead time,
              safety stock, order cycle, manual ROP, and hidden event items.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Link
              className="inline-flex h-10 items-center gap-2 rounded-md border border-[#cfd6df] bg-[#f9fafb] px-3 font-medium text-[#364252]"
              href="/"
            >
              <ArrowLeft size={16} />
              Dashboard
            </Link>
            <Link
              className="inline-flex h-10 items-center rounded-md border border-[#cfd6df] bg-[#f9fafb] px-3 font-medium text-[#364252]"
              href="/po"
              rel="noreferrer"
              target="_blank"
            >
              PO Portal
            </Link>
          </div>
        </div>
      </header>

      <div className="grid w-full min-w-0 gap-5 px-4 py-5 sm:px-6">
        {!data.controlsReady ? (
          <section className="rounded-lg border border-[#f0d9aa] bg-[#fffaf0] p-4 text-sm text-[#6f5a31]">
            Apply `supabase/migrations/005_purchasing_decision_controls.sql` in
            Supabase before saving manual purchasing controls.
          </section>
        ) : null}

        <section className="grid min-w-0 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {[
            { label: "SKUs", value: formatNumber(data.totals.skuCount), detail: "in Shopify read model" },
            { label: "Active", value: formatNumber(data.totals.activeSkuCount), detail: "visible to dashboard / PO" },
            { label: "Hidden", value: formatNumber(data.totals.hiddenSkuCount), detail: "event or markdown list" },
            {
              label: "On-hand",
              value: formatNumber(data.totals.onHandUnits),
              detail: "active visible, Shopify read-only",
              subDetail: `Overall incl. hidden: ${formatNumber(data.totals.overallOnHandUnits)}`,
            },
            { label: "Coming", value: formatNumber(data.totals.comingUnits), detail: "open PO workflow" },
            {
              label: "Stock value",
              value: `THB ${formatMoney(data.totals.inventoryValue)}`,
              detail: "active visible price estimate",
              subDetail: `Overall incl. hidden: THB ${formatMoney(data.totals.overallInventoryValue)}`,
            },
          ].map((metric) => (
            <article
              className="rounded-lg border border-[#dfe4ea] bg-white p-4 shadow-sm"
              key={metric.label}
            >
              <p className="text-sm font-medium text-[#5d6a78]">{metric.label}</p>
              <p className="mt-2 text-2xl font-semibold text-[#172026]">
                {metric.value}
              </p>
              <p className="mt-2 text-sm text-[#667380]">{metric.detail}</p>
              {"subDetail" in metric ? (
                <p className="mt-1 text-xs font-semibold text-[#42505c]">
                  {metric.subDetail}
                </p>
              ) : null}
            </article>
          ))}
        </section>

        <section className="min-w-0 rounded-lg border border-[#dfe4ea] bg-white shadow-sm">
          <div className="grid gap-4 border-b border-[#e2e7ed] p-4 sm:p-5">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[#172026]">
                  Purchasing Decision Sheet
                </h2>
                <p className="mt-1 text-sm text-[#667380]">
                  Filter by supplier, edit planning controls, mark event items hidden,
                  then save all visible rows in one submit.
                </p>
              </div>
              <form className="grid gap-3 md:grid-cols-[1fr_240px_170px_170px_150px_150px_170px_150px_auto]">
                <input name="lifetimeWeight" type="hidden" value={data.demandFormula.lifetimeWeight} />
                <input name="sellingWeight" type="hidden" value={data.demandFormula.sellingDayWeight} />
                <input name="recentFloor" type="hidden" value={data.demandFormula.recentFloorPercent} />
                <input
                  name="capSelling"
                  type="hidden"
                  value={data.demandFormula.capAtSellingDayAverage ? "true" : "false"}
                />
                <DecisionSearchBox initialValue={q} options={data.searchOptions} />
                <label className="grid gap-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#65717f]">
                    Supplier
                  </span>
                  <select className={inputClass} defaultValue={supplier} name="supplier">
                    <option value="all">All suppliers</option>
                    <option value="__unset">Not set in sheet</option>
                    <option value="__unmapped">Unmapped supplier</option>
                    {data.supplierFilterOptions.map((option) => (
                      <option key={option.supplier} value={option.supplier}>
                        {option.supplier} | qty {formatNumber(option.orderQty)} | on-hand {formatNumber(option.onHandUnits)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#65717f]">
                    Tags
                  </span>
                  <select className={inputClass} defaultValue={tag} name="tag">
                    <option value="all">All tags</option>
                    {data.tagFilterOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#65717f]">
                    Status
                  </span>
                  <select className={inputClass} defaultValue={status} name="status">
                    <option value="all">All statuses</option>
                    {data.itemStatusOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#65717f]">
                    Visibility
                  </span>
                  <select
                    className={inputClass}
                    defaultValue={visibility}
                    name="visibility"
                  >
                    <option value="active">Active only</option>
                    <option value="hidden">Hidden list</option>
                    <option value="all">All</option>
                  </select>
                </label>
                <AlertFilterSelect options={alertOptions} selectedAlerts={alert} />
                <StockFilterSelect options={stockOptions} selectedStock={stock} />
                <label className="grid gap-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#65717f]">
                    Round 10
                  </span>
                  <select className={inputClass} defaultValue={round10} name="round10">
                    <option value="positive">&gt; 0 only</option>
                    <option value="zero">= 0 only</option>
                    <option value="all">All</option>
                  </select>
                </label>
                <PendingSubmitButton
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#cfd6df] bg-[#f9fafb] px-4 text-sm font-semibold text-[#364252]"
                  loadingText="Filtering..."
                >
                  <Filter size={16} />
                  Filter
                </PendingSubmitButton>
              </form>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <Link
                className="inline-flex h-9 items-center rounded-md border border-[#cfd6df] bg-[#f9fafb] px-3 font-semibold text-[#364252]"
                href="/purchasing-setup"
              >
                Setup Suppliers & Tags
              </Link>
              <span className="inline-flex h-9 items-center rounded-md bg-[#eef4f8] px-3 text-xs font-semibold text-[#255f85]">
                Tags and suppliers are controlled by Purchasing Setup
              </span>
            </div>
          </div>

          {poError ? (
            <div className="border-b border-[#f5c2bd] bg-[#fff1f0] px-4 py-3 text-sm font-semibold text-[#a33a32]">
              {poError}
            </div>
          ) : null}
          {savedMessage ? (
            <div className="border-b border-[#b8e0c5] bg-[#eefaf1] px-4 py-3 text-sm font-semibold text-[#1f6b3d]">
              {savedMessage}
            </div>
          ) : null}
          <form
            action={createPoFromDecisionAction}
            className="hidden"
            id={createPoFormId}
          >
            <input name="returnTo" type="hidden" value={returnTo} />
          </form>
          <form action={savePurchasingDecisionAction}>
            <input name="returnTo" type="hidden" value={returnTo} />
            <div className="flex flex-col gap-3 border-b border-[#e2e7ed] bg-[#fbfcfd] px-4 py-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="inline-flex items-center gap-2 text-sm font-medium text-[#52606d]">
                <SlidersHorizontal size={16} />
                Showing {formatNumber(data.lines.length)} rows
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <SelectionButtons />
                <a
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#cfd6df] bg-white px-3 text-sm font-semibold text-[#364252]"
                  download
                  href={exportHref}
                >
                  <Download size={16} />
                  Export
                </a>
                <a
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#cfd6df] bg-white px-3 text-sm font-semibold text-[#364252]"
                  download
                  href={exportAllHref}
                >
                  <Download size={16} />
                  Export all SKU
                </a>
                <Link
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#cfd6df] bg-white px-3 text-sm font-semibold text-[#364252]"
                  href={overstockReportHref}
                  target="_blank"
                >
                  <Printer size={16} />
                  Print report
                </Link>
                <span className="inline-flex items-center gap-2 rounded-md bg-[#eef4f8] px-3 py-2 text-xs font-semibold text-[#255f85]">
                  <Save size={14} />
                  One save for visible rows
                </span>
                <BulkPlanningControls
                  canBulkEdit={currentUser.role === "super_admin"}
                  filterSummary={[
                    supplier !== "all" ? `Supplier = ${supplier}` : "Supplier = all",
                    tag !== "all" ? `Tag = ${tag}` : "",
                    status !== "all" ? `Status = ${status}` : "",
                    visibility !== "active" ? `Visibility = ${visibility}` : "Visibility = active only",
                    `Round 10 = ${
                      round10 === "positive" ? "> 0 only" : round10 === "zero" ? "= 0 only" : "all"
                    }`,
                    stock.includes("all") ? "" : `Stock = ${stock.join(", ")}`,
                    alert.includes("all") ? "" : `Alert = ${alert.join(", ")}`,
                    q ? `Search = ${q}` : "",
                  ].filter(Boolean).join(", ")}
                  rowCount={data.lines.length}
                />
                <DecisionSaveButton />
                <DecisionCreatePoButton formId={createPoFormId} />
              </div>
            </div>

            <div className="max-h-[calc(100vh-260px)] max-w-full overflow-auto">
              <table className="min-w-[2920px] text-left text-sm">
                <thead className="bg-[#f3f5f7] text-xs uppercase tracking-[0.12em] text-[#65717f]">
                  <tr>
                    <th className={`${stickyHeaderBase} left-0 z-50 w-[52px] min-w-[52px]`}>Pick</th>
                    <th className={`${stickyHeaderBase} left-[52px] z-50 w-[96px] min-w-[96px]`}>SKU</th>
                    <th className={`${stickyHeaderBase} left-[148px] z-50 w-[180px] min-w-[180px]`}>
                      <HideSelectionButtons />
                    </th>
                    <th className={`${stickyHeaderBase} left-[328px] z-50 w-[280px] min-w-[280px]`}>Product</th>
                    <th className={`${stickyHeaderBase} left-[608px] z-50 w-[200px] min-w-[200px]`}>Main name</th>
                    <th className={`${stickyHeaderBase} z-40`}>Item status</th>
                    <th className={`${stickyHeaderBase} z-40`}>Tags</th>
                    <th className={`${stickyHeaderBase} z-40`}>Sup</th>
                    <th className={`${stickyHeaderBase} z-40 text-right`}>On-hand</th>
                    <th className={`${stickyHeaderBase} z-40 text-right`}>Total sale</th>
                    <th className={`${stickyHeaderBase} z-40 text-right`}>Demand 30D</th>
                    <th className={`${stickyHeaderBase} z-40 text-right`}>
                      <DemandHmHeaderControls
                        capAtSellingDayAverage={data.demandFormula.capAtSellingDayAverage}
                        lifetimeWeight={data.demandFormula.lifetimeWeight}
                        recentFloorPercent={data.demandFormula.recentFloorPercent}
                        sellingDayWeight={data.demandFormula.sellingDayWeight}
                      />
                    </th>
                    <th className={`${stickyHeaderBase} z-40 text-right`}>Safety</th>
                    <th className={`${stickyHeaderBase} z-40 text-right`}>Lead</th>
                    <th className={`${stickyHeaderBase} z-40 text-right`}>Cycle</th>
                    <th className={`${stickyHeaderBase} z-40 text-right`}>Re-order Point</th>
                    <th className={`${stickyHeaderBase} z-40 text-right`}>Target Qty</th>
                    <th className={`${stickyHeaderBase} z-40 text-right`}>Order Qty</th>
                    <th className={`${stickyHeaderBase} z-40 text-right`}>Round 10</th>
                    <th className={`${stickyHeaderBase} z-40`}>
                      <OrderQtyModeHeaderButtons />
                    </th>
                    <th className={`${stickyHeaderBase} z-40 text-right`}>Cover</th>
                    <th className={`${stickyHeaderBase} z-40 text-right`}>Week</th>
                    <th className={`${stickyHeaderBase} z-40 text-right`}>Month</th>
                    <th className={`${stickyHeaderBase} z-40`}>Alert</th>
                    <th className={`${stickyHeaderBase} z-40`}>Stock Alert</th>
                    <th className={`${stickyHeaderBase} z-40 text-right`}>Over Qty</th>
                    <th className={`${stickyHeaderBase} z-40 text-right`}>Over Days</th>
                    <th className={`${stickyHeaderBase} z-40 text-right`}>At order</th>
                    <th className={`${stickyHeaderBase} z-40 text-right`}>Coming</th>
                    <th className={`${stickyHeaderBase} z-40 text-right`}>Value</th>
                    <th className={`${stickyHeaderBase} z-40`}>Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf1f5]">
                  {data.lines.map((line) => {
                    const rowBackground = line.hidden ? "bg-[#fbfcfd]" : "bg-white";
                    const supplierSelectOptions = Array.from(
                      new Set([line.supplier, ...data.supplierOptions].filter(Boolean)),
                    );

                    return (
                      <tr className={rowBackground} key={line.sku}>
                      <td className={`${stickyCellBase} left-0 z-30 w-[52px] min-w-[52px] ${rowBackground}`}>
                        <input
                          className="size-4 accent-[#172026]"
                          data-decision-select="sku"
                          defaultChecked={false}
                          form={createPoFormId}
                          name="selectedSku"
                          type="checkbox"
                          value={line.sku}
                        />
                        <input form={createPoFormId} name="poSku" type="hidden" value={line.sku} />
                        <input
                          form={createPoFormId}
                          name="poProductName"
                          type="hidden"
                          value={line.productName}
                        />
                        <input
                          form={createPoFormId}
                          name="poMainName"
                          type="hidden"
                          value={line.mainName}
                        />
                        <input
                          form={createPoFormId}
                          name="poSupplier"
                          type="hidden"
                          value={line.supplier}
                        />
                        <input
                          form={createPoFormId}
                          name="poUnitPrice"
                          type="hidden"
                          value={qtyValue(line.unitPrice)}
                        />
                      </td>
                      <td className={`${stickyCellBase} left-[52px] z-30 w-[96px] min-w-[96px] ${rowBackground}`}>
                        <input name="sku" type="hidden" value={line.sku} />
                        <p className="font-mono text-xs font-semibold text-[#42505c]">
                          {line.sku}
                        </p>
                        <p className="mt-1 text-xs text-[#7a8794]">
                          {line.supplierSource}
                        </p>
                      </td>
                      <td className={`${stickyCellBase} left-[148px] z-30 w-[180px] min-w-[180px] ${rowBackground}`}>
                        <label className="mb-2 flex items-center gap-2 text-xs font-semibold text-[#52606d]">
                          <input
                            className="size-4 accent-[#172026]"
                            data-decision-hide="sku"
                            defaultChecked={line.hidden}
                            name="hiddenSku"
                            type="checkbox"
                            value={line.sku}
                          />
                          <EyeOff size={14} />
                          Hide
                        </label>
                        <input
                          className={inputClass}
                          defaultValue={line.hideReason}
                          name="hideReason"
                          placeholder="Event / markdown"
                        />
                      </td>
                      <td className={`${stickyCellBase} left-[328px] z-30 w-[280px] min-w-[280px] ${rowBackground}`}>
                        <div className="flex items-start gap-3">
                          {line.imageUrl ? (
                            <Image
                              alt={line.productName}
                              className="size-12 rounded-md border border-[#dfe4ea] object-cover"
                              height={48}
                              src={line.imageUrl}
                              width={48}
                            />
                          ) : (
                            <div className="grid size-12 place-items-center rounded-md border border-[#dfe4ea] bg-[#f3f5f7] text-xs text-[#7a8794]">
                              SKU
                            </div>
                          )}
                          <input
                            className={inputClass}
                            defaultValue={line.productName}
                            name="productName"
                          />
                        </div>
                      </td>
                      <td className={`${stickyCellBase} left-[608px] z-30 w-[200px] min-w-[200px] ${rowBackground}`}>
                        <input
                          className={inputClass}
                          defaultValue={line.mainName}
                          name="mainName"
                        />
                      </td>
                      <td className="min-w-[160px] px-3 py-3 align-top">
                        <input
                          name="shopifyItemStatus"
                          type="hidden"
                          value={line.shopifyItemStatus}
                        />
                        <select
                          className={inputClass}
                          defaultValue={line.itemStatus}
                          name="itemStatus"
                        >
                          {Array.from(
                            new Set([line.itemStatus, line.shopifyItemStatus, ...data.itemStatusOptions])
                          )
                            .filter(Boolean)
                            .map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                        </select>
                        <p
                          className={`mt-1 text-right font-mono text-[10px] ${statusHelpClass(
                            line.itemStatus,
                            line.shopifyItemStatus,
                          )}`}
                        >
                          {statusHelpText(line.itemStatus, line.shopifyItemStatus)}
                        </p>
                      </td>
                      <td className="min-w-[190px] px-3 py-3 align-top">
                        <TagDropdownSelect initialTags={line.tags} options={data.tagOptions} />
                      </td>
                      <td className="min-w-[220px] px-3 py-3 align-top">
                        <select
                          className={inputClass}
                          defaultValue={line.supplier}
                          name="supplier"
                        >
                          <option value="">Select supplier</option>
                          {supplierSelectOptions.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                        <input name="supplierSource" type="hidden" value={line.supplierSource} />
                        <input name="originalSupplier" type="hidden" value={line.supplier} />
                      </td>
                      <td className={readOnlyMetricClass}>{formatNumber(line.onHandUnits)}</td>
                      <td className={readOnlyMetricClass}>{formatNumber(line.totalSale)}</td>
                      <td className={readOnlyMetricClass}>
                        <p>{formatDecimal(line.demand30Days, 2)}</p>
                        <p className="mt-1 text-xs text-[#6b7785]">daily avg</p>
                      </td>
                      <DecisionPlanningCells
                        calculatedDemandIndexHm={line.calculatedDemandIndexHm}
                        comingQty={line.coming}
                        createPoFormId={createPoFormId}
                        demandIndexOverride={line.demandIndexOverride}
                        firstSaleDate={line.firstSaleDate}
                        leadTimeDays={line.leadTimeDays}
                        leadTimeIsManual={line.leadTimeIsManual}
                        leadTimeSource={line.leadTimeSource}
                        lifetimeDailyAverage={line.lifetimeDailyAverage}
                        lastSaleDate={line.lastSaleDate}
                        orderCycleDays={line.orderCycleDays}
                        orderCycleIsManual={line.orderCycleIsManual}
                        orderQtyMode={line.orderQtyMode}
                        manualRopUnits={line.manualRopUnits}
                        reorderPointUnits={line.reorderPointUnits}
                        safetyDays={line.safetyDays}
                        safetyIsManual={line.safetyIsManual}
                        safetySource={line.safetySource}
                        sellingDayAverage={line.sellingDayAverage}
                        sellingDays={line.sellingDays}
                        sku={line.sku}
                        ropAlert={line.ropAlert}
                        onHandUnits={line.onHandUnits}
                        supplierLeadTimeDays={line.supplierLeadTimeDays}
                        supplierSafetyDays={line.supplierSafetyDays}
                      />
                      <td className={readOnlyMetricClass}>
                        <p>{formatNumber(line.coming)}</p>
                        {line.pendingComing > 0 ? (
                          <p className="mt-1 text-xs text-[#946200]">
                            pending {formatNumber(line.pendingComing)}
                          </p>
                        ) : null}
                      </td>
                      <td className={readOnlyMetricClass}>
                        <p>{formatMoney(line.inventoryValue)}</p>
                        <p className="mt-1 text-xs text-[#6b7785]">
                          coming {formatMoney(line.comingValue)}
                        </p>
                      </td>
                      <td className="min-w-[220px] px-3 py-3 align-top">
                        <input
                          className={inputClass}
                          defaultValue={line.note}
                          name="note"
                          placeholder="Purchasing note"
                        />
                        <input
                          name="targetCoverageDays"
                          type="hidden"
                          value={line.targetCoverageDays ?? ""}
                        />
                      </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </form>
        </section>
      </div>
      </div>
    </main>
  );
}
