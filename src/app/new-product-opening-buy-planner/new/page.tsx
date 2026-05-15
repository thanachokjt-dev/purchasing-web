import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PendingSubmitButton } from "@/app/loading-controls";
import { createNewProductPlanAction } from "@/app/new-product-opening-buy-planner/actions";
import { PoSidebarNav } from "@/app/po/sidebar-nav";
import { requireUser } from "@/lib/auth";
import { getSuppliersForNewProductPlan } from "@/lib/new-product-opening-buy";
import { canAccessAdminControlTower, defaultLandingForRole } from "@/lib/role-nav";

export const dynamic = "force-dynamic";

const inputClass =
  "mt-1 h-10 rounded-md border border-[#cfd6df] bg-white px-3 text-sm text-[#172026] outline-none focus:border-[#255f85]";
const labelClass = "grid gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#64707d]";
const buttonClass = "inline-flex h-10 items-center justify-center rounded-md bg-[#172026] px-4 text-sm font-semibold text-white";

export default async function NewProductOpeningBuyNewPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const currentUser = await requireUser("/new-product-opening-buy-planner/new");
  if (!canAccessAdminControlTower(currentUser)) {
    redirect(
      `/access-denied?from=${encodeURIComponent("/new-product-opening-buy-planner/new")}&next=${encodeURIComponent(
        defaultLandingForRole(currentUser.role),
      )}`,
    );
  }
  const params = await searchParams;
  const suppliers = await getSuppliersForNewProductPlan();

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
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-[#64707d]">
            Draft setup
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal">
            Create New Product Opening Buy Plan
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#52606d]">
            Capture the planning header first. Comparable products, estimated opening quantity,
            scenarios, and quantity matrix arrive in the next phases.
          </p>
        </header>

        {params.error ? (
          <section className="mt-5 rounded-lg border border-[#ffd6d6] bg-[#fff5f5] p-4 text-sm font-semibold text-[#b42318]">
            {params.error}
          </section>
        ) : null}

        <form action={createNewProductPlanAction} className="mt-5 rounded-lg border border-[#dfe4ea] bg-white shadow-sm">
          <div className="border-b border-[#e2e7ed] p-5">
            <h2 className="text-lg font-semibold">Plan Details</h2>
            <p className="mt-1 text-sm text-[#667380]">
              Supplier is optional while drafting, but required before future PO creation.
            </p>
          </div>
          <div className="grid gap-4 p-5 lg:grid-cols-3">
            <label className={`${labelClass} lg:col-span-2`}>
              Plan name
              <input className={inputClass} name="planName" placeholder="e.g. Summer rash guard launch" required />
            </label>
            <label className={labelClass}>
              Supplier
              <select className={inputClass} name="supplierCode">
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
              <input className={inputClass} name="category" placeholder="Product category" />
            </label>
            <label className={labelClass}>
              Planned launch date
              <input className={inputClass} name="plannedLaunchDate" type="date" />
            </label>
            <label className={labelClass}>
              Target coverage days
              <input className={inputClass} defaultValue={30} min={1} name="targetCoverageDays" required type="number" />
            </label>
            <input name="seasonFactorPercent" type="hidden" value="0" />
            <input name="confidenceFactorPercent" type="hidden" value="0" />
            <input name="riskFactorPercent" type="hidden" value="0" />
            <label className={labelClass}>
              Budget cap THB
              <input className={inputClass} min="0.01" name="budgetCapThb" step="0.01" type="number" />
            </label>
            <label className={`${labelClass} lg:col-span-3`}>
              Risk reason
              <input className={inputClass} name="riskReason" placeholder="Why the risk factor was chosen" />
            </label>
            <label className={`${labelClass} lg:col-span-3`}>
              Notes
              <textarea
                className="mt-1 min-h-24 rounded-md border border-[#cfd6df] bg-white px-3 py-2 text-sm normal-case tracking-normal text-[#172026] outline-none focus:border-[#255f85]"
                name="notes"
                placeholder="Launch assumptions, merchandising notes, supplier context"
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#edf1f5] p-5">
            <p className="text-sm text-[#667380]">This creates a draft only. No PO is created.</p>
            <PendingSubmitButton className={buttonClass} loadingText="Creating...">
              Create draft plan
            </PendingSubmitButton>
          </div>
        </form>
      </div>
    </main>
  );
}
