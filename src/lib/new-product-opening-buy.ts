import { getSupabaseServiceClient } from "@/lib/supabase/server";
import {
  matrixItemFamily,
  matrixSectionLabel,
  matrixSectionName,
  sortMatrixSizes,
  type MatrixFamily,
  type MatrixItemLike,
} from "@/lib/po-size-matrix";

export const NEW_PRODUCT_PLAN_STATUSES = [
  "draft",
  "review",
  "approved",
  "po_created",
  "cancelled",
  "launched",
  "closed",
] as const;

export type NewProductPlanStatus = (typeof NEW_PRODUCT_PLAN_STATUSES)[number];

export type NewProductPlanInput = {
  budgetCapThb?: number | null;
  category?: string | null;
  channelFilter?: string | null;
  confidenceFactor: number;
  notes?: string | null;
  planName: string;
  plannedLaunchDate?: string | null;
  riskFactor: number;
  riskReason?: string | null;
  seasonFactor: number;
  supplierCode?: string | null;
  supplierNameSnapshot?: string | null;
  targetCoverageDays: number;
};

export type NewProductPlan = {
  approvedAt: string;
  approvedBy: string;
  budgetCapThb: number;
  category: string;
  channelFilter: string;
  confidenceFactor: number;
  createdAt: string;
  createdBy: string;
  createdByProfile?: {
    displayName: string;
    email: string;
  };
  id: string;
  notes: string;
  planName: string;
  planNumber: string;
  plannedLaunchDate: string;
  poId: string;
  riskFactor: number;
  riskReason: string;
  seasonFactor: number;
  status: NewProductPlanStatus;
  supplierCode: string;
  supplierNameSnapshot: string;
  targetCoverageDays: number;
  updatedAt: string;
};

export type NewProductPlanAuditLog = {
  actionType: string;
  changedAt: string;
  changedBy: string;
  changedByProfile?: {
    displayName: string;
    email: string;
  };
  id: string;
  newValues: unknown;
  note: string;
  oldValues: unknown;
};

export type NewProductPlanDetail = NewProductPlan & {
  auditLogs: NewProductPlanAuditLog[];
  comparables: NewProductPlanComparable[];
  lines: NewProductPlanLine[];
  scenarios: Array<{
    id: string;
    isActive: boolean;
    scenarioName: string;
    scenarioType: string;
  }>;
};

export type NewProductPlanSupplier = {
  supplierCode: string;
  supplierName: string;
};

export type NewProductPlanComparable = {
  comparableProductId: string;
  comparableSku: string | null;
  comparableTitleSnapshot: string;
  createdAt: string;
  id: string;
  imageUrl?: string | null;
  note: string;
  planId: string;
  productType?: string | null;
  variantCount?: number | null;
  weight: number;
};

export type ComparableProductSearchResult = {
  availableInventory: number;
  imageUrl: string;
  matchedExamples: string[];
  productId: string;
  productTitle: string;
  productType: string;
  snapshotTitle: string;
  variantCount: number;
};

export type ComparableProductInput = {
  comparableProductId: string;
  comparableSku?: string | null;
  comparableTitleSnapshot: string;
  note?: string | null;
  weight: number;
};

export type ComparableProductUpdateInput = {
  note?: string | null;
  weight: number;
};

const MAX_COMPARABLE_SEARCH_QUERY_LENGTH = 100;

export type EstimatedComparableSkuDetail = {
  adjustedSuggestedQty: number;
  baseQty: number;
  color: string;
  comparableProduct: string;
  dataStatus: string;
  demandHm: number;
  demandSource: string;
  daysUsed: number;
  family: MatrixFamily;
  finalWeightedIndex: number;
  hasNegativeNetSales: boolean;
  imageUrl: string;
  planningQtySold: number;
  rawTotalSold: number;
  sectionLabel: string;
  sectionName: string;
  sku: string;
  size: string;
  targetCoverageDays: number;
  totalSold: number;
  variantTitle: string;
  weight: number;
  weightedDailyIndex: number;
  weightedContribution: number;
};

export type EstimatedComparableIndexGroup = {
  baseOpeningQtyPreview: number;
  color: string;
  comparableSkuCount: number;
  estimatedOpeningQtyPreview: number;
  family: MatrixFamily;
  factorAdjustedIndex: number;
  imageUrl: string;
  productName: string;
  sectionLabel: string;
  sectionName: string;
  size: string;
  targetCoverageDays: number;
  totalSold: number;
  weightedDailyIndex: number;
};

export type EstimatedComparableDemand = {
  details: EstimatedComparableSkuDetail[];
  groups: EstimatedComparableIndexGroup[];
  summary: {
    comparableCount: number;
    dataSource: "purchasing_decision_demand_hm";
    factorMultiplier: number;
    skusMissingSalesData: number;
    skusWithSalesData: number;
    totalComparableSalesQty: number;
  };
  warnings: string[];
};

export type NewProductPlanLine = {
  colorValue: string;
  demandIndexEstimate: number;
  estimatedCost: number | null;
  estimatedMargin: number;
  estimatedThb: number | null;
  finalQty: number;
  id: string;
  imageUrl: string;
  lockedQty: boolean;
  manualQty: number | null;
  mockupImageUrl: string;
  mockupImageStoragePath: string;
  orderMultiple: number;
  planId: string;
  plannedSku: string;
  productName: string;
  sizeValue: string;
  suggestedOpeningQty: number;
  supplierMoq: number | null;
  unitCost: number | null;
  variantNote: string;
  variantTitle: string;
};

export type NewProductPlanLineInput = {
  lockedQty: boolean;
  manualQty?: number | null;
  orderMultiple: number;
  unitCost?: number | null;
  variantNote?: string | null;
};

export type NewProductPlanLineMetadataInput = {
  colorValue?: string | null;
  imageUrl?: string | null;
  mockupImageStoragePath?: string | null;
  productName?: string | null;
};

export type NewProductPlanDemandControlsInput = {
  channelFilter?: string | null;
  confidenceFactor: number;
  riskFactor: number;
  seasonFactor: number;
};

export type NewProductPlanLineSummary = {
  budgetCapThb: number;
  budgetComparisonNote: string;
  budgetWarning: boolean;
  lineCount: number;
  lockedLineCount: number;
  manualOverrideCount: number;
  totalEstimatedCost: number;
  totalFinalQty: number;
  totalSuggestedQty: number;
};

type PlanRow = {
  approved_at: string | null;
  approved_by: string | null;
  budget_cap_thb: number | string | null;
  category: string | null;
  channel_filter: string | null;
  confidence_factor: number | string | null;
  created_at: string;
  created_by: string | null;
  id: string;
  notes: string | null;
  plan_name: string;
  plan_number: string;
  planned_launch_date: string | null;
  po_id: string | null;
  risk_factor: number | string | null;
  risk_reason: string | null;
  sales_history_end: string | null;
  sales_history_start: string | null;
  season_factor: number | string | null;
  status: string;
  supplier_code: string | null;
  supplier_name_snapshot: string | null;
  target_coverage_days: number | string | null;
  updated_at: string;
};

type ProfileRow = {
  auth_user_id: string | null;
  display_name: string | null;
  email: string | null;
};

type SupplierRow = {
  supplier_code: string | null;
  supplier_name: string | null;
};

type ComparableRow = {
  comparable_product_id: string | null;
  comparable_sku: string | null;
  comparable_title_snapshot: string | null;
  created_at: string;
  id: string;
  note: string | null;
  plan_id: string;
  weight: number | string | null;
};

type ProductRelationRow = {
  id: string | null;
  product_image_url: string | null;
  product_title: string | null;
  product_type: string | null;
};

type VariantSearchRow = {
  id: string | null;
  product_id: string | null;
  sku: string | null;
  variant_image_url: string | null;
  variant_title: string | null;
  products?: ProductRelationRow | ProductRelationRow[] | null;
};

type InventoryRow = {
  available: number | string | null;
  sku: string | null;
};

type ComparableVariantRow = {
  product_id?: string | null;
  option1_value: string | null;
  option2_value: string | null;
  option3_value: string | null;
  sku: string | null;
  variant_image_url?: string | null;
  variant_title: string | null;
  products?: ProductRelationRow | ProductRelationRow[] | null;
};

