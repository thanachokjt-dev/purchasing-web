import { getCurrentUserProfile } from "@/lib/auth";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { canAccessAdminControlTower } from "@/lib/role-nav";
import { canViewIncomingEtaOnly } from "@/lib/access-control";

export async function GET() {
  const user = await getCurrentUserProfile();
  if (!user?.isActive) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessAdminControlTower(user) && !canViewIncomingEtaOnly(user.email)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const db = getSupabaseServiceClient();
  if (!db) return Response.json({ error: "Unavailable" }, { status: 503 });
  const { data, count, error } = await db.from("po_orders")
    .select("updated_at", { count: "exact" }).order("updated_at", { ascending: false }).limit(1);
  if (error) return Response.json({ error: "Unavailable" }, { status: 503 });
  return Response.json({ version: `${count}:${data[0]?.updated_at ?? ""}` }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
