import { NextRequest, NextResponse } from "next/server";
import { envStatus } from "@/lib/env";
import { rollingLookbackWindow } from "@/lib/sync/window";
import { syncShopifyOrdersSalesLines } from "@/lib/sync/shopify-orders";
import { syncShopifyProductsAndInventory } from "@/lib/sync/shopify-products";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { refreshTopSellerProductDesignSnapshot } from "@/lib/top-seller-snapshot";

function unauthorized(error: "Invalid cron authorization" | "Missing cron authorization" | "Unauthorized") {
  console.warn("[daily-sync] auth failed", { error });
  return NextResponse.json({ ok: false, error }, { status: 401 });
}

async function runDailySync(request: NextRequest, modeOverride?: "manual" | "cron") {
  console.info("[daily-sync] route called", {
    method: request.method,
    modeOverride: modeOverride ?? null,
  });

  const env = envStatus();
  if (
    !env.supabaseUrl ||
    !env.supabaseServiceRoleKey ||
    !env.shopifyShopDomain ||
    !env.shopifyAdminAccessToken
  ) {
    console.error("[daily-sync] env validation failed", {
      shopifyAdminAccessToken: env.shopifyAdminAccessToken,
      shopifyShopDomain: env.shopifyShopDomain,
      supabaseServiceRoleKey: env.supabaseServiceRoleKey,
      supabaseUrl: env.supabaseUrl,
    });
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
    console.error("[daily-sync] env validation failed", {
      reason: "Supabase service client is not configured.",
    });
    return NextResponse.json(
      { ok: false, error: "Supabase service client is not configured." },
      { status: 428 },
    );
  }

  console.info("[daily-sync] env validation passed");

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
    console.info("[daily-sync] child sync started", { mode, window });
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

    console.info("[daily-sync] child sync result", {
      mode,
      ordersSales: {
        capped: ordersSales.capped,
        ordersSeen: ordersSales.ordersSeen,
        salesLinesSeen: ordersSales.salesLinesSeen,
      },
      productsInventory: {
        capped: productsInventory.capped,
        inventoryRowsSeen: productsInventory.inventoryRowsSeen,
        productsSeen: productsInventory.productsSeen,
        variantsSeen: productsInventory.variantsSeen,
      },
    });

    let topSellerSnapshot:
      | {
          groupCount: number;
          refreshedAt: string;
          skuCount: number;
          status: "completed";
        }
      | {
          error: string;
          status: "failed";
        };
    try {
      topSellerSnapshot = {
        ...(await refreshTopSellerProductDesignSnapshot(supabase)),
        status: "completed",
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown Top Seller snapshot error";
      console.error("[daily-sync] top seller snapshot failed", { error: message });
      topSellerSnapshot = {
        error: message,
        status: "failed",
      };
    }

    return NextResponse.json({
      ok: true,
      mode,
      window,
      productsInventory,
      ordersSales,
      topSellerSnapshot,
      note: "Daily sync completed. Inventory is a full current snapshot; sales lines use a rolling 7-day updated_at window.",
    });
  } catch (error) {
    console.error("[daily-sync] child sync failed", {
      error: error instanceof Error ? error.message : "Unknown daily sync error",
      mode,
      window,
    });
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
  console.info("[daily-sync] POST called");
  const secret = process.env.SYNC_SECRET;
  const provided = request.headers.get("x-sync-secret");

  if (!secret || provided !== secret) {
    return unauthorized("Unauthorized");
  }

  console.info("[daily-sync] POST auth passed");

  return runDailySync(request);
}

export async function GET(request: NextRequest) {
  console.info("[daily-sync] GET called");
  const cronSecret = process.env.CRON_SECRET ?? process.env.SYNC_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!authHeader) {
    return unauthorized("Missing cron authorization");
  }

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return unauthorized("Invalid cron authorization");
  }

  console.info("[daily-sync] GET auth passed", {
    tokenSource: process.env.CRON_SECRET ? "CRON_SECRET" : "SYNC_SECRET",
  });

  return runDailySync(request, "cron");
}
