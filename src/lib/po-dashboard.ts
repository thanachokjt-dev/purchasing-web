import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { SHOPIFY_ORDERS_SALES_SYNC_SOURCE } from "@/lib/sync/shopify-orders";
import { SHOPIFY_PRODUCTS_INVENTORY_SYNC_SOURCE } from "@/lib/sync/shopify-products";

const BANGKOK_TIME_ZONE = "Asia/Bangkok";

type QueryWarning = {
  label: string;
  message: string;
};

type CountResult = {
  count: number;
  warning?: QueryWarning;
};

type SyncRunRow = {
  duration_seconds?: number | string | null;
  error_message: string | null;
  finished_at: string | null;
  inventory_rows_seen: number | string | null;
  orders_seen?: number | string | null;
  products_seen: number | string | null;
  rows_upserted?: number | string | null;
  sales_lines_seen?: number | string | null;
  source: string | null;
  started_at: string | null;
  status: string | null;
  variants_seen: number | string | null;
};

type PoMetricsRow = {
  active_incoming_total: number | string | null;
  item_count: number | string | null;
  open_paid_amount_thb: number | string | null;
  ordered_total: number | string | null;
  pending_approval_total: number | string | null;
  planned_amount_thb: number | string | null;
  po_count: number | string | null;
  received_total: number | string | null;
  supplier_count: number | string | null;
};

type PoValueRow = {
  active_line_count?: number | string | null;
  pending_line_count?: number | string | null;
  po_amount_thb: number | string | null;
};

type ReceiptDateRow = {
  actual_received_date: string | null;
  received_at: string | null;
};

type EtaDateRow = {
  eta_date: string | null;
};

type PoSizeMixSummaryRow = {
  bucket: string | null;
  mix_group: string | null;
  pct: number | string | null;
  qty: number | string | null;
  rank: number | string | null;
};

type PoSizeMixLineRow = {
  cancelled_qty?: number | string | null;
  catalog_option1_value?: string | null;
  catalog_option2_value?: string | null;
  catalog_option3_value?: string | null;
  catalog_option_pick?: string | null;
  catalog_product_title?: string | null;
  catalog_product_type?: string | null;
  catalog_tags?: string[] | null;
  catalog_variant_title?: string | null;
  full_name: string | null;
  line_status: string | null;
  ordered_qty: number | string | null;
  po_orders:
    | {
        cancelled_at: string | null;
        po_id: string | null;
        po_title: string | null;
        quotation_reference?: string | null;
        rqq_id: string | null;
        supplier_code: string | null;
        supplier_invoice_no?: string | null;
        supplier_name_snapshot: string | null;
        work_status: string | null;
      }
    | {
        cancelled_at: string | null;
        po_id: string | null;
        po_title: string | null;
        quotation_reference?: string | null;
        rqq_id: string | null;
        supplier_code: string | null;
        supplier_invoice_no?: string | null;
        supplier_name_snapshot: string | null;
        work_status: string | null;
      }[]
    | null;
  product_title_snapshot: string | null;
  remark: string | null;
  sku: string | null;
  source_payload?: unknown;
  variant_title_snapshot: string | null;
};

type ProductVariantSizeMixRow = {
  option1_value: string | null;
  option2_value: string | null;
  option3_value: string | null;
  option_pick: string | null;
  products:
    | {
        product_title: string | null;
        product_type: string | null;
        tags: string[] | null;
      }
    | {
        product_title: string | null;
        product_type: string | null;
        tags: string[] | null;
      }[]
    | null;
  sku: string | null;
  variant_title: string | null;
};

export type DashboardCardTone = "blue" | "green" | "gray" | "red" | "yellow";

export type SyncHealthStatus = "failed" | "fresh" | "unknown" | "warning";

export type PoSizeMixGroup =
  | "adult_apparel_curve"
  | "gloves_oz"
  | "mma_gloves_size"
  | "shin_guards_size"
  | "shirts_tops_size"
  | "shorts_size"
  | "singlets_size";

export type PoSizeMixBucket = {
  bucket: string;
  pct: number;
  qty: number;
  rank: number;
};

export type PoSizeMixUnknownLine = {
  group: PoSizeMixGroup;
  href: string;
  itemName: string;
  orderedQty: number;
  parseReason: string;
  poId: string;
  poReference: string;
  sku: string;
  supplierName: string;
  variantText: string;
};

export type PoSizeMixCard = {
  group: PoSizeMixGroup;
  rows: PoSizeMixBucket[];
  title: string;
  totalQty: number;
  unknownQty: number;
  unknownLines: PoSizeMixUnknownLine[];
};

export type PoSizeMixSummary = {
  cards: PoSizeMixCard[];
  dataSource: "server-fallback" | "sql-view";
  excludedStatuses: string[];
  includedStatuses: string[];
  lowSampleSize: boolean;
  notes: string[];
  sampleQty: number;
  takeaways: string[];
  unknownQty: number;
  unknownLineLimit: number;
};

export type PoSizeMixUnknownExample = {
  group: Exclude<PoSizeMixGroup, "adult_apparel_curve">;
  name: string;
  qty: number;
  rawText?: string;
  sku: string;
  variant?: string;
};

export type DashboardActionItem = {
  detail: string;
  href?: string;
  label: string;
  tone: DashboardCardTone;
};

export type ShopifySyncSourceSummary = {
  dataFreshness: Exclude<SyncHealthStatus, "warning"> | "stale";
  durationSeconds: number | null;
  errorMessage: string | null;
  inventoryRowsSynced: number | null;
  lastStatus: "failed" | "running" | "success" | "unknown";
  lastSuccessfulSyncTime: string | null;
  lastSyncTime: string | null;
  ordersSeen: number | null;
  productsSynced: number | null;
  salesLinesSeen: number | null;
  source: string;
  syncLogFound: boolean;
  variantsSynced: number | null;
};

export type PoDashboardData = {
  generatedAt: string;
  incomingEta: {
    arrivingSoon: number;
    lateEta: number;
    nextExpectedArrival: string | null;
    noEta: number;
  };
  payments: {
    dueNext30Days: number;
    dueThisWeek: number;
    missingFxCount: number;
    overduePayments: number;
    paidTotalThb: number;
    plannedTotalThb: number;
    xeroDraftCount: number;
    xeroPendingCount: number;
    xeroUploadedCount: number;
  };
  poOverview: {
    inProduction: number;
    inTransit: number;
    openPoCount: number;
    openPoValueThb: number | null;
    outstandingQty: number;
    readyToShip: number;
    receivingPending: number;
  };
  receiving: {
    lastGoodsReceiptDate: string | null;
    linesWithOutstandingQty: number;
    outstandingReceivingQty: number;
    posWaitingToReceive: number;
    recentlyReceivedCount: number;
  };
  sync: {
    catalogInventory: ShopifySyncSourceSummary;
    dataFreshness: SyncHealthStatus;
    ordersSales: ShopifySyncSourceSummary;
    syncLogFound: boolean;
  };
  sizeMix: PoSizeMixSummary;
  attentionItems: DashboardActionItem[];
  warnings: QueryWarning[];
};

const SIZE_MIX_INCLUDED_STATUSES = [
  "open/current",
  "in production",
  "ready/final payment",
  "delivery/in transit",
  "closed/received",
];

