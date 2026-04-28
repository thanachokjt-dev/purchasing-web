import { getSupabaseServiceClient } from "@/lib/supabase/server";

const PAGE_SIZE = 1000;

export type SupplierSetup = {
  supplierCode: string;
  supplierName: string;
  currency: string;
  paymentTerms: string;
  moq: string;
  safetyDays: number;
  leadTimeDays: number;
  productScope: string;
  bankName: string;
  bankAccountName: string;
  bankAccountNo: string;
  contactEmail: string;
  profileScore: number;
  profileNote: string;
  isActive: boolean;
};

export type SupplierContact = {
  id: string;
  supplierCode: string;
  contactName: string;
  department: string;
  email: string;
  phone: string;
  lineId: string;
  note: string;
  isPrimary: boolean;
};

export type PurchasingTag = {
  tag: string;
  label: string;
  category: string;
  description: string;
  isActive: boolean;
};

type SupplierRow = {
  supplier_code: string | null;
  supplier_name: string | null;
  currency: string | null;
  payment_terms: string | null;
  moq: string | null;
  safety_days: number | string | null;
  lead_time_days: number | string | null;
  product_scope: string | null;
  bank_name?: string | null;
  bank_account_name?: string | null;
  bank_account_no?: string | null;
  contact_email?: string | null;
  profile_score?: number | string | null;
  profile_note?: string | null;
  is_active: boolean | null;
};

type SupplierContactRow = {
  id: string;
  supplier_code: string | null;
  contact_name: string | null;
  department: string | null;
  email: string | null;
  phone: string | null;
  line_id: string | null;
  note: string | null;
  is_primary: boolean | null;
};

type PurchasingTagRow = {
  tag: string | null;
  label: string | null;
  category: string | null;
  description: string | null;
  is_active: boolean | null;
};

type ProductTagRow = {
  tags: string[] | null;
};

function compactText(value: string | null | undefined) {
  return value?.trim() || "";
}

function numeric(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

async function fetchAllRows<T>(table: string, columns: string, orderColumn?: string) {
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return null;
  }

  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabase.from(table).select(columns).range(from, from + PAGE_SIZE - 1);
    if (orderColumn) {
      query = query.order(orderColumn, { ascending: true });
    }

    const { data, error } = await query;
    if (error) {
      return null;
    }

    const batch = (data ?? []) as T[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) {
      return rows;
    }
  }
}

function mapSupplier(row: SupplierRow): SupplierSetup {
  return {
    supplierCode: compactText(row.supplier_code),
    supplierName: compactText(row.supplier_name) || compactText(row.supplier_code),
    currency: compactText(row.currency) || "THB",
    paymentTerms: compactText(row.payment_terms),
    moq: compactText(row.moq),
    safetyDays: Math.max(0, Math.round(numeric(row.safety_days))),
    leadTimeDays: Math.max(0, Math.round(numeric(row.lead_time_days))),
    productScope: compactText(row.product_scope),
    bankName: compactText(row.bank_name),
    bankAccountName: compactText(row.bank_account_name),
    bankAccountNo: compactText(row.bank_account_no),
    contactEmail: compactText(row.contact_email),
    profileScore: numeric(row.profile_score),
    profileNote: compactText(row.profile_note),
    isActive: row.is_active ?? true,
  };
}

function mapContact(row: SupplierContactRow): SupplierContact {
  return {
    id: row.id,
    supplierCode: compactText(row.supplier_code),
    contactName: compactText(row.contact_name),
    department: compactText(row.department),
    email: compactText(row.email),
    phone: compactText(row.phone),
    lineId: compactText(row.line_id),
    note: compactText(row.note),
    isPrimary: row.is_primary ?? false,
  };
}

function mapTag(row: PurchasingTagRow): PurchasingTag {
  const tag = compactText(row.tag);
  return {
    tag,
    label: compactText(row.label) || tag,
    category: compactText(row.category) || "general",
    description: compactText(row.description),
    isActive: row.is_active ?? true,
  };
}

