import "server-only";

import { getCostPriceMonitorData, type CostPriceMonitorRow } from "@/lib/cost-price-monitor";
import { excelSupplierMap } from "@/lib/excel-supplier-map";
import { getPurchasingSetupData } from "@/lib/purchasing-setup";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

const PAGE_SIZE = 1000;
export const STOCK_VALUE_COST_CUTOFF_DATE = "2026-04-01";

type InventoryRow = {
  on_hand: number | string | null;
  sku: string | null;
};

type ProductRelation = {
  product_title: string | null;
  product_type: string | null;
  tags: string[] | null;
  vendor: string | null;
};

type VariantRow = {
  option1_value?: string | null;
  option2_value?: string | null;
  option3_value?: string | null;
  products: ProductRelation | ProductRelation[] | null;
  sku: string | null;
  variant_title: string | null;
};

type DecisionControlRow = {
  sku: string | null;
  supplier_override: string | null;
};

type ManualSupplierRow = {
  sku: string | null;
  supplier: string | null;
};

export type StockValueCostStatus =
  | "Manual override"
  | "Recent avg"
  | "Latest cost fallback"
  | "Missing cost"
  | "Invalid cost"
  | "Missing supplier"
  | "Uncategorized";

export type StockValueSummary = {
  costCoveragePercent: number;
  estimatedStockValue: number;
  missingCostQty: number;
  totalCurrentQty: number;
  valuedQty: number;
};

export type StockValueMixRow = {
  costCoveragePercent: number;
  currentQty: number;
  estimatedStockValue: number;
  label: string;
  missingCostQty: number;
  percentOfTotalEstimatedValue: number;
  valuedQty: number;
};

export type MissingCostSkuRow = {
  category: string;
  currentQty: number;
  productName: string;
  sku: string;
  status: StockValueCostStatus;
  supplier: string;
  variantTitle: string;
};

export type StockValueData = {
  categoryMix: StockValueMixRow[];
  missingCostSkus: MissingCostSkuRow[];
  summary: StockValueSummary;
  supplierMix: StockValueMixRow[];
  warnings: string[];
};

export function effectiveSkuPurchaseCostMap(rows: CostPriceMonitorRow[]) {
  const costBySku = new Map<
    string,
    {
      source: CostPriceMonitorRow["skuDetails"][number]["effectivePurchasePriceSource"];
      unitCost: number;
    }
  >();
  for (const row of rows) {
    for (const detail of row.skuDetails) {
      costBySku.set(detail.sku, {
        source: detail.effectivePurchasePriceSource,
        unitCost: detail.effectivePurchasePrice,
      });
    }
  }
  return costBySku;
}

const excelSupplierBySku = new Map(excelSupplierMap.map((row) => [row.sku, row.supplierName]));

function compactText(value: string | null | undefined) {
  return value?.trim() || "";
}

function numeric(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function firstProduct(row: VariantRow) {
  return Array.isArray(row.products) ? row.products[0] : row.products;
}

async function fetchAll<T>(
  label: string,
  queryForRange: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
  warnings: string[],
) {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await queryForRange(from, from + PAGE_SIZE - 1);
    if (error) {
      warnings.push(`${label}: ${error.message}`);
      return rows;
    }
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE_SIZE) {
      return rows;
    }
  }
}

function canonicalSupplier(value: string, aliases: Map<string, string>) {
  return aliases.get(value.toLowerCase()) ?? value;
}

function buildSupplierAliases(activeSupplierNames: string[]) {
  const aliases = new Map<string, string>();
  for (const supplier of activeSupplierNames) {
    aliases.set(supplier.toLowerCase(), supplier);
  }
  for (const row of excelSupplierMap) {
    const supplier = compactText(row.supplierName);
    if (supplier) {
      aliases.set(supplier.toLowerCase(), aliases.get(supplier.toLowerCase()) ?? supplier);
    }
  }
  return aliases;
}

