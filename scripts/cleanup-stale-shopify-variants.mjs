import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const SHOPIFY_API_VERSION = "2026-04";
const ARCHIVE_PREFIX = "__STALE__";
const PAGE_SIZE = 100;
const REFERENCE_TABLES = [
  { column: "sku", key: "poItems", table: "po_items" },
  { column: "sku", key: "salesLines", table: "sales_lines" },
  { column: "sku", key: "manualSupplierMappings", table: "manual_supplier_mappings" },
  { column: "sku", key: "purchasingDecisionControls", table: "purchasing_decision_controls" },
  { column: "sku", key: "salesBySkuDay", table: "sales_by_sku_day" },
  { column: "sku", key: "demandIndexCurrent", table: "demand_index_current" },
  { column: "sku", key: "costPriceMonitorOverrides", table: "cost_price_monitor_variant_overrides" },
];

function loadEnv() {
  const values = {};
  try {
    for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      let value = match[2];
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      values[match[1]] = value;
    }
  } catch {
    // Environment variables remain the fallback outside local development.
  }
  return { ...values, ...process.env };
}

function requireValue(env, name) {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function numericId(gid) {
  return String(gid ?? "").split("/").filter(Boolean).at(-1) ?? "";
}

function archiveSku(variantId, sku) {
  return `${ARCHIVE_PREFIX}${variantId}__${sku}`;
}

function countBy(rows, column) {
  const counts = new Map();
  for (const row of rows) {
    const key = String(row[column] ?? "");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

async function fetchShopifyVariants(env) {
  const query = `
    query ProductVariants($cursor: String) {
      productVariants(first: ${PAGE_SIZE}, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes { id sku title product { id title } }
      }
    }
  `;
  const variants = [];
  let cursor = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const response = await fetch(
      `https://${requireValue(env, "SHOPIFY_SHOP_DOMAIN")}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": requireValue(env, "SHOPIFY_ADMIN_ACCESS_TOKEN"),
        },
        body: JSON.stringify({ query, variables: { cursor } }),
      },
    );
    if (!response.ok) throw new Error(`Shopify API failed with HTTP ${response.status}.`);
    const payload = await response.json();
    if (payload.errors?.length) {
      throw new Error(payload.errors.map((error) => error.message).join("; "));
    }
    const page = payload.data?.productVariants;
    if (!page) throw new Error("Shopify API returned no product variants.");
    variants.push(...page.nodes);
    hasNextPage = page.pageInfo.hasNextPage;
    cursor = page.pageInfo.endCursor;
  }
  return variants;
}

async function fetchAllMatching(supabase, table, columns, column, values) {
  const rows = [];
  for (let index = 0; index < values.length; index += 200) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .in(column, values.slice(index, index + 200));
    if (error) throw new Error(`${table} reference audit failed: ${error.message}`);
    rows.push(...(data ?? []));
  }
  return rows;
}

async function identifyConflicts(supabase, shopifyVariants) {
  const incoming = shopifyVariants.filter((variant) => variant.sku?.trim());
  const incomingBySku = new Map(incoming.map((variant) => [variant.sku.trim(), variant]));
  const skus = [...incomingBySku.keys()];
  const localRows = await fetchAllMatching(
    supabase,
    "product_variants",
    "id,product_id,shopify_variant_id,sku,variant_title,updated_at,products(product_title,shopify_product_id)",
    "sku",
    skus,
  );

  return localRows.flatMap((local) => {
    const current = incomingBySku.get(local.sku);
    if (!current || String(local.shopify_variant_id) === numericId(current.id)) return [];
    return [{
      archiveSku: archiveSku(local.shopify_variant_id, local.sku),
      local,
      current,
    }];
  });
}

async function auditReferences(supabase, conflicts) {
  const skus = conflicts.map((conflict) => conflict.local.sku);
  const oldVariantIds = conflicts.map((conflict) => String(conflict.local.shopify_variant_id));
  const oldRowIds = conflicts.map((conflict) => conflict.local.id);
  const referenceMaps = {};

  for (const reference of REFERENCE_TABLES) {
    const rows = await fetchAllMatching(
      supabase,
      reference.table,
      reference.column,
      reference.column,
      skus,
    );
    referenceMaps[reference.key] = countBy(rows, reference.column);
  }

  const inventoryBySku = await fetchAllMatching(
    supabase,
    "inventory_snapshots",
    "sku",
    "sku",
    skus,
  );
  const inventoryByShopifyVariant = await fetchAllMatching(
    supabase,
    "inventory_snapshots",
    "shopify_variant_id",
    "shopify_variant_id",
    oldVariantIds,
  );
  const inventoryByRow = await fetchAllMatching(
    supabase,
    "inventory_snapshots",
    "variant_id",
    "variant_id",
    oldRowIds,
  );
  const salesByOldVariant = await fetchAllMatching(
    supabase,
    "sales_lines",
    "variant_id",
    "variant_id",
    oldVariantIds,
  );
  const inventorySkuCounts = countBy(inventoryBySku, "sku");
  const inventoryShopifyVariantCounts = countBy(inventoryByShopifyVariant, "shopify_variant_id");
  const inventoryRowCounts = countBy(inventoryByRow, "variant_id");
  const salesVariantCounts = countBy(salesByOldVariant, "variant_id");

  return conflicts.map((conflict) => {
    const sku = conflict.local.sku;
    const references = Object.fromEntries(
      REFERENCE_TABLES.map((reference) => [reference.key, referenceMaps[reference.key].get(sku) ?? 0]),
    );
    references.inventorySnapshotsBySku = inventorySkuCounts.get(sku) ?? 0;
    references.inventorySnapshotsByOldShopifyVariant =
      inventoryShopifyVariantCounts.get(String(conflict.local.shopify_variant_id)) ?? 0;
    references.inventorySnapshotsByOldVariantRow = inventoryRowCounts.get(conflict.local.id) ?? 0;
    references.salesLinesByOldShopifyVariant =
      salesVariantCounts.get(String(conflict.local.shopify_variant_id)) ?? 0;
    const referenceTotal = Object.values(references).reduce((total, value) => total + value, 0);
    return { ...conflict, references, riskLevel: referenceTotal > 0 ? "medium" : "low" };
  });
}

async function assertArchiveSkusFree(supabase, conflicts) {
  const proposed = conflicts.map((conflict) => conflict.archiveSku);
  const rows = await fetchAllMatching(supabase, "product_variants", "id,sku", "sku", proposed);
  if (rows.length) {
    throw new Error(`Cleanup blocked: ${rows.length} proposed archive SKU(s) already exist.`);
  }
}

function displayRows(conflicts) {
  console.table(conflicts.map((conflict) => ({
    originalSku: conflict.local.sku,
    oldVariantId: conflict.local.shopify_variant_id,
    oldProduct: conflict.local.products?.product_title ?? "Unknown",
    oldVariant: conflict.local.variant_title ?? "Untitled",
    newVariantId: numericId(conflict.current.id),
    newProduct: conflict.current.product.title,
    newVariant: conflict.current.title,
    references: Object.values(conflict.references).reduce((total, value) => total + value, 0),
    archiveSku: conflict.archiveSku,
    risk: conflict.riskLevel,
  })));
}

async function writeAuditFile(run) {
  await mkdir("cleanup-logs", { recursive: true });
  const filename = `cleanup-logs/stale-shopify-variants-${run.startedAt.replace(/[:.]/g, "-")}.json`;
  await writeFile(filename, `${JSON.stringify(run, null, 2)}\n`, "utf8");
  return filename;
}

async function insertDatabaseAudit(supabase, runId, conflicts, appliedBy) {
  const rows = conflicts.map((conflict) => ({
    cleanup_run_id: runId,
    product_variant_id: conflict.local.id,
    original_sku: conflict.local.sku,
    archived_sku: conflict.archiveSku,
    old_shopify_variant_id: String(conflict.local.shopify_variant_id),
    new_shopify_variant_id: numericId(conflict.current.id),
    old_product_title: conflict.local.products?.product_title ?? null,
    old_variant_title: conflict.local.variant_title,
    new_product_title: conflict.current.product.title,
    new_variant_title: conflict.current.title,
    reference_counts: conflict.references,
    risk_level: conflict.riskLevel,
    applied_by: appliedBy,
  }));
  const { error } = await supabase.from("shopify_variant_cleanup_logs").insert(rows);
  return error?.message ?? null;
}

async function applyCleanup(supabase, conflicts, runId, appliedBy) {
  const rpcRows = conflicts.map((conflict) => ({
    productVariantId: conflict.local.id,
    originalSku: conflict.local.sku,
    archivedSku: conflict.archiveSku,
    oldShopifyVariantId: String(conflict.local.shopify_variant_id),
    newShopifyVariantId: numericId(conflict.current.id),
    oldProductTitle: conflict.local.products?.product_title ?? null,
    oldVariantTitle: conflict.local.variant_title,
    newProductTitle: conflict.current.product.title,
    newVariantTitle: conflict.current.title,
    referenceCounts: conflict.references,
    riskLevel: conflict.riskLevel,
  }));
  const { data: rpcCount, error: rpcError } = await supabase.rpc(
    "cleanup_stale_shopify_variants",
    {
      p_applied_by: appliedBy,
      p_cleanup_run_id: runId,
      p_rows: rpcRows,
    },
  );
  if (!rpcError) {
    if (Number(rpcCount) !== conflicts.length) {
      throw new Error(`Transactional cleanup returned ${rpcCount}; expected ${conflicts.length}.`);
    }
    return { databaseAuditHandled: true };
  }
  const rpcUnavailable = rpcError.code === "PGRST202" || /schema cache|function/i.test(rpcError.message);
  if (!rpcUnavailable) {
    throw new Error(`Transactional cleanup failed: ${rpcError.message}`);
  }

  console.warn("Migration 062 RPC is not deployed; using guarded updates with rollback and local audit logging.");
  const updated = [];
  try {
    for (const conflict of conflicts) {
      const { data, error } = await supabase
        .from("product_variants")
        .update({ sku: conflict.archiveSku, updated_at: new Date().toISOString() })
        .eq("id", conflict.local.id)
        .eq("sku", conflict.local.sku)
        .eq("shopify_variant_id", conflict.local.shopify_variant_id)
        .select("id,sku")
        .single();
      if (error || data?.sku !== conflict.archiveSku) {
        throw new Error(`Failed to archive ${conflict.local.sku}: ${error?.message ?? "row changed during cleanup"}`);
      }
      updated.push(conflict);
    }
  } catch (error) {
    const rollbackErrors = [];
    for (const conflict of [...updated].reverse()) {
      const { error: rollbackError } = await supabase
        .from("product_variants")
        .update({ sku: conflict.local.sku, updated_at: conflict.local.updated_at })
        .eq("id", conflict.local.id)
        .eq("sku", conflict.archiveSku);
      if (rollbackError) rollbackErrors.push(`${conflict.local.sku}: ${rollbackError.message}`);
    }
    if (rollbackErrors.length) {
      throw new Error(`${error.message} Rollback also failed: ${rollbackErrors.join("; ")}`);
    }
    throw new Error(`${error.message} All earlier updates were rolled back.`);
  }
  return { databaseAuditHandled: false };
}

async function main() {
  const apply = process.argv.includes("--apply");
  const dryRun = process.argv.includes("--dry-run");
  if (apply === dryRun) throw new Error("Choose exactly one mode: --dry-run or --apply.");

  const env = loadEnv();
  const supabase = createClient(
    requireValue(env, "NEXT_PUBLIC_SUPABASE_URL"),
    requireValue(env, "SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const startedAt = new Date().toISOString();
  const runId = randomUUID();
  const shopifyVariants = await fetchShopifyVariants(env);
  const conflicts = await auditReferences(
    supabase,
    await identifyConflicts(supabase, shopifyVariants),
  );
  await assertArchiveSkusFree(supabase, conflicts);

  console.log(`Mode: ${apply ? "APPLY" : "DRY RUN"}`);
  console.log(`Shopify variants checked: ${shopifyVariants.length}`);
  console.log(`Confirmed stale SKU ownership conflicts: ${conflicts.length}`);
  displayRows(conflicts);

  const run = {
    runId,
    startedAt,
    mode: apply ? "apply" : "dry-run",
    status: apply ? "pending" : "completed",
    conflicts,
  };

  if (!apply) {
    const filename = await writeAuditFile(run);
    console.log(`Dry-run complete. No database rows changed. Audit: ${filename}`);
    return;
  }
  if (!conflicts.length) {
    console.log("Nothing to apply. No stale SKU ownership conflicts remain.");
    return;
  }

  const appliedBy = env.USERNAME ?? env.USER ?? "admin-script";
  const applyResult = await applyCleanup(supabase, conflicts, runId, appliedBy);
  run.status = "completed";
  run.finishedAt = new Date().toISOString();
  const databaseAuditError = applyResult.databaseAuditHandled
    ? null
    : await insertDatabaseAudit(supabase, runId, conflicts, appliedBy);
  run.databaseAuditError = databaseAuditError;
  const filename = await writeAuditFile(run);

  console.log(`Applied: ${conflicts.length} stale variants archived; no historical rows were deleted or rewritten.`);
  console.log(`Local audit: ${filename}`);
  if (databaseAuditError) {
    console.warn(`Database audit log unavailable: ${databaseAuditError}`);
    console.warn("Apply migration 062 to enable durable database cleanup audit records for future runs.");
  } else {
    console.log(`Database audit rows written for cleanup run ${runId}.`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
