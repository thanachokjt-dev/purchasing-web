import { getCurrentUserProfile } from "@/lib/auth";
import { serializeStockCountCsv } from "@/lib/stock-count-csv";
import { canAccessStockCounts, getStockCountSession } from "@/lib/stock-counts";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const profile = await getCurrentUserProfile();
  if (!profile || !profile.isActive) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessStockCounts(profile)) return Response.json({ error: "Forbidden" }, { status: 403 });
  const { sessionId } = await params;
  const data = await getStockCountSession(sessionId);
  if (!data) return Response.json({ error: "Not found" }, { status: 404 });
  const csv = serializeStockCountCsv(data.lines);
  const filename = `stock-count-${data.session.locationType}-${data.session.weekStart}.csv`;
  return new Response(csv, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}
