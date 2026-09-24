import { getCurrentUserProfile } from "@/lib/auth";
import { canAccessDashboard } from "@/lib/role-nav";
import { getSkuDashboardData } from "@/lib/sku-dashboard";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const profile = await getCurrentUserProfile();
  if (!profile) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (!canAccessDashboard(profile)) return Response.json({ error: "Access denied." }, { status: 403 });

  const params = new URL(request.url).searchParams;
  try {
    const data = await getSkuDashboardData({
      start: params.get("start") || undefined,
      end: params.get("end") || undefined,
      supplier: params.get("supplier") || undefined,
      category: params.get("category") || undefined,
      skus: params.getAll("sku"),
      compare: params.get("compare") !== "false",
    });
    return Response.json(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "SKU dashboard is unavailable.";
    const invalidRange = message.startsWith("Choose a valid date range");
    if (!invalidRange) console.error("SKU dashboard request failed", error);
    return Response.json({ error: invalidRange ? message : "SKU dashboard is temporarily unavailable." }, {
      status: invalidRange ? 400 : 503,
      headers: { "Cache-Control": "private, no-store" },
    });
  }
}
