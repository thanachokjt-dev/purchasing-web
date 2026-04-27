import type { SupabaseClient } from "@supabase/supabase-js";
import {
  PRODUCT_VARIANTS_QUERY,
  shopifyGraphql,
  type ShopifyGraphqlResult,
  type ProductVariantsPayload,
  type ShopifyVariantNode,
} from "@/lib/shopify/client";
import {
  extractShopifyNumericId,
  numericOrNull,
  optionName,
  optionPick,
  optionValue,
} from "@/lib/shopify/ids";

type SyncMode = "manual" | "cron" | "dry-run";

type SyncOptions = {
  mode: SyncMode;
  maxPages?: number;
  sinceAt?: string;
  untilAt?: string;
};

type SyncStats = {
  productsSeen: number;
  variantsSeen: number;
  inventoryRowsSeen: number;
  pagesSeen: number;
  hasNextPage: boolean;
  lastCursor: string | null;
  throttle: unknown;
};

type ProductUpsert = {
  shopify_product_id: string;
  shopify_gid: string;
  product_title: string;
  product_type: string | null;
  vendor: string | null;
  tags: string[];
  status: string;
  product_image_url: string | null;
  updated_at: string;
};

type VariantUpsert = {
  shopify_variant_id: string;
  shopify_gid: string;
  shopify_inventory_item_id: string | null;
  shopify_inventory_item_gid: string | null;
  sku: string;
  barcode: string | null;
  variant_title: string;
  option1_name: string | null;
  option1_value: string | null;
  option2_name: string | null;
  option2_value: string | null;
  option3_name: string | null;
  option3_value: string | null;
  option_pick: string | null;
  price: number | null;
  compare_at_price: number | null;
  tracked: boolean;
  effective_status: string;
  product_id?: string;
  updated_at: string;
};

type LocationUpsert = {
  id: string;
  shopify_gid: string;
  name: string;
  synced_at: string;
};

type InventorySnapshotUpsert = {
  snapshot_date: string;
  shopify_variant_id: string;
  sku: string;
  location_id: string;
  available: number;
  on_hand: number;
  committed: number;
  incoming: number;
  reserved: number;
  safety_stock: number;
  synced_at: string;
  variant_id?: string;
};

type InventoryLevelNode = NonNullable<
  ShopifyVariantNode["inventoryItem"]
>["inventoryLevels"]["nodes"][number];

function dedupeBy<T>(items: T[], keyFn: (item: T) => string) {
  const map = new Map<string, T>();
  for (const item of items) {
    map.set(keyFn(item), item);
  }
  return Array.from(map.values());
}

function quantitiesMap(node: InventoryLevelNode) {
  return Object.fromEntries(
    node.quantities.map((quantity) => [quantity.name, quantity.quantity]),
  ) as Record<string, number | undefined>;
}

