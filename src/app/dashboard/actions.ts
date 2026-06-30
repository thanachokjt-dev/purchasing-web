"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { DashboardBulkSkuCostOverrideState } from "@/app/dashboard/missing-cost-sku-state";
import { requireUser } from "@/lib/auth";
import { saveSkuCostOverride, scopedOverrideSaveMessage } from "@/lib/cost-price-overrides";
import { canAccessDashboard } from "@/lib/role-nav";

function text(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
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

function valueAt(formData: FormData, name: string, index: number) {
  return String(formData.getAll(name)[index] ?? "").trim();
}

function targetSkuIndex(formData: FormData, sku: string) {
  return formData.getAll("sku").findIndex((value) => String(value ?? "").trim() === sku);
}

function parseSkuCostValues({
  landedRaw,
  purchaseRaw,
  sellingRaw,
}: {
  landedRaw: string;
  purchaseRaw: string;
  sellingRaw: string;
}) {
  const manualPurchasePrice = optionalPositiveNumber(purchaseRaw, "Manual purchase cost");
  const manualLandedCost = optionalPositiveNumber(landedRaw, "Manual landed cost");
  const manualSellingPrice = optionalPositiveNumber(sellingRaw, "Manual selling price");
  const validationError = manualPurchasePrice.error || manualLandedCost.error || manualSellingPrice.error;
  if (validationError) {
    return { error: validationError };
  }
  if (
    manualPurchasePrice.value === undefined &&
    manualLandedCost.value === undefined &&
    manualSellingPrice.value === undefined
  ) {
    return { error: "Enter at least one cost value before saving." };
  }
  return {
    manualLandedCost: manualLandedCost.value,
    manualPurchasePrice: manualPurchasePrice.value,
    manualSellingPrice: manualSellingPrice.value,
  };
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

  const sku = text(formData, "saveSku") || text(formData, "sku");
  if (!sku) {
    redirect(dashboardStockValueStatus("error", "", "SKU is required."));
  }

  const index = targetSkuIndex(formData, sku);
  const parsed = parseSkuCostValues({
    landedRaw: index >= 0 ? valueAt(formData, "manualLandedCost", index) : text(formData, "manualLandedCost"),
    purchaseRaw: index >= 0 ? valueAt(formData, "manualPurchasePrice", index) : text(formData, "manualPurchasePrice"),
    sellingRaw: index >= 0 ? valueAt(formData, "manualSellingPrice", index) : text(formData, "manualSellingPrice"),
  });
  if (parsed.error) {
    redirect(dashboardStockValueStatus("error", sku, parsed.error));
  }

  const { error } = await saveSkuCostOverride({
    manualLandedCost: parsed.manualLandedCost,
    manualPurchasePrice: parsed.manualPurchasePrice,
    manualSellingPrice: parsed.manualSellingPrice,
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

export async function saveDashboardSkuCostOverridesBulkAction(
  _previousState: DashboardBulkSkuCostOverrideState,
  formData: FormData,
): Promise<DashboardBulkSkuCostOverrideState> {
  const profile = await requireUser("/dashboard");
  if (!canAccessDashboard(profile)) {
    throw new Error("You do not have permission to update Dashboard SKU costs.");
  }

  const skus = formData.getAll("sku").map((value) => String(value ?? "").trim());
  const dirtySkus = new Set(
    formData
      .getAll("dirtySku")
      .map((value) => String(value ?? "").trim())
      .filter(Boolean),
  );
  const failedRows: DashboardBulkSkuCostOverrideState["failedRows"] = [];
  const savedSkus: string[] = [];

  if (dirtySkus.size === 0) {
    return {
      failedRows: [],
      message: "No edited rows to save.",
      savedCount: 0,
      savedSkus: [],
      successRows: [],
      status: "error",
    };
  }

  for (const [index, sku] of skus.entries()) {
    if (!sku || !dirtySkus.has(sku)) {
      continue;
    }

    const parsed = parseSkuCostValues({
      landedRaw: valueAt(formData, "manualLandedCost", index),
      purchaseRaw: valueAt(formData, "manualPurchasePrice", index),
      sellingRaw: valueAt(formData, "manualSellingPrice", index),
    });
    if (parsed.error) {
      failedRows.push({ message: parsed.error, sku });
      continue;
    }

    const { error } = await saveSkuCostOverride({
      manualLandedCost: parsed.manualLandedCost,
      manualPurchasePrice: parsed.manualPurchasePrice,
      manualSellingPrice: parsed.manualSellingPrice,
      sku,
      updatedBy: profile.authUserId,
    });

    if (error) {
      failedRows.push({ message: scopedOverrideSaveMessage(error, "SKU"), sku });
    } else {
      savedSkus.push(sku);
    }
  }

  if (savedSkus.length > 0) {
    revalidatePath("/dashboard");
    revalidatePath("/cost-price-monitor");
    revalidatePath("/cost-price-monitor/print");
  }

  if (savedSkus.length === 0 && failedRows.length > 0) {
    return {
      failedRows,
      message: `${failedRows.length} row${failedRows.length === 1 ? "" : "s"} failed. Please review highlighted rows.`,
      savedCount: 0,
      savedSkus: [],
      successRows: [],
      status: "error",
    };
  }

  if (failedRows.length > 0) {
    return {
      failedRows,
      message: `Saved ${savedSkus.length} cost override${savedSkus.length === 1 ? "" : "s"}. ${failedRows.length} row${failedRows.length === 1 ? "" : "s"} failed. Please review highlighted rows.`,
      savedCount: savedSkus.length,
      savedSkus,
      successRows: savedSkus,
      status: "partial",
    };
  }

  return {
    failedRows: [],
    message: `Saved ${savedSkus.length} cost override${savedSkus.length === 1 ? "" : "s"}.`,
    savedCount: savedSkus.length,
    savedSkus,
    successRows: savedSkus,
    status: "success",
  };
}
