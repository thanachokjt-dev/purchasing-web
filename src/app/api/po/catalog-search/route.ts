import { NextRequest, NextResponse } from "next/server";
import { searchPoCatalogItems } from "@/lib/po-portal";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const skus = searchParams
    .getAll("sku")
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);

  if (q.trim().length < 2 && skus.length === 0) {
    return NextResponse.json({ items: [] });
  }

  const limit = Number(searchParams.get("limit") ?? 20);
  const items = await searchPoCatalogItems({
    limit: Number.isFinite(limit) ? limit : 20,
    q,
    skus,
    supplierCode: searchParams.get("supplierCode") ?? "",
    supplierName: searchParams.get("supplierName") ?? "",
  });

  return NextResponse.json({ items });
}
