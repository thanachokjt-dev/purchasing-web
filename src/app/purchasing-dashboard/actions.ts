"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { canEditPo } from "@/lib/access-control";
import { canAccessPurchasingDashboard } from "@/lib/role-nav";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

export async function saveOrderClassification(
  poId: string,
  classification: string,
) {
  const profile = await requireUser("/purchasing-dashboard");
  if (
    !profile.isActive ||
    !canEditPo(profile.email) ||
    !canAccessPurchasingDashboard(profile)
  )
    return {
      ok: false,
      message: "You do not have permission to classify purchase orders.",
    };
  if (
    typeof poId !== "string" ||
    !poId.trim() ||
    poId.length > 200 ||
    typeof classification !== "string" ||
    !["auto", "new", "existing"].includes(classification)
  )
    return { ok: false, message: "Invalid PO classification." };
  const client = getSupabaseServiceClient();
  if (!client)
    return {
      ok: false,
      message: "Unable to connect to the purchasing database.",
    };
  const result = await client
    .from("po_orders")
    .update({
      purchasing_order_classification: classification,
      purchasing_classified_by: profile.authUserId,
      purchasing_classified_at: new Date().toISOString(),
    })
    .eq("po_id", poId)
    .select("po_id")
    .maybeSingle();
  if (result.error)
    return {
      ok: false,
      message: "Unable to save PO classification. Please retry.",
    };
  if (!result.data) return { ok: false, message: "Purchase order not found." };
  revalidatePath("/purchasing-dashboard");
  return {
    ok: true,
    message: `Saved ${poId}: ${classification === "auto" ? "Auto" : classification === "new" ? "New order" : "Existing order"}.`,
  };
}
