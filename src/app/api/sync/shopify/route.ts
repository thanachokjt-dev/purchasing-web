import { NextRequest, NextResponse } from "next/server";
import { envStatus } from "@/lib/env";
import { syncShopifyProductsAndInventory } from "@/lib/sync/shopify-products";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

export async function POST(request: NextRequest) {
  const secret = process.env.SYNC_SECRET;
  const provided = request.headers.get("x-sync-secret");

  if (secret && provided !== secret) {
    return unauthorized();
  }

  const env = envStatus();
  if (!env.syncSecret) {
    return NextResponse.json(
      {
        ok: false,
        error: "SYNC_SECRET is missing. Add it before enabling Shopify sync.",
        env,
      },
      { status: 428 },
    );
  }

  if (!env.shopifyShopDomain || !env.shopifyAdminAccessToken) {
    return NextResponse.json(
      {
        ok: false,
        mode: "baseline",
        error: "Shopify credentials are missing. Add SHOPIFY_SHOP_DOMAIN and SHOPIFY_ADMIN_ACCESS_TOKEN.",
        env,
      },
      { status: 428 },
    );
  }

  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return NextResponse.json(
      {
        ok: false,
        mode: "shopify-check-only",
        error: "Supabase credentials are missing. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
        env,
      },
      { status: 428 },
    );
  }

  const url = new URL(request.url);
  const maxPagesParam = url.searchParams.get("maxPages");
  const maxPages = maxPagesParam ? Number(maxPagesParam) : undefined;
  const mode = url.searchParams.get("mode") === "cron" ? "cron" : "manual";

  if (maxPages !== undefined && (!Number.isInteger(maxPages) || maxPages < 1)) {
    return NextResponse.json(
      { ok: false, error: "maxPages must be a positive integer" },
      { status: 400 },
    );
  }

  try {
    const sync = await syncShopifyProductsAndInventory(supabase, {
      mode,
      maxPages,
    });

    return NextResponse.json({
      ok: true,
      mode,
      ...sync,
      note: sync.capped
        ? "Sync stopped at maxPages and has more Shopify pages to fetch."
        : "Shopify products, variants, locations, and inventory snapshots persisted.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Unknown Shopify sync error",
      },
      { status: 500 },
    );
  }
}
