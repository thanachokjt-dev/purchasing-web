import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/lib/auth";
import { searchComparableProducts } from "@/lib/new-product-opening-buy";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const profile = await getCurrentUserProfile();
  if (!profile?.isActive || profile.role !== "super_admin") {
    return NextResponse.json({ error: "Not authorized.", items: [] }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  if (q.trim().length < 2) {
    return NextResponse.json({ items: [] });
  }

  const items = await searchComparableProducts(q);
  return NextResponse.json({ items });
}
