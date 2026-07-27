import "server-only";

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPurchasingDecisionData } from "@/lib/purchasing-decision-data";
import { getPurchasingSetupData } from "@/lib/purchasing-setup";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

const PAGE_SIZE = 1000;
const UPSERT_SIZE = 250;
const SNAPSHOT_TABLE = "top_seller_product_design_snapshot";

const COLOR_TOKENS = [
  "Black/White",
  "White/Black",
  "Black/Gold",
  "Black/Red",
  "Black/Blue",
  "Black/Grey",
  "Grey/Black",
  "Navy/White",
  "Red/White",
  "Blue/White",
  "Camo",
  "Camouflage",
  "Black",
  "White",
  "Red",
  "Blue",
  "Navy",
  "Green",
  "Grey",
  "Gray",
  "Yellow",
  "Gold",
  "Silver",
  "Orange",
  "Purple",
  "Pink",
  "Brown",
  "Beige",
  "Cream",
  "Khaki",
  "Olive",
  "Charcoal",
  "Burgundy",
  "Maroon",
  "Teal",
  "Aqua",
] as const;

const COLOR_CODE_TOKENS: Record<string, string> = {
  BEI: "Beige",
  BG: "Black/Gold",
  BK: "Black",
  BL: "Blue",
  BLK: "Black",
  BLU: "Blue",
  BRN: "Brown",
  CAM: "Camo",
  CAMO: "Camo",
  CHAR: "Charcoal",
  GR: "Green",
  GRN: "Green",
  GRY: "Grey",
  GY: "Grey",
  NV: "Navy",
  NVY: "Navy",
  OL: "Olive",
  PNK: "Pink",
  RD: "Red",
  RED: "Red",
  WH: "White",
  WHT: "White",
  WT: "White",
  WTE: "White",
  YEL: "Yellow",
};

type VariantMetadataRow = {
  option1_name: string | null;
  option1_value: string | null;
  option2_name: string | null;
  option2_value: string | null;
  option3_name: string | null;
  option3_value: string | null;
  sku: string | null;
  variant_title: string | null;
};

type DemandSnapshotRow = {
  avg_daily_30: number | string | null;
  avg_daily_90: number | string | null;
  demand_index_hm: number | string | null;
  sku: string | null;
  sold_30: number | string | null;
  sold_90: number | string | null;
  total_sale: number | string | null;
};

type TopSellerSnapshotDbRow = {
  category: string | null;
  color: string | null;
  demand_index_30: number | string | null;
  demand_index_90: number | string | null;
  demand_index_lifetime: number | string | null;
  design_name: string | null;
  group_key: string | null;
  image_url: string | null;
  item_statuses: string[] | null;
  refreshed_at: string | null;
  sku_count: number | string | null;
  sold_30: number | string | null;
  sold_90: number | string | null;
  suppliers: string[] | null;
  tags: string[] | null;
  total_sale: number | string | null;
  visibilities: string[] | null;
};

type GroupAccumulator = {
  category: string;
  color: string;
  demandIndex30: number;
  demandIndex90: number;
  demandIndexLifetime: number;
  designName: string;
  imageUrl: string | null;
  itemStatuses: Set<string>;
  skus: Set<string>;
  sold30: number;
  sold90: number;
  suppliers: Set<string>;
  tags: Set<string>;
  totalSale: number;
  visibilities: Set<string>;
};

export type TopSellerProductDesignRow = {
  category: string;
  color: string;
  demandIndex30: number;
  demandIndex90: number;
  demandIndexLifetime: number;
  designName: string;
  groupKey: string;
  imageUrl: string | null;
  itemStatuses: string[];
  skuCount: number;
  sold30: number;
  sold90: number;
  suppliers: string[];
  tags: string[];
  totalSale: number;
  visibilities: Array<"active" | "hidden">;
};

export type TopSellerProductDesignData = {
  refreshedAt: string | null;
  rows: TopSellerProductDesignRow[];
  source: "top_seller_product_design_snapshot";
  warnings: string[];
};

export type TopSellerSnapshotRefreshResult = {
  groupCount: number;
  refreshedAt: string;
  skuCount: number;
};

function compactText(value: string | null | undefined) {
  return value?.trim() || "";
}

function numeric(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizedTokens(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_/|()[\],.-]+/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function normalizedGroupKeyPart(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, "-") || "unknown"
  );
}

