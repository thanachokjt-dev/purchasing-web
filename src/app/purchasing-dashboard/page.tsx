import Link from "next/link";
import { redirect } from "next/navigation";
import { PoSidebarNav } from "@/app/po/sidebar-nav";
import { requireUser } from "@/lib/auth";
import { canAccessPurchasingDashboard } from "@/lib/role-nav";
import { canEditPo } from "@/lib/access-control";
import { getPurchasingDashboardData } from "@/lib/purchasing-dashboard";
import {
  DashboardRefresh,
  PurchasingDashboardView,
} from "./purchasing-dashboard-view";

export const dynamic = "force-dynamic";
export default async function PurchasingDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; category?: string }>;
}) {
  const profile = await requireUser("/purchasing-dashboard");
  if (!canAccessPurchasingDashboard(profile)) redirect("/access-denied");
  const params = await searchParams;
  const data = await getPurchasingDashboardData();
  const detail = params.view === "details";
  return (
    <main className="min-h-screen bg-[#f4f6f8] text-[#172026] lg:grid lg:grid-cols-[200px_minmax(0,1fr)]">
      <PoSidebarNav active="purchasing-dashboard" />
      <div className="min-w-0">
        <header className="border-b border-slate-200 bg-white px-4 py-6 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">Purchasing Dashboard</h1>
              <p className="mt-1 text-sm text-slate-500">
                {data.period.months[0].label} – {data.period.months[3].label} ·
                through {data.period.end} · THB
              </p>
            </div>
            <div className="flex items-center gap-2">
              <DashboardRefresh />
              <a
                href="/api/purchasing-dashboard/export"
                className="rounded-lg bg-[#0d233f] px-4 py-2.5 text-sm font-semibold text-white"
              >
                Export Excel
              </a>
            </div>
          </div>
          <nav className="mt-5 flex gap-2" aria-label="Purchasing views">
            {[
              {
                label: "Overview",
                href: "/purchasing-dashboard",
                active: !detail,
              },
              {
                label: "Details",
                href: "/purchasing-dashboard?view=details",
                active: detail,
              },
            ].map((tab) => (
              <Link
                key={tab.label}
                href={tab.href}
                aria-current={tab.active ? "page" : undefined}
                className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab.active ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:bg-slate-50"}`}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
        </header>
        <PurchasingDashboardView
          data={data}
          detail={detail}
          initialCategory={params.category || ""}
          canClassify={canEditPo(profile.email)}
        />
      </div>
    </main>
  );
}