function mapVariant(
  variant: ShopifyVariantNode,
  syncedAt: string,
): {
  product: ProductUpsert;
  variant: VariantUpsert | null;
  locations: LocationUpsert[];
  inventory: InventorySnapshotUpsert[];
} {
  const sku = variant.sku?.trim();
  const productImage =
    variant.product.featuredMedia?.preview?.image?.url ?? null;
  const productId = extractShopifyNumericId(variant.product.id);
  const variantId = extractShopifyNumericId(variant.id);
  const inventoryItemId = variant.inventoryItem
    ? extractShopifyNumericId(variant.inventoryItem.id)
    : null;

  const product: ProductUpsert = {
    shopify_product_id: productId,
    shopify_gid: variant.product.id,
    product_title: variant.product.title,
    product_type: variant.product.productType,
    vendor: variant.product.vendor,
    tags: variant.product.tags ?? [],
    status: variant.product.status,
    product_image_url: productImage,
    updated_at: syncedAt,
  };

  if (!sku) {
    return {
      product,
      variant: null,
      locations: [],
      inventory: [],
    };
  }

  const variantRow: VariantUpsert = {
    shopify_variant_id: variantId,
    shopify_gid: variant.id,
    shopify_inventory_item_id: inventoryItemId,
    shopify_inventory_item_gid: variant.inventoryItem?.id ?? null,
    sku,
    barcode: variant.barcode,
    variant_title: variant.title,
    option1_name: optionName(variant.selectedOptions, 0),
    option1_value: optionValue(variant.selectedOptions, 0),
    option2_name: optionName(variant.selectedOptions, 1),
    option2_value: optionValue(variant.selectedOptions, 1),
    option3_name: optionName(variant.selectedOptions, 2),
    option3_value: optionValue(variant.selectedOptions, 2),
    option_pick: optionPick(variant.selectedOptions),
    price: numericOrNull(variant.price),
    compare_at_price: numericOrNull(variant.compareAtPrice),
    tracked: variant.inventoryItem?.tracked ?? false,
    effective_status: variant.product.status,
    updated_at: syncedAt,
  };

  const locations: LocationUpsert[] = [];
  const inventory: InventorySnapshotUpsert[] = [];
  const snapshotDate = syncedAt.slice(0, 10);

  for (const level of variant.inventoryItem?.inventoryLevels.nodes ?? []) {
    const locationId = extractShopifyNumericId(level.location.id);
    const quantities = quantitiesMap(level);

    locations.push({
      id: locationId,
      shopify_gid: level.location.id,
      name: level.location.name,
      synced_at: syncedAt,
    });

    inventory.push({
      snapshot_date: snapshotDate,
      shopify_variant_id: variantId,
      sku,
      location_id: locationId,
      available: quantities.available ?? 0,
      on_hand: quantities.on_hand ?? 0,
      committed: quantities.committed ?? 0,
      incoming: quantities.incoming ?? 0,
      reserved: quantities.reserved ?? 0,
      safety_stock: quantities.safety_stock ?? 0,
      synced_at: syncedAt,
    });
  }

  return {
    product,
    variant: variantRow,
    locations,
    inventory,
  };
}