function titleCaseColor(value: string) {
  return value
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const lower = part.toLowerCase();
      if (lower === "gray") {
        return "Grey";
      }
      if (lower === "camouflage") {
        return "Camo";
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join("/");
}

function normalizeColor(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || /^default title$/i.test(trimmed)) {
    return "";
  }
  if (/[/|]/.test(trimmed)) {
    const parts = trimmed
      .split(/\s*[/|]\s*/)
      .map((part) => normalizeColor(part))
      .filter(Boolean);
    if (parts.length > 1) {
      return Array.from(new Set(parts)).join("/");
    }
  }

  const normalized = ` ${trimmed.toLowerCase().replace(/[_|-]/g, " ")} `;
  const exactToken = trimmed.toUpperCase().replace(/[^A-Z0-9]+/g, "");
  if (COLOR_CODE_TOKENS[exactToken]) {
    return COLOR_CODE_TOKENS[exactToken];
  }

  const matches = COLOR_TOKENS.filter((color) => {
    const colorNormalized = color.toLowerCase().replace("/", " ");
    return normalized.includes(` ${colorNormalized} `);
  }).map(titleCaseColor);
  if (matches.length > 0) {
    return Array.from(new Set(matches)).slice(0, 2).join("/");
  }

  const codeMatch = normalizedTokens(trimmed.toUpperCase()).find(
    (token) => COLOR_CODE_TOKENS[token],
  );
  return codeMatch ? COLOR_CODE_TOKENS[codeMatch] : "";
}

function explicitVariantColor(value: string) {
  const trimmed = value.trim();
  if (!trimmed || /^default title$/i.test(trimmed)) {
    return "";
  }
  return trimmed.replace(/\s+/g, " ").replace(/\s*([/|])\s*/g, "$1");
}

function skuColor(value: string | null | undefined) {
  const codeMatch = normalizedTokens(compactText(value).toUpperCase()).find(
    (token) => COLOR_CODE_TOKENS[token],
  );
  return codeMatch ? COLOR_CODE_TOKENS[codeMatch] : "";
}

function variantColor(row: VariantMetadataRow | undefined, designName: string) {
  if (!row) {
    return normalizeColor(designName) || "No color";
  }

  const options = [
    { name: row.option1_name, value: row.option1_value },
    { name: row.option2_name, value: row.option2_value },
    { name: row.option3_name, value: row.option3_value },
  ];
  const explicit = options.find((option) => /colou?r/i.test(compactText(option.name)));
  const explicitColor = explicitVariantColor(compactText(explicit?.value));
  if (explicitColor) {
    return explicitColor;
  }

  const colorFromSku = skuColor(row.sku);
  if (colorFromSku) {
    return colorFromSku;
  }

  const candidates = [
    ...options.map((option) => option.value),
    row.variant_title,
    designName,
  ];
  return candidates.map((value) => normalizeColor(compactText(value))).find(Boolean) || "No color";
}

function stripTrailingColor(value: string, color: string) {
  if (!color || color === "No color") {
    return value.trim();
  }
  const escapedColors = color
    .split("/")
    .map((part) => part.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .filter(Boolean);
  if (escapedColors.length === 0) {
    return value.trim();
  }
  const colorPattern = escapedColors.join("\\s*(?:/|\\+|&|and|-)\\s*");
  return (
    value.replace(new RegExp(`\\s*(?:-|/|,)\\s*${colorPattern}\\s*$`, "i"), "").trim() ||
    value.trim()
  );
}

async function fetchAll<T>(
  label: string,
  queryForRange: (
    from: number,
    to: number,
  ) => PromiseLike<{
    data: unknown[] | null;
    error: { message: string } | null;
  }>,
) {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await queryForRange(from, from + PAGE_SIZE - 1);
    if (error) {
      throw new Error(`${label}: ${error.message}`);
    }
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE_SIZE) {
      return rows;
    }
  }
}