const SIZE_MIX_EXCLUDED_STATUSES = ["cancelled", "canceled", "void", "voided", "deleted"];

const SIZE_MIX_GROUPS: Array<{ group: PoSizeMixGroup; title: string; buckets: string[] }> = [
  { group: "gloves_oz", title: "Gloves Ordered by Oz", buckets: ["6 oz", "8 oz", "10 oz", "12 oz", "14 oz", "16 oz", "Unknown"] },
  {
    group: "mma_gloves_size",
    title: "MMA Gloves Ordered by Size",
    buckets: ["XS", "S", "S/M", "M", "L", "L/XL", "XL", "Other / Unknown"],
  },
  { group: "shin_guards_size", title: "Shin Guards Ordered by Size", buckets: ["S", "M", "L", "XL"] },
  {
    group: "shirts_tops_size",
    title: "Shirts / Tops Ordered by Size",
    buckets: ["XXS", "XS", "S", "M", "L", "XL", "2XL / XXL", "3XL"],
  },
  {
    group: "shorts_size",
    title: "Shorts Ordered by Size",
    buckets: ["XXS", "XS", "S", "M", "L", "XL", "2XL / XXL", "3XL"],
  },
  {
    group: "singlets_size",
    title: "Singlets Ordered by Size",
    buckets: ["XS", "S", "M", "L", "XL", "2XL / XXL", "3XL"],
  },
  {
    group: "adult_apparel_curve",
    title: "General Adult Apparel Curve",
    buckets: ["XXS", "XS", "S", "M", "L", "XL", "2XL / XXL", "3XL"],
  },
];

const emptySizeMixSummary: PoSizeMixSummary = {
  cards: SIZE_MIX_GROUPS.map((group) => ({
    group: group.group,
    rows: [],
    title: group.title,
    totalQty: 0,
    unknownQty: 0,
    unknownLines: [],
  })),
  dataSource: "sql-view",
  excludedStatuses: SIZE_MIX_EXCLUDED_STATUSES,
  includedStatuses: SIZE_MIX_INCLUDED_STATUSES,
  lowSampleSize: false,
  notes: [
    "Cancelled/void orders excluded.",
    "Estimate based on PO line names/SKUs. Unknown rows may need product naming cleanup.",
    "Unknown = PO lines where size/oz could not be parsed from SKU/name/variant.",
  ],
  sampleQty: 0,
  takeaways: [],
  unknownQty: 0,
  unknownLineLimit: 50,
};

