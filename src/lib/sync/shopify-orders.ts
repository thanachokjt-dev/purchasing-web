import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ORDERS_QUERY,
  shopifyGraphql,
  type OrdersPayload,
  type ShopifyGraphqlResult,
  type ShopifyOrderNode,
} from "@/lib/shopify/client";
import { extractShopifyNumericId, numericOrNull } from "@/lib/shopify/ids";
import { refreshSalesBySkuDayForDates } from "@/lib/sync/sales-summary";

export const SHOPIFY_ORDERS_SALES_SYNC_SOURCE = "shopify_orders_sales_lines";
const DEFAULT_LOCK_TTL_SECONDS = 30 * 60;

type SyncMode = "manual" | "cron" | "backfill";
type SyncWindowField = "created_at" | "updated_at";

type SyncOptions = {
  mode: SyncMode;
  sinceAt: string;
  untilAt: string;
  maxPages?: number;
  cursor?: string | null;
  windowField?: SyncWindowField;
  lockTtlSeconds?: number;
};

type SyncStats = {
  ordersSeen: number;
  salesLinesSeen: number;
  rowsFetched: number;
  rowsUpserted: number;
  rowsFailed: number;
  editedLinesZeroed: number;
  summaryDatesRefreshed: number;
  summaryRowsRefreshed: number;
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
  updated_at_shopify: string;
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

function schemaColumnMiss(errorMessage: string) {
  const message = errorMessage.toLowerCase();
  return message.includes("schema cache") || message.includes("column");
}

function orderQuery(sinceAt: string, untilAt: string, windowField: SyncWindowField) {
  return `${windowField}:>=${sinceAt} ${windowField}:<${untilAt}`;
}

function orderSortKey(windowField: SyncWindowField) {
  return windowField === "updated_at" ? "UPDATED_AT" : "CREATED_AT";
}

function mapOrderLines(order: ShopifyOrderNode, syncedAt: string) {
  return order.lineItems.nodes.map((line): SalesLineUpsert => {
    const unitPrice = numericOrNull(line.originalUnitPriceSet.shopMoney.amount);
    const lineTotal = numericOrNull(line.discountedTotalSet.shopMoney.amount);
    const currentQuantity = line.currentQuantity ?? line.quantity;

    return {
      shopify_order_id: extractShopifyNumericId(order.id),
      shopify_order_gid: order.id,
      shopify_line_item_id: extractShopifyNumericId(line.id),
      shopify_line_item_gid: line.id,
      order_name: order.name,
      order_date: order.createdAt.slice(0, 10),
      created_at_shopify: order.createdAt,
      updated_at_shopify: order.updatedAt,
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
      quantity: currentQuantity,
      unit_price: unitPrice,
      line_total: lineTotal,
      synced_at: syncedAt,
    };
  });
}

async function createSyncRun(
  supabase: SupabaseClient,
  options: SyncOptions & { windowField: SyncWindowField },
) {
  const fullInsert = {
    source: SHOPIFY_ORDERS_SALES_SYNC_SOURCE,
    mode: options.mode,
    status: "running",
    since_at: options.sinceAt,
    until_at: options.untilAt,
    window_start: options.sinceAt,
    window_end: options.untilAt,
    window_field: options.windowField,
    lock_key: SHOPIFY_ORDERS_SALES_SYNC_SOURCE,
  };
  const { data, error } = await supabase
    .from("sync_runs")
    .insert(fullInsert)
    .select("id")
    .single();

  if (!error) {
    return data.id as string;
  }

  if (!schemaColumnMiss(error.message)) {
    throw new Error(`Could not create order sync run: ${error.message}`);
  }

  const fallback = await supabase
    .from("sync_runs")
    .insert({
      source: SHOPIFY_ORDERS_SALES_SYNC_SOURCE,
      mode: options.mode,
      status: "running",
      since_at: options.sinceAt,
      until_at: options.untilAt,
    })
    .select("id")
    .single();

  if (fallback.error) {
    throw new Error(`Could not create order sync run: ${fallback.error.message}`);
  }

  return fallback.data.id as string;
}

async function markLockAcquired(supabase: SupabaseClient, runId: string) {
  await supabase
    .from("sync_runs")
    .update({ lock_acquired_at: new Date().toISOString() })
    .eq("id", runId);
}

async function acquireSyncLock(
  supabase: SupabaseClient,
  runId: string,
  ttlSeconds: number,
) {
  const { data, error } = await supabase.rpc("try_acquire_sync_lock", {
    lock_run_id: runId,
    lock_source: SHOPIFY_ORDERS_SALES_SYNC_SOURCE,
    lock_ttl_seconds: ttlSeconds,
  });

  if (error) {
    throw new Error(`Could not acquire Shopify sales sync lock: ${error.message}`);
  }
  if (!data) {
    throw new Error("Another Shopify sales line sync is already running. Try again after it finishes.");
  }

  await markLockAcquired(supabase, runId);
}

async function releaseSyncLock(supabase: SupabaseClient, runId: string) {
  await supabase.rpc("release_sync_lock", {
    lock_run_id: runId,
    lock_source: SHOPIFY_ORDERS_SALES_SYNC_SOURCE,
  });
}

async function finishSyncRun(
  supabase: SupabaseClient,
  runId: string,
  status: "completed" | "failed",
  stats: Partial<SyncStats>,
  errorMessage?: string,
) {
  const fullUpdate = {
    status,
    finished_at: new Date().toISOString(),
    orders_seen: stats.ordersSeen ?? 0,
    sales_lines_seen: stats.salesLinesSeen ?? 0,
    rows_fetched: stats.rowsFetched ?? 0,
    rows_upserted: stats.rowsUpserted ?? 0,
    rows_failed: stats.rowsFailed ?? 0,
    pages_seen: stats.pagesSeen ?? 0,
    has_next_page: stats.hasNextPage ?? false,
    last_cursor: stats.lastCursor ?? null,
    throttle: stats.throttle ?? null,
    error_message: errorMessage ?? null,
  };
  const { error } = await supabase
    .from("sync_runs")
    .update(fullUpdate)
    .eq("id", runId);

  if (!error) {
    return;
  }

  if (!schemaColumnMiss(error.message)) {
    throw new Error(`Could not finish order sync run: ${error.message}`);
  }

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

async function upsertSalesLines(
  supabase: SupabaseClient,
  rows: SalesLineUpsert[],
) {
  const { error } = await supabase
    .from("sales_lines")
    .upsert(rows, { onConflict: "shopify_line_item_id" });

  if (!error) {
    return;
  }

  if (!schemaColumnMiss(error.message)) {
    throw new Error(`Sales line upsert failed: ${error.message}`);
  }

  const rowsWithoutUpdatedAt = rows.map((row) => {
    const { updated_at_shopify: updatedAtShopify, ...fallbackRow } = row;
    void updatedAtShopify;
    return fallbackRow;
  });
  const retry = await supabase
    .from("sales_lines")
    .upsert(rowsWithoutUpdatedAt, { onConflict: "shopify_line_item_id" });

  if (retry.error) {
    throw new Error(`Sales line upsert failed: ${retry.error.message}`);
  }
}

async function markMissingEditedLines(
  supabase: SupabaseClient,
  orders: ShopifyOrderNode[],
  syncedAt: string,
) {
  const lineIdsByOrderId = new Map<string, Set<string>>();
  const orderById = new Map<string, ShopifyOrderNode>();

  for (const order of orders) {
    const orderId = extractShopifyNumericId(order.id);
    orderById.set(orderId, order);
    lineIdsByOrderId.set(
      orderId,
      new Set(order.lineItems.nodes.map((line) => extractShopifyNumericId(line.id))),
    );
  }

  const orderIds = Array.from(orderById.keys());
  if (!orderIds.length) {
    return {
      affectedDates: [] as string[],
      updatedRows: 0,
    };
  }

  const { data, error } = await supabase
    .from("sales_lines")
    .select("shopify_order_id,shopify_line_item_id,order_date")
    .in("shopify_order_id", orderIds);

  if (error) {
    throw new Error(`Could not read existing sales lines for edited orders: ${error.message}`);
  }

  let updatedRows = 0;
  const affectedDates = new Set<string>();
  for (const row of (data ?? []) as Array<{
    shopify_order_id: string | null;
    shopify_line_item_id: string | null;
    order_date: string | null;
  }>) {
    const orderId = row.shopify_order_id ?? "";
    const lineItemId = row.shopify_line_item_id ?? "";
    const order = orderById.get(orderId);
    const currentLineIds = lineIdsByOrderId.get(orderId);
    if (!order || !lineItemId || currentLineIds?.has(lineItemId)) {
      continue;
    }

    const update = {
      cancelled_at_shopify: order.cancelledAt,
      financial_status: order.displayFinancialStatus,
      fulfillment_status: order.displayFulfillmentStatus,
      line_total: 0,
      quantity: 0,
      synced_at: syncedAt,
      updated_at_shopify: order.updatedAt,
    };
    const { error: updateError } = await supabase
      .from("sales_lines")
      .update(update)
      .eq("shopify_line_item_id", lineItemId);

    if (!updateError) {
      updatedRows += 1;
      if (row.order_date) {
        affectedDates.add(row.order_date.slice(0, 10));
      }
      continue;
    }

    if (!schemaColumnMiss(updateError.message)) {
      throw new Error(`Could not zero edited sales line ${lineItemId}: ${updateError.message}`);
    }

    const { updated_at_shopify: updatedAtShopify, ...fallbackUpdate } = update;
    void updatedAtShopify;
    const retry = await supabase
      .from("sales_lines")
      .update(fallbackUpdate)
      .eq("shopify_line_item_id", lineItemId);

    if (retry.error) {
      throw new Error(`Could not zero edited sales line ${lineItemId}: ${retry.error.message}`);
    }
    updatedRows += 1;
    if (row.order_date) {
      affectedDates.add(row.order_date.slice(0, 10));
    }
  }

  return {
    affectedDates: Array.from(affectedDates),
    updatedRows,
  };
}

function assertNoNestedLineItemOverflow(orders: ShopifyOrderNode[]) {
  const overflowOrder = orders.find((order) => order.lineItems.pageInfo.hasNextPage);
  if (!overflowOrder) {
    return;
  }

  throw new Error(
    `Shopify order ${overflowOrder.name} has more than 100 line items. Sales sync stopped so demand is not undercounted silently.`,
  );
}

export async function syncShopifyOrdersSalesLines(
  supabase: SupabaseClient,
  options: SyncOptions,
) {
  const maxPages = options.maxPages ?? 100;
  const windowField = options.windowField ?? "updated_at";
  const syncedAt = new Date().toISOString();
  const runId = await createSyncRun(supabase, { ...options, windowField });
  const stats: SyncStats = {
    ordersSeen: 0,
    salesLinesSeen: 0,
    rowsFetched: 0,
    rowsUpserted: 0,
    rowsFailed: 0,
    editedLinesZeroed: 0,
    summaryDatesRefreshed: 0,
    summaryRowsRefreshed: 0,
    pagesSeen: 0,
    hasNextPage: false,
    lastCursor: null,
    throttle: null,
  };
  let cursor: string | null = options.cursor ?? null;
  let hasNextPage = true;
  let lockAcquired = false;
  const affectedSalesDates = new Set<string>();

  try {
    await acquireSyncLock(
      supabase,
      runId,
      options.lockTtlSeconds ?? DEFAULT_LOCK_TTL_SECONDS,
    );
    lockAcquired = true;

    while (hasNextPage && stats.pagesSeen < maxPages) {
      const result: ShopifyGraphqlResult<OrdersPayload> =
        await shopifyGraphql<OrdersPayload>(ORDERS_QUERY, {
          cursor,
          query: orderQuery(options.sinceAt, options.untilAt, windowField),
          sortKey: orderSortKey(windowField),
        });
      const page = result.data.orders;
      const fetchedRows = page.nodes.reduce(
        (sum, order) => sum + order.lineItems.nodes.length,
        0,
      );
      stats.rowsFetched += fetchedRows;

      try {
        assertNoNestedLineItemOverflow(page.nodes);
      } catch (error) {
        stats.rowsFailed += fetchedRows;
        throw error;
      }

      const rows = page.nodes.flatMap((order) => mapOrderLines(order, syncedAt));
      for (const row of rows) {
        affectedSalesDates.add(row.order_date);
      }

      if (rows.length) {
        try {
          await upsertSalesLines(supabase, rows);
          stats.rowsUpserted += rows.length;
        } catch (error) {
          stats.rowsFailed += rows.length;
          throw error;
        }
      }

      const zeroedLines = await markMissingEditedLines(supabase, page.nodes, syncedAt);
      for (const salesDate of zeroedLines.affectedDates) {
        affectedSalesDates.add(salesDate);
      }
      stats.editedLinesZeroed += zeroedLines.updatedRows;
      stats.rowsUpserted += zeroedLines.updatedRows;
      stats.ordersSeen += page.nodes.length;
      stats.salesLinesSeen += rows.length;
      stats.pagesSeen += 1;
      stats.throttle = result.extensions?.cost?.throttleStatus ?? null;
      hasNextPage = page.pageInfo.hasNextPage;
      cursor = page.pageInfo.endCursor;
    }

    stats.hasNextPage = hasNextPage;
    stats.lastCursor = cursor;
    // sales_by_sku_day is a rebuildable summary. Refresh only touched dates
    // after raw sales_lines writes have succeeded so raw lines remain the source of truth.
    const summary = await refreshSalesBySkuDayForDates(
      supabase,
      Array.from(affectedSalesDates),
    );
    stats.summaryDatesRefreshed = summary.refreshedDates.length;
    stats.summaryRowsRefreshed = summary.rowsRefreshed;
    await finishSyncRun(supabase, runId, "completed", stats);

    return {
      runId,
      windowField,
      ...stats,
      capped: hasNextPage,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown order sync error";
    stats.hasNextPage = hasNextPage;
    stats.lastCursor = cursor;
    await finishSyncRun(supabase, runId, "failed", stats, message);
    throw error;
  } finally {
    if (lockAcquired) {
      await releaseSyncLock(supabase, runId);
    }
  }
}
