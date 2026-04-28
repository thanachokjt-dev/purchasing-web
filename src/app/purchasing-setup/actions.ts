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

export async function saveSupplierSetupAction(formData: FormData) {
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return;
  }

  const supplierCode = text(formData, "supplierCode");
  const supplierName = text(formData, "supplierName");
  if (!supplierCode || !supplierName) {
    throw new Error("Supplier code and name are required");
  }

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
        product_scope: nullableText(formData, "productScope"),
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
