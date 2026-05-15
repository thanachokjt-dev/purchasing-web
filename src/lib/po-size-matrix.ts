export const APPAREL_SIZE_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "OS"];
export const GLOVE_SIZE_ORDER = ["Kid", "4 Oz", "6 Oz", "8 Oz", "10 Oz", "12 Oz", "14 Oz", "16 Oz", "18 Oz"];
export const PROTECTIVE_SIZE_ORDER = ["S", "M", "L", "XL"];

export const SIZE_PATTERN = [
  "18\\s*Oz",
  "16\\s*Oz",
  "14\\s*Oz",
  "12\\s*Oz",
  "10\\s*Oz",
  "8\\s*Oz",
  "6\\s*Oz",
  "4\\s*Oz",
  "One\\s*Size",
  "3XL",
  "2XL",
  "XXL",
  "2XS",
  "XXS",
  "XS",
  "XL",
  "K\\d+",
  "\\d{1,2}",
  "Kid",
  "L",
  "M",
  "S",
  "OS",
].join("|");

export type MatrixFamily =
  | "apparel"
  | "child-code"
  | "child-numeric"
  | "glove"
  | "one-size"
  | "protective"
  | "unknown";

export type MatrixItemLike = {
  fullName?: string | null;
  productName?: string | null;
  productTitle?: string | null;
  sku?: string | null;
  tags?: string[] | null;
  variantTitle?: string | null;
};

export function normalizeMatrixSize(value: string) {
  const clean = value.trim();
  if (!clean) {
    return "OS";
  }
  const compact = clean.replace(/\s+/g, "").toUpperCase();
  if (compact === "ONESIZE" || compact === "ONE-SIZE" || compact === "0") {
    return "OS";
  }
  if (compact === "2XS" || compact === "XXL") {
    return compact === "2XS" ? "XXS" : "2XL";
  }
  const ounce = compact.match(/^(\d{1,2})OZ$/);
  if (ounce) {
    return `${Number(ounce[1])} Oz`;
  }
  if (/^K\d+$/i.test(compact)) {
    return compact;
  }
  if (/^\d{1,2}$/.test(compact)) {
    return String(Number(compact));
  }
  if (compact === "KID" || compact === "KIDS") {
    return "Kid";
  }
  return compact;
}

export function matrixItemSize(item: MatrixItemLike) {
  const source = [
    item.variantTitle,
    item.fullName,
    item.productTitle,
    item.productName,
    item.sku,
  ].join(" ");
  const match = source.match(new RegExp(`(?:^|[\\s/-])(${SIZE_PATTERN})(?:$|[\\s/-])`, "i"));
  return normalizeMatrixSize(match?.[1] ?? "");
}

export function matrixProductName(item: MatrixItemLike) {
  const source = item.productTitle || item.productName || item.fullName || item.sku || "Product";
  return source
    .replace(new RegExp(`\\s*[/|-]\\s*(${SIZE_PATTERN})\\s*$`, "i"), "")
    .trim();
}

export function matrixSectionName(item: MatrixItemLike, fallback = "Untagged") {
  const tags = Array.isArray(item.tags) ? item.tags : [];
  const explicit = tags.find((tag) => tag.trim())?.trim();
  if (explicit) {
    return explicit;
  }

  const context = [
    item.productName,
    item.productTitle,
    item.variantTitle,
    item.fullName,
    item.sku,
  ].join(" ").toLowerCase();
  const rules: Array<[string, string[]]> = [
    ["MUAY THAI GLOVES", ["glove", "boxing glove", "muay thai glove", "mma glove", "mtg"]],
    ["SHIN GUARDS", ["shin guard", "shinguard"]],
    ["RASH GUARDS & COMPRESSION", ["rash guard", "compression", "spats"]],
    ["SPORT BRAS", ["sport bra", "sports bra", "bra"]],
    ["T-SHIRTS & TOPS", ["t-shirt", "tshirt", "tee", "shirt", "top", "tank", "jersey"]],
    ["SHORTS & PANTS", ["short", "pants", "jogger", "legging"]],
    ["ACCESSORIES", ["mouth guard", "hand wrap", "wrap", "bag", "cap"]],
  ];

  return rules.find(([, keywords]) => keywords.some((keyword) => context.includes(keyword)))?.[0] || fallback;
}

