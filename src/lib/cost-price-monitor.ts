import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { excelSupplierMap } from "@/lib/excel-supplier-map";
import { getPurchasingSetupData } from "@/lib/purchasing-setup";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

const PAGE_SIZE = 1000;
export const COST_PRICE_MONITOR_PAGE_SIZE = 100;
export const AVG_PURCHASE_COST_CUTOFF_DATE = "2026-04-01";
export const LOW_MARGIN_WARNING_PCT = 35;
export const LOW_MARGIN_CRITICAL_PCT = 20;
export const FIXED_LANDCOST_ESTIMATE = 120;
const NO_RECENT_PO_DAYS = 180;
const SIZE_PATTERN = /\s*\/\s*(?:2XS|XXS|XS|S|M|L|XL|2XL|XXL|3XL|XXXL|S\/M|L\/XL|\d{1,2}|K\d+)\s*$/i;
const SUPPLIER_ALIASES: Record<string, string> = {
  "twins phuket": "SSTWINPHUKET001",
};

type ProductRelation = {
  product_image_url?: string | null;
  product_title: string | null;
  product_type?: string | null;
  tags: string[] | null;
  vendor: string | null;
};

type VariantRow = {
  option1_name?: string | null;
  option1_value?: string | null;
  option2_name?: string | null;
  option2_value?: string | null;
  option3_name?: string | null;
  option3_value?: string | null;
  price: number | string | null;
  products: ProductRelation | ProductRelation[] | null;
  sku: string | null;
  variant_image_url?: string | null;
  variant_title: string | null;
};

type InventoryRow = {
  on_hand: number | string | null;
  sku: string | null;
};

type ManualSupplierRow = {
  sku: string | null;
  supplier: string | null;
};

type DecisionControlRow = {
  hide_from_purchasing: boolean | null;
  main_name_override: string | null;
  product_name_override: string | null;
  sku: string | null;
  supplier_override: string | null;
  tags_override: string[] | null;
};

type OverrideRow = {
  category?: string | null;
  color?: string | null;
  created_at: string | null;
  group_key?: string | null;
  id: string;
  main_name?: string | null;
  manual_landed_cost: number | string | null;
  manual_purchase_price: number | string | null;
  manual_selling_price: number | string | null;
  note: string | null;
  product_group?: string | null;
  scope?: "sku" | "group_default" | string | null;
  sku?: string | null;
  supplier?: string | null;
  updated_at: string | null;
  updated_by: string | null;
};

type PoLineRow = {
  cancelled_qty: number | string | null;
  created_at: string | null;
  landed_unit_cost?: number | string | null;
  line_status: string | null;
  ordered_qty: number | string | null;
  po_id: string | null;
  po_orders:
    | {
        cancelled_at: string | null;
        created_at: string | null;
        po_date: string | null;
        po_id: string | null;
        po_title: string | null;
        quotation_reference?: string | null;
        rqq_id: string | null;
        supplier_invoice_no?: string | null;
        updated_at: string | null;
        work_status: string | null;
      }
    | {
        cancelled_at: string | null;
        created_at: string | null;
        po_date: string | null;
        po_id: string | null;
        po_title: string | null;
        quotation_reference?: string | null;
        rqq_id: string | null;
        supplier_invoice_no?: string | null;
        updated_at: string | null;
        work_status: string | null;
      }[]
    | null;
  product_title_snapshot: string | null;
  sku: string | null;
  unit_price: number | string | null;
  updated_at: string | null;
  variant_title_snapshot: string | null;
};

type SkuPlanningMeta = {
  category: string;
  color: string;
  groupKey: string;
  hidden: boolean;
  mainName: string;
  productGroup: string;
  productName: string;
  sellingPrice: number;
  sku: string;
  supplier: string;
  tags: string[];
  variantTitle: string;
};

type GroupAccumulator = {
  categoryCounts: Map<string, number>;
  color: string;
  groupKey: string;
  hiddenSkuCount: number;
  latestPoId: string;
  latestTimestamp: number;
  latestLine: PoLineRow | null;
  mainName: string;
  productGroupCounts: Map<string, number>;
  purchaseStockValue: number;
  landedStockValue: number;
  sellingValue: number;
  skuVariants: Map<string, string>;
  skuDetails: CostPriceMonitorSkuDetail[];
  stockQty: number;
  supplierCounts: Map<string, number>;
  imageUrl: string;
};

type SkuAccumulator = {
  landedDenominator: number;
  landedNumerator: number;
  latestLine: PoLineRow | null;
  latestTimestamp: number;
  lines: Array<{ line: PoLineRow; qty: number; timestamp: number }>;
  recentPurchaseDenominator: number;
  recentPurchaseNumerator: number;
};

type ManualOverride = {
  manualLandedCost: number | null;
  manualPurchasePrice: number | null;
  manualSellingPrice: number | null;
  note: string;
};

export type CostPriceMonitorSkuDetail = {
  currentQty: number;
  effectiveLandedCost: number;
  effectiveLandedCostSource: "actual" | "manual" | "missing";
  effectivePurchasePrice: number;
  effectivePurchasePriceSource: "recent_avg" | "latest_fallback" | "manual" | "missing";
  effectiveSellingPrice: number;
  effectiveSellingPriceSource: "actual" | "manual" | "missing";
  latestPurchasePrice: number;
  manualLandedCost: number | null;
  manualPurchasePrice: number | null;
  manualSellingPrice: number | null;
  marginPct: number | null;
  recentAveragePurchasePrice: number;
  shopifySellingPrice: number;
  sku: string;
  variantTitle: string;
};

export type CostPriceMonitorFilters = {
  category?: string | string[];
  exportAll?: boolean | string | string[];
  group?: string | string[];
  lowMarginOnly?: boolean | string | string[];
  missingCostOnly?: boolean | string | string[];
  page?: number | string | string[];
  poStatus?: string | string[];
  q?: string | string[];
  selected?: string | string[];
  sort?: string | string[];
  supplier?: string | string[];
  direction?: string | string[];
  visibility?: string | string[];
};

type CleanCostPriceMonitorFilters = {
  category: string;
  direction: string;
  exportAll: boolean;
  group: string;
  lowMarginOnly: boolean;
  missingCostOnly: boolean;
  page: number;
  poStatus: string;
  q: string;
  selectedGroupKeys: string[];
  sort: string;
  suppliers: string[];
  visibility: "active" | "hidden" | "all";
};

export type CostPriceMonitorRow = {
  averageLandedCost: number;
  averagePurchasePrice: number;
  averagePurchasePriceSource: "recent_avg" | "latest_fallback" | "manual" | "missing";
  badges: string[];
  category: string;
  color: string;
  costBasis: number;
  groupKey: string;
  href: string;
  imageUrl: string;
  latestInvoiceQuoteReference: string;
  latestLandedCost: number;
  latestLandedCostSource: "actual" | "manual" | "missing";
  latestPoId: string;
  latestPoStatus: string;
  latestPurchaseDate: string;
  latestPurchasePrice: number;
  latestPurchasePriceSource: "actual" | "manual" | "missing";
  mainName: string;
  manualLandedCost: number | null;
  manualPurchasePrice: number | null;
  manualSellingPrice: number | null;
  marginPct: number | null;
  note: string;
  productGroup: string;
  rollupMode: "stock_weighted" | "no_stock_fallback";
  sellingPrice: number;
  sellingPriceSource: "actual" | "manual" | "missing";
  skuCount: number;
  skuDetails: CostPriceMonitorSkuDetail[];
  skuList: string;
  skuSummary: string;
  stockQty: number;
  supplier: string;
  visibility: "active" | "hidden";
};