type DemandIndexRow = {
  demand_index_hm: number | string | null;
  selling_days?: number | string | null;
  sku: string | null;
  total_sale: number | string | null;
};

type DecisionControlDemandRow = {
  demand_index_override: number | string | null;
  sku: string | null;
};

type PlanLineRow = {
  color_value: string | null;
  demand_index_estimate: number | string | null;
  estimated_cost: number | string | null;
  estimated_margin: number | string | null;
  estimated_thb: number | string | null;
  final_qty: number | string | null;
  id: string;
  image_url: string | null;
  locked_qty: boolean | null;
  manual_qty: number | string | null;
  mockup_image_storage_path?: string | null;
  order_multiple: number | string | null;
  plan_id: string;
  planned_sku: string | null;
  product_name: string | null;
  size_value: string | null;
  suggested_opening_qty: number | string | null;
  supplier_moq: number | string | null;
  unit_cost: number | string | null;
  variant_note: string | null;
  variant_title: string | null;
};

function numeric(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function compactText(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function firstProduct(row: { products?: ProductRelationRow | ProductRelationRow[] | null }) {
  return Array.isArray(row.products) ? row.products[0] : row.products;
}

function statusValue(value: string): NewProductPlanStatus {
  return NEW_PRODUCT_PLAN_STATUSES.includes(value as NewProductPlanStatus)
    ? (value as NewProductPlanStatus)
    : "draft";
}

function mapProfiles(rows: ProfileRow[] | null | undefined) {
  return new Map(
    (rows ?? [])
      .filter((row) => row.auth_user_id)
      .map((row) => [
        row.auth_user_id!,
        {
          displayName: row.display_name ?? "",
          email: row.email ?? "",
        },
      ]),
  );
}

function mapPlan(row: PlanRow, profiles = new Map<string, { displayName: string; email: string }>()): NewProductPlan {
  return {
    approvedAt: row.approved_at ?? "",
    approvedBy: row.approved_by ?? "",
    budgetCapThb: numeric(row.budget_cap_thb),
    category: row.category ?? "",
    channelFilter: row.channel_filter ?? "",
    confidenceFactor: row.confidence_factor === null ? 1 : numeric(row.confidence_factor),
    createdAt: row.created_at,
    createdBy: row.created_by ?? "",
    createdByProfile: row.created_by ? profiles.get(row.created_by) : undefined,
    id: row.id,
    notes: row.notes ?? "",
    planName: row.plan_name,
    planNumber: row.plan_number,
    plannedLaunchDate: row.planned_launch_date ?? "",
    poId: row.po_id ?? "",
    riskFactor: row.risk_factor === null ? 1 : numeric(row.risk_factor),
    riskReason: row.risk_reason ?? "",
    seasonFactor: row.season_factor === null ? 1 : numeric(row.season_factor),
    status: statusValue(row.status),
    supplierCode: row.supplier_code ?? "",
    supplierNameSnapshot: row.supplier_name_snapshot ?? "",
    targetCoverageDays: Math.round(numeric(row.target_coverage_days) || 30),
    updatedAt: row.updated_at,
  };
}

function planPayload(input: NewProductPlanInput) {
  return {
    budget_cap_thb: input.budgetCapThb ?? null,
    category: input.category ?? null,
    channel_filter: input.channelFilter ?? null,
    confidence_factor: input.confidenceFactor,
    notes: input.notes ?? null,
    plan_name: input.planName,
    planned_launch_date: input.plannedLaunchDate ?? null,
    risk_factor: input.riskFactor,
    risk_reason: input.riskReason ?? null,
    season_factor: input.seasonFactor,
    supplier_code: input.supplierCode ?? null,
    supplier_name_snapshot: input.supplierNameSnapshot ?? null,
    target_coverage_days: input.targetCoverageDays,
  };
}

function mapComparable(row: ComparableRow): NewProductPlanComparable {
  return {
    comparableProductId: row.comparable_product_id ?? "",
    comparableSku: row.comparable_sku ?? null,
    comparableTitleSnapshot: row.comparable_title_snapshot ?? "",
    createdAt: row.created_at,
    id: row.id,
    note: row.note ?? "",
    planId: row.plan_id,
    weight: numeric(row.weight) || 1,
  };
}

function mapPlanLine(row: PlanLineRow): NewProductPlanLine {
  return {
    colorValue: row.color_value ?? "",
    demandIndexEstimate: numeric(row.demand_index_estimate),
    estimatedCost: row.estimated_cost === null || row.estimated_cost === undefined ? null : Math.max(0, numeric(row.estimated_cost)),
    estimatedMargin: numeric(row.estimated_margin),
    estimatedThb: row.estimated_thb === null || row.estimated_thb === undefined ? null : Math.max(0, numeric(row.estimated_thb)),
    finalQty: Math.max(0, Math.round(numeric(row.final_qty))),
    id: row.id,
    imageUrl: row.image_url ?? "",
    lockedQty: row.locked_qty ?? false,
    manualQty: row.manual_qty === null || row.manual_qty === undefined ? null : Math.max(0, Math.round(numeric(row.manual_qty))),
    mockupImageUrl: "",
    mockupImageStoragePath: row.mockup_image_storage_path ?? "",
    orderMultiple: Math.max(1, Math.round(numeric(row.order_multiple) || 10)),
    planId: row.plan_id,
    plannedSku: row.planned_sku ?? "",
    productName: row.product_name ?? "",
    sizeValue: row.size_value ?? "",
    suggestedOpeningQty: Math.max(0, Math.round(numeric(row.suggested_opening_qty))),
    supplierMoq: row.supplier_moq === null || row.supplier_moq === undefined ? null : Math.max(0, Math.round(numeric(row.supplier_moq))),
    unitCost: row.unit_cost === null || row.unit_cost === undefined ? null : Math.max(0, numeric(row.unit_cost)),
    variantNote: row.variant_note ?? "",
    variantTitle: row.variant_title ?? "",
  };
}

async function resolvePlanLineMockupUrls(lines: NewProductPlanLine[]) {
  const supabase = requireSupabase();
  const uniquePaths = Array.from(new Set(lines.map((line) => line.mockupImageStoragePath).filter(Boolean)));
  if (!uniquePaths.length) {
    return lines;
  }

  const signedUrls = new Map<string, string>();
  await Promise.all(uniquePaths.map(async (path) => {
    const { data, error } = await supabase.storage
      .from("new-product-mockups")
      .createSignedUrl(path, 60 * 60);
    if (!error && data?.signedUrl) {
      signedUrls.set(path, data.signedUrl);
    }
  }));

  return lines.map((line) => ({
    ...line,
    mockupImageUrl: signedUrls.get(line.mockupImageStoragePath) || "",
  }));
}

function roundUpToMultiple(value: number, orderMultiple = 10) {
  const qty = Math.max(0, Math.ceil(value));
  const multiple = Math.max(1, Math.round(orderMultiple || 10));
  if (qty === 0) {
    return 0;
  }
  return Math.max(multiple, Math.ceil(qty / multiple) * multiple);
}

function adjustedSuggestedQty({
  adjustmentMultiplier,
  baseDailyIndex,
  orderMultiple,
  targetCoverageDays,
}: {
  adjustmentMultiplier: number;
  baseDailyIndex: number;
  orderMultiple: number;
  targetCoverageDays: number;
}) {
  const baseQty = Math.max(0, baseDailyIndex) * Math.max(1, targetCoverageDays);
  return roundUpToMultiple(baseQty * Math.max(0, adjustmentMultiplier), orderMultiple);
}

function lineFinancials(finalQty: number, unitCost: number | null | undefined) {
  if (unitCost === null || unitCost === undefined) {
    return { estimatedCost: null, estimatedThb: null };
  }
  const estimatedCost = Math.max(0, finalQty) * Math.max(0, unitCost);
  return { estimatedCost, estimatedThb: estimatedCost };
}

function isUniqueViolation(error: { code?: string; message?: string } | null | undefined, indexName: string) {
  return error?.code === "23505" || Boolean(error?.message?.includes(indexName));
}

function lineKey(productName: string, size: string, color: string) {
  return [
    productName.trim().toLowerCase(),
    size.trim().toLowerCase(),
    color.trim().toLowerCase(),
  ].join("::");
}

function requireSupabase() {
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }
  return supabase;
}

function isPlanNumberUniqueViolation(error: unknown) {
  const dbError = error as { code?: string; details?: string; message?: string };
  const message = `${dbError.message ?? ""} ${dbError.details ?? ""}`.toLowerCase();
  return dbError.code === "23505" && message.includes("plan_number");
}

function isComparableReferenceUniqueViolation(error: unknown) {
  const dbError = error as { code?: string; details?: string; message?: string };
  const message = `${dbError.message ?? ""} ${dbError.details ?? ""}`.toLowerCase();
  return (
    dbError.code === "23505" &&
    (message.includes("idx_po_new_product_plan_comparables_unique_reference") ||
      message.includes("po_new_product_plan_comparables"))
  );
}

function normalizeComparableSearchQuery(query: string) {
  return query
    .trim()
    .slice(0, MAX_COMPARABLE_SEARCH_QUERY_LENGTH)
    .replace(/[,()"'`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const SIZE_TOKENS = ["4XL", "3XL", "2XL", "XXL", "XL", "L", "M", "S", "XS", "XXS"];
const COLOR_TOKENS = [
  "Black",
  "White",
  "Red",
  "Blue",
  "Navy",
  "Grey",
  "Gray",
  "Green",
  "Yellow",
  "Pink",
  "Purple",
  "Brown",
  "Beige",
  "Cream",
  "Orange",
  "Khaki",
  "Olive",
  "Silver",
  "Gold",
];
const COLOR_CODE_TOKENS: Record<string, string> = {
  BEI: "Beige",
  BG: "Beige",
  BLK: "Black",
  BLU: "Blue",
  BRN: "Brown",
  CRM: "Cream",
  GLD: "Gold",
  GRN: "Green",
  GRY: "Grey",
  GY: "Grey",
  KHK: "Khaki",
  NVY: "Navy",
  OLV: "Olive",
  ORG: "Orange",
  PNK: "Pink",
  PRP: "Purple",
  PUR: "Purple",
  RED: "Red",
  SLV: "Silver",
  WHT: "White",
  WTE: "White",
  YLW: "Yellow",
};
const GLOVE_OZ_SIZES = new Set([4, 6, 8, 10, 12, 14, 16, 18]);

function normalizedTokens(value: string) {
  return value
    .replace(/([a-z])([0-9])/gi, "$1 $2")
    .replace(/([0-9])([a-z])/gi, "$1 $2")
    .replace(/[_/|-]/g, " ")
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function isCombatSizeContext(value: string) {
  const normalized = ` ${value.toLowerCase().replace(/[_/|-]/g, " ")} `;
  return /\b(boxing|muay\s*thai|mma|glove|gloves|mitt|mitts|mtg|bgl|glv)\b/.test(normalized);
}

function normalizedOunceSize(value: string, allowNumericToken: boolean) {
  const normalized = value.toLowerCase().replace(/[_/|-]/g, " ");
  const explicitMatch = normalized.match(/\b(4|6|8|10|12|14|16|18)\s*(oz|ounce|ounces)\b/);
  if (explicitMatch) {
    return `${explicitMatch[1]} Oz`;
  }
  if (/\bkid(s)?\b/.test(normalized)) {
    return "Kid";
  }
  if (!allowNumericToken) {
    return "";
  }
  const tokens = normalizedTokens(value);
  const lastToken = tokens.at(-1) ?? "";
  const numeric = Number(lastToken);
  return Number.isInteger(numeric) && GLOVE_OZ_SIZES.has(numeric) ? `${numeric} Oz` : "";
}

function normalizedSize(value: string) {
  const normalized = ` ${value.toUpperCase().replace(/[_/|-]/g, " ")} `;
  const match = SIZE_TOKENS.find((size) => normalized.includes(` ${size} `));
  return match === "XXL" ? "2XL" : match ?? "";
}

function normalizedColor(value: string) {
  const normalized = ` ${value.toLowerCase().replace(/[_/|-]/g, " ")} `;
  const match = COLOR_TOKENS.find((color) => normalized.includes(` ${color.toLowerCase()} `));
  if (match) {
    return match === "Gray" ? "Grey" : match;
  }
  const codeMatch = normalizedTokens(value.toUpperCase()).find((token) => COLOR_CODE_TOKENS[token]);
  return codeMatch ? COLOR_CODE_TOKENS[codeMatch] : "";
}

function normalizeSizeFromValues({
  optionValues,
  productTitle,
  sku,
  variantTitle,
}: {
  optionValues: string[];
  productTitle: string;
  sku: string;
  variantTitle: string;
}) {
  const context = [productTitle, variantTitle, sku].filter(Boolean).join(" ");
  const hasCombatContext = isCombatSizeContext(context);
  const optionSize = optionValues
    .map((value) => normalizedSize(value) || normalizedOunceSize(value, hasCombatContext))
    .find(Boolean);
  if (optionSize) {
    return optionSize;
  }

  const titleSize =
    normalizedSize(variantTitle) ||
    normalizedOunceSize(variantTitle, isCombatSizeContext([productTitle, variantTitle].join(" ")));
  if (titleSize) {
    return titleSize;
  }

  return normalizedSize(sku) || normalizedOunceSize(sku, hasCombatContext) || "Unknown";
}

export function normalizeVariantAttributes({
  option1Value,
  option2Value,
  option3Value,
  productTitle,
  sku,
  variantTitle,
}: {
  option1Value?: string | null;
  option2Value?: string | null;
  option3Value?: string | null;
  productTitle?: string | null;
  sku?: string | null;
  variantTitle?: string | null;
}) {
  const optionValues = [option1Value, option2Value, option3Value]
    .map((value) => compactText(value))
    .filter(Boolean);
  const values = [...optionValues, variantTitle, sku]
    .map((value) => compactText(value))
    .filter(Boolean);
  const size = normalizeSizeFromValues({
    optionValues,
    productTitle: compactText(productTitle),
    sku: compactText(sku),
    variantTitle: compactText(variantTitle),
  });
  const color = values.map(normalizedColor).find(Boolean) || "Unknown";
  return { color, size };
}

export async function generatePlanNumber() {
  const supabase = requireSupabase();
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `NPB-${stamp}-`;
  const { data, error } = await supabase
    .from("po_new_product_plans")
    .select("plan_number")
    .like("plan_number", `${prefix}%`)
    .order("plan_number", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  const last = String((data?.[0] as { plan_number?: string } | undefined)?.plan_number ?? "");
  const lastNumber = Number(last.slice(prefix.length)) || 0;
  return `${prefix}${String(lastNumber + 1).padStart(4, "0")}`;
}

export async function listNewProductPlans() {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("po_new_product_plans")
    .select(
      "id,plan_number,plan_name,supplier_code,supplier_name_snapshot,category,planned_launch_date,target_coverage_days,sales_history_start,sales_history_end,channel_filter,season_factor,confidence_factor,risk_factor,risk_reason,budget_cap_thb,status,created_by,approved_by,approved_at,po_id,notes,created_at,updated_at",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as PlanRow[];
  const creatorIds = Array.from(new Set(rows.map((row) => row.created_by).filter(Boolean))) as string[];
  const profileResult = creatorIds.length
    ? await supabase
        .from("user_profiles")
        .select("auth_user_id,display_name,email")
        .in("auth_user_id", creatorIds)
    : { data: [] as ProfileRow[], error: null };

  const profiles = profileResult.error ? new Map<string, { displayName: string; email: string }>() : mapProfiles(profileResult.data as ProfileRow[]);
  return rows.map((row) => mapPlan(row, profiles));
}

export async function getNewProductPlan(planId: string): Promise<NewProductPlanDetail | null> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("po_new_product_plans")
    .select(
      "id,plan_number,plan_name,supplier_code,supplier_name_snapshot,category,planned_launch_date,target_coverage_days,sales_history_start,sales_history_end,channel_filter,season_factor,confidence_factor,risk_factor,risk_reason,budget_cap_thb,status,created_by,approved_by,approved_at,po_id,notes,created_at,updated_at",
    )
    .eq("id", planId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    return null;
  }

  const [comparablesResult, linesResult, scenariosResult, auditResult] = await Promise.all([
    supabase
      .from("po_new_product_plan_comparables")
      .select("id,plan_id,comparable_product_id,comparable_sku,comparable_title_snapshot,weight,note,created_at")
      .eq("plan_id", planId)
      .order("created_at", { ascending: true }),
    supabase
      .from("po_new_product_plan_lines")
      .select("id,plan_id,planned_sku,product_name,variant_title,size_value,color_value,image_url,mockup_image_storage_path,demand_index_estimate,suggested_opening_qty,manual_qty,final_qty,locked_qty,variant_note,unit_cost,estimated_cost,estimated_thb,estimated_margin,order_multiple,supplier_moq")
      .eq("plan_id", planId)
      .order("created_at", { ascending: true }),
    supabase
      .from("po_new_product_plan_scenarios")
      .select("id,scenario_name,scenario_type,is_active")
      .eq("plan_id", planId)
      .order("created_at", { ascending: true }),
    supabase
      .from("po_new_product_plan_audit_logs")
      .select("id,action_type,old_values,new_values,note,changed_by,changed_at")
      .eq("plan_id", planId)
      .order("changed_at", { ascending: false })
      .limit(50),
  ]);

  for (const result of [comparablesResult, linesResult, scenariosResult, auditResult]) {
    if (result.error) {
      throw new Error(result.error.message);
    }
  }

  const planRow = data as PlanRow;
  const actorIds = Array.from(
    new Set([
      planRow.created_by,
      ...((auditResult.data ?? []) as Array<{ changed_by: string | null }>).map((row) => row.changed_by),
    ].filter(Boolean)),
  ) as string[];
  const profileResult = actorIds.length
    ? await supabase
        .from("user_profiles")
        .select("auth_user_id,display_name,email")
        .in("auth_user_id", actorIds)
    : { data: [] as ProfileRow[], error: null };
  const profiles = profileResult.error ? new Map<string, { displayName: string; email: string }>() : mapProfiles(profileResult.data as ProfileRow[]);
  const plan = mapPlan(planRow, profiles);
  const comparableRows = (comparablesResult.data ?? []) as ComparableRow[];
  const comparableProductIds = Array.from(new Set(
    comparableRows.map((row) => row.comparable_product_id).filter(Boolean),
  )) as string[];
  const variantCountResult = comparableProductIds.length
    ? await supabase
        .from("product_variants")
        .select("product_id,sku,variant_image_url,products(product_image_url,product_type)")
        .in("product_id", comparableProductIds)
        .not("sku", "is", null)
    : {
        data: [] as Array<{
          product_id: string | null;
          products?: ProductRelationRow | ProductRelationRow[] | null;
          sku: string | null;
          variant_image_url?: string | null;
        }>,
        error: null,
      };
  if (variantCountResult.error) {
    throw new Error(variantCountResult.error.message);
  }
  const variantCountByProduct = new Map<string, number>();
  const comparableImageByProduct = new Map<string, string>();
  const productTypeByProduct = new Map<string, string>();
  for (const variant of (variantCountResult.data ?? []) as Array<{
    product_id: string | null;
    products?: ProductRelationRow | ProductRelationRow[] | null;
    sku: string | null;
    variant_image_url?: string | null;
  }>) {
    const productId = compactText(variant.product_id);
    const sku = compactText(variant.sku);
    if (!productId || !sku) {
      continue;
    }
    const product = firstProduct(variant);
    const imageUrl = compactText(variant.variant_image_url) || compactText(product?.product_image_url);
    const productType = compactText(product?.product_type);
    variantCountByProduct.set(productId, (variantCountByProduct.get(productId) ?? 0) + 1);
    if (imageUrl && !comparableImageByProduct.has(productId)) {
      comparableImageByProduct.set(productId, imageUrl);
    }
    if (productType && !productTypeByProduct.has(productId)) {
      productTypeByProduct.set(productId, productType);
    }
  }
  const lines = await resolvePlanLineMockupUrls(((linesResult.data ?? []) as PlanLineRow[]).map(mapPlanLine));

  return {
    ...plan,
    auditLogs: ((auditResult.data ?? []) as Array<{
      action_type: string;
      changed_at: string;
      changed_by: string | null;
      id: string;
      new_values: unknown;
      note: string | null;
      old_values: unknown;
    }>).map((row) => ({
      actionType: row.action_type,
      changedAt: row.changed_at,
      changedBy: row.changed_by ?? "",
      changedByProfile: row.changed_by ? profiles.get(row.changed_by) : undefined,
      id: row.id,
      newValues: row.new_values,
      note: row.note ?? "",
      oldValues: row.old_values,
    })),
    comparables: comparableRows.map((row) => ({
      ...mapComparable(row),
      imageUrl: comparableImageByProduct.get(compactText(row.comparable_product_id)) ?? null,
      productType: productTypeByProduct.get(compactText(row.comparable_product_id)) ?? null,
      variantCount: variantCountByProduct.get(compactText(row.comparable_product_id)) ?? null,
    })),
    lines,
    scenarios: ((scenariosResult.data ?? []) as Array<{
      id: string;
      is_active: boolean | null;
      scenario_name: string | null;
      scenario_type: string | null;
    }>).map((row) => ({
      id: row.id,
      isActive: row.is_active ?? false,
      scenarioName: row.scenario_name ?? "",
      scenarioType: row.scenario_type ?? "",
    })),
  };
}

export async function listPlanComparables(planId: string) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("po_new_product_plan_comparables")
    .select("id,plan_id,comparable_product_id,comparable_sku,comparable_title_snapshot,weight,note,created_at")
    .eq("plan_id", planId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as ComparableRow[]).map(mapComparable);
}

export async function searchComparableProducts(query: string) {
  const supabase = requireSupabase();
  const term = normalizeComparableSearchQuery(query);
  if (term.length < 2) {
    return [] as ComparableProductSearchResult[];
  }

  const escaped = term.replace(/[\\%_]/g, "\\$&");
  const [productSearch, variantSearch] = await Promise.all([
    supabase
      .from("products")
      .select("id")
      .ilike("product_title", `%${escaped}%`)
      .limit(30),
    supabase
      .from("product_variants")
      .select("product_id")
      .or(`sku.ilike.%${escaped}%,variant_title.ilike.%${escaped}%`)
      .limit(80),
  ]);

  if (productSearch.error) {
    throw new Error(productSearch.error.message);
  }
  if (variantSearch.error) {
    throw new Error(variantSearch.error.message);
  }

  const productIds = Array.from(new Set([
    ...((productSearch.data ?? []) as Array<{ id: string | null }>)
      .map((row) => row.id)
      .filter(Boolean),
    ...((variantSearch.data ?? []) as Array<{ product_id: string | null }>)
      .map((row) => row.product_id)
      .filter(Boolean),
  ])) as string[];

  if (!productIds.length) {
    return [] as ComparableProductSearchResult[];
  }

  const { data, error } = await supabase
    .from("product_variants")
    .select("id,product_id,sku,variant_title,variant_image_url,products(id,product_title,product_type,product_image_url)")
    .in("product_id", productIds)
    .order("sku", { ascending: true })
    .limit(500);
  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as unknown as VariantSearchRow[];
  const skus = Array.from(new Set(rows.map((row) => compactText(row.sku)).filter(Boolean)));
  const inventoryResult = skus.length
    ? await supabase
        .from("current_inventory_by_sku")
        .select("sku,available")
        .in("sku", skus)
    : { data: [] as InventoryRow[], error: null };
  const availableBySku = new Map(
    ((inventoryResult.data ?? []) as InventoryRow[])
      .filter((row) => row.sku)
      .map((row) => [row.sku!, numeric(row.available)]),
  );

  const byProduct = new Map<string, {
    availableInventory: number;
    imageUrl: string;
    matchedExamples: string[];
    productTitle: string;
    productType: string;
    variantCount: number;
  }>();

  for (const row of rows) {
    const product = firstProduct(row);
    const productId = compactText(row.product_id) || compactText(product?.id);
    if (!productId) {
      continue;
    }

    const sku = compactText(row.sku);
    const variantTitle = compactText(row.variant_title);
    const productTitle = compactText(product?.product_title) || sku || productId;
    const current = byProduct.get(productId) ?? {
      availableInventory: 0,
      imageUrl: compactText(product?.product_image_url) || compactText(row.variant_image_url),
      matchedExamples: [],
      productTitle,
      productType: compactText(product?.product_type),
      variantCount: 0,
    };
    current.variantCount += 1;
    current.availableInventory += sku ? availableBySku.get(sku) ?? 0 : 0;
    if (!current.imageUrl) {
      current.imageUrl = compactText(row.variant_image_url);
    }
    const example = [sku, variantTitle].filter(Boolean).join(" / ");
    const matchesTerm =
      productTitle.toLowerCase().includes(term.toLowerCase()) ||
      sku.toLowerCase().includes(term.toLowerCase()) ||
      variantTitle.toLowerCase().includes(term.toLowerCase());
    if (example && matchesTerm && current.matchedExamples.length < 3) {
      current.matchedExamples.push(example);
    }
    byProduct.set(productId, current);
  }

  return productIds.flatMap((productId) => {
    const product = byProduct.get(productId);
    if (!product) {
      return [];
    }
    return [{
      availableInventory: product.availableInventory,
      imageUrl: product.imageUrl,
      matchedExamples: product.matchedExamples,
      productId,
      productTitle: product.productTitle,
      productType: product.productType,
      snapshotTitle: product.productTitle,
      variantCount: product.variantCount,
    } satisfies ComparableProductSearchResult];
  }).slice(0, 20);
}

export async function addComparableProduct(planId: string, input: ComparableProductInput) {
  const supabase = requireSupabase();
  const { data: duplicate, error: duplicateError } = await supabase
    .from("po_new_product_plan_comparables")
    .select("id,comparable_sku")
    .eq("plan_id", planId)
    .eq("comparable_product_id", input.comparableProductId)
    .limit(1);

  if (duplicateError) {
    throw new Error(duplicateError.message);
  }
  if ((duplicate ?? []).length > 0) {
    throw new Error("This product is already selected as a comparable reference.");
  }

  const { data, error } = await supabase
    .from("po_new_product_plan_comparables")
    .insert({
      comparable_product_id: input.comparableProductId,
      comparable_sku: input.comparableSku ?? null,
      comparable_title_snapshot: input.comparableTitleSnapshot,
      note: input.note ?? null,
      plan_id: planId,
      weight: input.weight,
    })
    .select("id,plan_id,comparable_product_id,comparable_sku,comparable_title_snapshot,weight,note,created_at")
    .single();

  if (error) {
    if (isComparableReferenceUniqueViolation(error)) {
      throw new Error("This product is already selected as a comparable reference.");
    }
    throw new Error(error.message);
  }

  return mapComparable(data as ComparableRow);
}

export async function updateComparableProduct(comparableId: string, input: ComparableProductUpdateInput) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("po_new_product_plan_comparables")
    .update({
      note: input.note ?? null,
      weight: input.weight,
    })
    .eq("id", comparableId)
    .select("id,plan_id,comparable_product_id,comparable_sku,comparable_title_snapshot,weight,note,created_at")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    throw new Error("Reference product was not found.");
  }

  return mapComparable(data as ComparableRow);
}

export async function removeComparableProduct(comparableId: string) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("po_new_product_plan_comparables")
    .delete()
    .eq("id", comparableId)
    .select("id,plan_id,comparable_product_id,comparable_sku,comparable_title_snapshot,weight,note,created_at")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    throw new Error("Reference product was not found.");
  }

  return mapComparable(data as ComparableRow);
}

export async function getComparableSalesSummary(planId: string) {
  return getEstimatedComparableDemand(planId);
}

export async function getEstimatedComparableDemand(planId: string): Promise<EstimatedComparableDemand | null> {
  const plan = await getNewProductPlan(planId);
  if (!plan) {
    return null;
  }

  const factorMultiplier = plan.seasonFactor * plan.confidenceFactor * plan.riskFactor;
  const emptySummary = {
    comparableCount: plan.comparables.length,
    dataSource: "purchasing_decision_demand_hm" as const,
    factorMultiplier,
    skusMissingSalesData: 0,
    skusWithSalesData: 0,
    totalComparableSalesQty: 0,
  };

  if (!plan.comparables.length) {
    return {
      details: [],
      groups: [],
      summary: emptySummary,
      warnings: [
        "No comparable reference products selected yet.",
        "Base demand comes from the same resolved Demand HM used by Purchasing Decision. Final suggested quantity applies the plan adjustments afterward.",
      ],
    };
  }

  const supabase = requireSupabase();
  const comparableProductIds = Array.from(new Set(plan.comparables.map((item) => item.comparableProductId).filter(Boolean)));
  const variantResult = await supabase
    .from("product_variants")
    .select("product_id,sku,variant_title,variant_image_url,option1_value,option2_value,option3_value,products(id,product_title,product_type,product_image_url)")
    .in("product_id", comparableProductIds);

  if (variantResult.error) {
    throw new Error(variantResult.error.message);
  }

  const comparableVariants = ((variantResult.data ?? []) as unknown as ComparableVariantRow[])
    .filter((row) => compactText(row.sku));
  const productLevelProductIds = new Set(
    plan.comparables
      .filter((comparable) => !comparable.comparableSku)
      .map((comparable) => comparable.comparableProductId),
  );
  const expandedByProductSku = new Map<string, {
    comparableProduct: string;
    sku: string;
    variant: ComparableVariantRow;
    weight: number;
  }>();

  for (const comparable of plan.comparables) {
    const rowsForProduct = comparableVariants.filter(
      (row) => compactText(row.product_id) === comparable.comparableProductId,
    );
    const rowsForComparable = comparable.comparableSku
      ? rowsForProduct.filter((row) => compactText(row.sku) === comparable.comparableSku)
      : rowsForProduct;

    for (const variant of rowsForComparable) {
      const sku = compactText(variant.sku);
      if (!sku) {
        continue;
      }
      const key = `${comparable.comparableProductId}:${sku}`;
      if (expandedByProductSku.has(key)) {
        continue;
      }
      if (comparable.comparableSku && productLevelProductIds.has(comparable.comparableProductId)) {
        continue;
      }
      expandedByProductSku.set(key, {
        comparableProduct: comparable.comparableTitleSnapshot,
        sku,
        variant,
        weight: comparable.weight,
      });
    }
  }

  const skus = Array.from(new Set(Array.from(expandedByProductSku.values()).map((item) => item.sku)));
  const demandResult = skus.length
    ? await supabase
      .from("demand_index_current")
      .select("sku,total_sale,selling_days,demand_index_hm")
      .in("sku", skus)
    : { data: [] as DemandIndexRow[], error: null };
  if (demandResult.error) {
    throw new Error(demandResult.error.message);
  }

  const controlDemandResult = skus.length
    ? await supabase
      .from("purchasing_decision_controls")
      .select("sku,demand_index_override")
      .in("sku", skus)
    : { data: [] as DecisionControlDemandRow[], error: null };
  if (controlDemandResult.error) {
    throw new Error(controlDemandResult.error.message);
  }

  const demandSnapshotBySku = new Map<string, { demandHm: number; daysUsed: number; totalSold: number }>();
  for (const row of (demandResult.data ?? []) as DemandIndexRow[]) {
    const sku = compactText(row.sku);
    if (!sku) {
      continue;
    }
    demandSnapshotBySku.set(sku, {
      demandHm: Math.max(0, numeric(row.demand_index_hm)),
      daysUsed: Math.max(0, Math.round(numeric(row.selling_days))),
      totalSold: Math.max(0, numeric(row.total_sale)),
    });
  }

  const demandOverrideBySku = new Map<string, number>();
  for (const row of (controlDemandResult.data ?? []) as DecisionControlDemandRow[]) {
    const sku = compactText(row.sku);
    if (!sku || row.demand_index_override === null || row.demand_index_override === undefined) {
      continue;
    }
    demandOverrideBySku.set(sku, Math.max(0, numeric(row.demand_index_override)));
  }

  const details = Array.from(expandedByProductSku.values()).map((reference) => {
    const variant = reference.variant;
    const product = firstProduct(variant ?? {});
    const productTitle =
      compactText(product?.product_title) ||
      reference.comparableProduct ||
      reference.sku;
    const attributes = normalizeVariantAttributes({
      option1Value: variant?.option1_value,
      option2Value: variant?.option2_value,
      option3Value: variant?.option3_value,
      productTitle,
      sku: reference.sku,
      variantTitle: variant?.variant_title ?? productTitle,
    });
    const matrixItem: MatrixItemLike = {
      fullName: [productTitle, variant?.variant_title, attributes.size, attributes.color, reference.sku]
        .filter(Boolean)
        .join(" "),
      productName: productTitle,
      productTitle,
      sku: reference.sku,
      variantTitle: [variant?.variant_title, attributes.size].filter(Boolean).join(" "),
    };
    const family = matrixItemFamily(matrixItem);
    const sectionName = matrixSectionName(matrixItem, productTitle);
    const demandSnapshot = demandSnapshotBySku.get(reference.sku);
    const overrideDemandHm = demandOverrideBySku.get(reference.sku);
    const hasOverrideDemand = overrideDemandHm !== undefined;
    const demandHm = hasOverrideDemand
      ? overrideDemandHm
      : demandSnapshot?.demandHm ?? 0;
    const demandSource = hasOverrideDemand
      ? "purchasing_decision_controls.demand_index_override"
      : demandSnapshot
        ? "demand_index_current.demand_index_hm"
        : "missing official Demand HM";
    const rawTotalSold = demandSnapshot?.totalSold ?? 0;
    const planningQtySold = Math.max(0, rawTotalSold);
    const weightedDailyIndex = demandHm * reference.weight;
    const hasNegativeNetSales = rawTotalSold < 0;
    const imageUrl = compactText(variant?.variant_image_url) || compactText(product?.product_image_url);
    const baseQty = demandHm * plan.targetCoverageDays;

    return {
      adjustedSuggestedQty: baseQty * factorMultiplier,
      baseQty,
      color: attributes.color,
      comparableProduct: productTitle,
      dataStatus: hasNegativeNetSales
        ? "Negative net sales / treated as 0"
        : demandHm > 0
          ? `Official Demand HM from ${demandSource}`
          : "Missing official Demand HM",
      demandHm,
      demandSource,
      daysUsed: demandSnapshot?.daysUsed ?? 0,
      family,
      finalWeightedIndex: 0,
      hasNegativeNetSales,
      imageUrl,
      planningQtySold,
      rawTotalSold,
      sectionLabel: matrixSectionLabel(sectionName, family),
      sectionName,
      sku: reference.sku,
      size: attributes.size,
      targetCoverageDays: plan.targetCoverageDays,
      totalSold: rawTotalSold,
      variantTitle: variant?.variant_title ?? "",
      weight: reference.weight,
      weightedDailyIndex,
      weightedContribution: weightedDailyIndex,
    };
  });

  const detailGroupKey = (detail: EstimatedComparableSkuDetail) => [
    detail.sectionName,
    detail.family,
    detail.size,
    detail.color,
  ].join("::");

  const groupMap = new Map<string, {
    color: string;
    family: MatrixFamily;
    imageUrl: string;
    productName: string;
    sectionLabel: string;
    sectionName: string;
    skus: Set<string>;
    size: string;
    totalSold: number;
    weightedDailyTotal: number;
    weightTotal: number;
  }>();
  for (const detail of details) {
    const key = detailGroupKey(detail);
    const group = groupMap.get(key) ?? {
      color: detail.color,
      family: detail.family,
      imageUrl: detail.imageUrl,
      productName: plan.planName,
      sectionLabel: detail.sectionLabel,
      sectionName: detail.sectionName,
      skus: new Set<string>(),
      size: detail.size,
      totalSold: 0,
      weightedDailyTotal: 0,
      weightTotal: 0,
    };
    group.skus.add(detail.sku);
    if (!group.imageUrl && detail.imageUrl) {
      group.imageUrl = detail.imageUrl;
    }
    group.totalSold += detail.planningQtySold;
    if (detail.demandHm > 0) {
      group.weightedDailyTotal += detail.demandHm * detail.weight;
      group.weightTotal += detail.weight;
    }
    groupMap.set(key, group);
  }

  const hasMultiplePlanningSections =
    new Set(
      Array.from(groupMap.values()).map(
        (group) => `${group.sectionName.toLowerCase()}::${group.family}`,
      ),
    ).size > 1;

  for (const detail of details) {
    const group = groupMap.get(detailGroupKey(detail));
    detail.finalWeightedIndex = detail.demandHm > 0 && group && group.weightTotal > 0
      ? detail.weightedContribution / group.weightTotal
      : 0;
  }

  const groups = Array.from(groupMap.values())
    .map((group) => {
      const weightedDailyIndex = Math.max(0, group.weightTotal > 0 ? group.weightedDailyTotal / group.weightTotal : 0);
      const factorAdjustedIndex = Math.max(0, weightedDailyIndex * factorMultiplier);
      const baseOpeningQtyPreview = Math.max(0, weightedDailyIndex * plan.targetCoverageDays);
      return {
        baseOpeningQtyPreview,
        color: group.color,
        comparableSkuCount: group.skus.size,
        estimatedOpeningQtyPreview: Math.max(0, baseOpeningQtyPreview * factorMultiplier),
        family: group.family,
        factorAdjustedIndex,
        imageUrl: group.imageUrl,
        productName: hasMultiplePlanningSections
          ? [group.productName, group.sectionName].filter(Boolean).join(" / ")
          : group.productName,
        sectionLabel: group.sectionLabel,
        sectionName: group.sectionName,
        size: group.size,
        targetCoverageDays: plan.targetCoverageDays,
        totalSold: group.totalSold,
        weightedDailyIndex,
      };
    })
    .sort((a, b) => {
      const sectionCompare = a.sectionLabel.localeCompare(b.sectionLabel);
      if (sectionCompare) {
        return sectionCompare;
      }
      const productCompare = a.productName.localeCompare(b.productName);
      if (productCompare) {
        return productCompare;
      }
      const orderedSizes = sortMatrixSizes([a.size, b.size], a.family);
      return orderedSizes.indexOf(a.size) - orderedSizes.indexOf(b.size) || a.color.localeCompare(b.color);
    });

  const skusWithSalesData = details.filter((item) => item.demandHm > 0).length;
  const totalComparableSalesQty = details.reduce((sum, item) => sum + item.planningQtySold, 0);
  const warnings: string[] = [
    "Base quantity is calculated from the same resolved Demand HM used by Purchasing Decision first; season, confidence, and risk percentages are applied after that.",
  ];
  if (skusWithSalesData === 0) {
    warnings.push("Comparable reference products are selected, but no official Demand HM was found.");
  }
  if (skusWithSalesData < details.length) {
    warnings.push("Some comparable SKUs have no official Demand HM.");
  }
  if (details.some((item) => item.size === "Unknown" || item.color === "Unknown")) {
    warnings.push("Some SKUs are missing size or color detection and are grouped as Unknown.");
  }
  if (details.some((item) => item.hasNegativeNetSales)) {
    warnings.push("Negative net sales from returns or adjustments were detected. Those SKUs are treated as 0 for the opening quantity preview.");
  }
  if (totalComparableSalesQty > 0 && totalComparableSalesQty < 20) {
    warnings.push("Comparable sales sample is very low.");
  }

  return {
    details,
    groups,
    summary: {
      ...emptySummary,
      skusMissingSalesData: details.length - skusWithSalesData,
      skusWithSalesData,
      totalComparableSalesQty,
    },
    warnings,
  };
}

export async function listPlanLines(planId: string) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("po_new_product_plan_lines")
    .select("id,plan_id,planned_sku,product_name,variant_title,size_value,color_value,image_url,mockup_image_storage_path,demand_index_estimate,suggested_opening_qty,manual_qty,final_qty,locked_qty,variant_note,unit_cost,estimated_cost,estimated_thb,estimated_margin,order_multiple,supplier_moq")
    .eq("plan_id", planId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return resolvePlanLineMockupUrls(((data ?? []) as PlanLineRow[]).map(mapPlanLine));
}

export async function getPlanLineSummary(planId: string): Promise<NewProductPlanLineSummary> {
  const [plan, lines] = await Promise.all([getNewProductPlan(planId), listPlanLines(planId)]);
  const totalEstimatedCost = lines.reduce((sum, line) => sum + (line.estimatedCost ?? 0), 0);
  const budgetCapThb = plan?.budgetCapThb ?? 0;
  const hasEstimatedCost = lines.some((line) => line.estimatedCost !== null);
  return {
    budgetCapThb,
    budgetComparisonNote:
      budgetCapThb > 0 && hasEstimatedCost
        ? "Budget cap is recorded in THB. Unit cost currency is not confirmed, so this comparison is informational only."
        : "",
    budgetWarning: false,
    lineCount: lines.length,
    lockedLineCount: lines.filter((line) => line.lockedQty).length,
    manualOverrideCount: lines.filter((line) => line.manualQty !== null).length,
    totalEstimatedCost,
    totalFinalQty: lines.reduce((sum, line) => sum + line.finalQty, 0),
    totalSuggestedQty: lines.reduce((sum, line) => sum + line.suggestedOpeningQty, 0),
  };
}

export async function recalculatePlanLineTotals(planId: string) {
  return getPlanLineSummary(planId);
}

export async function generateSuggestedPlanLines(planId: string, adjustmentMultiplier = 1) {
  return upsertPlanLinesFromEstimate(planId, adjustmentMultiplier);
}

async function updateGeneratedPlanLine(
  supabase: ReturnType<typeof requireSupabase>,
  existing: NewProductPlanLine,
  suggestedQty: number,
  demandIndexEstimate: number,
) {
  const manualQty = existing.manualQty;
  const finalQty = manualQty !== null ? Math.max(0, Math.ceil(manualQty)) : suggestedQty;
  const financials = lineFinancials(finalQty, existing.unitCost);
  const { data, error } = await supabase
    .from("po_new_product_plan_lines")
    .update({
      demand_index_estimate: demandIndexEstimate,
      estimated_cost: financials.estimatedCost,
      estimated_thb: financials.estimatedThb,
      final_qty: finalQty,
      suggested_opening_qty: suggestedQty,
    })
    .eq("id", existing.id)
    .select("id,plan_id,planned_sku,product_name,variant_title,size_value,color_value,image_url,mockup_image_storage_path,demand_index_estimate,suggested_opening_qty,manual_qty,final_qty,locked_qty,variant_note,unit_cost,estimated_cost,estimated_thb,estimated_margin,order_multiple,supplier_moq")
    .single();
  if (error) {
    throw new Error(error.message);
  }
  return mapPlanLine(data as PlanLineRow);
}

export async function upsertPlanLinesFromEstimate(planId: string, adjustmentMultiplier = 1) {
  const estimate = await getEstimatedComparableDemand(planId);
  const plan = await getNewProductPlan(planId);
  if (!plan) {
    throw new Error("Plan not found.");
  }
  if (!estimate || !estimate.groups.length) {
    throw new Error("No estimated comparable index is available. Add comparable reference products first.");
  }

  const supabase = requireSupabase();
  const existingLines = await listPlanLines(planId);
  const existingByKey = new Map(
    existingLines.map((line) => [lineKey(line.productName, line.sizeValue, line.colorValue), line]),
  );
  const changedLines: NewProductPlanLine[] = [];
  let created = 0;
  let skippedLocked = 0;
  let updated = 0;

  for (const group of estimate.groups) {
    const key = lineKey(group.productName, group.size, group.color);
    const existing = existingByKey.get(key);
    const orderMultiple = existing?.orderMultiple ?? 10;
    const demandIndexEstimate = Math.max(0, group.weightedDailyIndex);
    const suggestedQty = adjustedSuggestedQty({
      adjustmentMultiplier,
      baseDailyIndex: demandIndexEstimate,
      orderMultiple,
      targetCoverageDays: plan.targetCoverageDays,
    });

    if (existing?.lockedQty) {
      skippedLocked += 1;
      continue;
    }

    if (existing) {
      changedLines.push(await updateGeneratedPlanLine(supabase, existing, suggestedQty, demandIndexEstimate));
      updated += 1;
      continue;
    }

    const finalQty = suggestedQty;
    const financials = lineFinancials(finalQty, null);
    const variantTitle = [group.size, group.color].filter(Boolean).join(" / ");
    const { data, error } = await supabase
      .from("po_new_product_plan_lines")
      .insert({
        color_value: group.color,
        demand_index_estimate: demandIndexEstimate,
        estimated_cost: financials.estimatedCost,
        estimated_thb: financials.estimatedThb,
        final_qty: finalQty,
        image_url: group.imageUrl || null,
        locked_qty: false,
        order_multiple: 10,
        plan_id: planId,
        planned_sku: "",
        product_name: group.productName || plan.planName,
        size_value: group.size,
        suggested_opening_qty: suggestedQty,
        variant_title: variantTitle,
      })
      .select("id,plan_id,planned_sku,product_name,variant_title,size_value,color_value,image_url,mockup_image_storage_path,demand_index_estimate,suggested_opening_qty,manual_qty,final_qty,locked_qty,variant_note,unit_cost,estimated_cost,estimated_thb,estimated_margin,order_multiple,supplier_moq")
      .single();
    if (error) {
      if (
        isUniqueViolation(error, "idx_po_new_product_plan_lines_unique_product_size_color") ||
        isUniqueViolation(error, "idx_po_new_product_plan_lines_unique_size_color")
      ) {
        const concurrentLine = (await listPlanLines(planId)).find(
          (line) => lineKey(line.productName, line.sizeValue, line.colorValue) === key,
        );
        if (!concurrentLine) {
          throw new Error("This quantity matrix line already exists. Refresh the page and try again.");
        }
        if (concurrentLine.lockedQty) {
          skippedLocked += 1;
          continue;
        }
        const concurrentSuggestedQty = adjustedSuggestedQty({
          adjustmentMultiplier,
          baseDailyIndex: demandIndexEstimate,
          orderMultiple: concurrentLine.orderMultiple,
          targetCoverageDays: plan.targetCoverageDays,
        });
        changedLines.push(await updateGeneratedPlanLine(supabase, concurrentLine, concurrentSuggestedQty, demandIndexEstimate));
        updated += 1;
        continue;
      }
      throw new Error(error.message);
    }
    changedLines.push(mapPlanLine(data as PlanLineRow));
    created += 1;
  }

  return {
    changedLines,
    created,
    skippedLocked,
    summary: await getPlanLineSummary(planId),
    updated,
  };
}

export async function updatePlanLine(lineId: string, input: NewProductPlanLineInput) {
  const supabase = requireSupabase();
  const { data: currentRow, error: currentError } = await supabase
    .from("po_new_product_plan_lines")
    .select("id,plan_id,planned_sku,product_name,variant_title,size_value,color_value,image_url,mockup_image_storage_path,demand_index_estimate,suggested_opening_qty,manual_qty,final_qty,locked_qty,variant_note,unit_cost,estimated_cost,estimated_thb,estimated_margin,order_multiple,supplier_moq")
    .eq("id", lineId)
    .maybeSingle();

  if (currentError) {
    throw new Error(currentError.message);
  }
  if (!currentRow) {
    throw new Error("Planning line was not found.");
  }

  const current = mapPlanLine(currentRow as PlanLineRow);
  const manualQty = input.manualQty === undefined ? current.manualQty : input.manualQty;
  const orderMultiple = Math.max(1, Math.round(input.orderMultiple));
  const recalculatedSuggestedQty = roundUpToMultiple(current.suggestedOpeningQty, orderMultiple);
  const finalQty = manualQty !== null && manualQty !== undefined
    ? Math.max(0, Math.ceil(manualQty))
    : recalculatedSuggestedQty;
  const unitCost = input.unitCost === undefined ? current.unitCost : input.unitCost;
  const financials = lineFinancials(finalQty, unitCost);

  const { data, error } = await supabase
    .from("po_new_product_plan_lines")
    .update({
      estimated_cost: financials.estimatedCost,
      estimated_thb: financials.estimatedThb,
      final_qty: finalQty,
      locked_qty: input.lockedQty,
      manual_qty: manualQty ?? null,
      order_multiple: orderMultiple,
      suggested_opening_qty: recalculatedSuggestedQty,
      unit_cost: unitCost ?? null,
      variant_note: input.variantNote ?? null,
    })
    .eq("id", lineId)
    .select("id,plan_id,planned_sku,product_name,variant_title,size_value,color_value,image_url,mockup_image_storage_path,demand_index_estimate,suggested_opening_qty,manual_qty,final_qty,locked_qty,variant_note,unit_cost,estimated_cost,estimated_thb,estimated_margin,order_multiple,supplier_moq")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapPlanLine(data as PlanLineRow);
}

export async function updatePlanLineMetadata(lineId: string, input: NewProductPlanLineMetadataInput) {
  const supabase = requireSupabase();
  const updates: Record<string, string | null> = {};
  if (input.productName !== undefined) {
    updates.product_name = compactText(input.productName);
  }
  if (input.colorValue !== undefined) {
    updates.color_value = compactText(input.colorValue);
  }
  if (input.imageUrl !== undefined) {
    updates.image_url = compactText(input.imageUrl);
  }
  if (input.mockupImageStoragePath !== undefined) {
    updates.mockup_image_storage_path = compactText(input.mockupImageStoragePath);
  }
  if (!Object.keys(updates).length) {
    const { data, error } = await supabase
      .from("po_new_product_plan_lines")
      .select("id,plan_id,planned_sku,product_name,variant_title,size_value,color_value,image_url,mockup_image_storage_path,demand_index_estimate,suggested_opening_qty,manual_qty,final_qty,locked_qty,variant_note,unit_cost,estimated_cost,estimated_thb,estimated_margin,order_multiple,supplier_moq")
      .eq("id", lineId)
      .single();
    if (error) {
      throw new Error(error.message);
    }
    return mapPlanLine(data as PlanLineRow);
  }

  const { data, error } = await supabase
    .from("po_new_product_plan_lines")
    .update(updates)
    .eq("id", lineId)
    .select("id,plan_id,planned_sku,product_name,variant_title,size_value,color_value,image_url,mockup_image_storage_path,demand_index_estimate,suggested_opening_qty,manual_qty,final_qty,locked_qty,variant_note,unit_cost,estimated_cost,estimated_thb,estimated_margin,order_multiple,supplier_moq")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapPlanLine(data as PlanLineRow);
}

export async function removePlanLine(lineId: string) {
  const supabase = requireSupabase();
  const { data: currentRow, error: currentError } = await supabase
    .from("po_new_product_plan_lines")
    .select("id,plan_id,planned_sku,product_name,variant_title,size_value,color_value,image_url,mockup_image_storage_path,demand_index_estimate,suggested_opening_qty,manual_qty,final_qty,locked_qty,variant_note,unit_cost,estimated_cost,estimated_thb,estimated_margin,order_multiple,supplier_moq")
    .eq("id", lineId)
    .maybeSingle();

  if (currentError) {
    throw new Error(currentError.message);
  }
  if (!currentRow) {
    throw new Error("Planning line was not found.");
  }

  const current = mapPlanLine(currentRow as PlanLineRow);
  const { error } = await supabase
    .from("po_new_product_plan_lines")
    .delete()
    .eq("id", lineId);

  if (error) {
    throw new Error(error.message);
  }

  return current;
}

export async function applyGlobalPlanLineAdjustment(planId: string, adjustmentMultiplier: number) {
  const plan = await getNewProductPlan(planId);
  if (!plan) {
    throw new Error("Plan not found.");
  }

  const supabase = requireSupabase();
  const lines = await listPlanLines(planId);
  const changedLines: NewProductPlanLine[] = [];
  let skippedLocked = 0;

  for (const line of lines) {
    if (line.lockedQty) {
      skippedLocked += 1;
      continue;
    }

    const suggestedQty = adjustedSuggestedQty({
      adjustmentMultiplier,
      baseDailyIndex: line.demandIndexEstimate,
      orderMultiple: line.orderMultiple,
      targetCoverageDays: plan.targetCoverageDays,
    });
    const finalQty = line.manualQty !== null ? Math.max(0, Math.ceil(line.manualQty)) : suggestedQty;
    const financials = lineFinancials(finalQty, line.unitCost);
    const { data, error } = await supabase
      .from("po_new_product_plan_lines")
      .update({
        estimated_cost: financials.estimatedCost,
        estimated_thb: financials.estimatedThb,
        final_qty: finalQty,
        suggested_opening_qty: suggestedQty,
      })
      .eq("id", line.id)
      .select("id,plan_id,planned_sku,product_name,variant_title,size_value,color_value,image_url,mockup_image_storage_path,demand_index_estimate,suggested_opening_qty,manual_qty,final_qty,locked_qty,variant_note,unit_cost,estimated_cost,estimated_thb,estimated_margin,order_multiple,supplier_moq")
      .single();

    if (error) {
      throw new Error(error.message);
    }
    changedLines.push(mapPlanLine(data as PlanLineRow));
  }

  return {
    changedLines,
    skippedLocked,
    summary: await getPlanLineSummary(planId),
    updated: changedLines.length,
  };
}

export async function bulkUpdatePlanLines(planId: string, input: NewProductPlanLineInput) {
  const lines = await listPlanLines(planId);
  const updated: NewProductPlanLine[] = [];
  for (const line of lines) {
    updated.push(await updatePlanLine(line.id, input));
  }
  return updated;
}

export async function createNewProductPlan(input: NewProductPlanInput & { createdBy: string }) {
  const supabase = requireSupabase();
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const planNumber = await generatePlanNumber();
    const { data, error } = await supabase
      .from("po_new_product_plans")
      .insert({
        ...planPayload(input),
        created_by: input.createdBy,
        plan_number: planNumber,
        status: "draft",
      })
      .select("id")
      .single();

    if (!error) {
      return String((data as { id: string }).id);
    }

    if (!isPlanNumberUniqueViolation(error)) {
      throw new Error(error.message);
    }
  }

  throw new Error("Could not generate a unique plan number. Please try again.");
}

