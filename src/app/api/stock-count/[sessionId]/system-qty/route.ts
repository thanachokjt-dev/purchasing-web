import { getCurrentUserProfile } from "@/lib/auth";
import { canEditStockCountLocation, getStockCountSession, getStockCountSystemQty } from "@/lib/stock-counts";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const profile = await getCurrentUserProfile();
  if (!profile) return Response.json({ error: "Sign in required." }, { status: 401 });
  const { sessionId } = await params;
  try {
    const data = await getStockCountSession(sessionId);
    if (!data) return Response.json({ error: "Stock count not found." }, { status: 404 });
    if (!canEditStockCountLocation(profile, data.session.locationType)) return Response.json({ error: "Access denied." }, { status: 403 });
    const inventory = await getStockCountSystemQty(profile, data.session);
    const quantities = Object.fromEntries(data.lines.map((line) => [line.sku, inventory.quantities[line.sku] ?? null]));
    return Response.json({ ...inventory, quantities }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Stock count system quantities failed", error);
    return Response.json({ error: "Unable to load system quantities. Please try again." }, { status: 503 });
  }
}