function rowFromDb(row: TopSellerSnapshotDbRow): TopSellerProductDesignRow | null {
  const groupKey = compactText(row.group_key);
  const designName = compactText(row.design_name);
  if (!groupKey || !designName) {
    return null;
  }
  return {
    category: compactText(row.category) || "Uncategorized",
    color: compactText(row.color) || "No color",
    demandIndex30: numeric(row.demand_index_30),
    demandIndex90: numeric(row.demand_index_90),
    demandIndexLifetime: numeric(row.demand_index_lifetime),
    designName,
    groupKey,
    imageUrl: compactText(row.image_url) || null,
    itemStatuses: (row.item_statuses ?? []).map(compactText).filter(Boolean),
    skuCount: Math.max(0, Math.round(numeric(row.sku_count))),
    sold30: numeric(row.sold_30),
    sold90: numeric(row.sold_90),
    suppliers: (row.suppliers ?? []).map(compactText).filter(Boolean),
    tags: (row.tags ?? []).map(compactText).filter(Boolean),
    totalSale: numeric(row.total_sale),
    visibilities: (row.visibilities ?? []).flatMap((value) => {
      const normalized = compactText(value).toLowerCase();
      return normalized === "active" || normalized === "hidden" ? [normalized] : [];
    }),
  };
}

export async function getTopSellerProductDesignData(): Promise<TopSellerProductDesignData> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return {
      refreshedAt: null,
      rows: [],
      source: SNAPSHOT_TABLE,
      warnings: ["Supabase service client is not configured."],
    };
  }

  try {
    const readSnapshotRows = () =>
      fetchAll<TopSellerSnapshotDbRow>(
        "Top seller product-design snapshot",
        (from, to) =>
          supabase
            .from(SNAPSHOT_TABLE)
            .select(
              "group_key,category,design_name,color,suppliers,tags,image_url,item_statuses,visibilities,sku_count,sold_30,sold_90,total_sale,demand_index_30,demand_index_90,demand_index_lifetime,refreshed_at",
            )
            .order("category", { ascending: true })
            .order("demand_index_30", { ascending: false })
            .range(from, to),
      );
    let rows = await readSnapshotRows();
    const snapshotRefreshedAt =
      rows.map((row) => row.refreshed_at).filter(Boolean).sort().at(-1) ?? null;
    const latestDemandResult = await supabase
      .from("demand_index_current")
      .select("updated_at")
      .order("updated_at", { ascending: false })
      .limit(1);
    const latestDemandAt = compactText(latestDemandResult.data?.[0]?.updated_at);
    const snapshotIsStale =
      !snapshotRefreshedAt ||
      (latestDemandAt && new Date(latestDemandAt) > new Date(snapshotRefreshedAt));

    if (!latestDemandResult.error && snapshotIsStale) {
      await refreshTopSellerProductDesignSnapshot(supabase);
      rows = await readSnapshotRows();
    }

    return {
      refreshedAt:
        rows.map((row) => row.refreshed_at).filter(Boolean).sort().at(-1) ?? null,
      rows: rows.flatMap((row) => {
        const mapped = rowFromDb(row);
        return mapped ? [mapped] : [];
      }),
      source: SNAPSHOT_TABLE,
      warnings: [],
    };
  } catch (error) {
    return {
      refreshedAt: null,
      rows: [],
      source: SNAPSHOT_TABLE,
      warnings: [
        error instanceof Error
          ? `${error.message}. Apply migrations 063-065 and run a sales-demand backfill once.`
          : "Top seller snapshot could not be loaded.",
      ],
    };
  }
}

