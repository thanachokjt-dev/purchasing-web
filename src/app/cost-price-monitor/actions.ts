"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import {
  saveScopedCostPriceOverride,
  scopedOverrideSaveMessage,
  type ScopedOverridePayload,
  type SupabaseError,
} from "@/lib/cost-price-overrides";
import { canAccessCostPriceMonitor } from "@/lib/role-nav";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

type LegacyGroupOverridePayload = {
  category: string | null;
  color: string | null;
  group_key: string;
  main_name: string;
  manual_landed_cost?: number | null;
  manual_purchase_price?: number | null;
  manual_selling_price?: number | null;
  note?: string | null;
  product_group: string | null;
  sku: null;
  supplier: string | null;
  updated_at: string;
  updated_by: string;
};

function text(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function textAt(formData: FormData, name: string, index: number) {
  return String(formData.getAll(name)[index] ?? "").trim();
}

function optionalNonNegativeNumber(raw: string, label: string) {
  if (!raw) {
    return { value: undefined };
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    return { error: `${label} must be 0 or greater.` };
  }
  return { value };
}

function safeReturnTo(value: string) {
  return value.startsWith("/cost-price-monitor") ? value : "/cost-price-monitor";
}

function returnToWithStatus(returnTo: string, status: "error" | "saved", message?: string) {
  const url = new URL(safeReturnTo(returnTo), "http://local");
  url.searchParams.delete("overrideError");
  url.searchParams.delete("overrideSaved");
  if (status === "saved") {
    url.searchParams.set("overrideSaved", "1");
  } else {
    url.searchParams.set("overrideError", message || "Manual override could not be saved.");
  }
  return `${url.pathname}${url.search}`;
}

function isMissingOverrideTableError(error: SupabaseError | null) {
  const message = error?.message ?? "";

  return (
    error?.code === "42P01" ||
    /relation .*cost_price_monitor_overrides.*does not exist/i.test(message)
  );
}

async function saveLegacyGroupOverrideRow(
  supabase: NonNullable<ReturnType<typeof getSupabaseServiceClient>>,
  payload: LegacyGroupOverridePayload,
) {
  const existingResult = await supabase
    .from("cost_price_monitor_overrides")
    .select("group_key")
    .eq("group_key", payload.group_key)
    .limit(1)
    .maybeSingle();

  if (existingResult.error) {
    return existingResult.error;
  }

  const basePayload = {
    category: payload.category,
    color: payload.color,
    group_key: payload.group_key,
    main_name: payload.main_name,
    product_group: payload.product_group,
    sku: null,
    supplier: payload.supplier,
    updated_at: payload.updated_at,
    updated_by: payload.updated_by,
  };
  const valuePayload: Partial<LegacyGroupOverridePayload> = {};
  if (payload.manual_purchase_price !== undefined) {
    valuePayload.manual_purchase_price = payload.manual_purchase_price;
  }
  if (payload.manual_landed_cost !== undefined) {
    valuePayload.manual_landed_cost = payload.manual_landed_cost;
  }
  if (payload.manual_selling_price !== undefined) {
    valuePayload.manual_selling_price = payload.manual_selling_price;
  }
  if (payload.note !== undefined) {
    valuePayload.note = payload.note;
  }

  if (existingResult.data) {
    return (
      await supabase
        .from("cost_price_monitor_overrides")
        .update({ ...basePayload, ...valuePayload })
        .eq("group_key", payload.group_key)
    ).error;
  }

  return (await supabase.from("cost_price_monitor_overrides").insert({ ...basePayload, ...valuePayload })).error;
}

export async function saveCostPriceOverrideAction(formData: FormData) {
  return saveCostPriceOverridesAction(formData);
}

export async function saveCostPriceOverridesAction(formData: FormData) {
  const returnTo = text(formData, "returnTo");
  const profile = await requireUser("/cost-price-monitor");
  if (!canAccessCostPriceMonitor(profile)) {
    throw new Error("You do not have permission to update cost price overrides.");
  }

  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    console.error("Cost Price Monitor override save failed: Supabase service client is not configured", {
      hasNextPublicSupabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      hasSupabaseServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    });
    redirect(returnToWithStatus(returnTo, "error", "Supabase service client is not configured."));
  }

  const now = new Date().toISOString();
  const groupKeys = formData.getAll("groupKey").map((value) => String(value ?? "").trim());
  const skuKeys = formData.getAll("skuOverrideSku").map((value) => String(value ?? "").trim());
  const saveGroupKey = text(formData, "saveGroupKey");
  const saveSku = text(formData, "saveSku");
  const dirtyGroupKeys = new Set(
    formData
      .getAll("dirtyGroupKey")
      .map((value) => String(value ?? "").trim())
      .filter(Boolean),
  );
  const dirtySkus = new Set(
    formData
      .getAll("dirtySku")
      .map((value) => String(value ?? "").trim())
      .filter(Boolean),
  );
  const targetGroupKeys = saveGroupKey ? new Set([saveGroupKey]) : dirtyGroupKeys;
  const targetSkus = saveSku ? new Set([saveSku]) : dirtySkus;

  if (targetGroupKeys.size === 0 && targetSkus.size === 0) {
    redirect(returnToWithStatus(returnTo, "error", "No changed manual overrides to save."));
  }

  let validationMessage = "";
  const legacyGroupPayload: LegacyGroupOverridePayload[] = [];
  const groupPayload: ScopedOverridePayload[] = groupKeys.flatMap((groupKey, index) => {
    if (!groupKey || !targetGroupKeys.has(groupKey)) {
      return [];
    }

    const mainName = textAt(formData, "mainName", index);
    if (!mainName) {
      validationMessage = "Product group is required.";
      return [];
    }

    const manualPurchasePrice = optionalNonNegativeNumber(
      textAt(formData, "manualPurchasePrice", index),
      "Manual purchase override",
    );
    const manualLandedCost = optionalNonNegativeNumber(
      textAt(formData, "manualLandedCost", index),
      "Manual landed override",
    );
    const manualSellingPrice = optionalNonNegativeNumber(
      textAt(formData, "manualSellingPrice", index),
      "Manual selling override",
    );
    const validationError = manualPurchasePrice.error || manualLandedCost.error || manualSellingPrice.error;
    if (validationError) {
      validationMessage = validationError;
      return [];
    }

    const manualPurchaseValue = manualPurchasePrice.value;
    const manualLandedValue = manualLandedCost.value;
    const manualSellingValue = manualSellingPrice.value;
    const noteText = textAt(formData, "note", index);
    const note = noteText ? noteText : undefined;
    const updatedBy = profile.authUserId;

    legacyGroupPayload.push({
      category: textAt(formData, "category", index) || null,
      color: textAt(formData, "color", index) || null,
      group_key: groupKey,
      main_name: mainName,
      manual_landed_cost: manualLandedValue,
      manual_purchase_price: manualPurchaseValue,
      manual_selling_price: manualSellingValue,
      note,
      product_group: textAt(formData, "productGroup", index) || null,
      sku: null,
      supplier: textAt(formData, "supplier", index) || null,
      updated_at: now,
      updated_by: updatedBy,
    });

    return [
      {
        group_key: groupKey,
        scope: "group_default",
        sku: null,
        manual_purchase_price: manualPurchaseValue,
        manual_landed_cost: manualLandedValue,
        manual_selling_price: manualSellingValue,
        note,
        updated_by: updatedBy,
        updated_at: now,
      },
    ];
  });

  const skuPayload: ScopedOverridePayload[] = skuKeys.flatMap((sku, index) => {
    if (!sku || !targetSkus.has(sku)) {
      return [];
    }

    const manualPurchasePrice = optionalNonNegativeNumber(
      textAt(formData, "skuManualPurchasePrice", index),
      "SKU manual purchase override",
    );
    const manualLandedCost = optionalNonNegativeNumber(
      textAt(formData, "skuManualLandedCost", index),
      "SKU manual landed override",
    );
    const manualSellingPrice = optionalNonNegativeNumber(
      textAt(formData, "skuManualSellingPrice", index),
      "SKU manual selling override",
    );
    const validationError = manualPurchasePrice.error || manualLandedCost.error || manualSellingPrice.error;
    if (validationError) {
      validationMessage = validationError;
      return [];
    }

    return [
      {
        scope: "sku",
        sku,
        group_key: null,
        manual_purchase_price: manualPurchasePrice.value,
        manual_landed_cost: manualLandedCost.value,
        manual_selling_price: manualSellingPrice.value,
        note: undefined,
        updated_by: profile.authUserId,
        updated_at: now,
      },
    ];
  });

  if (validationMessage) {
    redirect(returnToWithStatus(returnTo, "error", validationMessage));
  }

  if (groupPayload.length === 0 && skuPayload.length === 0) {
    redirect(returnToWithStatus(returnTo, "error", "No matching manual override rows were found to save."));
  }

  let errorMessage = "";
  if (groupPayload.length > 0) {
    for (const payload of groupPayload) {
      const error = await saveScopedCostPriceOverride(supabase, payload);
      if (error) {
        errorMessage = scopedOverrideSaveMessage(error, "group-default");
        break;
      }
    }
  }

  if (!errorMessage && skuPayload.length > 0) {
    for (const payload of skuPayload) {
      const error = await saveScopedCostPriceOverride(supabase, payload);
      if (error) {
        errorMessage = scopedOverrideSaveMessage(error, "SKU");
        break;
      }
    }
  }

  if (!errorMessage && legacyGroupPayload.length > 0) {
    for (const payload of legacyGroupPayload) {
      const error = await saveLegacyGroupOverrideRow(supabase, payload);
      if (!error) {
        continue;
      }
      if (isMissingOverrideTableError(error)) {
        const legacyResult = await supabase.from("cost_price_overrides").upsert(
          [
            {
              ...payload,
              manual_landed_cost: payload.manual_landed_cost ?? null,
              manual_purchase_price: payload.manual_purchase_price ?? null,
              manual_selling_price: payload.manual_selling_price ?? null,
              note: payload.note ?? null,
              sku: null,
            },
          ],
          { onConflict: "group_key" },
        );
        if (legacyResult.error) {
          console.error("Cost Price Monitor legacy override save failed", legacyResult.error);
          errorMessage =
            "Manual override could not be saved. Apply migration 058 or confirm the legacy override table is available.";
          break;
        }
      } else {
        console.error("Cost Price Monitor override save failed", error);
        errorMessage =
          "Manual override could not be saved. Confirm migration 058 has created cost_price_monitor_overrides.";
        break;
      }
    }
  }

  if (errorMessage) {
    redirect(returnToWithStatus(returnTo, "error", errorMessage));
  }

  revalidatePath("/cost-price-monitor");
  revalidatePath("/cost-price-monitor/print");
  revalidatePath("/dashboard");
  redirect(returnToWithStatus(returnTo, "saved"));
}
