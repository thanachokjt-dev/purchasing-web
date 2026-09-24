import Link from "next/link";
import { redirect } from "next/navigation";
import { SkuDashboardView } from "@/app/sku-dashboard/sku-dashboard-view";
import { PoSidebarNav } from "@/app/po/sidebar-nav";
import { requireUser } from "@/lib/auth";
import { canAccessDashboard, defaultLandingForUser } from "@/lib/role-nav";
import { getSkuDashboardData } from "@/lib/sku-dashboard";

export const dynamic = "force-dynamic";

export default async function SkuDashboardPage() {
  const user = await requireUser("/sku-dashboard");
  if (!canAccessDashboard(user)) {
    redirect(`/access-denied?from=${encodeURIComponent("/sku-dashboard")}&next=${encodeURIComponent(defaultLandingForUser(user))}`);
  }

  const initial = await getSkuDashboardData();
  return (
    <main className="min-h-screen bg-[#f4f6f8] text-[#172026] lg:grid lg:grid-cols-[200px_minmax(0,1fr)]">
      <PoSidebarNav active="sku-dashboard" />
      <div className="min-w-0">
        <header className="border-b border-[#d9dde3] bg-white px-4 py-5 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64707d]">Sales analytics</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#142c49]">SKU Sales Dashboard</h1>
              <p className="mt-1 text-sm text-[#64748b]">Monthly sales, item mix, and same-period last-year comparison.</p>
            </div>
            <Link className="rounded-lg border border-[#cfd6df] px-3 py-2 text-sm font-semibold text-[#364252] hover:bg-slate-50" href="/dashboard">
              Control Room
            </Link>
          </div>
        </header>
        <SkuDashboardView initial={initial} />
      </div>
    </main>
  );
}
