import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PendingSubmitButton } from "@/app/loading-controls";
import { ComparableProductsPanel } from "@/app/new-product-opening-buy-planner/[planId]/comparable-products-panel";
import { EstimatedDemandPanel } from "@/app/new-product-opening-buy-planner/[planId]/estimated-demand-panel";
import { QuantityMatrixPanel } from "@/app/new-product-opening-buy-planner/[planId]/quantity-matrix-panel";
import {
  cancelNewProductPlanAction,
  updateNewProductPlanAction,
} from "@/app/new-product-opening-buy-planner/actions";
import { PoSidebarNav } from "@/app/po/sidebar-nav";
import { requireUser } from "@/lib/auth";
import {
  getEstimatedComparableDemand,
  getNewProductPlan,
  getPlanLineSummary,
  getSuppliersForNewProductPlan,
} from "@/lib/new-product-opening-buy";
import { canAccessAdminControlTower, defaultLandingForRole } from "@/lib/role-nav";

export const dynamic = "force-dynamic";

const inputClass =
  "mt-1 h-10 rounded-md border border-[#cfd6df] bg-white px-3 text-sm text-[#172026] outline-none focus:border-[#255f85]";
const labelClass = "grid gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#64707d]";
const buttonClass = "inline-flex h-10 items-center justify-center rounded-md bg-[#172026] px-4 text-sm font-semibold text-white";

function formatDate(value: string) {
  return value ? new Date(value).toLocaleDateString("en-US") : "-";
}

function formatDateTime(value: string) {
  return value ? new Date(value).toLocaleString("en-US") : "-";
}

function formatNumber(value: number) {
  return value > 0 ? value.toLocaleString("en-US") : "-";
}

