import { NextRequest, NextResponse } from "next/server";
import { envStatus } from "@/lib/env";
import { rollingLookbackWindow } from "@/lib/sync/window";
import { syncShopifyOrdersSalesLines } from "@/lib/sync/shopify-orders";
import { syncShopifyProductsAndInventory } from "@/lib/sync/shopify-products";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

async function runDailySync(request: NextRequest, modeOverride?: "manual" | "cron") {
  const env = envStatus();
  if (
    !env.supabaseUrl ||
    !env.supabaseServiceRoleKey ||
    !env.shopifyShopDomain ||
    !env.shopifyAdminAccessToken
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: "Supabase and Shopify credentials are required for daily sync.",
        env,
      },
      { status: 428 },
    );
  }

  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "Supabase service client is not configured." },
      { status: 428 },
    );
  }

  const url = new URL(request.url);
  const maxPagesParam = url.searchParams.get("maxPages");
  const maxPages = maxPagesParam ? Number(maxPagesParam) : undefined;
  const mode =
    modeOverride ?? (url.searchParams.get("mode") === "cron" ? "cron" : "manual");

  if (maxPages !== undefined && (!Number.isInteger(maxPages) || maxPages < 1)) {
    return NextResponse.json(
      { ok: false, error: "maxPages must be a positive integer" },
      { status: 400 },
    );
  }

  const window = rollingLookbackWindow(7);

  try {
    const [productsInventory, ordersSales] = await Promise.all([
      syncShopifyProductsAndInventory(supabase, {
        mode,
        maxPages,
      }),
      syncShopifyOrdersSalesLines(supabase, {
        mode,
        maxPages,
        sinceAt: window.sinceAt,
        untilAt: window.untilAt,
        windowField: "updated_at",
      }),
    ]);

    return NextResponse.json({
      ok: true,
      mode,
      window,
      productsInventory,
      ordersSales,
      note: "Daily sync completed. Inventory is a full current snapshot; sales lines use a rolling 7-day updated_at window.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        window,
        error:
          error instanceof Error ? error.message : "Unknown daily sync error",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const secret = process.env.SYNC_SECRET;
  const provided = request.headers.get("x-sync-secret");

  if (!secret || provided !== secret) {
    return unauthorized();
  }

  return runDailySync(request);
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET ?? process.env.SYNC_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return unauthorized();
  }

  return runDailySync(request, "cron");
}
