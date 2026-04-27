import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ORDERS_QUERY,
  shopifyGraphql,
  type OrdersPayload,
  type ShopifyGraphqlResult,
  type ShopifyOrderNode,
} from "@/lib/shopify/client";
import { extractShopifyNumericId, numericOrNull } from "@/lib/shopify/ids";

type SyncMode = "manual" | "cron" | "backfill";

type SyncOptions = {
  mode: SyncMode;
  sinceAt: string;
  untilAt: string;
  maxPages?: number;
  cursor?: string | null;
};

type SyncStats = {
  ordersSeen: number;
  salesLinesSeen: number;
  pagesSeen: number;
  hasNextPage: boolean;
  lastCursor: string | null;
  throttle: unknown;
};

type SalesLineUpsert = {
  shopify_order_id: string;
  shopify_order_gid: string;
  shopify_line_item_id: string;
  shopify_line_item_gid: string;
  order_name: string;
  order_date: string;
  created_at_shopify: string;
  processed_at_shopify: string | null;
  cancelled_at_shopify: string | null;
  financial_status: string | null;
  fulfillment_status: string | null;
  currency: string;
  sku: string | null;
  product_name: string;
  variant_title: string | null;
  product_id: string | null;
  variant_id: string | null;
  quantity: number;
  unit_price: number | null;
  line_total: number | null;
  synced_at: string;
};

function orderQuery(sinceAt: string, untilAt: string) {
  return `created_at:>=${sinceAt} created_at:<${untilAt}`;
}

function mapOrderLines(order: ShopifyOrderNode, syncedAt: string) {
  return order.lineItems.nodes.map((line): SalesLineUpsert => {
    const unitPrice = numericOrNull(line.originalUnitPriceSet.shopMoney.amount);
    const lineTotal = numericOrNull(line.discountedTotalSet.shopMoney.amount);

    return {
      shopify_order_id: extractShopifyNumericId(order.id),
      shopify_order_gid: order.id,
      shopify_line_item_id: extractShopifyNumericId(line.id),
      shopify_line_item_gid: line.id,
      order_name: order.name,
      order_date: order.createdAt.slice(0, 10),
      created_at_shopify: order.createdAt,
      processed_at_shopify: order.processedAt,
      cancelled_at_shopify: order.cancelledAt,
      financial_status: order.displayFinancialStatus,
      fulfillment_status: order.displayFulfillmentStatus,
      currency: order.currencyCode,
      sku: line.sku?.trim() || null,
      product_name: line.title,
      variant_title: line.variantTitle,
      product_id: line.product ? extractShopifyNumericId(line.product.id) : null,
      variant_id: line.variant ? extractShopifyNumericId(line.variant.id) : null,
      quantity: line.quantity,
      unit_price: unitPrice,
      line_total: lineTotal,
      synced_at: syncedAt,
    };
  });
}

async function createSyncRun(
  supabase: SupabaseClient,
  options: SyncOptions,
) {
  const { data, error } = await supabase
    .from("sync_runs")
    .insert({
      source: "shopify_orders_sales_lines",
      mode: options.mode,
      status: "running",
      since_at: options.sinceAt,
      until_at: options.untilAt,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Could not create order sync run: ${error.message}`);
  }

  return data.id as string;
}

async function finishSyncRun(
  supabase: SupabaseClient,
  runId: string,
  status: "completed" | "failed",
  stats: Partial<SyncStats>,
  errorMessage?: string,
) {
  await supabase
    .from("sync_runs")
    .update({
      status,
      finished_at: new Date().toISOString(),
      sales_lines_seen: stats.salesLinesSeen ?? 0,
      pages_seen: stats.pagesSeen ?? 0,
      throttle: stats.throttle ?? null,
      error_message: errorMessage ?? null,
    })
    .eq("id", runId);
}

export async function syncShopifyOrdersSalesLines(
  supabase: SupabaseClient,
  options: SyncOptions,
) {
  const maxPages = options.maxPages ?? 100;
  const syncedAt = new Date().toISOString();
  const runId = await createSyncRun(supabase, options);
  const stats: SyncStats = {
    ordersSeen: 0,
    salesLinesSeen: 0,
    pagesSeen: 0,
    hasNextPage: false,
    lastCursor: null,
    throttle: null,
  };
  let cursor: string | null = options.cursor ?? null;
  let hasNextPage = true;

  try {
    while (hasNextPage && stats.pagesSeen < maxPages) {
      const result: ShopifyGraphqlResult<OrdersPayload> =
        await shopifyGraphql<OrdersPayload>(ORDERS_QUERY, {
          cursor,
          query: orderQuery(options.sinceAt, options.untilAt),
        });
      const page = result.data.orders;
      const rows = page.nodes.flatMap((order) => mapOrderLines(order, syncedAt));

      if (rows.length) {
        const { error } = await supabase
          .from("sales_lines")
          .upsert(rows, { onConflict: "shopify_line_item_id" });
        if (error) {
          throw new Error(`Sales line upsert failed: ${error.message}`);
        }
      }

      stats.ordersSeen += page.nodes.length;
      stats.salesLinesSeen += rows.length;
      stats.pagesSeen += 1;
      stats.throttle = result.extensions?.cost?.throttleStatus ?? null;
      hasNextPage = page.pageInfo.hasNextPage;
      cursor = page.pageInfo.endCursor;
    }

    stats.hasNextPage = hasNextPage;
    stats.lastCursor = cursor;
    await finishSyncRun(supabase, runId, "completed", stats);

    return {
      runId,
      ...stats,
      capped: hasNextPage,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown order sync error";
    await finishSyncRun(supabase, runId, "failed", stats, message);
    throw error;
  }
}
