import { getCurrentUserProfile } from "@/lib/auth";
import { createStockCountPdf } from "@/lib/stock-count-pdf";
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
  const pdf = await createStockCountPdf({
    lines: data.lines,
    locationType: data.session.locationType,
    weekStart: data.session.weekStart,
  });
  const filename = `stock-count-${data.session.locationType}-${data.session.weekStart}.pdf`;
  return new Response(Buffer.from(pdf), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": "application/pdf",
    },
  });
}