export type CostPriceMonitorData = {
  categoryOptions: string[];
  debugCounts: {
    afterMissingCostFilterRows: number;
    afterSupplierFilterRows: number;
    afterVisibilityFilterRows: number;
    baseProductRows: number;
    finalTableRows: number;
    matchedOverrideRows: number;
    orphanOverrideRows: number;
    orphanOverrideSample: string[];
    overrideRows: number;
  };
  filters: CleanCostPriceMonitorFilters;
  groupOptions: string[];
  overrideReady: boolean;
  page: number;
  pageCount: number;
  pageSize: number;
  poStatusOptions: string[];
  rows: CostPriceMonitorRow[];
  sortDirection: "asc" | "desc";
  sortKey: string;
  supplierOptions: string[];
  summary: {
    lowMarginGroups: number;
    manualCostGroups: number;
    missingCostGroups: number;
    totalGroups: number;
  };
  totalRows: number;
  warnings: string[];
};

type BuildRowsResult = {
  debugCounts: Pick<
    CostPriceMonitorData["debugCounts"],
    "baseProductRows" | "finalTableRows" | "matchedOverrideRows" | "orphanOverrideRows" | "orphanOverrideSample" | "overrideRows"
  >;
  rows: CostPriceMonitorRow[];
};

const excelSupplierBySku = new Map(excelSupplierMap.map((row) => [row.sku, row]));

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
];
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
  RED: "Red",
  RD: "Red",
  WHT: "White",
  WH: "White",
  WT: "White",
  YEL: "Yellow",
};
const SIZE_WORDS = new Set([
  "2XS",
  "XXS",
  "XS",
  "S",
  "SM",
  "M",
  "L",
  "XL",
  "XXL",
  "2XL",
  "XXXL",
  "3XL",
  "4XL",
  "S/M",
  "L/XL",
  "6",
  "8",
  "10",
  "12",
  "14",
  "16",
  "18",
  "OZ",
  "K1",
  "K2",
  "K3",
  "K4",
]);

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function compactText(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function statusKey(value: string | null | undefined) {
  return compactText(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function isCancelledStatus(value: string | null | undefined) {
  return ["cancelled", "canceled", "void", "voided", "deleted"].includes(statusKey(value));
}

function firstProduct(row: VariantRow) {
  return Array.isArray(row.products) ? row.products[0] : row.products;
}

function productName(row: VariantRow) {
  const product = firstProduct(row);
  const title = compactText(product?.product_title);
  const variant = compactText(row.variant_title);
  if (!variant || variant === "Default Title") {
    return title || compactText(row.sku);
  }
  return title ? `${title} / ${variant}` : variant;
}

function mainNameFromVariant(row: VariantRow) {
  const product = firstProduct(row);
  return compactText(product?.product_title) || productName(row).replace(SIZE_PATTERN, "");
}

function mainNameFromPoLine(line: PoLineRow) {
  return (
    compactText(line.product_title_snapshot) ||
    compactText(line.variant_title_snapshot).replace(SIZE_PATTERN, "") ||
    compactText(line.sku)
  );
}

function normalizedTokens(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_/|()[\],.-]+/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function normalizeGroupKeyPart(value: string) {
  return (
    value
      .toLowerCase()
      .replace(SIZE_PATTERN, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, "-") || "unknown"
  );
}

function groupKey(mainName: string, color: string) {
  return `${normalizeGroupKeyPart(mainName)}::${normalizeGroupKeyPart(color)}`;
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
    const slashParts: string[] = trimmed
      .split(/\s*[/|]\s*/)
      .map((part) => normalizeColor(part))
      .filter(Boolean);
    if (slashParts.length > 1) {
      return Array.from(new Set(slashParts)).join("/");
    }
  }

  const normalized = ` ${trimmed.toLowerCase().replace(/[_|-]/g, " ")} `;
  const exactToken = trimmed.toUpperCase().replace(/[^A-Z0-9]+/g, "");
  if (COLOR_CODE_TOKENS[exactToken]) {
    return COLOR_CODE_TOKENS[exactToken];
  }

  const colorMatches = COLOR_TOKENS.filter((color) => {
    const colorNormalized = color.toLowerCase().replace("/", " ");
    return normalized.includes(` ${colorNormalized} `);
  }).map(titleCaseColor);
  if (colorMatches.length > 0) {
    return Array.from(new Set(colorMatches)).slice(0, 2).join("/");
  }

  const codeMatch = normalizedTokens(trimmed.toUpperCase()).find((token) => COLOR_CODE_TOKENS[token]);
  return codeMatch ? COLOR_CODE_TOKENS[codeMatch] : "";
}

function optionColorValue(row: VariantRow) {
  const options = [
    { name: row.option1_name, value: row.option1_value },
    { name: row.option2_name, value: row.option2_value },
    { name: row.option3_name, value: row.option3_value },
  ];
  const colorOption = options.find((option) => /colou?r/i.test(compactText(option.name)));
  if (colorOption) {
    return normalizeColor(compactText(colorOption.value));
  }
  return "";
}

function extractVariantColor(row: VariantRow) {
  const product = firstProduct(row);
  const explicitColor = optionColorValue(row);
  if (explicitColor) {
    return explicitColor;
  }

  const optionValues = [row.option1_value, row.option2_value, row.option3_value].map(compactText).filter(Boolean);
  const optionColor = optionValues.map(normalizeColor).find(Boolean);
  if (optionColor) {
    return optionColor;
  }

  const fallback = [row.variant_title, row.sku, product?.product_title].map(compactText).find((value) => {
    const tokens = normalizedTokens(value.toUpperCase());
    return tokens.some((token) => !SIZE_WORDS.has(token));
  });
  return fallback ? normalizeColor(fallback) || "No color" : "No color";
}

function extractPoLineColor(line: PoLineRow) {
  return (
    normalizeColor(compactText(line.variant_title_snapshot)) ||
    normalizeColor(compactText(line.sku)) ||
    normalizeColor(compactText(line.product_title_snapshot)) ||
    "No color"
  );
}

function stripTrailingColor(value: string, color: string) {
  if (!color || color === "No color") {
    return value;
  }
  const escapedColors = color
    .split("/")
    .map((part) => part.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .filter(Boolean);
  if (escapedColors.length === 0) {
    return value;
  }
  const colorPattern = escapedColors.join(`\\s*(?:/|\\+|&|and|-)\\s*`);
  const pattern = new RegExp(`\\s*(?:-|/|,)\\s*${colorPattern}\\s*$`, "i");
  return value.replace(pattern, "").trim() || value;
}

function purchaseTimestamp(line: PoLineRow) {
  const order = Array.isArray(line.po_orders) ? line.po_orders[0] : line.po_orders;
  const value =
    order?.po_date ? `${order.po_date}T00:00:00Z` : order?.created_at || order?.updated_at || line.created_at || line.updated_at || "";
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function purchaseDateForAverage(line: PoLineRow) {
  const order = Array.isArray(line.po_orders) ? line.po_orders[0] : line.po_orders;
  return (order?.po_date || order?.created_at || order?.updated_at || line.created_at || line.updated_at || "").slice(0, 10);
}

function isRecentAveragePurchaseLine(line: PoLineRow) {
  const purchaseDate = purchaseDateForAverage(line);
  return purchaseDate >= AVG_PURCHASE_COST_CUTOFF_DATE;
}

function isMissingVariantOverrideTableError(error: { code?: string; message?: string } | null) {
  const message = error?.message ?? "";

  return (
    error?.code === "42P01" ||
    /relation .*cost_price_monitor_variant_overrides.*does not exist/i.test(message)
  );
}

function isPermissionOrRlsError(error: { code?: string; message?: string } | null) {
  return (
    error?.code === "42501" ||
    /row-level security/i.test(error?.message ?? "") ||
    /permission denied/i.test(error?.message ?? "") ||
    /violates row-level security/i.test(error?.message ?? "")
  );
}

function latestPurchaseDate(line: PoLineRow | null) {
  if (!line) {
    return "";
  }
  const order = Array.isArray(line.po_orders) ? line.po_orders[0] : line.po_orders;
  return order?.po_date ?? (order?.created_at ?? line.created_at ?? "").slice(0, 10);
}

function latestReference(line: PoLineRow | null) {
  if (!line) {
    return "";
  }
  const order = Array.isArray(line.po_orders) ? line.po_orders[0] : line.po_orders;
  return (
    compactText(order?.quotation_reference) ||
    compactText(order?.supplier_invoice_no) ||
    compactText(order?.rqq_id) ||
    compactText(order?.po_title) ||
    compactText(order?.po_id)
  );
}

function latestStatus(line: PoLineRow | null) {
  if (!line) {
    return "";
  }
  const order = Array.isArray(line.po_orders) ? line.po_orders[0] : line.po_orders;
  return compactText(order?.work_status) || compactText(line.line_status);
}

function latestPoId(line: PoLineRow | null) {
  if (!line) {
    return "";
  }
  const order = Array.isArray(line.po_orders) ? line.po_orders[0] : line.po_orders;
  return compactText(order?.po_id) || compactText(line.po_id);
}

function validPoLine(line: PoLineRow) {
  const order = Array.isArray(line.po_orders) ? line.po_orders[0] : line.po_orders;
  return Boolean(
    order &&
      !order.cancelled_at &&
      !isCancelledStatus(order.work_status) &&
      !isCancelledStatus(line.line_status) &&
      compactText(line.sku),
  );
}

function weightedAverage(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : 0;
}

function averagePositive(values: number[]) {
  const validValues = values.filter((value) => Number.isFinite(value) && value > 0);
  return validValues.length > 0
    ? validValues.reduce((total, value) => total + value, 0) / validValues.length
    : 0;
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

function optionValue(value: number | string | string[] | undefined) {
  if (typeof value === "number") {
    return String(value);
  }
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function optionValues(value: string | string[] | undefined) {
  const rawValues = Array.isArray(value) ? value : value ? [value] : [];
  return withOptions(rawValues.flatMap((item) => item.split(",")).map((item) => item.trim()));
}

function boolFilter(value: string | string[] | boolean | undefined) {
  if (typeof value === "boolean") {
    return value;
  }
  const raw = optionValue(value);
  return raw === "1" || raw === "true" || raw === "on";
}

function cleanFilters(filters: CostPriceMonitorFilters) {
  const visibility = optionValue(filters.visibility).trim().toLowerCase();
  const cleanVisibility: CleanCostPriceMonitorFilters["visibility"] =
    visibility === "hidden" || visibility === "all" ? visibility : "active";
  return {
    category: optionValue(filters.category).trim(),
    direction: optionValue(filters.direction).trim() || "desc",
    exportAll: boolFilter(filters.exportAll),
    group: optionValue(filters.group).trim(),
    lowMarginOnly: boolFilter(filters.lowMarginOnly),
    missingCostOnly: boolFilter(filters.missingCostOnly),
    page: Math.max(1, Math.round(toNumber(optionValue(filters.page)) || 1)),
    poStatus: optionValue(filters.poStatus).trim(),
    q: optionValue(filters.q).trim(),
    selectedGroupKeys: optionValues(filters.selected),
    sort: optionValue(filters.sort).trim() || "latest_purchase_date",
    suppliers: optionValues(filters.supplier),
    visibility: cleanVisibility,
  };
}

function withOptions(options: string[]) {
  return Array.from(new Set(options.map((item) => item.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  );
}

function buildSupplierAliases(activeSupplierNames: string[]) {
  const aliases = new Map<string, string>();
  for (const supplier of activeSupplierNames) {
    aliases.set(supplier.toLowerCase(), supplier);
  }
  for (const [alias, supplier] of Object.entries(SUPPLIER_ALIASES)) {
    if (activeSupplierNames.some((name) => name.toLowerCase() === supplier.toLowerCase())) {
      aliases.set(alias, supplier);
    }
  }
  for (const row of excelSupplierMap) {
    const excelName = row.supplierName.trim();
    if (excelName) {
      aliases.set(excelName.toLowerCase(), aliases.get(excelName.toLowerCase()) ?? excelName);
    }
  }
  return aliases;
}

function setupSupplierName(value: string, aliases: Map<string, string>) {
  return aliases.get(value.toLowerCase()) ?? value;
}

function planningSupplier({
  activeSupplierNames,
  aliases,
  control,
  manualSupplier,
  sku,
}: {
  activeSupplierNames: Set<string>;
  aliases: Map<string, string>;
  control: DecisionControlRow | undefined;
  manualSupplier: string | undefined;
  sku: string;
}) {
  const override = compactText(control?.supplier_override);
  if (override) {
    return override;
  }
  if (manualSupplier) {
    return setupSupplierName(manualSupplier, aliases);
  }
  const excel = excelSupplierBySku.get(sku);
  if (excel?.supplierName) {
    return setupSupplierName(excel.supplierName, aliases);
  }
  return activeSupplierNames.size ? "Unmapped" : "Unmapped";
}

function categoryFromTags(tags: string[], categoryByTag: Map<string, string>) {
  const categories = withOptions(tags.map((tag) => categoryByTag.get(tag.toLowerCase()) ?? ""));
  return categories.length ? categories.join(", ") : "Uncategorized";
}

function costSource(actual: number, manual: number | null) {
  if ((manual ?? 0) > 0) {
    return "manual" as const;
  }
  if (actual > 0) {
    return "actual" as const;
  }
  return "missing" as const;
}

function landedCostSource(actual: number, manualLandedCost: number | null) {
  if ((manualLandedCost ?? 0) > 0) {
    return "manual" as const;
  }
  if (actual > 0) {
    return "actual" as const;
  }
  return "missing" as const;
}

function displayCost(actual: number, manual: number | null) {
  return (manual ?? 0) > 0 ? manual ?? 0 : actual;
}

function displayLandedCost(actual: number, effectivePurchase: number, manualLandedCost: number | null) {
  if ((manualLandedCost ?? 0) > 0) {
    return effectivePurchase + (manualLandedCost ?? 0);
  }
  return actual;
}

function firstPositive(...values: Array<number | null | undefined>) {
  return values.find((value) => (value ?? 0) > 0) ?? 0;
}

function effectiveAveragePurchasePrice(recentAverage: number, latestPurchase: number, manualPurchasePrice?: number | null) {
  if ((manualPurchasePrice ?? 0) > 0 && Number.isFinite(manualPurchasePrice)) {
    return {
      source: "manual" as const,
      value: manualPurchasePrice ?? 0,
    };
  }
  if (recentAverage > 0 && Number.isFinite(recentAverage)) {
    return {
      source: "recent_avg" as const,
      value: recentAverage,
    };
  }
  if (latestPurchase > 0 && Number.isFinite(latestPurchase)) {
    return {
      source: "latest_fallback" as const,
      value: latestPurchase,
    };
  }
  return {
    source: "missing" as const,
    value: 0,
  };
}

function mostCommon(values: Map<string, number>, fallback: string) {
  return (
    [...values.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? fallback
  );
}

function addCount(map: Map<string, number>, value: string, weight = 1) {
  if (value) {
    map.set(value, (map.get(value) ?? 0) + weight);
  }
}

function emptyAccumulator(meta: SkuPlanningMeta): GroupAccumulator {
  return {
    categoryCounts: new Map([[meta.category, 1]]),
    color: meta.color,
    groupKey: meta.groupKey,
    hiddenSkuCount: 0,
    latestLine: null,
    latestPoId: "",
    latestTimestamp: 0,
    mainName: meta.mainName,
    productGroupCounts: new Map([[meta.productGroup, 1]]),
    landedStockValue: 0,
    purchaseStockValue: 0,
    sellingValue: 0,
    skuDetails: [],
    skuVariants: new Map([[meta.sku, meta.variantTitle || meta.sku]]),
    stockQty: 0,
    supplierCounts: new Map([[meta.supplier, 1]]),
    imageUrl: "",
  };
}

function skuSummary(values: string[]) {
  const cleaned = values.map((value) => value.trim()).filter(Boolean);
  const sizeLike = cleaned.filter((value) => /^(?:2XS|XXS|XS|S|M|L|XL|2XL|XXL|3XL|XXXL|S\/M|L\/XL|\d{1,2}|K\d+)$/i.test(value));
  const source = sizeLike.length >= Math.min(cleaned.length, 3) ? sizeLike : cleaned;
  const unique = withOptions(source);
  if (unique.length <= 6) {
    return unique.join(", ") || `${cleaned.length} SKUs`;
  }
  return `${cleaned.length} SKUs`;
}

function rowSearchText(row: CostPriceMonitorRow) {
  return [
    row.mainName,
    row.color,
    row.skuList,
    row.skuSummary,
    row.supplier,
    row.category,
    row.productGroup,
    row.latestInvoiceQuoteReference,
    row.latestPoStatus,
    row.note,
  ]
    .join(" ")
    .toLowerCase();
}

export function estimatedLandedCost(costBasis: number) {
  return costBasis + FIXED_LANDCOST_ESTIMATE;
}

function sortValue(row: CostPriceMonitorRow, sortKey: string) {
  switch (sortKey) {
    case "category":
      return row.category;
    case "color":
      return row.color;
    case "latest_landed_cost":
      return row.latestLandedCost;
    case "latest_purchase_date":
      return row.latestPurchaseDate ? Date.parse(`${row.latestPurchaseDate}T00:00:00Z`) : 0;
    case "latest_purchase_price":
      return row.latestPurchasePrice;
    case "margin_pct":
      return row.marginPct ?? -999;
    case "stock_qty":
      return row.stockQty;
    case "supplier":
      return row.supplier;
    case "main_name":
    default:
      return row.mainName;
  }
}

function sortRows(rows: CostPriceMonitorRow[], sortKey: string, direction: "asc" | "desc") {
  const multiplier = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const aValue = sortValue(a, sortKey);
    const bValue = sortValue(b, sortKey);
    if (typeof aValue === "number" && typeof bValue === "number") {
      return (aValue - bValue) * multiplier || a.mainName.localeCompare(b.mainName);
    }
    return String(aValue).localeCompare(String(bValue)) * multiplier || a.mainName.localeCompare(b.mainName);
  });
}

function buildBadges(row: Omit<CostPriceMonitorRow, "badges">, latestLandedActual: number) {
  const badges: string[] = [];
  if (row.averagePurchasePrice <= 0) {
    badges.push("Missing cost");
  }
  if (row.averagePurchasePrice <= 0) {
    badges.push("Missing recent cost");
  }
  if (
    row.latestPurchasePriceSource === "manual" ||
    row.latestLandedCostSource === "manual" ||
    row.sellingPriceSource === "manual"
  ) {
    badges.push("Manual cost");
  }
  if (row.sellingPrice <= 0) {
    badges.push("No selling price");
  }
  if (latestLandedActual <= 0) {
    badges.push("No landed cost");
  }
  if (row.marginPct !== null && row.marginPct < LOW_MARGIN_CRITICAL_PCT) {
    badges.push("Critical margin");
  } else if (row.marginPct !== null && row.marginPct < LOW_MARGIN_WARNING_PCT) {
    badges.push("Low margin");
  }
  if (!row.latestPurchaseDate) {
    badges.push("No recent PO");
  } else {
    const ageDays = (Date.now() - Date.parse(`${row.latestPurchaseDate}T00:00:00Z`)) / 86_400_000;
    if (ageDays > NO_RECENT_PO_DAYS) {
      badges.push("No recent PO");
    }
  }
  return badges;
}

function applyFilters(rows: CostPriceMonitorRow[], filters: ReturnType<typeof cleanFilters>) {
  const suppliers = new Set(filters.suppliers.map((supplier) => supplier.toLowerCase()));
  const category = filters.category.toLowerCase();
  const group = filters.group.toLowerCase();
  const poStatus = filters.poStatus.toLowerCase();
  const terms = filters.q
    .toLowerCase()
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean);

  return rows.filter((row) => {
    if (suppliers.size > 0 && !suppliers.has(row.supplier.toLowerCase())) {
      return false;
    }
    if (category && !row.category.toLowerCase().split(",").map((item) => item.trim()).includes(category)) {
      return false;
    }
    if (group && !row.productGroup.toLowerCase().split(",").map((item) => item.trim()).includes(group)) {
      return false;
    }
    if (poStatus && row.latestPoStatus.toLowerCase() !== poStatus) {
      return false;
    }
    if (filters.missingCostOnly && row.costBasis > 0) {
      return false;
    }
    if (filters.lowMarginOnly && !(row.marginPct !== null && row.marginPct < LOW_MARGIN_WARNING_PCT)) {
      return false;
    }
    if (filters.visibility === "active" && row.visibility !== "active") {
      return false;
    }
    if (filters.visibility === "hidden" && row.visibility !== "hidden") {
      return false;
    }
    if (terms.length && !terms.every((term) => rowSearchText(row).includes(term))) {
      return false;
    }
    return true;
  });
}

function manualOverrideForGroup(
  groupKeyValue: string,
  overridesByGroup: Map<string, OverrideRow>,
): ManualOverride {
  const groupOverride = overridesByGroup.get(groupKeyValue);
  return {
    manualLandedCost: groupOverride?.manual_landed_cost == null ? null : toNumber(groupOverride.manual_landed_cost),
    manualPurchasePrice: groupOverride?.manual_purchase_price == null ? null : toNumber(groupOverride.manual_purchase_price),
    manualSellingPrice: groupOverride?.manual_selling_price == null ? null : toNumber(groupOverride.manual_selling_price),
    note: compactText(groupOverride?.note),
  };
}

function latestPoWeightedCostFromEntries(
  entries: Array<{ line: PoLineRow; qty: number; timestamp: number }>,
  latestLine: PoLineRow | null,
  latestTimestamp: number,
  field: "landed_unit_cost" | "unit_price",
) {
  if (!latestLine) {
    return { actual: 0, denominator: 0 };
  }
  const latestPoIdValue = latestPoId(latestLine);
  const latestLines = entries.filter((entry) =>
    latestPoIdValue ? latestPoId(entry.line) === latestPoIdValue : entry.timestamp === latestTimestamp,
  );
  const numerator = latestLines.reduce((sum, entry) => {
    const value = toNumber(entry.line[field]);
    return value > 0 ? sum + value * entry.qty : sum;
  }, 0);
  const denominator = latestLines.reduce((sum, entry) => {
    const value = toNumber(entry.line[field]);
    return value > 0 ? sum + entry.qty : sum;
  }, 0);
  return { actual: weightedAverage(numerator, denominator), denominator };
}

function buildRows({
  controls,
  inventoryRows,
  manualSupplierRows,
  overrideRows,
  poRows,
  setupData,
  variantRows,
}: {
  controls: Map<string, DecisionControlRow>;
  inventoryRows: InventoryRow[];
  manualSupplierRows: ManualSupplierRow[];
  overrideRows: OverrideRow[];
  poRows: PoLineRow[];
  setupData: Awaited<ReturnType<typeof getPurchasingSetupData>>;
  variantRows: VariantRow[];
}): BuildRowsResult {
  const activeSuppliers = setupData.suppliers.filter((supplier) => supplier.isActive);
  const activeSupplierNames = new Set(activeSuppliers.map((supplier) => supplier.supplierName.toLowerCase()));
  const supplierAliases = buildSupplierAliases(activeSuppliers.map((supplier) => supplier.supplierName));
  const activeTags = setupData.tags.filter((tag) => tag.isActive);
  const activeTagSet = new Set(activeTags.map((tag) => tag.tag.toLowerCase()));
  const categoryByTag = new Map(activeTags.map((tag) => [tag.tag.toLowerCase(), tag.category || "general"]));
  const manualSupplierBySku = new Map(
    manualSupplierRows
      .filter((row) => compactText(row.sku) && compactText(row.supplier))
      .map((row) => [compactText(row.sku), compactText(row.supplier)]),
  );
  const variantsBySku = new Map<string, VariantRow>();
  const stockBySku = new Map<string, number>();
  const overridesByGroup = new Map<string, OverrideRow>();
  const overridesBySku = new Map<string, OverrideRow>();
  const metaBySku = new Map<string, SkuPlanningMeta>();
  const groups = new Map<string, GroupAccumulator>();
  const skuAccumulators = new Map<string, SkuAccumulator>();
  const allSkus = new Set<string>();

  for (const row of variantRows) {
    const sku = compactText(row.sku);
    if (sku) {
      variantsBySku.set(sku, row);
      allSkus.add(sku);
    }
  }
  for (const row of inventoryRows) {
    const sku = compactText(row.sku);
    if (sku) {
      stockBySku.set(sku, (stockBySku.get(sku) ?? 0) + toNumber(row.on_hand));
      allSkus.add(sku);
    }
  }
  for (const row of overrideRows) {
    const key = compactText(row.group_key);
    const sku = compactText(row.sku);
    if (sku && row.scope === "sku") {
      overridesBySku.set(sku, row);
    } else if (key && (!row.scope || row.scope === "group_default")) {
      overridesByGroup.set(key, row);
    } else if (sku) {
      overridesBySku.set(sku, row);
    }
  }
  for (const line of poRows) {
    const sku = compactText(line.sku);
    if (sku) {
      allSkus.add(sku);
    }
  }

  for (const sku of allSkus) {
    const variant = variantsBySku.get(sku);
    const control = controls.get(sku);
    const product = variant ? firstProduct(variant) : null;
    const sourceTags =
      control?.tags_override && control.tags_override.length ? control.tags_override : product?.tags ?? [];
    const tags = sourceTags.filter((tag) => activeTagSet.has(tag.toLowerCase()));
    const color = variant ? extractVariantColor(variant) : "No color";
    const rawMainName = compactText(control?.main_name_override) || (variant ? mainNameFromVariant(variant) : sku);
    const mainName = stripTrailingColor(rawMainName, color);
    const productTitle = compactText(control?.product_name_override) || (variant ? productName(variant) : sku);
    // Reorder Planning treats missing control rows as visible; mirror that fallback here.
    const hidden = Boolean(control?.hide_from_purchasing);
    const supplier = planningSupplier({
      activeSupplierNames,
      aliases: supplierAliases,
      control,
      manualSupplier: manualSupplierBySku.get(sku),
      sku,
    });

    metaBySku.set(sku, {
      category: categoryFromTags(tags, categoryByTag),
      color,
      groupKey: groupKey(mainName, color),
      hidden,
      mainName,
      productGroup: tags.length ? tags.join(", ") : "Unassigned",
      productName: productTitle,
      sellingPrice: toNumber(variant?.price),
      sku,
      supplier,
      tags,
      variantTitle: compactText(variant?.variant_title).replace("Default Title", ""),
    });
  }

  for (const [sku, meta] of metaBySku) {
    const accumulator = groups.get(meta.groupKey) ?? emptyAccumulator(meta);
    accumulator.skuVariants.set(sku, meta.variantTitle || sku);
    if (meta.hidden) {
      accumulator.hiddenSkuCount += 1;
    }
    addCount(accumulator.supplierCounts, meta.supplier);
    addCount(accumulator.categoryCounts, meta.category);
    addCount(accumulator.productGroupCounts, meta.productGroup);
    if (!accumulator.imageUrl) {
      const variant = variantsBySku.get(sku);
      const product = variant ? firstProduct(variant) : null;
      accumulator.imageUrl = compactText(variant?.variant_image_url) || compactText(product?.product_image_url);
    }
    groups.set(meta.groupKey, accumulator);
    skuAccumulators.set(sku, {
      landedDenominator: 0,
      landedNumerator: 0,
      latestLine: null,
      latestTimestamp: 0,
      lines: [],
      recentPurchaseDenominator: 0,
      recentPurchaseNumerator: 0,
    });
  }

  for (const line of poRows) {
    if (!validPoLine(line)) {
      continue;
    }
    const sku = compactText(line.sku);
    const qty = Math.max(toNumber(line.ordered_qty) - toNumber(line.cancelled_qty), 0);
    if (!sku || qty <= 0) {
      continue;
    }
    let meta = metaBySku.get(sku);
    if (!meta) {
      const color = extractPoLineColor(line);
      const mainName = stripTrailingColor(mainNameFromPoLine(line), color);
      meta = {
        category: "Uncategorized",
        color,
        groupKey: groupKey(mainName, color),
        hidden: false,
        mainName,
        productGroup: "Unassigned",
        productName: mainName,
        sellingPrice: 0,
        sku,
        supplier: "Unmapped",
        tags: [],
        variantTitle: compactText(line.variant_title_snapshot),
      };
      metaBySku.set(sku, meta);
    }
    const accumulator = groups.get(meta.groupKey) ?? emptyAccumulator(meta);
    const skuAccumulator =
      skuAccumulators.get(sku) ??
      {
        landedDenominator: 0,
        landedNumerator: 0,
        latestLine: null,
        latestTimestamp: 0,
        lines: [],
        recentPurchaseDenominator: 0,
        recentPurchaseNumerator: 0,
      };
    const unitPrice = toNumber(line.unit_price);
    const landedCost = toNumber(line.landed_unit_cost);
    const timestamp = purchaseTimestamp(line);
    skuAccumulator.lines.push({ line, qty, timestamp });
    if (unitPrice > 0 && isRecentAveragePurchaseLine(line)) {
      skuAccumulator.recentPurchaseNumerator += unitPrice * qty;
      skuAccumulator.recentPurchaseDenominator += qty;
    }
    if (landedCost > 0) {
      skuAccumulator.landedNumerator += landedCost * qty;
      skuAccumulator.landedDenominator += qty;
    }
    if (timestamp >= skuAccumulator.latestTimestamp) {
      skuAccumulator.latestLine = line;
      skuAccumulator.latestTimestamp = timestamp;
    }
    if (timestamp >= accumulator.latestTimestamp) {
      accumulator.latestLine = line;
      accumulator.latestPoId = latestPoId(line);
      accumulator.latestTimestamp = timestamp;
    }
    skuAccumulators.set(sku, skuAccumulator);
    groups.set(meta.groupKey, accumulator);
  }

  for (const [sku, meta] of metaBySku) {
    const accumulator = groups.get(meta.groupKey) ?? emptyAccumulator(meta);
    const skuAccumulator =
      skuAccumulators.get(sku) ??
      {
        landedDenominator: 0,
        landedNumerator: 0,
        latestLine: null,
        latestTimestamp: 0,
        lines: [],
        recentPurchaseDenominator: 0,
        recentPurchaseNumerator: 0,
      };
    const groupManual = manualOverrideForGroup(meta.groupKey, overridesByGroup);
    const skuManual = overridesBySku.get(sku);
    const skuManualPurchase = skuManual?.manual_purchase_price == null ? null : toNumber(skuManual.manual_purchase_price);
    const skuManualLanded = skuManual?.manual_landed_cost == null ? null : toNumber(skuManual.manual_landed_cost);
    const skuManualSelling = skuManual?.manual_selling_price == null ? null : toNumber(skuManual.manual_selling_price);
    const manualPurchase = (skuManualPurchase ?? 0) > 0 ? skuManualPurchase : groupManual.manualPurchasePrice;
    const manualLanded = (skuManualLanded ?? 0) > 0 ? skuManualLanded : groupManual.manualLandedCost;
    const manualSelling = (skuManualSelling ?? 0) > 0 ? skuManualSelling : groupManual.manualSellingPrice;
    const recentAveragePurchasePrice = weightedAverage(
      skuAccumulator.recentPurchaseNumerator,
      skuAccumulator.recentPurchaseDenominator,
    );
    const latestPurchase = latestPoWeightedCostFromEntries(
      skuAccumulator.lines,
      skuAccumulator.latestLine,
      skuAccumulator.latestTimestamp,
      "unit_price",
    );
    const latestLanded = latestPoWeightedCostFromEntries(
      skuAccumulator.lines,
      skuAccumulator.latestLine,
      skuAccumulator.latestTimestamp,
      "landed_unit_cost",
    );
    const averageLanded = weightedAverage(skuAccumulator.landedNumerator, skuAccumulator.landedDenominator);
    const effectivePurchase = effectiveAveragePurchasePrice(
      recentAveragePurchasePrice,
      latestPurchase.actual,
      manualPurchase,
    );
    const landedActual = firstPositive(latestLanded.actual, averageLanded);
    const effectiveLandedCost = displayLandedCost(landedActual, effectivePurchase.value, manualLanded);
    const effectiveLandedCostSource = landedCostSource(landedActual, manualLanded);
    const effectiveSellingPrice = displayCost(meta.sellingPrice, manualSelling);
    const effectiveSellingPriceSource = costSource(meta.sellingPrice, manualSelling);
    const currentQty = stockBySku.get(sku) ?? 0;
    const purchaseStockValue = currentQty > 0 && effectivePurchase.value > 0 ? currentQty * effectivePurchase.value : 0;
    const landedStockValue = currentQty > 0 && effectiveLandedCost > 0 ? currentQty * effectiveLandedCost : 0;
    const sellingValue = currentQty > 0 && effectiveSellingPrice > 0 ? currentQty * effectiveSellingPrice : 0;
    const skuDetail: CostPriceMonitorSkuDetail = {
      currentQty,
      effectiveLandedCost,
      effectiveLandedCostSource,
      effectivePurchasePrice: effectivePurchase.value,
      effectivePurchasePriceSource: effectivePurchase.source,
      effectiveSellingPrice,
      effectiveSellingPriceSource,
      latestPurchasePrice: displayCost(latestPurchase.actual, skuManualPurchase ?? groupManual.manualPurchasePrice),
      manualLandedCost: skuManualLanded,
      manualPurchasePrice: skuManualPurchase,
      manualSellingPrice: skuManualSelling,
      marginPct: effectiveSellingPrice > 0 && effectivePurchase.value > 0 ? ((effectiveSellingPrice - effectivePurchase.value) / effectiveSellingPrice) * 100 : null,
      recentAveragePurchasePrice,
      shopifySellingPrice: meta.sellingPrice,
      sku,
      variantTitle: meta.variantTitle || sku,
    };

    accumulator.stockQty += currentQty;
    accumulator.purchaseStockValue += purchaseStockValue;
    accumulator.landedStockValue += landedStockValue;
    accumulator.sellingValue += sellingValue;
    accumulator.skuDetails.push(skuDetail);
    groups.set(meta.groupKey, accumulator);
  }

  const groupKeys = new Set(groups.keys());
  const skuToGroup = new Map([...metaBySku].map(([sku, meta]) => [sku, meta.groupKey]));
  let matchedOverrideRows = 0;
  const orphanOverrideKeys: string[] = [];

  for (const row of overrideRows) {
    const key = compactText(row.group_key);
    const sku = compactText(row.sku);
    const isMatched = key ? groupKeys.has(key) : Boolean(sku && skuToGroup.has(sku));
    if (isMatched) {
      matchedOverrideRows += 1;
    } else {
      orphanOverrideKeys.push(key || sku);
    }
  }

  const rows = [...groups.values()].map((accumulator) => {
    const skus = [...accumulator.skuVariants.keys()];
    const visibility = skus.length > 0 && accumulator.hiddenSkuCount >= skus.length ? "hidden" : "active";
    const manual = manualOverrideForGroup(accumulator.groupKey, overridesByGroup);
    const rollupMode = accumulator.stockQty > 0 ? "stock_weighted" : "no_stock_fallback";
    const averagePurchase = rollupMode === "stock_weighted"
      ? weightedAverage(accumulator.purchaseStockValue, accumulator.stockQty)
      : averagePositive(accumulator.skuDetails.map((detail) => detail.effectivePurchasePrice));
    const averageLandedCost = rollupMode === "stock_weighted"
      ? weightedAverage(accumulator.landedStockValue, accumulator.stockQty)
      : averagePositive(accumulator.skuDetails.map((detail) => detail.effectiveLandedCost));
    const sellingPrice = rollupMode === "stock_weighted"
      ? weightedAverage(accumulator.sellingValue, accumulator.stockQty)
      : averagePositive(accumulator.skuDetails.map((detail) => detail.effectiveSellingPrice));
    const latestPurchasePrice = firstPositive(...accumulator.skuDetails.map((detail) => detail.latestPurchasePrice));
    const latestLandedCost = firstPositive(...accumulator.skuDetails.map((detail) => detail.effectiveLandedCost));
    const marginPct = rollupMode === "stock_weighted"
      ? accumulator.sellingValue > 0
        ? ((accumulator.sellingValue - accumulator.purchaseStockValue) / accumulator.sellingValue) * 100
        : null
      : sellingPrice > 0 && averagePurchase > 0
        ? ((sellingPrice - averagePurchase) / sellingPrice) * 100
        : null;
    const costBasis = firstPositive(averageLandedCost, averagePurchase);
    const purchaseSourceDetails = rollupMode === "no_stock_fallback"
      ? accumulator.skuDetails.filter((detail) => detail.effectivePurchasePrice > 0)
      : accumulator.skuDetails;
    const averagePurchaseSource = purchaseSourceDetails.length === 0 || purchaseSourceDetails.some((detail) => detail.effectivePurchasePriceSource === "missing")
      ? "missing"
      : purchaseSourceDetails.some((detail) => detail.effectivePurchasePriceSource === "manual")
        ? "manual"
        : purchaseSourceDetails.some((detail) => detail.effectivePurchasePriceSource === "latest_fallback")
        ? "latest_fallback"
        : "recent_avg";
    const rowWithoutBadges = {
      averageLandedCost,
      averagePurchasePrice: averagePurchase,
      averagePurchasePriceSource: averagePurchaseSource,
      category: mostCommon(accumulator.categoryCounts, "Uncategorized"),
      color: accumulator.color,
      costBasis,
      groupKey: accumulator.groupKey,
      href: accumulator.latestPoId ? `/po/${encodeURIComponent(accumulator.latestPoId)}` : "/po",
      latestInvoiceQuoteReference: latestReference(accumulator.latestLine),
      imageUrl: accumulator.imageUrl,
      latestLandedCost,
      latestLandedCostSource: accumulator.skuDetails.some((detail) => detail.effectiveLandedCostSource === "manual") ? "manual" : averageLandedCost > 0 ? "actual" : "missing",
      latestPoId: accumulator.latestPoId,
      latestPoStatus: latestStatus(accumulator.latestLine) || "No PO",
      latestPurchaseDate: latestPurchaseDate(accumulator.latestLine),
      latestPurchasePrice,
      latestPurchasePriceSource: costSource(latestPurchasePrice, manual.manualPurchasePrice),
      mainName: accumulator.mainName,
      manualLandedCost: manual.manualLandedCost,
      manualPurchasePrice: manual.manualPurchasePrice,
      manualSellingPrice: manual.manualSellingPrice,
      marginPct,
      note: manual.note,
      productGroup: mostCommon(accumulator.productGroupCounts, "Unassigned"),
      rollupMode,
      sellingPrice,
      sellingPriceSource: accumulator.skuDetails.some((detail) => detail.effectiveSellingPriceSource === "manual") ? "manual" : sellingPrice > 0 ? "actual" : "missing",
      skuCount: skus.length,
      skuDetails: accumulator.skuDetails.sort((a, b) => b.currentQty - a.currentQty || a.sku.localeCompare(b.sku)),
      skuList: skus.join(", "),
      skuSummary: skuSummary([...accumulator.skuVariants.values()]),
      stockQty: accumulator.stockQty,
      supplier: mostCommon(accumulator.supplierCounts, "Unmapped"),
      visibility,
    } satisfies Omit<CostPriceMonitorRow, "badges">;

    return {
      ...rowWithoutBadges,
      badges: buildBadges(rowWithoutBadges, averageLandedCost),
    } satisfies CostPriceMonitorRow;
  });

  return {
    debugCounts: {
      baseProductRows: groups.size,
      finalTableRows: rows.length,
      matchedOverrideRows,
      orphanOverrideRows: Math.max(overrideRows.length - matchedOverrideRows, 0),
      orphanOverrideSample: withOptions(orphanOverrideKeys).slice(0, 5),
      overrideRows: overrideRows.length,
    },
    rows,
  };
}

export async function getCostPriceMonitorData(filters: CostPriceMonitorFilters = {}): Promise<CostPriceMonitorData> {
  const supabase = getSupabaseServiceClient();
  const clean = cleanFilters(filters);
  const warnings: string[] = [];

  if (!supabase) {
    return {
      categoryOptions: [],
      debugCounts: {
        afterMissingCostFilterRows: 0,
        afterSupplierFilterRows: 0,
        afterVisibilityFilterRows: 0,
        baseProductRows: 0,
        finalTableRows: 0,
        matchedOverrideRows: 0,
        orphanOverrideRows: 0,
        orphanOverrideSample: [],
        overrideRows: 0,
      },
      filters: clean,
      groupOptions: [],
      overrideReady: false,
      page: 1,
      pageCount: 1,
      pageSize: COST_PRICE_MONITOR_PAGE_SIZE,
      poStatusOptions: [],
      rows: [],
      sortDirection: clean.direction === "asc" ? "asc" : "desc",
      sortKey: clean.sort,
      supplierOptions: [],
      summary: { lowMarginGroups: 0, manualCostGroups: 0, missingCostGroups: 0, totalGroups: 0 },
      totalRows: 0,
      warnings: ["Supabase service client is not configured."],
    };
  }

  const [variantRows, inventoryRows, poRows, manualSupplierRows, setupData] = await Promise.all([
    fetchAll<VariantRow>(
      "Product variants",
      (from, to) =>
        supabase
          .from("product_variants")
          .select(
            "sku,variant_title,option1_name,option1_value,option2_name,option2_value,option3_name,option3_value,variant_image_url,price,products(product_title,product_image_url,vendor,tags)",
          )
          .order("sku", { ascending: true })
          .range(from, to),
      warnings,
    ),
    fetchAll<InventoryRow>(
      "Current inventory",
      (from, to) =>
        supabase.from("current_inventory_by_sku").select("sku,on_hand").order("sku", { ascending: true }).range(from, to),
      warnings,
    ),
    fetchAll<PoLineRow>(
      "PO line costs",
      (from, to) =>
        supabase
          .from("po_items")
          .select(
            [
              "po_id",
              "sku",
              "product_title_snapshot",
              "variant_title_snapshot",
              "ordered_qty",
              "cancelled_qty",
              "unit_price",
              "landed_unit_cost",
              "line_status",
              "created_at",
              "updated_at",
              "po_orders!inner(po_id,po_title,po_date,quotation_reference,supplier_invoice_no,rqq_id,work_status,cancelled_at,created_at,updated_at)",
            ].join(","),
          )
          .order("created_at", { ascending: false })
          .range(from, to),
      warnings,
    ),
    fetchAll<ManualSupplierRow>(
      "Manual supplier mappings",
      (from, to) =>
        supabase.from("manual_supplier_mappings").select("sku,supplier").order("sku", { ascending: true }).range(from, to),
      warnings,
    ),
    getPurchasingSetupData(),
  ]);

  const controlResult = await fetchAll<DecisionControlRow>(
    "Purchasing decision controls",
    (from, to) =>
      supabase
        .from("purchasing_decision_controls")
        .select("sku,product_name_override,main_name_override,supplier_override,tags_override,hide_from_purchasing")
        .order("sku", { ascending: true })
        .range(from, to),
    warnings,
  );
  const controls = new Map(
    controlResult.filter((row) => compactText(row.sku)).map((row) => [compactText(row.sku), row]),
  );

  const overrideResult = await (supabase as SupabaseClient)
    .from("cost_price_monitor_overrides")
    .select("id,group_key,main_name,color,supplier,category,product_group,manual_purchase_price,manual_landed_cost,manual_selling_price,note,updated_by,updated_at,created_at")
    .order("updated_at", { ascending: false });
  let overrideReady = !overrideResult.error;
  const overrideRows: OverrideRow[] = overrideReady ? ((overrideResult.data ?? []) as OverrideRow[]) : [];

  const scopedOverrideResult = await (supabase as SupabaseClient)
    .from("cost_price_monitor_variant_overrides")
    .select("id,scope,sku,group_key,manual_purchase_price,manual_landed_cost,manual_selling_price,note,updated_by,updated_at,created_at")
    .order("updated_at", { ascending: false });
  if (scopedOverrideResult.error) {
    overrideReady = false;
    if (isMissingVariantOverrideTableError(scopedOverrideResult.error)) {
      warnings.push("Scoped SKU overrides table is not available yet. Apply migration 060 for SKU-level Cost Price Monitor overrides.");
    } else if (isPermissionOrRlsError(scopedOverrideResult.error)) {
      warnings.push("Scoped SKU overrides could not be read because Supabase denied admin access. Confirm SUPABASE_SERVICE_ROLE_KEY is configured on the server.");
    } else {
      warnings.push(`Scoped SKU overrides could not be read: ${scopedOverrideResult.error.message}`);
    }
  } else {
    overrideRows.push(...((scopedOverrideResult.data ?? []) as OverrideRow[]));
  }

  const legacyOverrideResult = await (supabase as SupabaseClient)
    .from("cost_price_overrides")
    .select("*")
    .order("updated_at", { ascending: false });
  if (!legacyOverrideResult.error) {
    overrideReady = true;
    const groupKeys = new Set(overrideRows.map((row) => compactText(row.group_key)).filter(Boolean));
    for (const legacyRow of (legacyOverrideResult.data ?? []) as OverrideRow[]) {
      const legacyGroupKey = compactText(legacyRow.group_key);
      if (legacyGroupKey) {
        if (!groupKeys.has(legacyGroupKey)) {
          overrideRows.push(legacyRow);
          groupKeys.add(legacyGroupKey);
        }
        continue;
      }
      if (compactText(legacyRow.sku)) {
        overrideRows.push(legacyRow);
      }
    }
  }
  if (!overrideReady) {
    warnings.push("Manual overrides table is not available yet. Apply migration 058 for Cost Price Monitor overrides.");
  }

  const { debugCounts: rowDebugCounts, rows: allRows } = buildRows({
    controls,
    inventoryRows,
    manualSupplierRows,
    overrideRows,
    poRows,
    setupData,
    variantRows,
  });
  if (rowDebugCounts.orphanOverrideRows > 0) {
    warnings.push(
      `Manual overrides not matched to current product rows: ${rowDebugCounts.orphanOverrideRows}${
        rowDebugCounts.orphanOverrideSample.length ? ` (${rowDebugCounts.orphanOverrideSample.join(", ")})` : ""
      }. These saved overrides are kept but hidden from the product table, print, and export.`,
    );
  }
  const supplierOptions = withOptions(allRows.map((row) => row.supplier).filter((supplier) => supplier !== "Unmapped"));
  const categoryOptions = withOptions(allRows.flatMap((row) => row.category.split(",").map((item) => item.trim())));
  const groupOptions = withOptions(allRows.flatMap((row) => row.productGroup.split(",").map((item) => item.trim())));
  const poStatusOptions = withOptions(allRows.map((row) => row.latestPoStatus));
  const afterSupplierFilterRows = applyFilters(allRows, {
    ...clean,
    category: "",
    group: "",
    lowMarginOnly: false,
    missingCostOnly: false,
    poStatus: "",
    q: "",
    visibility: "all",
  }).length;
  const afterVisibilityFilterRows = applyFilters(allRows, {
    ...clean,
    category: "",
    group: "",
    lowMarginOnly: false,
    missingCostOnly: false,
    poStatus: "",
    q: "",
  }).length;
  const afterMissingCostFilterRows = applyFilters(allRows, {
    ...clean,
    category: "",
    group: "",
    lowMarginOnly: false,
    poStatus: "",
    q: "",
  }).length;
  const filteredRows = applyFilters(allRows, clean);
  const selectedSet = new Set(clean.selectedGroupKeys);
  const scopedRows = selectedSet.size > 0 ? filteredRows.filter((row) => selectedSet.has(row.groupKey)) : filteredRows;
  const sortDirection = clean.direction === "asc" ? "asc" : "desc";
  const sortedRows = sortRows(scopedRows, clean.sort, sortDirection);
  const pageCount = Math.max(1, Math.ceil(sortedRows.length / COST_PRICE_MONITOR_PAGE_SIZE));
  const page = Math.min(clean.page, pageCount);
  const start = (page - 1) * COST_PRICE_MONITOR_PAGE_SIZE;
  const rows = clean.exportAll ? sortedRows : sortedRows.slice(start, start + COST_PRICE_MONITOR_PAGE_SIZE);
  const summary = {
    lowMarginGroups: filteredRows.filter((row) => row.marginPct !== null && row.marginPct < LOW_MARGIN_WARNING_PCT).length,
    manualCostGroups: filteredRows.filter((row) => row.badges.includes("Manual cost")).length,
    missingCostGroups: filteredRows.filter((row) => row.costBasis <= 0).length,
    totalGroups: filteredRows.length,
  };

  return {
    categoryOptions,
    debugCounts: {
      ...rowDebugCounts,
      afterMissingCostFilterRows,
      afterSupplierFilterRows,
      afterVisibilityFilterRows,
    },
    filters: clean,
    groupOptions,
    overrideReady,
    page,
    pageCount,
    pageSize: COST_PRICE_MONITOR_PAGE_SIZE,
    poStatusOptions,
    rows,
    sortDirection,
    sortKey: clean.sort,
    supplierOptions,
    summary,
    totalRows: filteredRows.length,
    warnings,
  };
}