export async function refreshTopSellerProductDesignSnapshot(
  supabase: SupabaseClient,
): Promise<TopSellerSnapshotRefreshResult> {
  const [reorderData, variantRows, demandRows, setupData] = await Promise.all([
    getPurchasingDecisionData({
      limit: null,
      round10: "all",
      visibility: "all",
    }),
    fetchAll<VariantMetadataRow>("Product variant metadata", (from, to) =>
      supabase
        .from("product_variants")
        .select(
          "sku,variant_title,option1_name,option1_value,option2_name,option2_value,option3_name,option3_value",
        )
        .order("sku", { ascending: true })
        .range(from, to),
    ),
    fetchAll<DemandSnapshotRow>("Demand index snapshot", (from, to) =>
      supabase
        .from("demand_index_current")
        .select(
          "sku,sold_30,sold_90,total_sale,avg_daily_30,avg_daily_90,demand_index_hm",
        )
        .order("sku", { ascending: true })
        .range(from, to),
    ),
    getPurchasingSetupData(),
  ]);

  if (reorderData.mode !== "supabase") {
    throw new Error("Reorder Planning data is unavailable; Top Seller snapshot was not replaced.");
  }

  const catalogLines = reorderData.lines;
  if (catalogLines.length === 0) {
    throw new Error("No Reorder Planning lines were found; Top Seller snapshot was not replaced.");
  }

  const variantsBySku = new Map(
    variantRows
      .map((row) => [compactText(row.sku), row] as const)
      .filter(([sku]) => Boolean(sku)),
  );
  const demandBySku = new Map(
    demandRows
      .map((row) => [compactText(row.sku), row] as const)
      .filter(([sku]) => Boolean(sku)),
  );
  const categoryByTag = new Map(
    setupData.tags
      .filter((tag) => tag.isActive)
      .map((tag) => [tag.tag.toLowerCase(), compactText(tag.category) || "Uncategorized"]),
  );
  const groups = new Map<string, GroupAccumulator>();

  for (const line of catalogLines) {
    const variant = variantsBySku.get(line.sku);
    const color = variantColor(variant, line.mainName);
    const designName = stripTrailingColor(line.mainName, color) || line.mainName;
    const category =
      line.tags.map((tag) => categoryByTag.get(tag.toLowerCase())).find(Boolean) ||
      "Uncategorized";
    const groupKey = [
      normalizedGroupKeyPart(category),
      normalizedGroupKeyPart(designName),
      normalizedGroupKeyPart(color),
    ].join("::");
    const demand = demandBySku.get(line.sku);
    const group =
      groups.get(groupKey) ??
      {
        category,
        color,
        demandIndex30: 0,
        demandIndex90: 0,
        demandIndexLifetime: 0,
        designName,
        imageUrl: line.imageUrl,
        itemStatuses: new Set<string>(),
        skus: new Set<string>(),
        sold30: 0,
        sold90: 0,
        suppliers: new Set<string>(),
        tags: new Set<string>(),
        totalSale: 0,
        visibilities: new Set<string>(),
      };

    group.demandIndex30 += numeric(demand?.avg_daily_30);
    group.demandIndex90 += numeric(demand?.avg_daily_90);
    group.demandIndexLifetime += Math.max(0, numeric(demand?.demand_index_hm));
    group.sold30 += numeric(demand?.sold_30);
    group.sold90 += numeric(demand?.sold_90);
    group.totalSale += numeric(demand?.total_sale);
    group.skus.add(line.sku);
    if (line.itemStatus) {
      group.itemStatuses.add(line.itemStatus);
    }
    group.visibilities.add(line.hidden ? "hidden" : "active");
    if (line.supplier) {
      group.suppliers.add(line.supplier);
    }
    for (const tag of line.tags) {
      if (tag) {
        group.tags.add(tag);
      }
    }
    if (!group.imageUrl && line.imageUrl) {
      group.imageUrl = line.imageUrl;
    }
    groups.set(groupKey, group);
  }

  const snapshotToken = randomUUID();
  const refreshedAt = new Date().toISOString();
  const rows = Array.from(groups.entries()).map(([groupKey, group]) => ({
    category: group.category,
    color: group.color,
    demand_index_30: group.demandIndex30,
    demand_index_90: group.demandIndex90,
    demand_index_lifetime: group.demandIndexLifetime,
    design_name: group.designName,
    group_key: groupKey,
    image_url: group.imageUrl,
    item_statuses: Array.from(group.itemStatuses).sort((a, b) => a.localeCompare(b)),
    refreshed_at: refreshedAt,
    sku_count: group.skus.size,
    snapshot_token: snapshotToken,
    sold_30: group.sold30,
    sold_90: group.sold90,
    suppliers: Array.from(group.suppliers).sort((a, b) => a.localeCompare(b)),
    tags: Array.from(group.tags).sort((a, b) => a.localeCompare(b)),
    total_sale: group.totalSale,
    visibilities: Array.from(group.visibilities).sort((a, b) => a.localeCompare(b)),
  }));

  for (let index = 0; index < rows.length; index += UPSERT_SIZE) {
    const { error } = await supabase
      .from(SNAPSHOT_TABLE)
      .upsert(rows.slice(index, index + UPSERT_SIZE), { onConflict: "group_key" });
    if (error) {
      throw new Error(
        `Top Seller snapshot upsert failed. Apply migrations 063-065 first: ${error.message}`,
      );
    }
  }

  const { error: staleDeleteError } = await supabase
    .from(SNAPSHOT_TABLE)
    .delete()
    .neq("snapshot_token", snapshotToken);
  if (staleDeleteError) {
    throw new Error(`Top Seller stale-row cleanup failed: ${staleDeleteError.message}`);
  }

  return {
    groupCount: rows.length,
    refreshedAt,
    skuCount: catalogLines.length,
  };
}
