import { NextRequest, NextResponse } from "next/server";
import { envStatus } from "@/lib/env";
import { syncShopifyOrdersSalesLines } from "@/lib/sync/shopify-orders";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

function parseDateParam(value: string | null, boundary: "since" | "until") {
  if (!value || value === "now") {
    return boundary === "since"
      ? new Date("2025-01-01T00:00:00+07:00").toISOString()
      : new Date().toISOString();
  }

  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T00:00:00+07:00`
    : value;
  const parsed = new Date(normalized);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${boundary} must be an ISO date or YYYY-MM-DD`);
  }

  return parsed.toISOString();
}

export async function POST(request: NextRequest) {
  const secret = process.env.SYNC_SECRET;
  const provided = request.headers.get("x-sync-secret");

  if (!secret || provided !== secret) {
    return unauthorized();
  }

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
        error: "Supabase and Shopify credentials are required for sales line sync.",
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
  const cursor = url.searchParams.get("cursor");

  if (maxPages !== undefined && (!Number.isInteger(maxPages) || maxPages < 1)) {
    return NextResponse.json(
      { ok: false, error: "maxPages must be a positive integer" },
      { status: 400 },
    );
  }

  let sinceAt: string;
  let untilAt: string;
  try {
    sinceAt = parseDateParam(url.searchParams.get("since"), "since");
    untilAt = parseDateParam(url.searchParams.get("until"), "until");
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Bad date" },
      { status: 400 },
    );
  }

  if (new Date(sinceAt).getTime() >= new Date(untilAt).getTime()) {
    return NextResponse.json(
      { ok: false, error: "since must be before until" },
      { status: 400 },
    );
  }

  try {
    const salesLines = await syncShopifyOrdersSalesLines(supabase, {
      mode: "backfill",
      maxPages,
      sinceAt,
      untilAt,
      cursor,
    });

    return NextResponse.json({
      ok: true,
      mode: "backfill",
      window: { sinceAt, untilAt },
      salesLines,
      note: salesLines.capped
        ? "Backfill stopped at maxPages and has more Shopify pages to fetch."
        : "Shopify sales lines persisted for the requested window.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        window: { sinceAt, untilAt },
        error:
          error instanceof Error ? error.message : "Unknown sales line sync error",
      },
      { status: 500 },
    );
  }
}
