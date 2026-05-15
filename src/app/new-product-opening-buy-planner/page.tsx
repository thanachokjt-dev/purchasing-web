import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { PoSidebarNav } from "@/app/po/sidebar-nav";
import { requireUser } from "@/lib/auth";
import { listNewProductPlans } from "@/lib/new-product-opening-buy";
import { canAccessAdminControlTower, defaultLandingForRole } from "@/lib/role-nav";

export const dynamic = "force-dynamic";

function formatDate(value: string) {
  return value ? new Date(value).toLocaleDateString("en-US") : "-";
}

function formatDateTime(value: string) {
  return value ? new Date(value).toLocaleString("en-US") : "-";
}

function formatNumber(value: number) {
  return value > 0 ? value.toLocaleString("en-US") : "-";
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

function label(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default async function NewProductOpeningBuyPlannerPage() {
  const currentUser = await requireUser("/new-product-opening-buy-planner");
  if (!canAccessAdminControlTower(currentUser)) {
    redirect(
      `/access-denied?from=${encodeURIComponent("/new-product-opening-buy-planner")}&next=${encodeURIComponent(
        defaultLandingForRole(currentUser.role),
      )}`,
    );
  }

  const plans = await listNewProductPlans();

  return (
    <main className="min-h-screen bg-[#f6f8fb] text-[#172026] lg:grid lg:grid-cols-[220px_1fr]">
      <PoSidebarNav active="new-product-planner" />
      <div className="p-4 sm:p-6 lg:p-8">
        <header className="flex flex-col gap-4 rounded-lg border border-[#dfe4ea] bg-white p-5 shadow-sm lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64707d]">
              Purchasing planning
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal">
              New Product Opening Buy Planner
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#52606d]">
              Draft opening-buy plans for new products before real sales history exists.
              This module is separate from Reorder Planning and does not create POs in this phase.
            </p>
          </div>
          <Link
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#172026] px-4 text-sm font-semibold text-white"
            href="/new-product-opening-buy-planner/new"
          >
            <Plus size={16} />
            Create new plan
          </Link>
        </header>

        <section className="mt-5 rounded-lg border border-[#dfe4ea] bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e2e7ed] p-4">
            <div>
              <h2 className="text-lg font-semibold">Opening Buy Plans</h2>
              <p className="mt-1 text-sm text-[#667380]">
                Foundation list for draft plans, supplier context, status, and audit-ready tracking.
              </p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-md bg-[#eef4f8] px-3 py-2 text-xs font-semibold text-[#255f85]">
              <Search size={14} />
              {plans.length.toLocaleString("en-US")} plans
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#fbfcfd] text-xs uppercase tracking-[0.08em] text-[#64707d]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Plan No.</th>
                  <th className="px-4 py-3 font-semibold">Plan Name</th>
                  <th className="px-4 py-3 font-semibold">Supplier</th>
                  <th className="px-4 py-3 font-semibold">Category</th>
                  <th className="px-4 py-3 text-right font-semibold">Coverage</th>
                  <th className="px-4 py-3 text-right font-semibold">Budget Cap</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Created</th>
                  <th className="px-4 py-3 font-semibold">Created By</th>
                  <th className="px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf1f5]">
                {plans.length > 0 ? (
                  plans.map((plan) => (
                    <tr className="bg-white align-top hover:bg-[#fbfcfd]" key={plan.id}>
                      <td className="px-4 py-3 font-mono text-xs font-semibold">{plan.planNumber}</td>
                      <td className="px-4 py-3">
                        <p className="font-semibold">{plan.planName}</p>
                        <p className="mt-1 text-xs text-[#667380]">
                          Launch {formatDate(plan.plannedLaunchDate)}
                        </p>
                      </td>
                      <td className="px-4 py-3">{plan.supplierNameSnapshot || "-"}</td>
                      <td className="px-4 py-3">{plan.category || "-"}</td>
                      <td className="px-4 py-3 text-right font-mono">{plan.targetCoverageDays}d</td>
                      <td className="px-4 py-3 text-right font-mono">{formatNumber(plan.budgetCapThb)}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-md px-2 py-1 text-xs font-semibold ${statusClass(plan.status)}`}>
                          {label(plan.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#667380]">{formatDateTime(plan.createdAt)}</td>
                      <td className="px-4 py-3 text-xs">
                        {plan.createdByProfile?.displayName || plan.createdByProfile?.email || "-"}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          className="inline-flex rounded-md border border-[#cfd6df] px-3 py-1.5 text-xs font-semibold text-[#364252]"
                          href={`/new-product-opening-buy-planner/${plan.id}`}
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-4 py-8 text-center text-sm text-[#667380]" colSpan={10}>
                      No opening buy plans yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
