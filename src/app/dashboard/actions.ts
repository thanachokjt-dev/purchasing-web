"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { saveSkuCostOverride, scopedOverrideSaveMessage } from "@/lib/cost-price-overrides";
import { canAccessDashboard } from "@/lib/role-nav";

function text(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function positiveNumber(raw: string, label: string) {
  const value = Number(raw);
  if (!raw || !Number.isFinite(value) || value <= 0) {
    return { error: `${label} must be greater than 0.` };
  }
  return { value };
}

function optionalPositiveNumber(raw: string, label: string) {
  if (!raw) {
    return { value: undefined };
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    return { error: `${label} must be greater than 0.` };
  }
  return { value };
}

function dashboardStockValueStatus(status: "error" | "saved", sku: string, message?: string) {
  const url = new URL("/dashboard", "http://local");
  url.searchParams.set("stockCostSku", sku);
  if (status === "saved") {
    url.searchParams.set("stockCostSaved", "1");
  } else {
    url.searchParams.set("stockCostError", message || "SKU cost could not be saved.");
  }
  return `${url.pathname}${url.search}`;
}

export async function saveDashboardSkuCostOverrideAction(formData: FormData) {
  const profile = await requireUser("/dashboard");
  if (!canAccessDashboard(profile)) {
    throw new Error("You do not have permission to update Dashboard SKU costs.");
  }

  const sku = text(formData, "sku");
  if (!sku) {
    redirect(dashboardStockValueStatus("error", "", "SKU is required."));
  }

  const manualPurchasePrice = positiveNumber(text(formData, "manualPurchasePrice"), "Manual purchase cost");
  const manualLandedCost = optionalPositiveNumber(text(formData, "manualLandedCost"), "Manual landed cost");
  const manualSellingPrice = optionalPositiveNumber(text(formData, "manualSellingPrice"), "Manual selling price");
  const validationError = manualPurchasePrice.error || manualLandedCost.error || manualSellingPrice.error;
  if (validationError) {
    redirect(dashboardStockValueStatus("error", sku, validationError));
  }

  const { error } = await saveSkuCostOverride({
    manualLandedCost: manualLandedCost.value,
    manualPurchasePrice: manualPurchasePrice.value,
    manualSellingPrice: manualSellingPrice.value,
    sku,
    updatedBy: profile.authUserId,
  });

  if (error) {
    redirect(dashboardStockValueStatus("error", sku, scopedOverrideSaveMessage(error, "SKU")));
  }

  revalidatePath("/dashboard");
  revalidatePath("/cost-price-monitor");
  revalidatePath("/cost-price-monitor/print");
  redirect(dashboardStockValueStatus("saved", sku));
}