export function matrixFamilyLabel(family: MatrixFamily) {
  const labels: Record<MatrixFamily, string> = {
    apparel: "APPAREL",
    "child-code": "KIDS CODED SIZES",
    "child-numeric": "KIDS NUMERIC SIZES",
    glove: "GLOVES",
    "one-size": "ONE SIZE",
    protective: "PROTECTIVE GEAR",
    unknown: "OPTIONS",
  };
  return labels[family];
}

export function matrixItemFamily(item: MatrixItemLike): MatrixFamily {
  const size = matrixItemSize(item);
  const tags = Array.isArray(item.tags) ? item.tags.join(" ") : "";
  const context = [
    item.productName,
    item.productTitle,
    item.variantTitle,
    item.fullName,
    item.sku,
    matrixSectionName(item, ""),
    tags,
  ].join(" ").toLowerCase();

  if (/\b(glove|boxing glove|muay thai glove|mma glove|mtg)\b/.test(context) || /^\d+\s*Oz$/i.test(size)) {
    return "glove";
  }
  if (/\b(shin guard|shinguard|protective|sg)\b/.test(context) && PROTECTIVE_SIZE_ORDER.includes(size)) {
    return "protective";
  }
  if (/^K\d+$/i.test(size)) {
    return "child-code";
  }
  if (/^\d{1,2}$/.test(size)) {
    return "child-numeric";
  }
  if (size === "OS") {
    return "one-size";
  }
  if (/\b(kid|kids|child|youth)\b/.test(context)) {
    return /^K\d+$/i.test(size) ? "child-code" : /^\d{1,2}$/.test(size) ? "child-numeric" : "apparel";
  }
  if (APPAREL_SIZE_ORDER.includes(size)) {
    return "apparel";
  }
  return "unknown";
}

export function matrixSectionLabel(section: string, family: MatrixFamily) {
  return `${section} · ${matrixFamilyLabel(family)}`;
}

export function sizeSortRank(size: string, family: MatrixFamily) {
  const order =
    family === "glove"
      ? GLOVE_SIZE_ORDER
      : family === "protective"
        ? PROTECTIVE_SIZE_ORDER
        : family === "apparel" || family === "one-size"
          ? APPAREL_SIZE_ORDER
          : [];
  const index = order.indexOf(size);
  if (index >= 0) {
    return index;
  }
  if (family === "child-code") {
    const coded = size.match(/^K(\d+)$/i);
    if (coded) {
      return Number(coded[1]);
    }
  }
  if (family === "child-numeric" || /^\d+$/.test(size)) {
    return Number(size);
  }
  const ounce = size.match(/^(\d+)\s*Oz$/i);
  if (ounce) {
    return Number(ounce[1]);
  }
  return 10_000;
}

export function sortMatrixSizes(sizes: string[], family: MatrixFamily) {
  return Array.from(new Set(sizes.filter(Boolean))).sort(
    (a, b) => sizeSortRank(a, family) - sizeSortRank(b, family) || a.localeCompare(b),
  );
}

export function matrixSkuFamily(sku: string) {
  const tokens = sku.split("-").filter(Boolean);
  if (tokens.length <= 1) {
    return sku;
  }
  const last = normalizeMatrixSize(tokens.at(-1) ?? "");
  const isSize = last !== "OS" || /(?:^|-)0$/i.test(sku) || /(?:^|-)OS$/i.test(sku);
  return isSize ? tokens.slice(0, -1).join("-") : sku;
}

export function matrixProductGroupKey(item: MatrixItemLike) {
  const family = matrixItemFamily(item);
  const section = matrixSectionName(item);
  const product = matrixProductName(item).toLowerCase();
  const skuFamily = matrixSkuFamily(item.sku ?? "").toLowerCase();
  return [section.toLowerCase(), family, product || skuFamily].filter(Boolean).join("::");
}