async function createSyncRun(supabase: SupabaseClient, options: SyncOptions) {
  const { data, error } = await supabase
    .from("sync_runs")
    .insert({
      source: "shopify_products_inventory",
      mode: options.mode,
      status: "running",
      since_at: options.sinceAt ?? null,
      until_at: options.untilAt ?? null,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Could not create sync run: ${error.message}`);
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
      products_seen: stats.productsSeen ?? 0,
      variants_seen: stats.variantsSeen ?? 0,
      inventory_rows_seen: stats.inventoryRowsSeen ?? 0,
      pages_seen: stats.pagesSeen ?? 0,
      throttle: stats.throttle ?? null,
      error_message: errorMessage ?? null,
    })
    .eq("id", runId);
}

async function persistPage(
  supabase: SupabaseClient,
  nodes: ShopifyVariantNode[],
  syncedAt: string,
) {
  const mapped = nodes.map((node) => mapVariant(node, syncedAt));
  const products = dedupeBy(
    mapped.map((row) => row.product),
    (product) => product.shopify_product_id,
  );
  const variants = mapped
    .map((row) => row.variant)
    .filter((row): row is VariantUpsert => Boolean(row));
  const locations = dedupeBy(
    mapped.flatMap((row) => row.locations),
    (location) => location.id,
  );
  const inventory = mapped.flatMap((row) => row.inventory);

  if (products.length) {
    const { error } = await supabase
      .from("products")
      .upsert(products, { onConflict: "shopify_product_id" });
    if (error) {
      throw new Error(`Product upsert failed: ${error.message}`);
    }
  }

  const productIds = new Map<string, string>();
  if (products.length) {
    const { data, error } = await supabase
      .from("products")
      .select("id, shopify_product_id")
      .in(
        "shopify_product_id",
        products.map((product) => product.shopify_product_id),
      );
    if (error) {
      throw new Error(`Product lookup failed: ${error.message}`);
    }
    for (const row of data ?? []) {
      productIds.set(row.shopify_product_id as string, row.id as string);
    }
  }

  const variantsWithProduct = variants.map((variant) => {
    const source = nodes.find(
      (node) => extractShopifyNumericId(node.id) === variant.shopify_variant_id,
    );
    const shopifyProductId = source
      ? extractShopifyNumericId(source.product.id)
      : null;

    return {
      ...variant,
      product_id: shopifyProductId ? productIds.get(shopifyProductId) : undefined,
    };
  });

  if (variantsWithProduct.length) {
    const { error } = await supabase
      .from("product_variants")
      .upsert(variantsWithProduct, { onConflict: "shopify_variant_id" });
    if (error) {
      throw new Error(`Variant upsert failed: ${error.message}`);
    }
  }

  if (locations.length) {
    const { error } = await supabase
      .from("shopify_locations")
      .upsert(locations, { onConflict: "id" });
    if (error) {
      throw new Error(`Location upsert failed: ${error.message}`);
    }
  }

  const variantIds = new Map<string, string>();
  if (variants.length) {
    const { data, error } = await supabase
      .from("product_variants")
      .select("id, shopify_variant_id")
      .in(
        "shopify_variant_id",
        variants.map((variant) => variant.shopify_variant_id),
      );
    if (error) {
      throw new Error(`Variant lookup failed: ${error.message}`);
    }
    for (const row of data ?? []) {
      variantIds.set(row.shopify_variant_id as string, row.id as string);
    }
  }

  const inventoryWithVariant = inventory.map((row) => ({
    ...row,
    variant_id: variantIds.get(row.shopify_variant_id),
  }));

  if (inventoryWithVariant.length) {
    const { error } = await supabase
      .from("inventory_snapshots")
      .upsert(inventoryWithVariant, {
        onConflict: "snapshot_date,shopify_variant_id,location_id",
      });
    if (error) {
      throw new Error(`Inventory snapshot upsert failed: ${error.message}`);
    }
  }

  return {
    products: products.length,
    variants: variants.length,
    inventory: inventory.length,
  };
}

export async function syncShopifyProductsAndInventory(
  supabase: SupabaseClient,
  options: SyncOptions,
) {
  const maxPages = options.maxPages ?? 100;
  const syncedAt = new Date().toISOString();
  const runId = await createSyncRun(supabase, options);
  let cursor: string | null = null;
  const query =
    options.sinceAt || options.untilAt
      ? [
          options.sinceAt ? `updated_at:>=${options.sinceAt}` : null,
          options.untilAt ? `updated_at:<${options.untilAt}` : null,
        ]
          .filter(Boolean)
          .join(" ")
      : null;
  let hasNextPage = true;
  let throttle: unknown = null;
  const stats: SyncStats = {
    productsSeen: 0,
    variantsSeen: 0,
    inventoryRowsSeen: 0,
    pagesSeen: 0,
    hasNextPage: false,
    lastCursor: null,
    throttle: null,
  };

  try {
    while (hasNextPage && stats.pagesSeen < maxPages) {
      const result: ShopifyGraphqlResult<ProductVariantsPayload> =
        await shopifyGraphql<ProductVariantsPayload>(
        PRODUCT_VARIANTS_QUERY,
        { cursor, query },
      );
      const page = result.data.productVariants;
      throttle = result.extensions?.cost?.throttleStatus ?? null;

      const persisted = await persistPage(supabase, page.nodes, syncedAt);
      stats.productsSeen += persisted.products;
      stats.variantsSeen += persisted.variants;
      stats.inventoryRowsSeen += persisted.inventory;
      stats.pagesSeen += 1;

      hasNextPage = page.pageInfo.hasNextPage;
      cursor = page.pageInfo.endCursor;
    }

    stats.hasNextPage = hasNextPage;
    stats.lastCursor = cursor;
    stats.throttle = throttle;
    await finishSyncRun(supabase, runId, "completed", stats);

    return {
      runId,
      ...stats,
      capped: hasNextPage,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown Shopify sync error";
    await finishSyncRun(supabase, runId, "failed", stats, message);
    throw error;
  }
}
