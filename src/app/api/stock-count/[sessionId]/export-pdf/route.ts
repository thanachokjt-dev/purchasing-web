import { getCurrentUserProfile } from "@/lib/auth";
import { createStockCountPdf } from "@/lib/stock-count-pdf";
import { canAccessStockCounts, canEditStockCountLocation, getStockCountSession, getStockCountSystemQty } from "@/lib/stock-counts";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const profile = await getCurrentUserProfile();
  if (!profile || !profile.isActive) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessStockCounts(profile)) return Response.json({ error: "Forbidden" }, { status: 403 });
  const { sessionId } = await params;
  const data = await getStockCountSession(sessionId);
  if (!data) return Response.json({ error: "Not found" }, { status: 404 });
  const query = new URL(request.url).searchParams;
  const quantityScope = query.get("qtyScope") === "all" ? "all" : "location";
  const showQty = query.get("showQty") === "1" || quantityScope === "all";
  if (showQty && !canEditStockCountLocation(profile, data.session.locationType)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  let inventory;
  if (showQty) {
    try {
      inventory = await getStockCountSystemQty(profile, data.session, quantityScope);
    } catch {
      return Response.json({ error: "Unable to load system quantities. Please try again." }, { status: 503 });
    }
  }
  const pdf = await createStockCountPdf({
    lines: data.lines,
    locationType: data.session.locationType,
    weekStart: data.session.weekStart,
    systemQuantities: inventory?.quantities,
    quantityScope,
  });
  const filename = `stock-count-${data.session.locationType}-${data.session.weekStart}${quantityScope === "all" ? "-total-on-hand" : ""}.pdf`;
  return new Response(Buffer.from(pdf), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": "application/pdf",
    },
  });
}