function label(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function statusClass(status: string) {
  if (status === "draft") {
    return "bg-[#eef4f8] text-[#255f85]";
  }
  if (status === "approved" || status === "po_created") {
    return "bg-[#eaf6ef] text-[#1f6b3d]";
  }
  if (status === "cancelled") {
    return "bg-[#fff1f0] text-[#b42318]";
  }
  return "bg-[#fff4e5] text-[#946200]";
}

function PlaceholderSection({ title }: { title: string }) {
  return (
    <section className="rounded-lg border border-[#dfe4ea] bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <span className="rounded-md bg-[#fff4e5] px-2 py-1 text-xs font-semibold text-[#946200]">
          Coming in next phase
        </span>
      </div>
      <p className="mt-2 text-sm text-[#667380]">
        Placeholder only. This foundation phase stores the draft plan header and audit trail.
      </p>
    </section>
  );
}

export default async function NewProductOpeningBuyPlanDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ planId: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { planId } = await params;
  const currentUser = await requireUser(`/new-product-opening-buy-planner/${encodeURIComponent(planId)}`);
  if (!canAccessAdminControlTower(currentUser)) {
    redirect(
      `/access-denied?from=${encodeURIComponent(
        `/new-product-opening-buy-planner/${planId}`,
      )}&next=${encodeURIComponent(defaultLandingForRole(currentUser.role))}`,
    );
  }

  const [plan, suppliers, messages] = await Promise.all([
    getNewProductPlan(planId),
    getSuppliersForNewProductPlan(),
    searchParams,
  ]);
  if (!plan) {
    notFound();
  }

  const editable = plan.status === "draft";
  const comparablesEditable = ["draft", "review"].includes(plan.status);
  const [estimatedComparableDemand, lineSummary] = await Promise.all([
    getEstimatedComparableDemand(plan.id),
    getPlanLineSummary(plan.id),
  ]);

  return (
    <main className="min-h-screen bg-[#f6f8fb] text-[#172026] lg:grid lg:grid-cols-[220px_1fr]">
      <PoSidebarNav active="new-product-planner" />
      <div className="p-4 sm:p-6 lg:p-8">
        <header className="rounded-lg border border-[#dfe4ea] bg-white p-5 shadow-sm">
          <Link
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#255f85]"
            href="/new-product-opening-buy-planner"
          >
            <ArrowLeft size={16} />
            Back to plans
          </Link>
          <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-[#64707d]">
                {plan.planNumber}
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-normal">{plan.planName}</h1>
              <p className="mt-2 text-sm text-[#52606d]">
                {plan.supplierNameSnapshot || "No supplier selected"} / {plan.category || "No category"} / Launch{" "}
                {formatDate(plan.plannedLaunchDate)}
              </p>
            </div>
            <span className={`rounded-md px-3 py-2 text-xs font-semibold ${statusClass(plan.status)}`}>
              {label(plan.status)}
            </span>
          </div>
        </header>

        {messages.error ? (
          <section className="mt-5 rounded-lg border border-[#ffd6d6] bg-[#fff5f5] p-4 text-sm font-semibold text-[#b42318]">
            {messages.error}
          </section>
        ) : null}
        {messages.success ? (
          <section className="mt-5 rounded-lg border border-[#cdebd8] bg-[#f0fbf4] p-4 text-sm font-semibold text-[#1f6b3d]">
            {messages.success}
          </section>
        ) : null}

        <section className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            ["Target coverage", `${plan.targetCoverageDays} days`],
            ["Budget cap", formatNumber(plan.budgetCapThb)],
            ["Matrix lines", String(plan.lines.length)],
            ["Final planned qty", formatNumber(lineSummary.totalFinalQty)],
          ].map(([title, value]) => (
            <div className="rounded-lg border border-[#dfe4ea] bg-white p-4 shadow-sm" key={title}>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64707d]">{title}</p>
              <p className="mt-2 text-lg font-semibold">{value}</p>
            </div>
          ))}
        </section>

        <form action={updateNewProductPlanAction} className="mt-5 rounded-lg border border-[#dfe4ea] bg-white shadow-sm">
          <input name="planId" type="hidden" value={plan.id} />
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#e2e7ed] p-5">
            <div>
              <h2 className="text-lg font-semibold">Plan Fields</h2>
              <p className="mt-1 text-sm text-[#667380]">
                Header fields only. Estimated opening quantity will be added in a later phase.
              </p>
            </div>
            {!editable ? (
              <span className="rounded-md bg-[#eef0f2] px-3 py-2 text-xs font-semibold text-[#52606d]">
                Read-only unless draft
              </span>
            ) : null}
          </div>
          <fieldset className="grid gap-4 p-5 lg:grid-cols-3" disabled={!editable}>
            <label className={`${labelClass} lg:col-span-2`}>
              Plan name
              <input className={inputClass} defaultValue={plan.planName} name="planName" required />
            </label>
            <label className={labelClass}>
              Supplier
              <select className={inputClass} defaultValue={plan.supplierCode} name="supplierCode">
                <option value="">Draft without supplier</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.supplierCode} value={supplier.supplierCode}>
                    {supplier.supplierName} ({supplier.supplierCode})
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              Category
              <input className={inputClass} defaultValue={plan.category} name="category" />
            </label>
            <label className={labelClass}>
              Planned launch date
              <input className={inputClass} defaultValue={plan.plannedLaunchDate} name="plannedLaunchDate" type="date" />
            </label>
            <label className={labelClass}>
              Target coverage days
              <input className={inputClass} defaultValue={plan.targetCoverageDays} min={1} name="targetCoverageDays" required type="number" />
            </label>
            <input name="channelFilter" type="hidden" value={plan.channelFilter} />
            <input name="seasonFactorPercent" type="hidden" value={Math.round((plan.seasonFactor - 1) * 100)} />
            <input name="confidenceFactorPercent" type="hidden" value={Math.round((plan.confidenceFactor - 1) * 100)} />
            <input name="riskFactorPercent" type="hidden" value={Math.round((plan.riskFactor - 1) * 100)} />
            <label className={labelClass}>
              Budget cap THB
              <input className={inputClass} defaultValue={plan.budgetCapThb || ""} min="0.01" name="budgetCapThb" step="0.01" type="number" />
            </label>
            <label className={`${labelClass} lg:col-span-3`}>
              Risk reason
              <input className={inputClass} defaultValue={plan.riskReason} name="riskReason" />
            </label>
            <label className={`${labelClass} lg:col-span-3`}>
              Notes
              <textarea
                className="mt-1 min-h-24 rounded-md border border-[#cfd6df] bg-white px-3 py-2 text-sm normal-case tracking-normal text-[#172026] outline-none focus:border-[#255f85]"
                defaultValue={plan.notes}
                name="notes"
              />
            </label>
          </fieldset>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#edf1f5] p-5">
            <p className="text-sm text-[#667380]">
              Created {formatDateTime(plan.createdAt)} by{" "}
              {plan.createdByProfile?.displayName || plan.createdByProfile?.email || "-"}
            </p>
            {editable ? (
              <PendingSubmitButton className={buttonClass} loadingText="Saving...">
                Save draft
              </PendingSubmitButton>
            ) : null}
          </div>
        </form>

        <div className="mt-5 grid gap-5">
          <ComparableProductsPanel
            canEdit={comparablesEditable}
            comparables={plan.comparables}
            planId={plan.id}
          />
          <EstimatedDemandPanel estimate={estimatedComparableDemand} />
          <PlaceholderSection title="Scenario Controls" />
          <QuantityMatrixPanel
            canEdit={comparablesEditable}
            estimate={estimatedComparableDemand}
            lines={plan.lines}
            planId={plan.id}
            plan={plan}
            summary={lineSummary}
          />
          <section className="rounded-lg border border-[#dfe4ea] bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Quantity planning only</h2>
            <p className="mt-1 text-sm font-semibold text-[#52606d]">
              This planner is for opening quantity planning only and does not create a PO.
            </p>
            {plan.poId ? (
              <p className="mt-2 text-sm text-[#667380]">
                Historical note: this plan already has linked PO {plan.poId}, but new PO creation is disabled from this planner.
              </p>
            ) : null}
          </section>
          <PlaceholderSection title="Financial Summary" />
        </div>

        <section className="mt-5 rounded-lg border border-[#dfe4ea] bg-white shadow-sm">
          <div className="border-b border-[#e2e7ed] p-5">
            <h2 className="text-lg font-semibold">Audit Logs</h2>
            <p className="mt-1 text-sm text-[#667380]">Create, update, and cancel history for this plan.</p>
          </div>
          <div className="divide-y divide-[#edf1f5]">
            {plan.auditLogs.length > 0 ? (
              plan.auditLogs.map((log) => (
                <div className="p-4 text-sm" key={log.id}>
                  <p className="font-semibold">{label(log.actionType)}</p>
                  <p className="mt-1 text-xs text-[#667380]">
                    {formatDateTime(log.changedAt)} /{" "}
                    {log.changedByProfile?.displayName || log.changedByProfile?.email || "-"}
                  </p>
                  {log.note ? <p className="mt-2 text-[#52606d]">{log.note}</p> : null}
                </div>
              ))
            ) : (
              <p className="p-5 text-sm text-[#667380]">No audit logs yet.</p>
            )}
          </div>
        </section>

        {!["cancelled", "po_created", "closed"].includes(plan.status) ? (
          <details className="mt-5 rounded-lg border border-[#ffd6d6] bg-white shadow-sm">
            <summary className="cursor-pointer list-none p-5 text-sm font-semibold text-[#b42318]">
              Cancel plan
            </summary>
            <form action={cancelNewProductPlanAction} className="grid gap-3 border-t border-[#ffd6d6] p-5">
              <input name="planId" type="hidden" value={plan.id} />
              <label className={labelClass}>
                Cancellation reason
                <input className={inputClass} name="cancelReason" placeholder="Optional reason" />
              </label>
              <div className="flex justify-end">
                <PendingSubmitButton
                  className="inline-flex h-10 items-center justify-center rounded-md bg-[#b42318] px-4 text-sm font-semibold text-white"
                  loadingText="Cancelling..."
                >
                  Cancel plan
                </PendingSubmitButton>
              </div>
            </form>
          </details>
        ) : null}
      </div>
    </main>
  );
}
