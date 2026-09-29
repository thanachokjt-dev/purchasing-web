import { NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/lib/auth";
import { canAccessPurchasingDashboard } from "@/lib/role-nav";
import { getPurchasingDashboardData } from "@/lib/purchasing-dashboard";
import { purchasingDashboardXlsx } from "@/lib/purchasing-dashboard-export";

export const dynamic = "force-dynamic";
export async function GET() {
  const profile = await getCurrentUserProfile();
  if (!profile?.isActive)
    return new NextResponse("Unauthorized", { status: 401 });
  if (!canAccessPurchasingDashboard(profile))
    return new NextResponse("Forbidden", { status: 403 });
  const data = await getPurchasingDashboardData();
  return new NextResponse(purchasingDashboardXlsx(data), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="purchasing_dashboard_${data.period.end}.xlsx"`,
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  });
}
