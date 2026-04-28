import { ArrowLeft, EyeOff, Filter, Save, SlidersHorizontal } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import {
  createPoFromDecisionAction,
  savePurchasingDecisionAction,
} from "@/app/purchasing-decision/actions";
import {
  DecisionCreatePoButton,
  DecisionPlanningCells,
  DecisionSaveButton,
  SelectionButtons,
  TagDropdownSelect,
} from "@/app/purchasing-decision/decision-form";
import {
  getPurchasingDecisionData,
} from "@/lib/purchasing-decision-data";
import { formatNumber } from "@/lib/baseline-data";

export const dynamic = "force-dynamic";

const inputClass =
  "h-9 w-full rounded-md border border-[#cfd6df] bg-white px-2 text-sm text-[#172026] outline-none focus:border-[#255f85]";
const readOnlyMetricClass = "px-3 py-3 text-right font-mono text-sm text-[#172026]";

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(value);
}

function coverageText(value: number | null) {
  return value === null ? "-" : `${formatNumber(Math.floor(value))}d`;
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

function alertClass(status: string) {
  if (status === "order_now") {
    return "bg-[#fff1e8] text-[#9a3412]";
  }
  if (status === "watch") {
    return "bg-[#fff4e5] text-[#946200]";
  }
  if (status === "hidden") {
    return "bg-[#eef0f3] text-[#5c6670]";
  }
  return "bg-[#eaf6ef] text-[#1f6b3d]";
}

export default async function PurchasingDecisionPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; supplier?: string; visibility?: string }>;
}) {
  const params = await searchParams;
  const q = params.q ?? "";
  const supplier = params.supplier ?? "all";
  const visibility = params.visibility ?? "active";
  const data = await getPurchasingDecisionData({ q, supplier, visibility });

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f6f7f9] text-[#172026]">
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
            { label: "On-hand", value: formatNumber(data.totals.onHandUnits), detail: "Shopify read-only" },
            { label: "Coming", value: formatNumber(data.totals.comingUnits), detail: "open PO workflow" },
            { label: "Stock value", value: `THB ${formatMoney(data.totals.inventoryValue)}`, detail: "Shopify price estimate" },
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
              <form className="grid gap-3 md:grid-cols-[1fr_220px_160px_auto]">
                <label className="grid gap-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#65717f]">
                    Search
                  </span>
                  <input
                    className={inputClass}
                    defaultValue={q}
                    name="q"
                    placeholder="SKU, product, tag"
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#65717f]">
                    Supplier
                  </span>
                  <select className={inputClass} defaultValue={supplier} name="supplier">
                    <option value="all">All suppliers</option>
                    {data.supplierOptions.map((option) => (
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
                <button
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#cfd6df] bg-[#f9fafb] px-4 text-sm font-semibold text-[#364252]"
                  type="submit"
                >
                  <Filter size={16} />
                  Filter
                </button>
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

          <form action={createPoFromDecisionAction} id="decision-create-po-form" />
          <form action={savePurchasingDecisionAction}>
            <div className="flex flex-col gap-3 border-b border-[#e2e7ed] bg-[#fbfcfd] px-4 py-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="inline-flex items-center gap-2 text-sm font-medium text-[#52606d]">
                <SlidersHorizontal size={16} />
                Showing {formatNumber(data.lines.length)} rows
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <SelectionButtons />
                <span className="inline-flex items-center gap-2 rounded-md bg-[#eef4f8] px-3 py-2 text-xs font-semibold text-[#255f85]">
                  <Save size={14} />
                  One save for visible rows
                </span>
                <DecisionSaveButton />
                <DecisionCreatePoButton />
              </div>
            </div>

            <div className="max-w-full overflow-x-auto">
              <table className="min-w-[2240px] text-left text-sm">
                <thead className="bg-[#f3f5f7] text-xs uppercase tracking-[0.12em] text-[#65717f]">
                  <tr>
                    <th className="px-3 py-3 font-semibold">Pick</th>
                    <th className="px-3 py-3 font-semibold">SKU</th>
                    <th className="px-3 py-3 font-semibold">Product</th>
                    <th className="px-3 py-3 font-semibold">Main name</th>
                    <th className="px-3 py-3 font-semibold">Tags</th>
                    <th className="px-3 py-3 font-semibold">Sup</th>
                    <th className="px-3 py-3 text-right font-semibold">On-hand</th>
                    <th className="px-3 py-3 text-right font-semibold">Total sale</th>
                    <th className="px-3 py-3 text-right font-semibold">Demand HM</th>
                    <th className="px-3 py-3 text-right font-semibold">Safety</th>
                    <th className="px-3 py-3 text-right font-semibold">Lead</th>
                    <th className="px-3 py-3 text-right font-semibold">Cycle</th>
                    <th className="px-3 py-3 text-right font-semibold">Re-order Point</th>
                    <th className="px-3 py-3 text-right font-semibold">Raw qty</th>
                    <th className="px-3 py-3 text-right font-semibold">Round 10</th>
                    <th className="px-3 py-3 font-semibold">Use</th>
                    <th className="px-3 py-3 text-right font-semibold">Cover</th>
                    <th className="px-3 py-3 text-right font-semibold">Week</th>
                    <th className="px-3 py-3 text-right font-semibold">Month</th>
                    <th className="px-3 py-3 font-semibold">Alert</th>
                    <th className="px-3 py-3 text-right font-semibold">At order</th>
                    <th className="px-3 py-3 text-right font-semibold">Coming</th>
                    <th className="px-3 py-3 text-right font-semibold">Value</th>
                    <th className="px-3 py-3 font-semibold">Hide</th>
                    <th className="px-3 py-3 font-semibold">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf1f5]">
                  {data.lines.map((line) => (
                    <tr className={line.hidden ? "bg-[#fbfcfd]" : "bg-white"} key={line.sku}>
                      <td className="px-3 py-3 align-top">
                        <input
                          className="size-4 accent-[#172026]"
                          data-decision-select="sku"
                          defaultChecked={false}
                          form="decision-create-po-form"
                          name="selectedSku"
                          type="checkbox"
                          value={line.sku}
                        />
                        <input form="decision-create-po-form" name="poSku" type="hidden" value={line.sku} />
                        <input
                          form="decision-create-po-form"
                          name="poProductName"
                          type="hidden"
                          value={line.productName}
                        />
                        <input
                          form="decision-create-po-form"
                          name="poSupplier"
                          type="hidden"
                          value={line.supplier}
                        />
                        <input
                          form="decision-create-po-form"
                          name="poUnitPrice"
                          type="hidden"
                          value={qtyValue(line.unitPrice)}
                        />
                      </td>
                      <td className="px-3 py-3 align-top">
                        <input name="sku" type="hidden" value={line.sku} />
                        <p className="font-mono text-xs font-semibold text-[#42505c]">
                          {line.sku}
                        </p>
                        <p className="mt-1 text-xs text-[#7a8794]">
                          {line.supplierSource}
                        </p>
                      </td>
                      <td className="min-w-[280px] px-3 py-3 align-top">
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
                      <td className="min-w-[200px] px-3 py-3 align-top">
                        <input
                          className={inputClass}
                          defaultValue={line.mainName}
                          name="mainName"
                        />
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
                          {data.supplierOptions.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className={readOnlyMetricClass}>{formatNumber(line.onHandUnits)}</td>
                      <td className={readOnlyMetricClass}>{formatNumber(line.totalSale)}</td>
                      <DecisionPlanningCells
                        calculatedDemandIndexHm={line.calculatedDemandIndexHm}
                        comingQty={line.coming}
                        demandIndexHm={line.demandIndexHm}
                        leadTimeDays={line.leadTimeDays}
                        leadTimeSource={line.leadTimeSource}
                        orderCycleDays={line.orderCycleDays}
                        reorderPointUnits={line.reorderPointUnits}
                        safetyDays={line.safetyDays}
                        safetySource={line.safetySource}
                        sku={line.sku}
                        supplierLeadTimeDays={line.supplierLeadTimeDays}
                        supplierSafetyDays={line.supplierSafetyDays}
                      />
                      <td className={readOnlyMetricClass}>{coverageText(line.coversSalesDuration)}</td>
                      <td className={readOnlyMetricClass}>{formatNumber(line.week)}</td>
                      <td className={readOnlyMetricClass}>{formatNumber(line.month)}</td>
                      <td className="px-3 py-3 align-top">
                        <span
                          className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${alertClass(
                            line.ropAlert,
                          )}`}
                        >
                          {alertLabel(line.ropAlert)}
                        </span>
                      </td>
                      <td className={readOnlyMetricClass}>{coverageText(line.totalCoverageAtOrder)}</td>
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
                      <td className="min-w-[190px] px-3 py-3 align-top">
                        <label className="mb-2 flex items-center gap-2 text-xs font-semibold text-[#52606d]">
                          <input
                            className="size-4 accent-[#172026]"
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
                  ))}
                </tbody>
              </table>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