async function getProductTagsFallback() {
  const productRows = await fetchAllRows<ProductTagRow>("products", "tags", "product_title");
  const tags = new Map<string, PurchasingTag>();

  for (const row of productRows ?? []) {
    for (const tag of row.tags ?? []) {
      const key = tag.trim();
      if (!key) {
        continue;
      }
      tags.set(key, {
        tag: key,
        label: key,
        category: "shopify",
        description: "Fallback from Shopify product tags",
        isActive: true,
      });
    }
  }

  const defaults: PurchasingTag[] = [
    {
      tag: "core",
      label: "Core",
      category: "planning",
      description: "Always-on product that should stay visible in purchase planning",
      isActive: true,
    },
    {
      tag: "event",
      label: "Event",
      category: "planning",
      description: "Event or limited-run item; can be hidden from regular reorder flow",
      isActive: true,
    },
    {
      tag: "seasonal",
      label: "Seasonal",
      category: "planning",
      description: "Seasonal demand item",
      isActive: true,
    },
    {
      tag: "new_drop",
      label: "New Drop",
      category: "planning",
      description: "New product drop or launch item",
      isActive: true,
    },
    {
      tag: "slow_mover",
      label: "Slow Mover",
      category: "planning",
      description: "Low movement item that needs cautious replenishment",
      isActive: true,
    },
    {
      tag: "markdown_list",
      label: "Markdown List",
      category: "planning",
      description: "Item intentionally hidden from standard reorder planning",
      isActive: true,
    },
    {
      tag: "one_time_event",
      label: "One-Time Event",
      category: "planning",
      description: "Strong seller from a one-off event or campaign; exclude from normal PO demand",
      isActive: true,
    },
    {
      tag: "restock_candidate",
      label: "Restock Candidate",
      category: "planning",
      description: "Candidate for reorder review after buyer confirmation",
      isActive: true,
    },
    {
      tag: "oos_comeback",
      label: "OOS Comeback",
      category: "planning",
      description: "Stockout item with enough demand history to consider bringing back",
      isActive: true,
    },
    {
      tag: "high_margin",
      label: "High Margin",
      category: "commercial",
      description: "Product with strong margin profile",
      isActive: true,
    },
    {
      tag: "cash_sensitive",
      label: "Cash Sensitive",
      category: "commercial",
      description: "Reorder should consider cash flow or deposit timing before PO",
      isActive: true,
    },
    {
      tag: "supplier_risk",
      label: "Supplier Risk",
      category: "supplier",
      description: "Item needs attention due to supplier reliability or lead-time risk",
      isActive: true,
    },
    {
      tag: "long_lead_time",
      label: "Long Lead Time",
      category: "supplier",
      description: "Supplier or item usually needs longer production or delivery planning",
      isActive: true,
    },
    {
      tag: "size_run",
      label: "Size Run",
      category: "merchandising",
      description: "Item should be reviewed as a size run rather than standalone SKU",
      isActive: true,
    },
  ];

  for (const tag of defaults) {
    if (!tags.has(tag.tag)) {
      tags.set(tag.tag, tag);
    }
  }

  return Array.from(tags.values()).sort((a, b) => a.tag.localeCompare(b.tag));
}

export async function getPurchasingSetupData() {
  const suppliers =
    (await fetchAllRows<SupplierRow>(
      "po_suppliers",
      [
        "supplier_code",
        "supplier_name",
        "currency",
        "payment_terms",
        "moq",
        "safety_days",
        "lead_time_days",
        "product_scope",
        "bank_name",
        "bank_account_name",
        "bank_account_no",
        "contact_email",
        "profile_score",
        "profile_note",
        "is_active",
      ].join(","),
      "supplier_name",
    )) ??
    (await fetchAllRows<SupplierRow>(
      "po_suppliers",
      "supplier_code,supplier_name,currency,payment_terms,moq,safety_days,lead_time_days,product_scope,is_active",
      "supplier_name",
    )) ??
    [];

  const contacts =
    (await fetchAllRows<SupplierContactRow>(
      "po_supplier_contacts",
      "id,supplier_code,contact_name,department,email,phone,line_id,note,is_primary",
      "supplier_code",
    )) ?? [];

  const tagRows = await fetchAllRows<PurchasingTagRow>(
    "purchasing_tag_catalog",
    "tag,label,category,description,is_active",
    "tag",
  );

  return {
    contacts: contacts.map(mapContact),
    setupReady: Boolean(tagRows),
    suppliers: suppliers.map(mapSupplier),
    tags: tagRows ? tagRows.map(mapTag) : await getProductTagsFallback(),
  };
}
