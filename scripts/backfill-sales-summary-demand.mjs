import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_SIZE = 1000;
const UPSERT_SIZE = 500;

function loadEnvFile(path) {
  try {
    const content = readFileSync(path, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (!match) {
        continue;
      }
      const key = match[1].trim();
      const value = match[2].trim().replace(/^['"]|['"]$/g, "");
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // Optional local env file.
  }
}

function numeric(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isCountableDemandLine(row) {
  const status = String(row.financial_status ?? "").trim().toUpperCase();
  return (
    String(row.sku ?? "").trim() &&
    row.order_date &&
    !row.cancelled_at_shopify &&
    status !== "REFUNDED" &&
    status !== "VOIDED"
  );
}

function daysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function saleSpanDays(firstDate, lastDate) {
  if (!firstDate || !lastDate) {
    return 0;
  }
  const first = new Date(`${firstDate}T00:00:00Z`).getTime();
  const last = new Date(`${lastDate}T00:00:00Z`).getTime();
  if (!Number.isFinite(first) || !Number.isFinite(last) || last < first) {
    return 0;
  }
  return Math.max(1, Math.floor((last - first) / (24 * 60 * 60 * 1000)) + 1);
}

function demandFromStats(stats) {
  const spanDays = saleSpanDays(stats.firstSaleDate, stats.lastSaleDate);
  const lifetimeDailyAverage = spanDays > 0 ? stats.total / spanDays : 0;
  const sellingDayAverage = stats.sellingDays > 0 ? stats.total / stats.sellingDays : 0;
  const saleDensity = spanDays > 0 ? stats.sellingDays / spanDays : 0;
  const slowMoverReliability = Math.min(
    1,
    saleDensity * 1.2,
    stats.sellingDays > 0 ? stats.sellingDays / 180 : 0,
    stats.total > 0 ? stats.total / 320 : 0,
  );
  const effectiveSellingWeight = 65 * slowMoverReliability;
  const effectiveLifetimeWeight =
    slowMoverReliability < 1 ? 100 - effectiveSellingWeight : 35;
  const weightTotal = effectiveLifetimeWeight + effectiveSellingWeight;
  const weightedBase =
    weightTotal > 0
      ? (lifetimeDailyAverage * effectiveLifetimeWeight +
          sellingDayAverage * effectiveSellingWeight) /
        weightTotal
      : Math.max(lifetimeDailyAverage, sellingDayAverage);
  const recentFloorDaily = (stats.sold30 / 30) * 0.75;
  const uncappedDemand = Math.max(weightedBase, recentFloorDaily);
  const demandIndexHm =
    sellingDayAverage > 0 ? Math.min(uncappedDemand, sellingDayAverage) : uncappedDemand;

  return {
    demandIndexHm,
    effectiveLifetimeWeight,
    effectiveSellingWeight,
    lifetimeDailyAverage,
    recentFloorDaily,
    sellingDayAverage,
    slowMoverReliability,
  };
}

async function fetchAll(supabase, table, columns, orderColumn) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabase.from(table).select(columns).range(from, from + PAGE_SIZE - 1);
    if (orderColumn) {
      query = query.order(orderColumn, { ascending: true });
    }
    const { data, error } = await query;
    if (error) {
      throw new Error(`${table} read failed: ${error.message}`);
    }
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) {
      return rows;
    }
  }
}

async function upsertChunks(supabase, table, rows, options) {
  let count = 0;
  for (let i = 0; i < rows.length; i += UPSERT_SIZE) {
    const chunk = rows.slice(i, i + UPSERT_SIZE);
    const { error } = await supabase.from(table).upsert(chunk, options);
    if (error) {
      throw new Error(`${table} upsert failed: ${error.message}`);
    }
    count += chunk.length;
  }
  return count;
}

loadEnvFile(resolve(process.cwd(), ".env.local"));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

console.log("Reading raw sales_lines...");
const salesLines = await fetchAll(
  supabase,
  "sales_lines",
  "sku,quantity,order_date,unit_price,line_total,shopify_order_id,cancelled_at_shopify,financial_status",
  "order_date",
);

const summaryByDateSku = new Map();
for (const row of salesLines) {
  if (!isCountableDemandLine(row)) {
    continue;
  }
  const sku = String(row.sku).trim();
  const salesDate = String(row.order_date).slice(0, 10);
  const key = `${salesDate}\u0000${sku}`;
  const current =
    summaryByDateSku.get(key) ??
    {
      gross_sales: 0,
      net_sales: 0,
      orderIds: new Set(),
      qty_sold: 0,
      sales_date: salesDate,
      sku,
      updated_at: new Date().toISOString(),
    };
  const qty = numeric(row.quantity);
  current.qty_sold += qty;
  current.gross_sales += numeric(row.unit_price) * qty;
  current.net_sales += row.line_total === null || row.line_total === undefined
    ? numeric(row.unit_price) * qty
    : numeric(row.line_total);
  if (row.shopify_order_id) {
    current.orderIds.add(String(row.shopify_order_id));
  }
  summaryByDateSku.set(key, current);
}

const salesSummaryRows = Array.from(summaryByDateSku.values()).map((row) => ({
  sales_date: row.sales_date,
  sku: row.sku,
  qty_sold: row.qty_sold,
  gross_sales: row.gross_sales,
  net_sales: row.net_sales,
  order_count: row.orderIds.size,
  updated_at: new Date().toISOString(),
}));

console.log(`Rebuilding sales_by_sku_day with ${salesSummaryRows.length} rows...`);
await supabase.from("sales_by_sku_day").delete().gte("sales_date", "1900-01-01");
const salesSummaryUpserted = await upsertChunks(
  supabase,
  "sales_by_sku_day",
  salesSummaryRows,
  { onConflict: "sales_date,sku" },
);

console.log("Reading product_variants for zero-sales demand rows...");
const variantRows = await fetchAll(supabase, "product_variants", "sku", "sku");
const allSkus = new Set(
  variantRows.map((row) => String(row.sku ?? "").trim()).filter(Boolean),
);

const d7 = daysAgo(7);
const d30 = daysAgo(30);
const d60 = daysAgo(60);
const d90 = daysAgo(90);
const demandStatsBySku = new Map();
for (const row of salesSummaryRows) {
  allSkus.add(row.sku);
  const stats =
    demandStatsBySku.get(row.sku) ??
    {
      firstSaleDate: null,
      lastSaleDate: null,
      saleDates: new Set(),
      sold7: 0,
      sold30: 0,
      sold60: 0,
      sold90: 0,
      total: 0,
    };
  stats.total += numeric(row.qty_sold);
  if (row.sales_date >= d7) stats.sold7 += numeric(row.qty_sold);
  if (row.sales_date >= d30) stats.sold30 += numeric(row.qty_sold);
  if (row.sales_date >= d60) stats.sold60 += numeric(row.qty_sold);
  if (row.sales_date >= d90) stats.sold90 += numeric(row.qty_sold);
  stats.firstSaleDate =
    stats.firstSaleDate && stats.firstSaleDate < row.sales_date
      ? stats.firstSaleDate
      : row.sales_date;
  stats.lastSaleDate =
    stats.lastSaleDate && stats.lastSaleDate > row.sales_date
      ? stats.lastSaleDate
      : row.sales_date;
  stats.saleDates.add(row.sales_date);
  demandStatsBySku.set(row.sku, stats);
}

const now = new Date().toISOString();
const demandRows = Array.from(allSkus).map((sku) => {
  const stats = demandStatsBySku.get(sku) ?? {
    firstSaleDate: null,
    lastSaleDate: null,
    saleDates: new Set(),
    sold7: 0,
    sold30: 0,
    sold60: 0,
    sold90: 0,
    total: 0,
  };
  const sellingDays = stats.saleDates.size;
  const demand = demandFromStats({
    firstSaleDate: stats.firstSaleDate,
    lastSaleDate: stats.lastSaleDate,
    sellingDays,
    sold30: stats.sold30,
    total: stats.total,
  });

  return {
    sku,
    total_sale: stats.total,
    sold_7: stats.sold7,
    sold_30: stats.sold30,
    sold_60: stats.sold60,
    sold_90: stats.sold90,
    avg_daily_7: stats.sold7 / 7,
    avg_daily_30: stats.sold30 / 30,
    avg_daily_60: stats.sold60 / 60,
    avg_daily_90: stats.sold90 / 90,
    first_sale_date: stats.firstSaleDate,
    last_sale_date: stats.lastSaleDate,
    selling_days: sellingDays,
    lifetime_daily_average: demand.lifetimeDailyAverage,
    selling_day_average: demand.sellingDayAverage,
    slow_mover_reliability: demand.slowMoverReliability,
    effective_lifetime_weight: demand.effectiveLifetimeWeight,
    effective_selling_day_weight: demand.effectiveSellingWeight,
    recent_floor_daily: demand.recentFloorDaily,
    demand_index_hm: demand.demandIndexHm,
    updated_at: now,
  };
});

console.log(`Rebuilding demand_index_current with ${demandRows.length} rows...`);
await supabase.from("demand_index_current").delete().neq("sku", "");
const demandUpserted = await upsertChunks(
  supabase,
  "demand_index_current",
  demandRows,
  { onConflict: "sku" },
);

const sampleSkus = ["BT-ANKL-BLK", "BT-ANKL-PNK"];
const { data: samples, error: sampleError } = await supabase
  .from("demand_index_current")
  .select("sku,total_sale,sold_30,avg_daily_30,demand_index_hm,first_sale_date,last_sale_date,selling_days")
  .in("sku", sampleSkus)
  .order("sku", { ascending: true });

if (sampleError) {
  throw new Error(`Sample verification failed: ${sampleError.message}`);
}

console.log(JSON.stringify({
  demand_index_current_rows: demandUpserted,
  finished_at: new Date().toISOString(),
  raw_sales_lines: salesLines.length,
  sales_by_sku_day_rows: salesSummaryUpserted,
  samples,
}, null, 2));