export async function updateNewProductPlan(planId: string, input: NewProductPlanInput) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("po_new_product_plans")
    .update(planPayload(input))
    .eq("id", planId)
    .eq("status", "draft")
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    throw new Error("This plan can no longer be edited because its status has changed.");
  }
}

export async function updateNewProductPlanDemandControls(
  planId: string,
  input: NewProductPlanDemandControlsInput,
) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("po_new_product_plans")
    .update({
      channel_filter: input.channelFilter ?? null,
      confidence_factor: input.confidenceFactor,
      risk_factor: input.riskFactor,
      season_factor: input.seasonFactor,
    })
    .eq("id", planId)
    .in("status", ["draft", "review"])
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    throw new Error("This plan can no longer be adjusted because its status has changed.");
  }
}

export async function getSuppliersForNewProductPlan() {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("po_suppliers")
    .select("supplier_code,supplier_name")
    .eq("is_active", true)
    .order("supplier_name", { ascending: true });

  if (error) {
    const fallback = await supabase
      .from("po_suppliers")
      .select("supplier_code,supplier_name")
      .order("supplier_name", { ascending: true });
    if (fallback.error) {
      throw new Error(fallback.error.message);
    }
    return ((fallback.data ?? []) as SupplierRow[]).map((row) => ({
      supplierCode: row.supplier_code ?? "",
      supplierName: row.supplier_name ?? row.supplier_code ?? "",
    }));
  }

  return ((data ?? []) as SupplierRow[]).map((row) => ({
    supplierCode: row.supplier_code ?? "",
    supplierName: row.supplier_name ?? row.supplier_code ?? "",
  }));
}