function resolvedSupplier({
  aliases,
  control,
  manualSupplier,
  shopifyVendor,
  sku,
}: {
  aliases: Map<string, string>;
  control: DecisionControlRow | undefined;
  manualSupplier: string | undefined;
  shopifyVendor: string;
  sku: string;
}) {
  const supplier =
    compactText(control?.supplier_override) ||
    compactText(manualSupplier) ||
    compactText(excelSupplierBySku.get(sku)) ||
    compactText(shopifyVendor);
  return supplier ? canonicalSupplier(supplier, aliases) : "Unmapped";
}

function variantOptionText(row: VariantRow | undefined) {
  const values = [row?.variant_title, row?.option1_value, row?.option2_value, row?.option3_value]
    .map(compactText)
    .filter((value) => value && value !== "Default Title");
  return Array.from(new Set(values)).join(" / ");
}

function stockValueCostStatus(
  source: CostPriceMonitorRow["skuDetails"][number]["effectivePurchasePriceSource"] | undefined,
  cost: number | undefined,
): StockValueCostStatus {
  if (cost !== undefined && (!Number.isFinite(cost) || cost < 0)) {
    return "Invalid cost";
  }
  if (cost === undefined || cost <= 0 || source === "missing") {
    return "Missing cost";
  }
  if (source === "manual") {
    return "Manual override";
  }
  if (source === "recent_avg") {
    return "Recent avg";
  }
  if (source === "latest_fallback") {
    return "Latest cost fallback";
  }
  return "Missing cost";
}

function aggregateMix(rows: Array<{ currentQty: number; estimatedStockValue: number | null; key: string }>) {
  const totalEstimatedValue = rows.reduce((sum, row) => sum + (row.estimatedStockValue ?? 0), 0);
  const byKey = new Map<string, Omit<StockValueMixRow, "costCoveragePercent" | "percentOfTotalEstimatedValue">>();

  for (const row of rows) {
    const existing =
      byKey.get(row.key) ??
      {
        currentQty: 0,
        estimatedStockValue: 0,
        label: row.key,
        missingCostQty: 0,
        valuedQty: 0,
      };
    existing.currentQty += row.currentQty;
    if (row.estimatedStockValue === null) {
      existing.missingCostQty += row.currentQty;
    } else {
      existing.valuedQty += row.currentQty;
      existing.estimatedStockValue += row.estimatedStockValue;
    }
    byKey.set(row.key, existing);
  }

  return [...byKey.values()]
    .map((row) => ({
      ...row,
      costCoveragePercent: row.currentQty > 0 ? (row.valuedQty / row.currentQty) * 100 : 0,
      percentOfTotalEstimatedValue: totalEstimatedValue > 0 ? (row.estimatedStockValue / totalEstimatedValue) * 100 : 0,
    }))
    .sort((a, b) => b.estimatedStockValue - a.estimatedStockValue || b.currentQty - a.currentQty || a.label.localeCompare(b.label));
}

