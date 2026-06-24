import "server-only";

import { getSupabaseServiceClient } from "@/lib/supabase/server";

export type SupabaseError = {
  code?: string;
  details?: string;
  hint?: string;
  message?: string;
};

export type ScopedOverridePayload = {
  group_key: string | null;
  manual_landed_cost?: number | null;
  manual_purchase_price?: number | null;
  manual_selling_price?: number | null;
  note?: string | null;
  scope: "group_default" | "sku";
  sku?: string | null;
  updated_at: string;
  updated_by: string;
};

export function isMissingVariantOverrideTableError(error: SupabaseError | null) {
  const message = error?.message ?? "";

  return (
    error?.code === "42P01" ||
    /relation .*cost_price_monitor_variant_overrides.*does not exist/i.test(message)
  );
}

export function isPermissionOrRlsError(error: SupabaseError | null) {
  return (
    error?.code === "42501" ||
    /row-level security/i.test(error?.message ?? "") ||
    /permission denied/i.test(error?.message ?? "") ||
    /violates row-level security/i.test(error?.message ?? "")
  );
}

export function isMissingColumnOrSchemaMismatchError(error: SupabaseError | null) {
  return (
    error?.code === "PGRST204" ||
    /could not find .* column/i.test(error?.message ?? "") ||
    /column .* does not exist/i.test(error?.message ?? "")
  );
}

export function scopedOverrideSaveMessage(error: SupabaseError | null, scope: "group-default" | "SKU") {
  if (isMissingVariantOverrideTableError(error)) {
    return "Manual override could not be saved. Apply migration 060 for Cost Price Monitor SKU overrides.";
  }
  if (isMissingColumnOrSchemaMismatchError(error)) {
    return "Override save failed because the payload contains a column that does not exist in the override table.";
  }
  if (isPermissionOrRlsError(error)) {
    return `${scope} override could not be saved because Supabase denied admin access. Confirm SUPABASE_SERVICE_ROLE_KEY is configured on the server and the service-role client is used.`;
  }
  return `${scope} override could not be saved. ${error?.message ?? "Check Cost Price Monitor override constraints."}`;
}

function activeSupabaseProjectRef() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    return null;
  }
  try {
    return new URL(url).hostname.split(".")[0] || null;
  } catch {
    return null;
  }
}

function logScopedOverrideSaveError(
  label: string,
  error: SupabaseError,
  payload: Pick<ScopedOverridePayload, "group_key" | "scope" | "sku">,
) {
  console.error("Cost Price Monitor scoped override save failed", {
    label,
    error: {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    },
    attempted: {
      scope: payload.scope,
      sku: payload.sku ?? null,
      group_key: payload.group_key ?? null,
    },
    activeSupabaseProjectRef: activeSupabaseProjectRef(),
  });
}

export async function saveScopedCostPriceOverride(
  supabase: NonNullable<ReturnType<typeof getSupabaseServiceClient>>,
  payload: ScopedOverridePayload,
) {
  const scopeLabel = payload.scope === "sku" ? "SKU" : "group-default";
  const target =
    payload.scope === "sku"
      ? { column: "sku", value: payload.sku ?? "" }
      : { column: "group_key", value: payload.group_key ?? "" };

  const existingResult = await supabase
    .from("cost_price_monitor_variant_overrides")
    .select("id,manual_purchase_price,manual_landed_cost,manual_selling_price,note")
    .eq("scope", payload.scope)
    .eq(target.column, target.value)
    .limit(1)
    .maybeSingle();

  if (existingResult.error) {
    logScopedOverrideSaveError(`${scopeLabel} override read`, existingResult.error, payload);
    return existingResult.error;
  }

  const basePayload = {
    group_key: payload.group_key,
    scope: payload.scope,
    sku: payload.sku ?? null,
    updated_at: payload.updated_at,
    updated_by: payload.updated_by,
  };
  const valuePayload: Partial<ScopedOverridePayload> = {};
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
    const updateResult = await supabase
      .from("cost_price_monitor_variant_overrides")
      .update({ ...basePayload, ...valuePayload })
      .eq("id", existingResult.data.id)
      .select("id");

    if (updateResult.error) {
      logScopedOverrideSaveError(`${scopeLabel} override update`, updateResult.error, payload);
      return updateResult.error;
    }

    return null;
  }

  const insertResult = await supabase
    .from("cost_price_monitor_variant_overrides")
    .insert({ ...basePayload, ...valuePayload });
  if (!insertResult.error) {
    return null;
  }

  if (insertResult.error.code === "23505") {
    const retryResult = await supabase
      .from("cost_price_monitor_variant_overrides")
      .update({ ...basePayload, ...valuePayload })
      .eq("scope", payload.scope)
      .eq(target.column, target.value)
      .select("id");
    if (!retryResult.error && (retryResult.data ?? []).length > 0) {
      return null;
    }
    if (retryResult.error) {
      logScopedOverrideSaveError(`${scopeLabel} override retry update`, retryResult.error, payload);
      return retryResult.error;
    }
  }

  logScopedOverrideSaveError(`${scopeLabel} override insert`, insertResult.error, payload);
  return insertResult.error;
}

export async function saveSkuCostOverride({
  manualLandedCost,
  manualPurchasePrice,
  manualSellingPrice,
  sku,
  updatedBy,
}: {
  manualLandedCost?: number | null;
  manualPurchasePrice?: number | null;
  manualSellingPrice?: number | null;
  sku: string;
  updatedBy: string;
}) {
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return {
      error: {
        message: "Supabase service client is not configured.",
      } satisfies SupabaseError,
    };
  }

  return {
    error: await saveScopedCostPriceOverride(supabase, {
      group_key: null,
      manual_landed_cost: manualLandedCost,
      manual_purchase_price: manualPurchasePrice,
      manual_selling_price: manualSellingPrice,
      scope: "sku",
      sku,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy,
    }),
  };
}
