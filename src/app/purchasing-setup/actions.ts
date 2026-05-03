"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

function text(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function nullableText(formData: FormData, name: string) {
  const value = text(formData, name);
  return value || null;
}

function textListFromValue(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function mergeProductScope(formData: FormData) {
  const typedScope = textListFromValue(text(formData, "productScope"));
  const selectedTags = formData
    .getAll("supplierTag")
    .map((value) => String(value).trim())
    .filter(Boolean);
  const merged = new Map<string, string>();

  for (const item of [...typedScope, ...selectedTags]) {
    const key = item.toLowerCase();
    if (!merged.has(key)) {
      merged.set(key, item);
    }
  }

  const value = Array.from(merged.values()).join(", ");
  return value || null;
}

function nonNegativeNumber(formData: FormData, name: string) {
  const raw = text(formData, name);
  if (!raw) {
    return 0;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${name} must be 0 or greater`);
  }
  return parsed;
}

function refreshSetup() {
  revalidatePath("/purchasing-setup");
  revalidatePath("/purchasing-decision");
  revalidatePath("/po");
}

function supplierCodePrefix(supplierName: string) {
  const ignored = new Set(["AND", "CO", "COMPANY", "LTD", "LIMITED", "THE"]);
  const tokens =
    supplierName
      .toUpperCase()
      .match(/[A-Z0-9]+/g)
      ?.filter((token) => !ignored.has(token)) ?? [];
  const initials = tokens.map((token) => token[0]).join("");
  const compact = supplierName.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return (initials || compact || "SUP").slice(0, 4).padEnd(3, "X");
}

async function generatedSupplierCode(supplierName: string) {
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return supplierCodePrefix(supplierName);
  }

  const prefix = supplierCodePrefix(supplierName);
  const { data } = await supabase
    .from("po_suppliers")
    .select("supplier_code")
    .ilike("supplier_code", `${prefix}%`);
  const maxSuffix = ((data ?? []) as Array<{ supplier_code: string | null }>).reduce(
    (max, row) => {
      const match = row.supplier_code?.match(new RegExp(`^${prefix}(\\d+)$`, "i"));
      return match ? Math.max(max, Number(match[1])) : max;
    },
    0,
  );

  return `${prefix}${String(maxSuffix + 1).padStart(3, "0")}`;
}

export async function saveSupplierSetupAction(formData: FormData) {
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return;
  }

  const supplierName = text(formData, "supplierName");
  if (!supplierName) {
    throw new Error("Supplier name is required");
  }
  const supplierCode = text(formData, "supplierCode") || (await generatedSupplierCode(supplierName));

  const { error } = await supabase
    .from("po_suppliers")
    .upsert(
      {
        supplier_code: supplierCode,
        supplier_name: supplierName,
        currency: nullableText(formData, "currency"),
        payment_terms: nullableText(formData, "paymentTerms"),
        moq: nullableText(formData, "moq"),
        safety_days: Math.round(nonNegativeNumber(formData, "safetyDays")),
        lead_time_days: Math.round(nonNegativeNumber(formData, "leadTimeDays")),
        product_scope: mergeProductScope(formData),
        bank_name: nullableText(formData, "bankName"),
        bank_account_name: nullableText(formData, "bankAccountName"),
        bank_account_no: nullableText(formData, "bankAccountNo"),
        contact_email: nullableText(formData, "contactEmail"),
        profile_score: nonNegativeNumber(formData, "profileScore"),
        profile_note: nullableText(formData, "profileNote"),
        is_active: formData.get("isActive") === "on",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "supplier_code" },
    );

  if (error) {
    throw new Error(error.message);
  }

  refreshSetup();
}

export async function addSupplierContactAction(formData: FormData) {
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return;
  }

  const supplierCode = text(formData, "supplierCode");
  const contactName = text(formData, "contactName");
  if (!supplierCode || !contactName) {
    throw new Error("Supplier and contact name are required");
  }

  const { error } = await supabase.from("po_supplier_contacts").insert({
    supplier_code: supplierCode,
    contact_name: contactName,
    department: nullableText(formData, "department"),
    email: nullableText(formData, "email"),
    phone: nullableText(formData, "phone"),
    line_id: nullableText(formData, "lineId"),
    note: nullableText(formData, "note"),
    is_primary: formData.get("isPrimary") === "on",
  });

  if (error) {
    throw new Error(error.message);
  }

  refreshSetup();
}

export async function savePurchasingTagAction(formData: FormData) {
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return;
  }

  const tag = text(formData, "tag");
  if (!tag) {
    throw new Error("Tag is required");
  }

  const { error } = await supabase
    .from("purchasing_tag_catalog")
    .upsert(
      {
        tag,
        label: text(formData, "label") || tag,
        category: text(formData, "category") || "general",
        description: nullableText(formData, "description"),
        is_active: formData.get("isActive") === "on",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tag" },
    );

  if (error) {
    throw new Error(error.message);
  }

  refreshSetup();
}
