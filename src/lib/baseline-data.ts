import {
  AlertTriangle,
  Boxes,
  CalendarClock,
  CircleDollarSign,
  DatabaseZap,
  Factory,
  FileSpreadsheet,
  PackageCheck,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";

export type SupplierSummary = {
  supplier: string;
  variants: number;
  suggestedQty: number;
  currency?: string;
  leadTimeNote?: string;
  onHandQty?: number;
  activeIncomingQty?: number;
  inventoryValue?: number;
  incomingValue?: number;
};

export type ReorderLine = {
  sku: string;
  product: string;
  supplier: string;
  tag: string;
  demandIndex: number;
  onHand: number;
  incoming: number;
  excelQty: number;
  netQty: number;
  leadTimeDays: number | null;
  status: "should_order" | "monitor" | "blocked";
};

export type MatrixRow = {
  product: string;
  xs: number;
  s: number;
  m: number;
  l: number;
  xl: number;
  twoXl: number;
  total: number;
};

export type DemandLine = {
  sku: string;
  product: string;
  quantity: number;
  orderCount: number;
  revenue: number;
};

export type DemandInsightLine = {
  sku: string;
  product: string;
  sold7: number;
  sold30: number;
  sold60: number;
  sold90: number;
  ads30: number;
  stockOnHand: number;
  coverageDays: number | null;
  reorderPoint: number;
  suggestedQty: number;
  status: "order_now" | "watch" | "healthy";
};

export type ComebackSignalLine = {
  sku: string;
  product: string;
  lastSoldDate: string;
  quietDays: number;
  historicalSold: number;
  bestMonthSold: number;
  demandIndex: number;
  stockOnHand: number;
  confidence: number;
  targetQty: number;
  suggestedQty: number;
};

export type DemandQualitySummary = {
  totalLines: number;
  countableLines: number;
  excludedLines: number;
  missingSkuLines: number;
  cancelledLines: number;
  refundedLines: number;
};

export type BuyerReviewLine = {
  sku: string;
  product: string;
  priority: "critical" | "high" | "watch";
  reason: string;
  suggestedQty: number;
  activeIncomingQty: number;
  pendingApprovalQty: number;
  netSuggestedQty: number;
  stockOnHand: number;
  coverageDays: number | null;
  sold30: number | null;
  demandIndex: number;
  source: "reorder" | "comeback";
  supplier: string | null;
  supplierSource: "manual" | "excel" | "shopify_vendor" | "pending";
  supplierCode: string | null;
  currency: string | null;
  moq: string | null;
  paymentTerms: string | null;
  safetyDays: number | null;
  supplierLeadTimeDays: number | null;
};

export const baselineMetrics = [
  {
    label: "Sales lines",
    value: "77,028",
    detail: "37,396 orders, 1,134 SKUs sold",
    icon: ShoppingCart,
  },
  {
    label: "Product variants",
    value: "1,306",
    detail: "203 products from Shopify export",
    icon: Boxes,
  },
  {
    label: "Inventory snapshots",
    value: "15,563",
    detail: "15,563 on hand, 15,515 available in Excel baseline",
    icon: PackageCheck,
  },
  {
    label: "Suggested qty",
    value: "20,435",
    detail: "Excel mode across 1,073 alert lines",
    icon: TrendingUp,
  },
];

export const syncSources = [
  {
    name: "Shopify products",
    status: "Phase 1 connector",
    rows: "1,306 variants baseline",
    description: "Products, variants, option values, tags, images, status.",
    icon: DatabaseZap,
  },
  {
    name: "Shopify inventory",
    status: "Phase 1 connector",
    rows: "2,607 location rows baseline",
    description: "Available, on-hand, committed, incoming, reserved by location.",
    icon: Boxes,
  },
  {
    name: "Shopify sales lines",
    status: "Phase 1 connector",
    rows: "77,028 sales lines baseline",
    description: "Order date, SKU, quantity, revenue, tags, product type.",
    icon: FileSpreadsheet,
  },
  {
    name: "Open purchase orders",
    status: "Excel import baseline",
    rows: "884 PO lines",
    description: "Used for incoming/outstanding quantity reconciliation.",
    icon: CalendarClock,
  },
];

export const supplierSummaries: SupplierSummary[] = [
  {
    supplier: "Engage Global",
    variants: 429,
    suggestedQty: 11150,
    currency: "AUD",
    leadTimeNote: "60/90 day mismatch needs confirmation",
  },
  {
    supplier: "Thai Tshirt Factory Co., LTD.",
    variants: 389,
    suggestedQty: 3980,
    currency: "THB",
    leadTimeNote: "Used by THAIT reorder sample",
  },
  {
    supplier: "Dude Sport Co., Ltd.",
    variants: 115,
    suggestedQty: 3520,
    currency: "THB",
    leadTimeNote: "Jersey/event demand heavy",
  },
  {
    supplier: "CSD FASHION(Weyes Clothing LTD)",
    variants: 91,
    suggestedQty: 1560,
    currency: "THB",
    leadTimeNote: "Hand wrap top alert line",
  },
  {
    supplier: "Paphavee Group Co.,Ltd.",
    variants: 28,
    suggestedQty: 40,
    currency: "THB",
    leadTimeNote: "MOQ 100/300 in supplier sheet",
  },
];

export const topReorderLines: ReorderLine[] = [
  {
    sku: "BT-OG-HW-BLK-0",
    product: "Bangtao OG Hand Wraps - Black",
    supplier: "CSD FASHION(Weyes Clothing LTD)",
    tag: "Hand Wraps",
    demandIndex: 12.67,
    onHand: 0,
    incoming: 0,
    excelQty: 1520,
    netQty: 1520,
    leadTimeDays: 120,
    status: "should_order",
  },
  {
    sku: "BT-SBJ-BLU-M",
    product: "Blue Baller Jersey (Songkran Special Edition) - M",
    supplier: "Dude Sport Co., Ltd.",
    tag: "Event",
    demandIndex: 1.67,
    onHand: 0,
    incoming: 0,
    excelQty: 200,
    netQty: 200,
    leadTimeDays: 120,
    status: "should_order",
  },
  {
    sku: "BJ-SKS-WHT-25-S",
    product: "Songkran 2025 Baller Jersey - White / S",
    supplier: "Dude Sport Co., Ltd.",
    tag: "Event",
    demandIndex: 1.42,
    onHand: 0,
    incoming: 0,
    excelQty: 170,
    netQty: 170,
    leadTimeDays: 120,
    status: "should_order",
  },
  {
    sku: "SPLIT-TANK-BLK-M",
    product: "Bangtao Split Tank Top - M",
    supplier: "Engage Global",
    tag: "T-shirts",
    demandIndex: 1,
    onHand: 0,
    incoming: 0,
    excelQty: 120,
    netQty: 120,
    leadTimeDays: 60,
    status: "should_order",
  },
  {
    sku: "BT-EHTS-BLK-2XL",
    product: "Bangtao X Engage Hybrid T-shirt - Black / 2XL",
    supplier: "Engage Global",
    tag: "Training Tops",
    demandIndex: 0.331967,
    onHand: 29,
    incoming: 0,
    excelQty: 40,
    netQty: 20,
    leadTimeDays: 60,
    status: "should_order",
  },
];

export const thaiTshirtMatrix: MatrixRow[] = [
  {
    product: "Microfiber T-shirt - Blue",
    xs: 0,
    s: 0,
    m: 70,
    l: 10,
    xl: 0,
    twoXl: 0,
    total: 80,
  },
  {
    product: "Microfiber T-shirt - Black",
    xs: 0,
    s: 0,
    m: 10,
    l: 90,
    xl: 0,
    twoXl: 0,
    total: 100,
  },
  {
    product: "Tribal T-Shirt - Navy Blue",
    xs: 0,
    s: 0,
    m: 0,
    l: 80,
    xl: 0,
    twoXl: 30,
    total: 110,
  },
  {
    product: "Classic Bangtao Cotton T-shirt - Black (Pink)",
    xs: 0,
    s: 0,
    m: 60,
    l: 0,
    xl: 0,
    twoXl: 0,
    total: 60,
  },
  {
    product: "Palm Earth T-Shirt - Black",
    xs: 0,
    s: 0,
    m: 60,
    l: 70,
    xl: 0,
    twoXl: 0,
    total: 130,
  },
  {
    product: "Palm Earth T-Shirt - White",
    xs: 0,
    s: 0,
    m: 0,
    l: 0,
    xl: 40,
    twoXl: 0,
    total: 40,
  },
  {
    product: "Lai Thai Muay Thai Shorts - Black",
    xs: 0,
    s: 40,
    m: 80,
    l: 80,
    xl: 80,
    twoXl: 30,
    total: 330,
  },
  {
    product: "Essential Series Muay Thai Shorts - White",
    xs: 0,
    s: 30,
    m: 60,
    l: 70,
    xl: 60,
    twoXl: 40,
    total: 260,
  },
  {
    product: "Essential Series Muay Thai Shorts - Black",
    xs: 0,
    s: 30,
    m: 60,
    l: 80,
    xl: 60,
    twoXl: 40,
    total: 270,
  },
];

export const validationWarnings = [
  {
    title: "Suggested qty currently mirrors Excel gross-target mode",
    description:
      "Excel total is 20,435 units. Net requirement mode that subtracts stock and incoming is estimated at 16,920 units.",
    icon: AlertTriangle,
  },
  {
    title: "Lead time source must be confirmed",
    description:
      "Several Engage SKUs show 60 days in Purchasing Decision but 90 days in the raw Shopify-derived layer.",
    icon: Factory,
  },
  {
    title: "Cost and PO amounts are read-only in Phase 1",
    description:
      "Xero cost and Coming Order data are represented as imports until accounting workflow is built.",
    icon: CircleDollarSign,
  },
];

export const formatNumber = (value: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