function toNumber(value: number | string | null | undefined) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function nullableNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizedText(value: string) {
  return value
    .toLowerCase()
    .replace(/[_\-/.()]+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wordMatch(text: string, pattern: RegExp) {
  return pattern.test(` ${text} `);
}

function payloadSizeMixText(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }
  const payload = value as Record<string, unknown>;
  return [
    "product_name",
    "productName",
    "product_title",
    "title",
    "item_name",
    "itemName",
    "variant_name",
    "variantName",
    "variant_title",
    "description",
    "option1",
    "option2",
    "option3",
    "option1_value",
    "option2_value",
    "option3_value",
    "size",
    "Size",
    "color_size",
    "supplier_sku",
    "supplierSku",
    "product_type",
    "category",
    "submittedSku",
  ]
    .map((key) => payload[key])
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function firstProduct<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function poSizeMixPreferredText(row: PoSizeMixLineRow) {
  return [
    row.variant_title_snapshot,
    row.catalog_variant_title,
    row.catalog_option_pick,
    row.catalog_option1_value,
    row.catalog_option2_value,
    row.catalog_option3_value,
    ...payloadSizeMixText(row.source_payload).filter((item) => /\b(size|small|medium|large|xl|xxl|oz|k[1-9]|\d{1,2})\b/i.test(item)),
  ]
    .filter(Boolean)
    .join(" ");
}

function joinedProductText(row: PoSizeMixLineRow) {
  return [
    row.sku,
    row.product_title_snapshot,
    row.catalog_product_title,
    row.full_name,
    row.variant_title_snapshot,
    row.catalog_variant_title,
    row.catalog_option_pick,
    row.catalog_option1_value,
    row.catalog_option2_value,
    row.catalog_option3_value,
    row.catalog_product_type,
    row.catalog_tags?.join(" "),
    row.remark,
    ...payloadSizeMixText(row.source_payload),
  ]
    .filter(Boolean)
    .join(" ");
}

function joinedGroupText(row: PoSizeMixLineRow) {
  return [
    row.sku,
    row.product_title_snapshot,
    row.catalog_product_title,
    row.full_name,
    row.variant_title_snapshot,
    row.catalog_variant_title,
    row.catalog_option_pick,
    row.catalog_option1_value,
    row.catalog_option2_value,
    row.catalog_option3_value,
    ...payloadSizeMixText(row.source_payload),
  ]
    .filter(Boolean)
    .join(" ");
}

function poSizeMixSearchText(row: PoSizeMixLineRow) {
  return normalizedText(joinedGroupText(row));
}

function sizeMixStatusKey(value: string | null | undefined) {
  return normalizedText(value ?? "").replace(/\s+/g, "_");
}

function isSizeMixCancelledStatus(value: string | null | undefined) {
  return SIZE_MIX_EXCLUDED_STATUSES.includes(sizeMixStatusKey(value));
}

function isMmaGloveText(text: string) {
  return wordMatch(text, /\b(mma gloves?|grappling gloves?|hybrid mma gloves?)\b/);
}

function isOzSizedGloveText(text: string) {
  const hasGlove = wordMatch(text, /\bgloves?\b/);
  const hasExplicitOz = /\b(6|8|10|12|14|16)\s*oz\b/.test(text);
  const hasKnownOzGloveKeyword = wordMatch(
    text,
    /\b(boxing gloves?|sparring gloves?|muay thai gloves?|bag gloves?|training gloves?|rental gloves?)\b/,
  );
  return hasGlove && (hasExplicitOz || hasKnownOzGloveKeyword);
}

function classifyPoSizeMixGroup(row: PoSizeMixLineRow): Exclude<PoSizeMixGroup, "adult_apparel_curve"> | null {
  const text = poSizeMixSearchText(row);
  if (isMmaGloveText(text)) {
    return "mma_gloves_size";
  }
  if (wordMatch(text, /\b(shinguards?|shin guards?|shin pads?|shin)\b/)) {
    return "shin_guards_size";
  }
  if (isOzSizedGloveText(text)) {
    return "gloves_oz";
  }
  if (wordMatch(text, /\b(singlets?|tank tops?|tanks?)\b/)) {
    return "singlets_size";
  }
  if (wordMatch(text, /\b((muay thai|mma) )?shorts\b/)) {
    return "shorts_size";
  }
  if (wordMatch(text, /\b(t shirts?|tee|tees|training tee|oversized tee|shirts?|tops?)\b/)) {
    return "shirts_tops_size";
  }
  return null;
}

function extractGloveOz(row: PoSizeMixLineRow) {
  const text = normalizedText([poSizeMixPreferredText(row), joinedProductText(row)].filter(Boolean).join(" "));
  const explicitMatch = text.match(/\b(6|8|10|12|14|16)\s*oz\b/);
  if (explicitMatch) {
    return `${explicitMatch[1]} oz`;
  }

  const gloveContext = /\b(bg|boxing glove|sparring glove|muay thai glove|glove|gloves)\b/.test(text);
  if (!gloveContext) {
    return "Unknown";
  }

  const contextMatch =
    text.match(/\b(?:bg|boxing glove|sparring glove|muay thai glove|glove|gloves)\s+(6|8|10|12|14|16)\b/) ??
    text.match(/\b(6|8|10|12|14|16)\s+(?:bg|boxing glove|sparring glove|muay thai glove|glove|gloves)\b/);
  return contextMatch ? `${contextMatch[1]} oz` : "Unknown";
}

function extractMmaGloveSize(row: PoSizeMixLineRow) {
  const preferredText = [poSizeMixPreferredText(row), row.sku].filter(Boolean).join(" ");
  const preferred = normalizedText(preferredText);
  const fullText = normalizedText([preferredText, joinedProductText(row)].filter(Boolean).join(" "));
  const text = preferred || fullText;

  if (/\b(s m|sm)\b/.test(text) || /\b(s m|sm)\b/.test(fullText)) {
    return "S/M";
  }
  if (/\b(l xl|lxl)\b/.test(text) || /\b(l xl|lxl)\b/.test(fullText)) {
    return "L/XL";
  }

  const skuSize = normalizedText(row.sku ?? "").match(/\b(xs|s|m|l|xl)\b$/)?.[1];
  const singleSize = skuSize ?? text.match(/\b(xs|s|m|l|xl)\b/)?.[1] ?? fullText.match(/\b(xs|s|m|l|xl)\b/)?.[1];
  if (!singleSize) {
    return "Other / Unknown";
  }

  return singleSize.toUpperCase();
}

function normalizeSizeMixBucket(group: PoSizeMixGroup, bucket: string) {
  const trimmed = bucket.trim();
  if (group === "gloves_oz") {
    return /^(6|8|10|12|14|16) oz$/.test(trimmed) ? trimmed : "Unknown";
  }
  if (group === "mma_gloves_size") {
    return ["XS", "S", "S/M", "M", "L", "L/XL", "XL"].includes(trimmed) ? trimmed : "Other / Unknown";
  }
  return trimmed || "Unknown";
}

function sizeFromText(value: string, allowOtherSizes: boolean) {
  const text = normalizedText(value);
  const tests: Array<[string, RegExp]> = [
    ["3XL", /\b(3xl|3 xl|xxxl|triple xl)\b/],
    ["2XL / XXL", /\b(xxl|2xl|2 xl|double xl)\b/],
    ["XXS", /\b(xxs|2xs|extra extra small)\b/],
    ["XS", /\b(xs|x small|xsmall|extra small)\b/],
    ["XL", /\b(xl|x large|xlarge|extra large)\b/],
    ["S", /\b(s|small)\b/],
    ["M", /\b(m|medium)\b/],
    ["L", /\b(l|large)\b/],
  ];
  const matched = tests.find(([, pattern]) => pattern.test(text))?.[0];
  if (matched) {
    return matched;
  }

  if (allowOtherSizes && /\b([4-9]xl|[4-9] xl|k[1-9]|1[0-9])\b/.test(text)) {
    return "Other / Unknown";
  }

  return "Unknown";
}

function extractApparelSize(row: PoSizeMixLineRow) {
  const preferred = sizeFromText(poSizeMixPreferredText(row), true);
  if (preferred !== "Unknown") {
    return preferred;
  }
  const skuMatch = normalizedText(row.sku ?? "").match(/\b(?:xxs|2xs|xs|s|m|l|xl|xxl|2xl|3xl|xxxl|[4-9]xl|k[1-9]|1[0-9])\b$/);
  if (skuMatch) {
    return sizeFromText(skuMatch[0], true);
  }
  return sizeFromText(joinedProductText(row), true);
}

function extractPoSizeMixBucket(group: Exclude<PoSizeMixGroup, "adult_apparel_curve">, line: PoSizeMixLineRow) {
  if (group === "gloves_oz") {
    return extractGloveOz(line);
  }
  if (group === "mma_gloves_size") {
    return extractMmaGloveSize(line);
  }
  return extractApparelSize(line);
}

function isAdultApparelSize(bucket: string) {
  return bucket !== "Unknown" && bucket !== "Other / Unknown";
}

function isUnknownCleanupBucket(bucket: string) {
  return bucket === "Unknown" || bucket === "Other / Unknown";
}

function singlePoOrder(row: PoSizeMixLineRow) {
  return Array.isArray(row.po_orders) ? row.po_orders[0] : row.po_orders;
}

function compactText(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function poSizeMixItemName(line: PoSizeMixLineRow) {
  return (
    compactText(line.full_name) ||
    compactText(line.product_title_snapshot) ||
    compactText(line.catalog_product_title) ||
    compactText(line.variant_title_snapshot) ||
    compactText(line.sku)
  );
}

function poSizeMixVariantText(line: PoSizeMixLineRow) {
  return [
    line.variant_title_snapshot,
    line.catalog_variant_title,
    line.catalog_option_pick,
    line.catalog_option1_value,
    line.catalog_option2_value,
    line.catalog_option3_value,
    ...payloadSizeMixText(line.source_payload).filter((item) =>
      /\b(size|small|medium|large|xl|xxl|oz|k[1-9]|\d{1,2})\b/i.test(item),
    ),
  ]
    .map((item) => item?.trim())
    .filter(Boolean)
    .join(" / ");
}

function poSizeMixReference(order: NonNullable<ReturnType<typeof singlePoOrder>>) {
  return (
    compactText(order.quotation_reference) ||
    compactText(order.supplier_invoice_no) ||
    compactText(order.rqq_id) ||
    compactText(order.po_title) ||
    compactText(order.po_id)
  );
}

function poSizeMixSupplier(order: NonNullable<ReturnType<typeof singlePoOrder>>) {
  return compactText(order.supplier_name_snapshot) || compactText(order.supplier_code) || "Unknown supplier";
}

function parseReasonForSizeMixUnknown(
  group: Exclude<PoSizeMixGroup, "adult_apparel_curve">,
  bucket: string,
  line: PoSizeMixLineRow,
) {
  if (!joinedGroupText(line).trim()) {
    return "Missing SKU/name/variant text";
  }
  if (group === "gloves_oz") {
    return "No oz pattern found";
  }
  if (group === "mma_gloves_size") {
    return "No size token found";
  }
  if (bucket === "Other / Unknown") {
    return "Group classified but size not parsed";
  }
  return "No size token found";
}

function shouldUsePoSizeMixSqlRows(rows: PoSizeMixSummaryRow[]) {
  if (rows.length === 0) {
    return true;
  }

  const rowGroups = new Set(rows.map((row) => row.mix_group).filter(Boolean));
  const sampleQty = rows
    .filter((row) => row.mix_group !== "adult_apparel_curve")
    .reduce((sum, row) => sum + toNumber(row.qty), 0);
  const allQtyIsUnknown = rows.every((row) => (row.bucket?.trim() || "Unknown") === "Unknown");

  return sampleQty >= 10000 && rowGroups.size >= 4 && !allQtyIsUnknown;
}

function sortSizeMixRows(group: PoSizeMixGroup, rows: PoSizeMixBucket[]) {
  const bucketOrder = SIZE_MIX_GROUPS.find((item) => item.group === group)?.buckets ?? [];
  const orderIndex = new Map(bucketOrder.map((bucket, index) => [bucket, index]));
  return [...rows].sort((a, b) => {
    const aIndex = orderIndex.get(a.bucket) ?? (a.bucket === "Unknown" ? 999 : 998);
    const bIndex = orderIndex.get(b.bucket) ?? (b.bucket === "Unknown" ? 999 : 998);
    return aIndex - bIndex || a.bucket.localeCompare(b.bucket);
  });
}

function buildPoSizeMixSummary(
  rows: PoSizeMixSummaryRow[],
  dataSource: PoSizeMixSummary["dataSource"],
  unknownLines: PoSizeMixUnknownLine[] = [],
): PoSizeMixSummary {
  const rowsByGroup = new Map<PoSizeMixGroup, PoSizeMixBucket[]>();

  for (const row of rows) {
    const group = row.mix_group as PoSizeMixGroup | null;
    const qty = toNumber(row.qty);
    if (!group || qty <= 0) {
      continue;
    }
    const bucket = normalizeSizeMixBucket(group, row.bucket ?? "Unknown");
    const currentRows = rowsByGroup.get(group) ?? [];
    currentRows.push({
      bucket,
      pct: Math.round(toNumber(row.pct) * 10) / 10,
      qty,
      rank: Math.max(1, Math.round(toNumber(row.rank))),
    });
    rowsByGroup.set(group, currentRows);
  }

  const cards = SIZE_MIX_GROUPS.map((groupConfig) => {
    const rowsForGroup = sortSizeMixRows(groupConfig.group, rowsByGroup.get(groupConfig.group) ?? []);
    const totalQty = rowsForGroup.reduce((sum, row) => sum + row.qty, 0);
    return {
      group: groupConfig.group,
      rows: rowsForGroup,
      title: groupConfig.title,
      totalQty,
      unknownQty: rowsForGroup
        .filter((row) => isUnknownCleanupBucket(row.bucket))
        .reduce((sum, row) => sum + row.qty, 0),
      unknownLines: unknownLines.filter((line) => line.group === groupConfig.group),
    };
  });

  const sampleQty = cards
    .filter((card) => card.group !== "adult_apparel_curve")
    .reduce((sum, card) => sum + card.totalQty, 0);
  const unknownQty = cards
    .filter((card) => card.group !== "adult_apparel_curve")
    .reduce((sum, card) => sum + card.unknownQty, 0);

  return {
    cards,
    dataSource,
    excludedStatuses: SIZE_MIX_EXCLUDED_STATUSES,
    includedStatuses: SIZE_MIX_INCLUDED_STATUSES,
    lowSampleSize: sampleQty > 0 && sampleQty < 50,
    notes: emptySizeMixSummary.notes,
    sampleQty,
    takeaways: buildPoSizeMixTakeaways(cards),
    unknownQty,
    unknownLineLimit: 50,
  };
}

function topBuckets(cards: PoSizeMixCard[], group: PoSizeMixGroup, limit: number) {
  return [...(cards.find((card) => card.group === group)?.rows ?? [])]
    .filter((row) => row.bucket !== "Unknown" && row.bucket !== "Other / Unknown" && row.qty > 0)
    .sort((a, b) => b.qty - a.qty || a.bucket.localeCompare(b.bucket))
    .slice(0, limit)
    .map((row) => row.bucket);
}

function formatList(values: string[]) {
  if (values.length <= 1) {
    return values[0] ?? "";
  }
  if (values.length === 2) {
    return `${values[0]} and ${values[1]}`;
  }
  return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
}

function buildPoSizeMixTakeaways(cards: PoSizeMixCard[]) {
  const adultSizes = topBuckets(cards, "adult_apparel_curve", 3);
  const gloveSizes = topBuckets(cards, "gloves_oz", 2);
  const mmaGloveSizes = topBuckets(cards, "mma_gloves_size", 2);
  const shinSizes = topBuckets(cards, "shin_guards_size", 2);
  return [
    adultSizes.length ? `${formatList(adultSizes)} are the core adult apparel sizes.` : "",
    gloveSizes.length ? `For boxing/Muay Thai gloves, ${formatList(gloveSizes)} dominate orders.` : "",
    mmaGloveSizes.length ? `For MMA gloves, ${formatList(mmaGloveSizes)} are the key sizes.` : "",
    shinSizes.length ? `For shin guards, ${formatList(shinSizes)} are the key sizes.` : "",
  ].filter(Boolean);
}

async function enrichSizeMixRowsWithCatalog(
  supabase: NonNullable<ReturnType<typeof getSupabaseServiceClient>>,
  rows: PoSizeMixLineRow[],
) {
  const skus = Array.from(new Set(rows.map((row) => row.sku?.trim()).filter(Boolean) as string[]));
  if (!skus.length) {
    return rows;
  }

  const variantResult = await supabase
    .from("product_variants")
    .select("sku,variant_title,option1_value,option2_value,option3_value,option_pick,products(product_title,product_type,tags)")
    .in("sku", skus);

  if (variantResult.error) {
    return rows;
  }

  const variantBySku = new Map(
    ((variantResult.data ?? []) as unknown as ProductVariantSizeMixRow[])
      .filter((row) => row.sku)
      .map((row) => [row.sku!, row]),
  );

  return rows.map((row) => {
    const variant = row.sku ? variantBySku.get(row.sku) : null;
    const product = firstProduct(variant?.products);
    return {
      ...row,
      catalog_option1_value: variant?.option1_value ?? null,
      catalog_option2_value: variant?.option2_value ?? null,
      catalog_option3_value: variant?.option3_value ?? null,
      catalog_option_pick: variant?.option_pick ?? null,
      catalog_product_title: product?.product_title ?? null,
      catalog_product_type: product?.product_type ?? null,
      catalog_tags: product?.tags ?? null,
      catalog_variant_title: variant?.variant_title ?? null,
    };
  });
}

async function fetchPoSizeMixSourceLines(
  supabase: NonNullable<ReturnType<typeof getSupabaseServiceClient>>,
  warnings?: QueryWarning[],
) {
  const fallbackRows: PoSizeMixLineRow[] = [];
  const pageSize = 1000;
  for (let offset = 0; offset < 10000; offset += pageSize) {
    const lineResult = await supabase
      .from("po_items")
      .select(
        [
          "sku",
          "product_title_snapshot",
          "variant_title_snapshot",
          "full_name",
          "remark",
          "source_payload",
          "ordered_qty",
          "cancelled_qty",
          "line_status",
          "po_orders!inner(po_id,rqq_id,po_title,quotation_reference,supplier_invoice_no,supplier_code,supplier_name_snapshot,work_status,cancelled_at)",
        ].join(","),
      )
      .range(offset, offset + pageSize - 1);

    if (lineResult.error) {
      warnings?.push({ label: "Historical PO Size Mix Fallback", message: lineResult.error.message });
      break;
    }

    const pageRows = (lineResult.data ?? []) as unknown as PoSizeMixLineRow[];
    fallbackRows.push(...pageRows);
    if (pageRows.length < pageSize) {
      break;
    }
  }

  if (fallbackRows.length >= 10000) {
    warnings?.push({
      label: "Historical PO Size Mix Fallback",
      message: "Fallback aggregation stopped at 10,000 PO lines. Apply the po_size_mix_summary SQL view for complete fast results.",
    });
  }

  return enrichSizeMixRowsWithCatalog(supabase, fallbackRows);
}

function aggregatePoSizeMixRows(lines: PoSizeMixLineRow[]) {
  const totals = new Map<string, number>();

  for (const line of lines) {
    const order = Array.isArray(line.po_orders) ? line.po_orders[0] : line.po_orders;
    if (
      !order ||
      order.cancelled_at ||
      isSizeMixCancelledStatus(order.work_status) ||
      isSizeMixCancelledStatus(line.line_status)
    ) {
      continue;
    }

    const qty = Math.max(toNumber(line.ordered_qty) - toNumber(line.cancelled_qty), 0);
    const group = classifyPoSizeMixGroup(line);
    if (!group || qty <= 0) {
      continue;
    }

    const bucket = normalizeSizeMixBucket(group, extractPoSizeMixBucket(group, line));
    totals.set(`${group}|${bucket}`, (totals.get(`${group}|${bucket}`) ?? 0) + qty);
    if (["shirts_tops_size", "shorts_size", "singlets_size"].includes(group) && isAdultApparelSize(bucket)) {
      totals.set(`adult_apparel_curve|${bucket}`, (totals.get(`adult_apparel_curve|${bucket}`) ?? 0) + qty);
    }
  }

  const groupTotals = new Map<string, number>();
  for (const [key, qty] of totals) {
    const [group] = key.split("|");
    groupTotals.set(group, (groupTotals.get(group) ?? 0) + qty);
  }

  const rows = Array.from(totals.entries()).map(([key, qty]) => {
    const [mix_group, bucket] = key.split("|");
    const total = groupTotals.get(mix_group) ?? 0;
    return {
      bucket,
      mix_group,
      pct: total > 0 ? Math.round((qty / total) * 1000) / 10 : 0,
      qty,
      rank: 1,
    } satisfies PoSizeMixSummaryRow;
  });

  const rowsByGroup = new Map<string, PoSizeMixSummaryRow[]>();
  for (const row of rows) {
    const currentRows = rowsByGroup.get(row.mix_group ?? "") ?? [];
    currentRows.push(row);
    rowsByGroup.set(row.mix_group ?? "", currentRows);
  }
  for (const groupRows of rowsByGroup.values()) {
    groupRows
      .sort((a, b) => toNumber(b.qty) - toNumber(a.qty) || (a.bucket ?? "").localeCompare(b.bucket ?? ""))
      .forEach((row, index) => {
        row.rank = index + 1;
      });
  }

  return rows;
}

function buildPoSizeMixUnknownLines(lines: PoSizeMixLineRow[], limitPerGroup = 50) {
  const linesByGroup = new Map<PoSizeMixGroup, PoSizeMixUnknownLine[]>();

  for (const line of lines) {
    const order = singlePoOrder(line);
    if (
      !order ||
      order.cancelled_at ||
      isSizeMixCancelledStatus(order.work_status) ||
      isSizeMixCancelledStatus(line.line_status)
    ) {
      continue;
    }

    const qty = Math.max(toNumber(line.ordered_qty) - toNumber(line.cancelled_qty), 0);
    const group = classifyPoSizeMixGroup(line);
    if (!group || qty <= 0) {
      continue;
    }

    const bucket = normalizeSizeMixBucket(group, extractPoSizeMixBucket(group, line));
    if (!isUnknownCleanupBucket(bucket)) {
      continue;
    }

    const poId = compactText(order.po_id);
    const unknownLine: PoSizeMixUnknownLine = {
      group,
      href: poId ? `/po/${encodeURIComponent(poId)}` : "/po",
      itemName: poSizeMixItemName(line),
      orderedQty: qty,
      parseReason: parseReasonForSizeMixUnknown(group, bucket, line),
      poId,
      poReference: poSizeMixReference(order),
      sku: compactText(line.sku),
      supplierName: poSizeMixSupplier(order),
      variantText: poSizeMixVariantText(line),
    };

    const groupLines = linesByGroup.get(group) ?? [];
    groupLines.push(unknownLine);
    linesByGroup.set(group, groupLines);

    if (["shirts_tops_size", "shorts_size", "singlets_size"].includes(group)) {
      const adultLines = linesByGroup.get("adult_apparel_curve") ?? [];
      adultLines.push({ ...unknownLine, group: "adult_apparel_curve" });
      linesByGroup.set("adult_apparel_curve", adultLines);
    }
  }

  return Array.from(linesByGroup.values()).flatMap((groupLines) =>
    groupLines.sort((a, b) => b.orderedQty - a.orderedQty).slice(0, limitPerGroup),
  );
}

async function getPoSizeMixSummary(
  supabase: NonNullable<ReturnType<typeof getSupabaseServiceClient>>,
  warnings: QueryWarning[],
): Promise<PoSizeMixSummary> {
  const viewResult = await supabase
    .from("po_size_mix_summary")
    .select("mix_group,bucket,qty,pct,rank")
    .order("mix_group", { ascending: true })
    .order("rank", { ascending: true });

  if (!viewResult.error) {
    const sqlRows = (viewResult.data ?? []) as PoSizeMixSummaryRow[];
    const enrichedRows = await fetchPoSizeMixSourceLines(supabase, warnings);
    const unknownLines = buildPoSizeMixUnknownLines(enrichedRows);
    if (shouldUsePoSizeMixSqlRows(sqlRows)) {
      return buildPoSizeMixSummary(sqlRows, "sql-view", unknownLines);
    }
    warnings.push({
      label: "Historical PO Size Mix",
      message: "SQL view returned an implausibly small or all-Unknown summary; used server-side fallback aggregation.",
    });
    return buildPoSizeMixSummary(aggregatePoSizeMixRows(enrichedRows), "server-fallback", unknownLines);
  } else {
    warnings.push({
      label: "Historical PO Size Mix",
      message: `SQL view unavailable; used server-side fallback aggregation. ${viewResult.error.message}`,
    });
  }

  const enrichedRows = await fetchPoSizeMixSourceLines(supabase, warnings);
  return buildPoSizeMixSummary(
    aggregatePoSizeMixRows(enrichedRows),
    "server-fallback",
    buildPoSizeMixUnknownLines(enrichedRows),
  );
}

export async function getPoSizeMixUnknownExamples(limit = 10): Promise<PoSizeMixUnknownExample[]> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return [];
  }

  const examples = new Map<string, PoSizeMixUnknownExample>();
  const enrichedRows = await fetchPoSizeMixSourceLines(supabase);
  for (const line of enrichedRows) {
    const order = Array.isArray(line.po_orders) ? line.po_orders[0] : line.po_orders;
    if (
      !order ||
      order.cancelled_at ||
      isSizeMixCancelledStatus(order.work_status) ||
      isSizeMixCancelledStatus(line.line_status)
    ) {
      continue;
    }

    const qty = Math.max(toNumber(line.ordered_qty) - toNumber(line.cancelled_qty), 0);
    const group = classifyPoSizeMixGroup(line);
    if (!group || qty <= 0) {
      continue;
    }

    const bucket = normalizeSizeMixBucket(group, extractPoSizeMixBucket(group, line));
    if (!isUnknownCleanupBucket(bucket)) {
      continue;
    }

    const sku = line.sku?.trim() ?? "";
    const name =
      line.full_name?.trim() ||
      line.product_title_snapshot?.trim() ||
      line.catalog_product_title?.trim() ||
      line.variant_title_snapshot?.trim() ||
      "";
    const key = `${group}|${sku}|${name}`;
    const current = examples.get(key) ?? {
      group,
      name,
      qty: 0,
      rawText: joinedProductText(line),
      sku,
      variant: line.variant_title_snapshot?.trim() || line.catalog_variant_title?.trim() || "",
    };
    current.qty += qty;
    examples.set(key, current);
  }

  return [...examples.values()].sort((a, b) => b.qty - a.qty).slice(0, Math.max(1, limit));
}

function toDateInput(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: BANGKOK_TIME_ZONE,
    year: "numeric",
  }).formatToParts(date);
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? "01";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function addDays(dateInput: string, days: number) {
  const [year, month, day] = dateInput.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function freshnessFor(latestRun: SyncRunRow | null, latestSuccess: SyncRunRow | null) {
  if (!latestRun && !latestSuccess) {
    return "unknown" as const;
  }
  if (latestRun?.status === "failed") {
    return "failed" as const;
  }
  const successTime = latestSuccess?.finished_at ?? latestSuccess?.started_at;
  if (!successTime) {
    return "unknown" as const;
  }
  const ageMs = Date.now() - new Date(successTime).getTime();
  if (!Number.isFinite(ageMs)) {
    return "unknown" as const;
  }
  return ageMs <= 24 * 60 * 60 * 1000 ? ("fresh" as const) : ("stale" as const);
}

function durationFor(latestRun: SyncRunRow | null) {
  return (
    nullableNumber(latestRun?.duration_seconds) ??
    (latestRun?.started_at && latestRun?.finished_at
      ? Math.round((new Date(latestRun.finished_at).getTime() - new Date(latestRun.started_at).getTime()) / 1000)
      : null)
  );
}

function syncSourceSummary(
  source: string,
  latestRun: SyncRunRow | null,
  latestSuccess: SyncRunRow | null,
): ShopifySyncSourceSummary {
  return {
    dataFreshness: freshnessFor(latestRun, latestSuccess),
    durationSeconds: durationFor(latestRun),
    errorMessage: latestRun?.error_message ?? null,
    inventoryRowsSynced: nullableNumber(latestRun?.inventory_rows_seen),
    lastStatus: statusFor(latestRun),
    lastSuccessfulSyncTime: latestSuccess?.finished_at ?? latestSuccess?.started_at ?? null,
    lastSyncTime: latestRun?.finished_at ?? latestRun?.started_at ?? null,
    ordersSeen: nullableNumber(latestRun?.orders_seen),
    productsSynced: nullableNumber(latestRun?.products_seen),
    salesLinesSeen: nullableNumber(latestRun?.sales_lines_seen),
    source,
    syncLogFound: Boolean(latestRun || latestSuccess),
    variantsSynced: nullableNumber(latestRun?.variants_seen),
  };
}

function overallSyncHealth(summaries: ShopifySyncSourceSummary[]): SyncHealthStatus {
  if (summaries.every((summary) => !summary.syncLogFound)) {
    return "unknown";
  }
  if (summaries.some((summary) => summary.lastStatus === "failed")) {
    return "failed";
  }
  if (summaries.some((summary) => !summary.syncLogFound || summary.dataFreshness !== "fresh")) {
    return "warning";
  }
  return "fresh";
}

function unavailableSyncSourceSummary(source: string, errorMessage: string): ShopifySyncSourceSummary {
  return {
    dataFreshness: "unknown",
    durationSeconds: null,
    errorMessage,
    inventoryRowsSynced: null,
    lastStatus: "unknown",
    lastSuccessfulSyncTime: null,
    lastSyncTime: null,
    ordersSeen: null,
    productsSynced: null,
    salesLinesSeen: null,
    source,
    syncLogFound: false,
    variantsSynced: null,
  };
}

function statusFor(latestRun: SyncRunRow | null) {
  if (!latestRun?.status) {
    return "unknown" as const;
  }
  if (latestRun.status === "completed") {
    return "success" as const;
  }
  if (latestRun.status === "failed") {
    return "failed" as const;
  }
  if (latestRun.status === "running") {
    return "running" as const;
  }
  return "unknown" as const;
}

async function countRows(
  label: string,
  run: () => PromiseLike<{ count: number | null; error: { message: string } | null }>,
): Promise<CountResult> {
  const { count, error } = await run();
  if (error) {
    return { count: 0, warning: { label, message: error.message } };
  }
  return { count: count ?? 0 };
}

export async function getPoDashboardData(): Promise<PoDashboardData> {
  const generatedAt = new Date().toISOString();
  const supabase = getSupabaseServiceClient();
  const warnings: QueryWarning[] = [];
  const today = toDateInput(new Date());
  const next7 = addDays(today, 7);
  const next30 = addDays(today, 30);
  const sevenDaysAgo = addDays(today, -7);

  if (!supabase) {
    const catalogInventory = unavailableSyncSourceSummary(
      SHOPIFY_PRODUCTS_INVENTORY_SYNC_SOURCE,
      "Supabase service client is not configured.",
    );
    const ordersSales = unavailableSyncSourceSummary(
      SHOPIFY_ORDERS_SALES_SYNC_SOURCE,
      "Supabase service client is not configured.",
    );

    return {
      generatedAt,
      incomingEta: { arrivingSoon: 0, lateEta: 0, nextExpectedArrival: null, noEta: 0 },
      payments: {
        dueNext30Days: 0,
        dueThisWeek: 0,
        missingFxCount: 0,
        overduePayments: 0,
        paidTotalThb: 0,
        plannedTotalThb: 0,
        xeroDraftCount: 0,
        xeroPendingCount: 0,
        xeroUploadedCount: 0,
      },
      poOverview: {
        inProduction: 0,
        inTransit: 0,
        openPoCount: 0,
        openPoValueThb: null,
        outstandingQty: 0,
        readyToShip: 0,
        receivingPending: 0,
      },
      receiving: {
        lastGoodsReceiptDate: null,
        linesWithOutstandingQty: 0,
        outstandingReceivingQty: 0,
        posWaitingToReceive: 0,
        recentlyReceivedCount: 0,
      },
      sync: {
        catalogInventory,
        dataFreshness: "unknown",
        ordersSales,
        syncLogFound: false,
      },
      sizeMix: emptySizeMixSummary,
      attentionItems: [
        {
          detail: "Dashboard data is unavailable until Supabase service credentials are configured.",
          label: "Database connection missing",
          tone: "gray",
        },
      ],
      warnings,
    };
  }

  const [
    latestCatalogSyncResult,
    latestCatalogSuccessResult,
    latestOrdersSyncResult,
    latestOrdersSuccessResult,
    metricsResult,
    openPoCount,
    inProductionCount,
    readyToShipCount,
    inTransitCount,
    receivingPendingCount,
    openPoValueResult,
    overduePaymentCount,
    dueThisWeekCount,
    dueNext30DaysCount,
    missingFxCount,
    xeroPendingCount,
    xeroDraftCount,
    xeroUploadedCount,
    recentReceiptsCount,
    latestReceiptResult,
    arrivingSoonCount,
    lateEtaCount,
    noEtaCount,
    nextEtaResult,
    sizeMix,
  ] = await Promise.all([
    supabase
      .from("sync_runs")
      .select(
        "source,status,started_at,finished_at,products_seen,variants_seen,inventory_rows_seen,orders_seen,sales_lines_seen,rows_upserted,error_message",
      )
      .eq("source", SHOPIFY_PRODUCTS_INVENTORY_SYNC_SOURCE)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("sync_runs")
      .select(
        "source,status,started_at,finished_at,products_seen,variants_seen,inventory_rows_seen,orders_seen,sales_lines_seen,rows_upserted,error_message",
      )
      .eq("source", SHOPIFY_PRODUCTS_INVENTORY_SYNC_SOURCE)
      .eq("status", "completed")
      .order("finished_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("sync_runs")
      .select(
        "source,status,started_at,finished_at,products_seen,variants_seen,inventory_rows_seen,orders_seen,sales_lines_seen,rows_upserted,error_message",
      )
      .eq("source", SHOPIFY_ORDERS_SALES_SYNC_SOURCE)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("sync_runs")
      .select(
        "source,status,started_at,finished_at,products_seen,variants_seen,inventory_rows_seen,orders_seen,sales_lines_seen,rows_upserted,error_message",
      )
      .eq("source", SHOPIFY_ORDERS_SALES_SYNC_SOURCE)
      .eq("status", "completed")
      .order("finished_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("po_portal_metrics").select("*").limit(1).maybeSingle(),
    countRows("Open POs", () =>
      supabase
        .from("po_order_summary")
        .select("*", { count: "exact", head: true })
        .is("closed_at", null)
        .is("cancelled_at", null)
        .not("work_status", "in", "(closed,cancelled,canceled)"),
    ),
    countRows("In Production POs", () =>
      supabase
        .from("po_order_summary")
        .select("*", { count: "exact", head: true })
        .eq("work_status", "inpro")
        .is("closed_at", null)
        .is("cancelled_at", null),
    ),
    countRows("Ready to Ship POs", () =>
      supabase
        .from("po_order_summary")
        .select("*", { count: "exact", head: true })
        .eq("work_status", "final_payment")
        .is("closed_at", null)
        .is("cancelled_at", null),
    ),
    countRows("In Transit POs", () =>
      supabase
        .from("po_order_summary")
        .select("*", { count: "exact", head: true })
        .eq("work_status", "delivery")
        .is("closed_at", null)
        .is("cancelled_at", null),
    ),
    countRows("Receiving Pending POs", () =>
      supabase
        .from("po_order_summary")
        .select("*", { count: "exact", head: true })
        .gt("total_outstanding_qty", 0)
        .is("closed_at", null)
        .is("cancelled_at", null),
    ),
    supabase
      .from("po_order_summary")
      .select("po_amount_thb,active_line_count,pending_line_count")
      .is("closed_at", null)
      .is("cancelled_at", null)
      .not("work_status", "in", "(closed,cancelled,canceled)")
      .limit(2000),
    countRows("Overdue Payments", () =>
      supabase
        .from("po_payments")
        .select("*", { count: "exact", head: true })
        .ilike("payment_status", "planned")
        .lt("due_date", today),
    ),
    countRows("Payments Due This Week", () =>
      supabase
        .from("po_payments")
        .select("*", { count: "exact", head: true })
        .ilike("payment_status", "planned")
        .gte("due_date", today)
        .lte("due_date", next7),
    ),
    countRows("Payments Due Next 30 Days", () =>
      supabase
        .from("po_payments")
        .select("*", { count: "exact", head: true })
        .ilike("payment_status", "planned")
        .gte("due_date", today)
        .lte("due_date", next30),
    ),
    countRows("Missing FX Payments", () =>
      supabase
        .from("po_payments")
        .select("*", { count: "exact", head: true })
        .neq("currency", "THB")
        .lte("exchange_rate", 1),
    ),
    countRows("Xero Pending Payments", () =>
      supabase
        .from("po_payments")
        .select("*", { count: "exact", head: true })
        .eq("xero_status", "pending"),
    ),
    countRows("Xero Draft Payments", () =>
      supabase
        .from("po_payments")
        .select("*", { count: "exact", head: true })
        .eq("xero_status", "draft"),
    ),
    countRows("Xero Uploaded Payments", () =>
      supabase
        .from("po_payments")
        .select("*", { count: "exact", head: true })
        .eq("xero_status", "uploaded"),
    ),
    countRows("Recent Goods Receipts", () =>
      supabase
        .from("po_receipts")
        .select("*", { count: "exact", head: true })
        .gte("received_at", `${sevenDaysAgo}T00:00:00+07:00`),
    ),
    supabase
      .from("po_receipts")
      .select("actual_received_date,received_at")
      .order("received_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
    countRows("Arriving Soon ETA", () =>
      supabase
        .from("po_incoming_eta_events")
        .select("*", { count: "exact", head: true })
        .gte("eta_date", today)
        .lte("eta_date", next7),
    ),
    countRows("Late ETA", () =>
      supabase
        .from("po_incoming_eta_events")
        .select("*", { count: "exact", head: true })
        .lt("eta_date", today),
    ),
    countRows("No ETA", () =>
      supabase
        .from("po_incoming_eta_unscheduled_events")
        .select("*", { count: "exact", head: true }),
    ),
    supabase
      .from("po_incoming_eta_events")
      .select("eta_date")
      .gte("eta_date", today)
      .order("eta_date", { ascending: true })
      .limit(1)
      .maybeSingle(),
    getPoSizeMixSummary(supabase, warnings),
  ]);

  const collectWarning = (warning?: QueryWarning) => {
    if (warning) {
      warnings.push(warning);
    }
  };

  [
    openPoCount,
    inProductionCount,
    readyToShipCount,
    inTransitCount,
    receivingPendingCount,
    overduePaymentCount,
    dueThisWeekCount,
    dueNext30DaysCount,
    missingFxCount,
    xeroPendingCount,
    xeroDraftCount,
    xeroUploadedCount,
    recentReceiptsCount,
    arrivingSoonCount,
    lateEtaCount,
    noEtaCount,
  ].forEach((result) => collectWarning(result.warning));

  if (latestCatalogSyncResult.error) {
    warnings.push({ label: "Catalog / Inventory Sync", message: latestCatalogSyncResult.error.message });
  }
  if (latestCatalogSuccessResult.error) {
    warnings.push({
      label: "Last Successful Catalog / Inventory Sync",
      message: latestCatalogSuccessResult.error.message,
    });
  }
  if (latestOrdersSyncResult.error) {
    warnings.push({ label: "Orders / Sales Lines Sync", message: latestOrdersSyncResult.error.message });
  }
  if (latestOrdersSuccessResult.error) {
    warnings.push({
      label: "Last Successful Orders / Sales Lines Sync",
      message: latestOrdersSuccessResult.error.message,
    });
  }
  if (metricsResult.error) {
    warnings.push({ label: "PO Portal Metrics", message: metricsResult.error.message });
  }
  if (openPoValueResult.error) {
    warnings.push({ label: "Open PO Value", message: openPoValueResult.error.message });
  }
  if (latestReceiptResult.error) {
    warnings.push({ label: "Latest Goods Receipt", message: latestReceiptResult.error.message });
  }
  if (nextEtaResult.error) {
    warnings.push({ label: "Next Expected Arrival", message: nextEtaResult.error.message });
  }

  const latestCatalogRun = (latestCatalogSyncResult.data ?? null) as SyncRunRow | null;
  const latestCatalogSuccess = (latestCatalogSuccessResult.data ?? null) as SyncRunRow | null;
  const latestOrdersRun = (latestOrdersSyncResult.data ?? null) as SyncRunRow | null;
  const latestOrdersSuccess = (latestOrdersSuccessResult.data ?? null) as SyncRunRow | null;
  const metrics = (metricsResult.data ?? null) as PoMetricsRow | null;
  const poValueRows = (openPoValueResult.data ?? []) as PoValueRow[];
  const latestReceipt = (latestReceiptResult.data ?? null) as ReceiptDateRow | null;
  const nextEta = (nextEtaResult.data ?? null) as EtaDateRow | null;
  const openPoValueThb =
    openPoValueResult.error || poValueRows.length === 2000
      ? null
      : poValueRows.reduce((sum, row) => sum + toNumber(row.po_amount_thb), 0);

  if (poValueRows.length === 2000) {
    warnings.push({
      label: "Open PO Value",
      message: "Open PO value was not summed because more than 2,000 open rows may exist.",
    });
  }

  const outstandingQty =
    toNumber(metrics?.active_incoming_total) + toNumber(metrics?.pending_approval_total);
  const linesWithOutstandingQty = poValueRows.reduce(
    (sum, row) => sum + toNumber(row.active_line_count) + toNumber(row.pending_line_count),
    0,
  );
  const catalogInventory = syncSourceSummary(
    SHOPIFY_PRODUCTS_INVENTORY_SYNC_SOURCE,
    latestCatalogRun,
    latestCatalogSuccess,
  );
  const ordersSales = syncSourceSummary(
    SHOPIFY_ORDERS_SALES_SYNC_SOURCE,
    latestOrdersRun,
    latestOrdersSuccess,
  );
  const syncFreshness = overallSyncHealth([catalogInventory, ordersSales]);

  const data: PoDashboardData = {
    generatedAt,
    incomingEta: {
      arrivingSoon: arrivingSoonCount.count,
      lateEta: lateEtaCount.count,
      nextExpectedArrival: nextEta?.eta_date ?? null,
      noEta: noEtaCount.count,
    },
    payments: {
      dueNext30Days: dueNext30DaysCount.count,
      dueThisWeek: dueThisWeekCount.count,
      missingFxCount: missingFxCount.count,
      overduePayments: overduePaymentCount.count,
      paidTotalThb: toNumber(metrics?.open_paid_amount_thb),
      plannedTotalThb: toNumber(metrics?.planned_amount_thb),
      xeroDraftCount: xeroDraftCount.count,
      xeroPendingCount: xeroPendingCount.count,
      xeroUploadedCount: xeroUploadedCount.count,
    },
    poOverview: {
      inProduction: inProductionCount.count,
      inTransit: inTransitCount.count,
      openPoCount: openPoCount.count,
      openPoValueThb,
      outstandingQty,
      readyToShip: readyToShipCount.count,
      receivingPending: receivingPendingCount.count,
    },
    receiving: {
      lastGoodsReceiptDate: latestReceipt?.actual_received_date ?? latestReceipt?.received_at ?? null,
      linesWithOutstandingQty,
      outstandingReceivingQty: outstandingQty,
      posWaitingToReceive: receivingPendingCount.count,
      recentlyReceivedCount: recentReceiptsCount.count,
    },
    sync: {
      catalogInventory,
      dataFreshness: syncFreshness,
      ordersSales,
      syncLogFound: catalogInventory.syncLogFound || ordersSales.syncLogFound,
    },
    sizeMix,
    attentionItems: [],
    warnings,
  };

  data.attentionItems = [
    ...(data.sync.dataFreshness === "failed"
      ? [
          {
            detail: [data.sync.catalogInventory, data.sync.ordersSales]
              .filter((summary) => summary.lastStatus === "failed")
              .map((summary) => summary.errorMessage ?? `${summary.source} failed.`)
              .join(" "),
            label: "Shopify sync failed",
            tone: "red" as const,
          },
        ]
      : []),
    ...(data.sync.dataFreshness === "warning"
      ? [
          {
            detail: "One required Shopify sync source is missing, stale, or still running.",
            label: "Shopify sync needs review",
            tone: "yellow" as const,
          },
        ]
      : []),
    ...(data.payments.overduePayments > 0
      ? [
          {
            detail: `${data.payments.overduePayments} planned payment(s) are past due.`,
            href: "/po",
            label: "Overdue payments",
            tone: "red" as const,
          },
        ]
      : []),
    ...(data.payments.missingFxCount > 0
      ? [
          {
            detail: `${data.payments.missingFxCount} foreign currency payment row(s) need FX.`,
            href: "/po",
            label: "Missing FX",
            tone: "yellow" as const,
          },
        ]
      : []),
    ...(data.payments.xeroPendingCount + data.payments.xeroDraftCount > 0
      ? [
          {
            detail: `${data.payments.xeroPendingCount} pending and ${data.payments.xeroDraftCount} draft row(s).`,
            href: "/po",
            label: "Xero tracking open",
            tone: "blue" as const,
          },
        ]
      : []),
    ...(data.incomingEta.lateEta > 0
      ? [
          {
            detail: `${data.incomingEta.lateEta} incoming ETA line(s) are late.`,
            href: "/po",
            label: "Late incoming ETA",
            tone: "red" as const,
          },
        ]
      : []),
    ...(data.incomingEta.noEta > 0
      ? [
          {
            detail: `${data.incomingEta.noEta} incoming line(s) do not have an ETA.`,
            href: "/po",
            label: "Missing ETA",
            tone: "yellow" as const,
          },
        ]
      : []),
    ...(data.receiving.posWaitingToReceive > 0
      ? [
          {
            detail: `${data.receiving.posWaitingToReceive} PO(s) still have outstanding receiving.`,
            href: "/po",
            label: "Receiving pending",
            tone: "blue" as const,
          },
        ]
      : []),
    ...(data.payments.dueThisWeek > 0
      ? [
          {
            detail: `${data.payments.dueThisWeek} planned payment(s) are due in the next 7 days.`,
            href: "/po",
            label: "Payments due this week",
            tone: "yellow" as const,
          },
        ]
      : []),
  ].slice(0, 10);

  if (!data.sync.syncLogFound) {
    data.attentionItems.unshift({
      detail: "No durable sync run was found in sync_runs.",
      label: "Shopify sync log unavailable",
      tone: "gray",
    });
  }

  if (data.attentionItems.length === 0) {
    data.attentionItems.push({
      detail: "No urgent PO, payment, sync, or ETA issues were found in the lightweight checks.",
      label: "No immediate attention items",
      tone: "green",
    });
  }

  return data;
}
