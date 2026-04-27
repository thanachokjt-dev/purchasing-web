import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const DATA_FILE = "src/lib/po-portal-data.ts";
const SOURCE = "appsheet_export";
const BATCH_SIZE = 250;

function loadLocalEnv() {
  const env = {};

  try {
    const contents = readFileSync(".env.local", "utf8");
    for (const line of contents.split(/\r?\n/)) {
      const match = line.match(/^\s*([^#][^=]+)=(.*)$/);
      if (match) {
        env[match[1].trim()] = match[2].trim();
      }
    }
  } catch {
    // Fall back to process.env below.
  }

  return { ...env, ...process.env };
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function extractArray(source, exportName) {
  const marker = `export const ${exportName} = `;
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) {
    throw new Error(`Cannot find ${exportName} in ${DATA_FILE}`);
  }

  const start = source.indexOf("[", markerIndex);
  if (start < 0) {
    throw new Error(`Cannot find array start for ${exportName}`);
  }

  let depth = 0;
  let inString = false;
  let escapeNext = false;

  for (let index = start; index < source.length; index += 1) {
    const char = source[index];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (char === "\\") {
      escapeNext = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) {
      continue;
    }
    if (char === "[") {
      depth += 1;
    }
    if (char === "]") {
      depth -= 1;
      if (depth === 0) {
        return JSON.parse(source.slice(start, index + 1));
      }
    }
  }

  throw new Error(`Cannot find array end for ${exportName}`);
}

function readPoPortalData() {
  const source = readFileSync(DATA_FILE, "utf8");

  return {
    suppliers: extractArray(source, "poPortalSuppliers"),
    items: extractArray(source, "poPortalItems"),
    orders: extractArray(source, "poPortalOrders"),
  };
}

function dateOnly(value) {
  if (!value) {
    return null;
  }

  return String(value).slice(0, 10);
}

function numberOrZero(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function cleanText(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

function supplierRows(suppliers, orders) {
  const rows = new Map();

  for (const supplier of suppliers) {
    rows.set(supplier.supplierCode, {
      supplier_code: supplier.supplierCode,
      supplier_name: supplier.supplierName || supplier.supplierCode,
      currency: cleanText(supplier.currency),
      payment_terms: cleanText(supplier.paymentTerms),
      moq: cleanText(supplier.moq),
      safety_days: numberOrZero(supplier.safetyDays),
      lead_time_days: numberOrZero(supplier.leadTimeDays),
      product_scope: cleanText(supplier.productScope),
      source: SOURCE,
      updated_at: new Date().toISOString(),
    });
  }

  for (const order of orders) {
    if (!order.supplierCode || rows.has(order.supplierCode)) {
      continue;
    }

    rows.set(order.supplierCode, {
      supplier_code: order.supplierCode,
      supplier_name: order.supplierName || order.supplierCode,
      currency: cleanText(order.currency),
      payment_terms: cleanText(order.paymentTerms),
      moq: null,
      safety_days: 0,
      lead_time_days: 0,
      product_scope: null,
      source: SOURCE,
      updated_at: new Date().toISOString(),
    });
  }

  return [...rows.values()];
}

function orderRows(orders) {
  return orders.map((order) => ({
    po_id: order.poId,
    rqq_id: cleanText(order.rqqId),
    po_title: cleanText(order.poTitle),
    po_date: dateOnly(order.poDate),
    work_status: cleanText(order.workStatus) ?? "unknown",
    requester: cleanText(order.requester),
    owner: cleanText(order.owner),
    supplier_code: cleanText(order.supplierCode),
    supplier_name_snapshot: cleanText(order.supplierName),
    currency: cleanText(order.currency),
    po_amount_foreign: numberOrZero(order.poAmountForeign),
    po_amount_thb: numberOrZero(order.poAmountThb),
    payment_terms_snapshot: cleanText(order.paymentTerms),
    source: SOURCE,
    source_payload: {
      statuses: order.statuses,
      itemCount: order.itemCount,
      totalQty: order.totalQty,
      receivedQty: order.receivedQty,
      outstandingQty: order.outstandingQty,
    },
    updated_at: new Date().toISOString(),
  }));
}

function itemRows(items) {
  return items.map((item) => ({
    po_item_id: cleanText(item.poItemId),
    po_id: item.poId,
    line_no: cleanText(item.lineNo),
    sku: item.sku,
    product_title_snapshot: cleanText(item.productTitle),
    variant_title_snapshot: cleanText(item.variantTitle),
    ordered_qty: numberOrZero(item.qty),
    legacy_received_qty: numberOrZero(item.receivedQty),
    backorder_qty: numberOrZero(item.backorderQty),
    unit_price: numberOrZero(item.unitPrice),
    line_amount: numberOrZero(item.lineAmount),
    currency: cleanText(item.currency),
    remark: cleanText(item.remark),
    full_name: cleanText(item.fullName),
    line_status: cleanText(item.status) ?? "unknown",
    source: SOURCE,
    source_payload: {
      outstandingQty: item.outstandingQty,
    },
    updated_at: new Date().toISOString(),
  }));
}

function assertUnique(rows, field, label) {
  const seen = new Set();

  for (const row of rows) {
    const value = row[field];
    if (!value) {
      throw new Error(`${label} has an empty ${field}`);
    }
    if (seen.has(value)) {
      throw new Error(`${label} has a duplicate ${field}: ${value}`);
    }
    seen.add(value);
  }
}

function validateRows(suppliers, orders, items) {
  assertUnique(suppliers, "supplier_code", "Suppliers");
  assertUnique(orders, "po_id", "PO orders");
  assertUnique(items, "po_item_id", "PO items");

  const orderIds = new Set(orders.map((order) => order.po_id));
  const missingOrder = items.find((item) => !orderIds.has(item.po_id));
  if (missingOrder) {
    throw new Error(`PO item ${missingOrder.po_item_id} references missing PO ${missingOrder.po_id}`);
  }

  const missingSku = items.find((item) => !item.sku);
  if (missingSku) {
    throw new Error(`PO item ${missingSku.po_item_id} has an empty SKU`);
  }
}

async function upsertBatches(supabase, table, rows, onConflict) {
  let imported = 0;

  for (let index = 0; index < rows.length; index += BATCH_SIZE) {
    const batch = rows.slice(index, index + BATCH_SIZE);
    const { error } = await supabase.from(table).upsert(batch, { onConflict });
    if (error) {
      throw new Error(`${table} import failed: ${error.message}`);
    }
    imported += batch.length;
    console.log(`${table} imported=${imported}/${rows.length}`);
  }
}

async function main() {
  const env = loadLocalEnv();
  const dryRun = hasFlag("dry-run");
  const data = readPoPortalData();
  const suppliers = supplierRows(data.suppliers, data.orders);
  const orders = orderRows(data.orders);
  const items = itemRows(data.items);

  validateRows(suppliers, orders, items);

  console.log(
    [
      dryRun ? "dry-run" : "import",
      `suppliers=${suppliers.length}`,
      `orders=${orders.length}`,
      `items=${items.length}`,
    ].join(" "),
  );

  if (dryRun) {
    return;
  }

  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }

  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  await upsertBatches(supabase, "po_suppliers", suppliers, "supplier_code");
  await upsertBatches(supabase, "po_orders", orders, "po_id");
  await upsertBatches(supabase, "po_items", items, "po_item_id");

  console.log("done");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