export async function getDashboardStockValueData(): Promise<StockValueData> {
  const supabase = getSupabaseServiceClient();
  const warnings: string[] = [];
  if (!supabase) {
    return {
      categoryMix: [],
      missingCostSkus: [],
      summary: {
        costCoveragePercent: 0,
        estimatedStockValue: 0,
        missingCostQty: 0,
        totalCurrentQty: 0,
        valuedQty: 0,
      },
      supplierMix: [],
      warnings: ["Supabase service client is not configured."],
    };
  }

  const [inventoryRows, variantRows, costMonitorData, controlRows, manualSupplierRows, setupData] = await Promise.all([
    fetchAll<InventoryRow>(
      "Current inventory",
      (from, to) => supabase.from("current_inventory_by_sku").select("sku,on_hand").order("sku", { ascending: true }).range(from, to),
      warnings,
    ),
    fetchAll<VariantRow>(
      "Product variants",
      (from, to) =>
        supabase
          .from("product_variants")
          .select("sku,variant_title,option1_value,option2_value,option3_value,products(product_title,product_type,tags,vendor,status)")
          .order("sku", { ascending: true })
          .range(from, to),
      warnings,
    ),
    getCostPriceMonitorData({ exportAll: true, visibility: "all" }),
    fetchAll<DecisionControlRow>(
      "Purchasing decision controls",
      (from, to) => supabase.from("purchasing_decision_controls").select("sku,supplier_override").order("sku", { ascending: true }).range(from, to),
      warnings,
    ),
    fetchAll<ManualSupplierRow>(
      "Manual supplier mappings",
      (from, to) => supabase.from("manual_supplier_mappings").select("sku,supplier").order("sku", { ascending: true }).range(from, to),
      warnings,
    ),
    getPurchasingSetupData(),
  ]);
  warnings.push(...(costMonitorData.warnings ?? []).map((warning) => `Cost Price Monitor: ${warning}`));

  const stockBySku = new Map<string, number>();
  for (const row of inventoryRows) {
    const sku = compactText(row.sku);
    const qty = numeric(row.on_hand);
    if (sku && qty > 0) {
      stockBySku.set(sku, (stockBySku.get(sku) ?? 0) + qty);
    }
  }

  const variantsBySku = new Map<string, VariantRow>();
  for (const row of variantRows) {
    const sku = compactText(row.sku);
    if (sku) {
      variantsBySku.set(sku, row);
    }
  }

  const controlsBySku = new Map<string, DecisionControlRow>();
  for (const row of controlRows) {
    const sku = compactText(row.sku);
    if (sku) {
      controlsBySku.set(sku, row);
    }
  }
  const manualSupplierBySku = new Map(
    manualSupplierRows
      .map((row) => [compactText(row.sku), compactText(row.supplier)] as const)
      .filter(([sku, supplier]) => Boolean(sku && supplier)),
  );
  const supplierAliases = buildSupplierAliases(setupData.suppliers.filter((supplier) => supplier.isActive).map((supplier) => supplier.supplierName));

  const costBySku = effectiveSkuPurchaseCostMap(costMonitorData.rows);

  const detailRows = [...stockBySku.entries()].map(([sku, currentQty]) => {
    const variant = variantsBySku.get(sku);
    const product = variant ? firstProduct(variant) : null;
    const category = compactText(product?.product_type) || "Uncategorized";
    const supplier = resolvedSupplier({
      aliases: supplierAliases,
      control: controlsBySku.get(sku),
      manualSupplier: manualSupplierBySku.get(sku),
      shopifyVendor: compactText(product?.vendor),
      sku,
    });
    const costState = costBySku.get(sku);
    const unitCost = costState?.unitCost;
    const estimatedStockValue = unitCost !== undefined && Number.isFinite(unitCost) && unitCost > 0 ? currentQty * unitCost : null;
    const status = stockValueCostStatus(costState?.source, unitCost);

    return {
      category,
      currentQty,
      estimatedStockValue,
      productName: compactText(product?.product_title) || sku,
      sku,
      status,
      supplier,
      variantTitle: variantOptionText(variant),
    };
  });

  const totalCurrentQty = detailRows.reduce((sum, row) => sum + row.currentQty, 0);
  const valuedQty = detailRows.reduce((sum, row) => (row.estimatedStockValue === null ? sum : sum + row.currentQty), 0);
  const estimatedStockValue = detailRows.reduce((sum, row) => sum + (row.estimatedStockValue ?? 0), 0);
  const missingCostQty = totalCurrentQty - valuedQty;

  return {
    categoryMix: aggregateMix(detailRows.map((row) => ({ ...row, key: row.category }))),
    missingCostSkus: detailRows
      .filter((row) => row.estimatedStockValue === null)
      .sort((a, b) => b.currentQty - a.currentQty || a.sku.localeCompare(b.sku)),
    summary: {
      costCoveragePercent: totalCurrentQty > 0 ? (valuedQty / totalCurrentQty) * 100 : 0,
      estimatedStockValue,
      missingCostQty,
      totalCurrentQty,
      valuedQty,
    },
    supplierMix: aggregateMix(detailRows.map((row) => ({ ...row, key: row.supplier }))),
    warnings,
  };
}
