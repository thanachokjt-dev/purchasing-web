import { NextRequest, NextResponse } from "next/server";
import { searchPoCatalogItems } from "@/lib/po-portal";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";

  if (q.trim().length < 2) {
    return NextResponse.json({ items: [] });
  }

  const limit = Number(searchParams.get("limit") ?? 20);
  const items = await searchPoCatalogItems({
    limit: Number.isFinite(limit) ? limit : 20,
    q,
    supplierCode: searchParams.get("supplierCode") ?? "",
    supplierName: searchParams.get("supplierName") ?? "",
  });

  return NextResponse.json({ items });
}
