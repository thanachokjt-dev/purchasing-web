import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { refreshTopSellerProductDesignSnapshot } from "@/lib/top-seller-snapshot";

export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function hasValidSyncSecret(request: NextRequest) {
  const secret = process.env.SYNC_SECRET;
  const authHeader = request.headers.get("authorization");
  const headerSecret = request.headers.get("x-sync-secret");

  return Boolean(
    secret &&
      (authHeader === `Bearer ${secret}` || headerSecret === secret),
  );
}

export async function POST(request: NextRequest) {
  if (!hasValidSyncSecret(request)) {
    return unauthorized();
  }

  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase service credentials are not configured" },
      { status: 500 },
    );
  }

  const { data, error } = await supabase.rpc("backfill_sales_summary_and_demand");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  try {
    const topSellerSnapshot = await refreshTopSellerProductDesignSnapshot(supabase);
    return NextResponse.json({
      salesDemand: data,
      topSellerSnapshot,
    });
  } catch (snapshotError) {
    return NextResponse.json(
      {
        error:
          snapshotError instanceof Error
            ? snapshotError.message
            : "Top Seller snapshot refresh failed",
        salesDemand: data,
      },
      { status: 500 },
    );
  }
}
