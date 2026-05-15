"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canEditPo } from "@/lib/access-control";
import {
  addComparableProduct,
  applyGlobalPlanLineAdjustment,
  generateSuggestedPlanLines,
  createNewProductPlan,
  getNewProductPlan,
  listPlanLines,
  listPlanComparables,
  removeComparableProduct,
  removePlanLine,
  type NewProductPlanInput,
  updatePlanLine,
  updatePlanLineMetadata,
  updateComparableProduct,
  updateNewProductPlanDemandControls,
  updateNewProductPlan,
} from "@/lib/new-product-opening-buy";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

function text(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function nullableText(formData: FormData, name: string) {
  const value = text(formData, name);
  return value || null;
}

function positiveInteger(formData: FormData, name: string, label: string) {
  const value = text(formData, name);
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive whole number.`);
  }
  return parsed;
}

function adjustmentPercentFactor(formData: FormData, name: string, label: string, fallbackPercent = 0) {
  const value = text(formData, name);
  const parsed = value ? Number(value) : fallbackPercent;
  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} must be a valid adjustment percentage.`);
  }
  if (parsed < -100) {
    throw new Error(`${label} cannot be below -100%.`);
  }
  return 1 + parsed / 100;
}

function globalQtyAdjustmentMultiplier(formData: FormData) {
  return adjustmentPercentFactor(formData, "qtyAdjustmentPercent", "Global qty adjustment");
}

function matrixDemandControls(formData: FormData) {
  const seasonAdjustmentPercent = adjustmentPercent(formData, "seasonFactorPercent");
  const confidenceAdjustmentPercent = adjustmentPercent(formData, "confidenceFactorPercent");
  const riskAdjustmentPercent = adjustmentPercent(formData, "riskFactorPercent");
  const globalQtyAdjustmentPercent = adjustmentPercent(formData, "qtyAdjustmentPercent");
  const seasonFactor = adjustmentPercentFactor(formData, "seasonFactorPercent", "Season adjustment");
  const confidenceFactor = adjustmentPercentFactor(formData, "confidenceFactorPercent", "Confidence adjustment");
  const riskFactor = adjustmentPercentFactor(formData, "riskFactorPercent", "Risk adjustment");
  const globalQtyAdjustment = globalQtyAdjustmentMultiplier(formData);
  return {
    channelFilter: nullableText(formData, "channelFilter"),
    confidenceAdjustmentPercent,
    confidenceFactor,
    globalQtyAdjustmentPercent,
    globalQtyAdjustment,
    riskAdjustmentPercent,
    riskFactor,
    seasonAdjustmentPercent,
    seasonFactor,
    totalMultiplier: seasonFactor * confidenceFactor * riskFactor * globalQtyAdjustment,
  };
}

function adjustmentPercent(formData: FormData, name: string, fallbackPercent = 0) {
  const value = text(formData, name);
  return value ? Number(value) : fallbackPercent;
}

function nullablePositiveNumber(formData: FormData, name: string, label: string) {
  const value = text(formData, name);
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} must be blank or positive.`);
  }
  return parsed;
}

function dateOrNull(formData: FormData, name: string, label: string) {
  const value = text(formData, name);
  if (!value) {
    return null;
  }

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new Error(`${label} must be a valid date.`);
  }

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error(`${label} must be a valid date.`);
  }

  return value;
}

function requireSuperAdmin(profile: Awaited<ReturnType<typeof requireUser>>) {
  if (profile.role !== "super_admin" || !canEditPo(profile.email)) {
    throw new Error("Only super_admin can manage New Product Opening Buy plans.");
  }
}

function errorUrl(path: string, message: string) {
  return `${path}?error=${encodeURIComponent(message)}`;
}

function successUrl(path: string, message: string) {
  return `${path}?success=${encodeURIComponent(message)}`;
}

function refreshPlanner(planId?: string) {
  revalidatePath("/new-product-opening-buy-planner");
  if (planId) {
    revalidatePath(`/new-product-opening-buy-planner/${planId}`);
  }
}

function plannerDetailPath(planId: string) {
  return `/new-product-opening-buy-planner/${encodeURIComponent(planId)}`;
}

function safeStorageName(name: string) {
  return name
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "mockup";
}

async function uploadMockupImage(planId: string, file: File | null) {
  if (!file || file.size === 0) {
    return "";
  }
  if (!file.type.startsWith("image/")) {
    throw new Error("Mockup image must be an image file.");
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Mockup image must be 5MB or smaller.");
  }
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Mockup image must be JPG, PNG, or WebP.");
  }
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }
  const extension = file.name.includes(".") ? file.name.split(".").pop() : file.type.split("/").pop();
  const path = `${planId}/${randomUUID()}-${safeStorageName(file.name || `mockup.${extension || "jpg"}`)}`;
  const { error } = await supabase.storage
    .from("new-product-mockups")
    .upload(path, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });
  if (error) {
    throw new Error(`Mockup image upload failed. Please check storage bucket configuration. ${error.message}`);
  }
  return path;
}

function positiveComparableWeight(formData: FormData) {
  const value = text(formData, "weight");
  const parsed = Number(value || 1);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("Weight must be positive.");
  }
  return parsed;
}

async function requireComparableEditablePlan(planId: string) {
  if (!planId) {
    throw new Error("Plan ID is required.");
  }

  const plan = await getNewProductPlan(planId);
  if (!plan) {
    throw new Error("Plan not found.");
  }
  if (!["draft", "review"].includes(plan.status)) {
    throw new Error("Comparable reference products can only be changed while the plan is draft or in review.");
  }
  return plan;
}

async function requirePlanningEditablePlan(planId: string) {
  if (!planId) {
    throw new Error("Plan ID is required.");
  }

  const plan = await getNewProductPlan(planId);
  if (!plan) {
    throw new Error("Plan not found.");
  }
  if (!["draft", "review"].includes(plan.status)) {
    throw new Error("Planning quantities can only be changed while the plan is draft or in review.");
  }
  return plan;
}

function nullableFormNumber(formData: FormData, name: string, label: string) {
  const value = text(formData, name);
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} must be a valid number.`);
  }
  return parsed;
}

function nonNegativeIntegerOrNull(formData: FormData, name: string, label: string) {
  const parsed = nullableFormNumber(formData, name, label);
  if (parsed === null) {
    return null;
  }
  if (parsed < 0) {
    throw new Error(`${label} must be 0 or greater.`);
  }
  return Math.ceil(parsed);
}

function nonNegativeMoneyOrNull(formData: FormData, name: string, label: string) {
  const parsed = nullableFormNumber(formData, name, label);
  if (parsed === null) {
    return null;
  }
  if (parsed < 0) {
    throw new Error(`${label} must be 0 or greater.`);
  }
  return parsed;
}

function positiveIntegerField(formData: FormData, name: string, label: string, fallback = 10) {
  const value = text(formData, name);
  const parsed = value ? Number(value) : fallback;
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive whole number.`);
  }
  return parsed;
}

async function requireExistingComparableProduct(productId: string) {
  if (!productId) {
    throw new Error("Reference product is required.");
  }

  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id,product_title")
    .eq("id", productId)
    .maybeSingle();

  if (productError) {
    throw new Error(productError.message);
  }
  if (!product) {
    throw new Error("Selected reference product was not found.");
  }

  const { count, error: variantError } = await supabase
    .from("product_variants")
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId)
    .not("sku", "is", null);

  if (variantError) {
    throw new Error(variantError.message);
  }
  if (!count) {
    throw new Error("Selected reference product has no variants/SKUs to use as planning input.");
  }

  return {
    productTitle: String((product as { product_title?: string | null }).product_title ?? "").trim(),
    variantCount: count,
  };
}

async function supplierSnapshot(supplierCode: string | null) {
  if (!supplierCode) {
    return { currency: null, paymentTerms: null, supplierCode: null, supplierNameSnapshot: null };
  }

  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }
  const { data, error } = await supabase
    .from("po_suppliers")
    .select("supplier_code,supplier_name,currency,payment_terms")
    .eq("supplier_code", supplierCode)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    throw new Error("Selected supplier does not exist.");
  }

  const supplier = data as {
    currency?: string | null;
    payment_terms?: string | null;
    supplier_code: string | null;
    supplier_name: string | null;
  };
  return {
    currency: supplier.currency ?? null,
    paymentTerms: supplier.payment_terms ?? null,
    supplierCode: supplier.supplier_code,
    supplierNameSnapshot: supplier.supplier_name,
  };
}

async function auditPlan({
  actionType,
  changedBy,
  newValues,
  note,
  oldValues,
  planId,
}: {
  actionType: string;
  changedBy: string;
  newValues?: unknown;
  note?: string | null;
  oldValues?: unknown;
  planId: string;
}) {
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { error } = await supabase.from("po_new_product_plan_audit_logs").insert({
    action_type: actionType,
    changed_by: changedBy,
    new_values: newValues ?? null,
    note: note ?? null,
    old_values: oldValues ?? null,
    plan_id: planId,
  });

  if (error) {
    throw new Error(`Could not write audit log: ${error.message}`);
  }
}

async function parsedPlanInput(formData: FormData): Promise<NewProductPlanInput> {
  const planName = text(formData, "planName");
  if (!planName) {
    throw new Error("Plan name is required.");
  }

  const supplier = await supplierSnapshot(nullableText(formData, "supplierCode"));

  return {
    budgetCapThb: nullablePositiveNumber(formData, "budgetCapThb", "Budget cap THB"),
    category: nullableText(formData, "category"),
    channelFilter: nullableText(formData, "channelFilter"),
    confidenceFactor: adjustmentPercentFactor(formData, "confidenceFactorPercent", "Confidence factor"),
    notes: nullableText(formData, "notes"),
    planName,
    plannedLaunchDate: dateOrNull(formData, "plannedLaunchDate", "Planned launch date"),
    riskFactor: adjustmentPercentFactor(formData, "riskFactorPercent", "Risk factor"),
    riskReason: nullableText(formData, "riskReason"),
    seasonFactor: adjustmentPercentFactor(formData, "seasonFactorPercent", "Season factor"),
    supplierCode: supplier.supplierCode,
    supplierNameSnapshot: supplier.supplierNameSnapshot,
    targetCoverageDays: positiveInteger(formData, "targetCoverageDays", "Target coverage days"),
  };
}

export async function createNewProductPlanAction(formData: FormData) {
  let nextPath = "/new-product-opening-buy-planner/new";
  try {
    const profile = await requireUser("/new-product-opening-buy-planner/new");
    requireSuperAdmin(profile);

    const input = await parsedPlanInput(formData);
    const planId = await createNewProductPlan({ ...input, createdBy: profile.authUserId });
    try {
      await auditPlan({
        actionType: "created",
        changedBy: profile.authUserId,
        newValues: input,
        note: "Created New Product Opening Buy plan.",
        planId,
      });
    } catch (error) {
      refreshPlanner(planId);
      nextPath = errorUrl(
        `/new-product-opening-buy-planner/${planId}`,
        error instanceof Error
          ? `Draft plan was created, but ${error.message}`
          : "Draft plan was created, but the audit log could not be written.",
      );
      redirect(nextPath);
    }
    refreshPlanner(planId);
    nextPath = successUrl(`/new-product-opening-buy-planner/${planId}`, "Draft plan created.");
  } catch (error) {
    nextPath = errorUrl(
      "/new-product-opening-buy-planner/new",
      error instanceof Error ? error.message : "Could not create plan.",
    );
  }

  redirect(nextPath);
}

export async function updateNewProductPlanAction(formData: FormData) {
  const planId = text(formData, "planId");
  let nextPath = `/new-product-opening-buy-planner/${encodeURIComponent(planId)}`;
  try {
    const profile = await requireUser(nextPath);
    requireSuperAdmin(profile);
    if (!planId) {
      throw new Error("Plan ID is required.");
    }

    const current = await getNewProductPlan(planId);
    if (!current) {
      throw new Error("Plan not found.");
    }
    if (current.status !== "draft") {
      throw new Error("Only draft plans can be edited in this phase.");
    }

    const input = await parsedPlanInput(formData);
    await updateNewProductPlan(planId, input);
    await auditPlan({
      actionType: "updated",
      changedBy: profile.authUserId,
      newValues: input,
      note: "Updated New Product Opening Buy draft.",
      oldValues: current,
      planId,
    });
    refreshPlanner(planId);
    nextPath = successUrl(`/new-product-opening-buy-planner/${planId}`, "Draft plan updated.");
  } catch (error) {
    nextPath = errorUrl(
      `/new-product-opening-buy-planner/${encodeURIComponent(planId)}`,
      error instanceof Error ? error.message : "Could not update plan.",
    );
  }

  redirect(nextPath);
}

export async function addComparableProductAction(formData: FormData) {
  const planId = text(formData, "planId");
  let nextPath = plannerDetailPath(planId);
  try {
    const profile = await requireUser(nextPath);
    requireSuperAdmin(profile);
    await requireComparableEditablePlan(planId);

    const comparableProductId = text(formData, "comparableProductId");
    const comparableTitleSnapshot = text(formData, "comparableTitleSnapshot");
    const weight = positiveComparableWeight(formData);
    const note = nullableText(formData, "note");

    if (!comparableTitleSnapshot) {
      throw new Error("Reference product title is required.");
    }
    const productReference = await requireExistingComparableProduct(comparableProductId);

    const comparable = await addComparableProduct(planId, {
      comparableProductId,
      comparableTitleSnapshot,
      note,
      weight,
    });
    await auditPlan({
      actionType: "add_comparable",
      changedBy: profile.authUserId,
      newValues: {
        ...comparable,
        comparableSku: null,
        scope: "product_level",
        variantCount: productReference.variantCount,
      },
      note: `Added product-level comparable reference ${comparable.comparableTitleSnapshot}.`,
      planId,
    });
    refreshPlanner(planId);
    nextPath = successUrl(plannerDetailPath(planId), "Comparable reference product added.");
  } catch (error) {
    nextPath = errorUrl(
      plannerDetailPath(planId),
      error instanceof Error ? error.message : "Could not add comparable reference product.",
    );
  }

  redirect(nextPath);
}

export async function updateComparableProductAction(formData: FormData) {
  const planId = text(formData, "planId");
  const comparableId = text(formData, "comparableId");
  let nextPath = plannerDetailPath(planId);
  try {
    const profile = await requireUser(nextPath);
    requireSuperAdmin(profile);
    await requireComparableEditablePlan(planId);
    if (!comparableId) {
      throw new Error("Reference product ID is required.");
    }

    const comparables = await listPlanComparables(planId);
    const current = comparables.find((comparable) => comparable.id === comparableId);
    if (!current) {
      throw new Error("Reference product was not found on this plan.");
    }

    const updated = await updateComparableProduct(comparableId, {
      note: nullableText(formData, "note"),
      weight: positiveComparableWeight(formData),
    });
    await auditPlan({
      actionType: "update_comparable",
      changedBy: profile.authUserId,
      newValues: updated,
      note: `Updated comparable reference ${updated.comparableTitleSnapshot}.`,
      oldValues: current,
      planId,
    });
    refreshPlanner(planId);
    nextPath = successUrl(plannerDetailPath(planId), "Comparable reference product updated.");
  } catch (error) {
    nextPath = errorUrl(
      plannerDetailPath(planId),
      error instanceof Error ? error.message : "Could not update comparable reference product.",
    );
  }

  redirect(nextPath);
}

export async function removeComparableProductAction(formData: FormData) {
  const planId = text(formData, "planId");
  const comparableId = text(formData, "comparableId");
  let nextPath = plannerDetailPath(planId);
  try {
    const profile = await requireUser(nextPath);
    requireSuperAdmin(profile);
    await requireComparableEditablePlan(planId);
    if (!comparableId) {
      throw new Error("Reference product ID is required.");
    }

    const comparables = await listPlanComparables(planId);
    const current = comparables.find((comparable) => comparable.id === comparableId);
    if (!current) {
      throw new Error("Reference product was not found on this plan.");
    }

    const removed = await removeComparableProduct(comparableId);
    await auditPlan({
      actionType: "remove_comparable",
      changedBy: profile.authUserId,
      note: `Removed comparable reference ${removed.comparableTitleSnapshot}.`,
      oldValues: current,
      planId,
    });
    refreshPlanner(planId);
    nextPath = successUrl(plannerDetailPath(planId), "Comparable reference product removed.");
  } catch (error) {
    nextPath = errorUrl(
      plannerDetailPath(planId),
      error instanceof Error ? error.message : "Could not remove comparable reference product.",
    );
  }

  redirect(nextPath);
}

export async function generatePlanLinesAction(formData: FormData) {
  const planId = text(formData, "planId");
  let nextPath = plannerDetailPath(planId);
  try {
    const profile = await requireUser(nextPath);
    requireSuperAdmin(profile);
    await requirePlanningEditablePlan(planId);
    const oldLines = await listPlanLines(planId);
    const controls = matrixDemandControls(formData);
    await updateNewProductPlanDemandControls(planId, controls);
    const result = await generateSuggestedPlanLines(planId, controls.totalMultiplier);
    await auditPlan({
      actionType: "generate_plan_lines",
      changedBy: profile.authUserId,
      newValues: {
        changedLines: result.changedLines,
        channelFilter: controls.channelFilter,
        confidenceAdjustmentPercent: controls.confidenceAdjustmentPercent,
        created: result.created,
        globalQtyAdjustmentPercent: controls.globalQtyAdjustmentPercent,
        riskAdjustmentPercent: controls.riskAdjustmentPercent,
        seasonAdjustmentPercent: controls.seasonAdjustmentPercent,
        skippedLocked: result.skippedLocked,
        updated: result.updated,
      },
      note: `Generated qty matrix with ${Math.round(controls.totalMultiplier * 100)}% total adjustment: ${result.created} created, ${result.updated} updated, ${result.skippedLocked} locked skipped.`,
      oldValues: oldLines,
      planId,
    });
    refreshPlanner(planId);
    nextPath = successUrl(plannerDetailPath(planId), "Qty matrix generated from estimate.");
  } catch (error) {
    nextPath = errorUrl(
      plannerDetailPath(planId),
      error instanceof Error ? error.message : "Could not generate qty matrix.",
    );
  }

  redirect(nextPath);
}

export async function applyGlobalQtyAdjustmentAction(formData: FormData) {
  const planId = text(formData, "planId");
  let nextPath = plannerDetailPath(planId);
  try {
    const profile = await requireUser(nextPath);
    requireSuperAdmin(profile);
    await requirePlanningEditablePlan(planId);
    const oldLines = await listPlanLines(planId);
    if (!oldLines.length) {
      throw new Error("Generate the qty matrix before applying a global adjustment.");
    }

    const controls = matrixDemandControls(formData);
    await updateNewProductPlanDemandControls(planId, controls);
    const result = await applyGlobalPlanLineAdjustment(planId, controls.totalMultiplier);
    await auditPlan({
      actionType: "apply_global_qty_adjustment",
      changedBy: profile.authUserId,
      newValues: {
        changedLines: result.changedLines,
        channelFilter: controls.channelFilter,
        confidenceAdjustmentPercent: controls.confidenceAdjustmentPercent,
        globalQtyAdjustmentPercent: controls.globalQtyAdjustmentPercent,
        riskAdjustmentPercent: controls.riskAdjustmentPercent,
        seasonAdjustmentPercent: controls.seasonAdjustmentPercent,
        skippedLocked: result.skippedLocked,
        updated: result.updated,
      },
      note: `Applied ${Math.round(controls.totalMultiplier * 100)}% total qty adjustment: ${result.updated} updated, ${result.skippedLocked} locked skipped.`,
      oldValues: oldLines,
      planId,
    });
    refreshPlanner(planId);
    nextPath = successUrl(plannerDetailPath(planId), "Global qty adjustment applied.");
  } catch (error) {
    nextPath = errorUrl(
      plannerDetailPath(planId),
      error instanceof Error ? error.message : "Could not apply global qty adjustment.",
    );
  }

  redirect(nextPath);
}

export async function updatePlanLineAction(formData: FormData) {
  const planId = text(formData, "planId");
  const lineId = text(formData, "lineId");
  let nextPath = plannerDetailPath(planId);
  try {
    const profile = await requireUser(nextPath);
    requireSuperAdmin(profile);
    await requirePlanningEditablePlan(planId);
    if (!lineId) {
      throw new Error("Planning line ID is required.");
    }

    const lines = await listPlanLines(planId);
    const current = lines.find((line) => line.id === lineId);
    if (!current) {
      throw new Error("Planning line was not found on this plan.");
    }

    const manualQty = nonNegativeIntegerOrNull(formData, "manualQty", "Manual qty");
    const unitCost = nonNegativeMoneyOrNull(formData, "unitCost", "Unit cost");
    const orderMultiple = positiveIntegerField(formData, "orderMultiple", "Order multiple", current.orderMultiple || 10);
    const variantNote = nullableText(formData, "variantNote");
    const lockedQty = text(formData, "lockedQty") === "on";

    const updated = await updatePlanLine(lineId, {
      lockedQty,
      manualQty,
      orderMultiple,
      unitCost,
      variantNote,
    });
    await auditPlan({
      actionType: "update_plan_line",
      changedBy: profile.authUserId,
      newValues: updated,
      note: `Updated planning line ${updated.sizeValue || "-"} / ${updated.colorValue || "-"}.`,
      oldValues: current,
      planId,
    });
    refreshPlanner(planId);
    nextPath = successUrl(plannerDetailPath(planId), "Planning line updated.");
  } catch (error) {
    nextPath = errorUrl(
      plannerDetailPath(planId),
      error instanceof Error ? error.message : "Could not update planning line.",
    );
  }

  redirect(nextPath);
}

export async function updatePlanRowMetadataAction(formData: FormData) {
  const planId = text(formData, "planId");
  const lineIds = formData
    .getAll("lineId")
    .map((value) => String(value).trim())
    .filter(Boolean);
  let nextPath = plannerDetailPath(planId);
  try {
    const profile = await requireUser(nextPath);
    requireSuperAdmin(profile);
    await requirePlanningEditablePlan(planId);
    if (!lineIds.length) {
      throw new Error("At least one planning line is required.");
    }

    const lines = await listPlanLines(planId);
    const editableLineIds = new Set(lines.map((line) => line.id));
    const invalidLine = lineIds.find((lineId) => !editableLineIds.has(lineId));
    if (invalidLine) {
      throw new Error("Planning row contains a line that does not belong to this plan.");
    }

    const productName = text(formData, "productName");
    const colorValue = text(formData, "colorValue");
    if (!productName) {
      throw new Error("Planning name is required.");
    }

    const fileEntry = formData.get("mockupImage");
    const mockupImageStoragePath = fileEntry instanceof File ? await uploadMockupImage(planId, fileEntry) : "";
    const oldValues = lines.filter((line) => lineIds.includes(line.id));
    const updated = [];
    for (const lineId of lineIds) {
      updated.push(await updatePlanLineMetadata(lineId, {
        colorValue,
        mockupImageStoragePath: mockupImageStoragePath || undefined,
        productName,
      }));
    }

    await auditPlan({
      actionType: "update_plan_line_metadata",
      changedBy: profile.authUserId,
      newValues: updated,
      note: `Updated planning row ${productName}${colorValue ? ` / ${colorValue}` : ""}.`,
      oldValues,
      planId,
    });
    refreshPlanner(planId);
    nextPath = successUrl(plannerDetailPath(planId), "Planning row updated.");
  } catch (error) {
    nextPath = errorUrl(
      plannerDetailPath(planId),
      error instanceof Error ? error.message : "Could not update planning row.",
    );
  }

  redirect(nextPath);
}

function nonNegativeIntegerValue(value: FormDataEntryValue | null, label: string) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return null;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} must be 0 or greater.`);
  }
  return Math.ceil(parsed);
}

function nonNegativeMoneyValue(value: FormDataEntryValue | null, label: string) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return null;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} must be 0 or greater.`);
  }
  return parsed;
}

function positiveIntegerValue(value: FormDataEntryValue | null, label: string, fallback = 10) {
  const raw = String(value ?? "").trim();
  const parsed = raw ? Number(raw) : fallback;
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive whole number.`);
  }
  return parsed;
}

function formValueText(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

export async function updatePlanMatrixAction(formData: FormData) {
  const planId = text(formData, "planId");
  let nextPath = plannerDetailPath(planId);
  try {
    const profile = await requireUser(nextPath);
    requireSuperAdmin(profile);
    await requirePlanningEditablePlan(planId);

    const lines = await listPlanLines(planId);
    const linesById = new Map(lines.map((line) => [line.id, line]));
    const submittedLineIds = Array.from(new Set(
      formData
        .getAll("matrixLineId")
        .map((value) => String(value).trim())
        .filter(Boolean),
    ));
    const invalidLine = submittedLineIds.find((lineId) => !linesById.has(lineId));
    if (invalidLine) {
      throw new Error("Matrix contains a line that does not belong to this plan.");
    }

    const updatedLines = [];
    for (const lineId of submittedLineIds) {
      const current = linesById.get(lineId);
      if (!current) {
        continue;
      }
      const submittedManualQty = nonNegativeIntegerValue(
        formData.get(`manualQty:${lineId}`),
        `Manual qty for ${current.sizeValue || current.plannedSku || lineId}`,
      );
      const manualQty =
        current.manualQty === null && submittedManualQty === current.finalQty
          ? null
          : submittedManualQty;
      updatedLines.push(await updatePlanLine(lineId, {
        lockedQty: formValueText(formData, `lockedQty:${lineId}`) === "on",
        manualQty,
        orderMultiple: positiveIntegerValue(
          formData.get(`orderMultiple:${lineId}`),
          `Order multiple for ${current.sizeValue || current.plannedSku || lineId}`,
          current.orderMultiple || 10,
        ),
        unitCost: nonNegativeMoneyValue(
          formData.get(`unitCost:${lineId}`),
          `Unit cost for ${current.sizeValue || current.plannedSku || lineId}`,
        ),
        variantNote: formValueText(formData, `variantNote:${lineId}`) || null,
      }));
    }

    const submittedRowKeys = Array.from(new Set(
      formData
        .getAll("matrixRowKey")
        .map((value) => String(value).trim())
        .filter(Boolean),
    ));
    const updatedRows = [];
    for (const rowKey of submittedRowKeys) {
      const rowLineIds = Array.from(new Set(
        formData
          .getAll(`rowLineId:${rowKey}`)
          .map((value) => String(value).trim())
          .filter(Boolean),
      ));
      if (!rowLineIds.length) {
        continue;
      }
      const invalidRowLine = rowLineIds.find((lineId) => !linesById.has(lineId));
      if (invalidRowLine) {
        throw new Error("Matrix row contains a line that does not belong to this plan.");
      }
      const productName = formValueText(formData, `productName:${rowKey}`);
      const colorValue = formValueText(formData, `colorValue:${rowKey}`);
      if (!productName) {
        throw new Error("Planning name is required.");
      }

      const fileEntry = formData.get(`mockupImage:${rowKey}`);
      const hasMockupUpload = fileEntry instanceof File && fileEntry.size > 0;
      const mockupImageStoragePath = hasMockupUpload
        ? await uploadMockupImage(planId, fileEntry)
        : "";

      for (const lineId of rowLineIds) {
        updatedRows.push(await updatePlanLineMetadata(lineId, {
          colorValue,
          mockupImageStoragePath: mockupImageStoragePath || undefined,
          productName,
        }));
      }
    }

    await auditPlan({
      actionType: "update_plan_matrix",
      changedBy: profile.authUserId,
      newValues: {
        updatedLineCount: updatedLines.length,
        updatedRowLineCount: updatedRows.length,
      },
      note: `Saved quantity matrix: ${updatedLines.length} qty cells/lines and ${updatedRows.length} row metadata records.`,
      oldValues: lines,
      planId,
    });
    refreshPlanner(planId);
    nextPath = successUrl(plannerDetailPath(planId), "Quantity matrix saved.");
  } catch (error) {
    nextPath = errorUrl(
      plannerDetailPath(planId),
      error instanceof Error ? error.message : "Could not save quantity matrix.",
    );
  }

  redirect(nextPath);
}

export async function removePlanLineAction(formData: FormData) {
  const planId = text(formData, "planId");
  const lineId = text(formData, "lineId");
  let nextPath = plannerDetailPath(planId);
  try {
    const profile = await requireUser(nextPath);
    requireSuperAdmin(profile);
    await requirePlanningEditablePlan(planId);
    if (!lineId) {
      throw new Error("Planning line ID is required.");
    }

    const lines = await listPlanLines(planId);
    const current = lines.find((line) => line.id === lineId);
    if (!current) {
      throw new Error("Planning line was not found on this plan.");
    }

    const removed = await removePlanLine(lineId);
    await auditPlan({
      actionType: "remove_plan_line",
      changedBy: profile.authUserId,
      note: `Removed planning line ${removed.sizeValue || "-"} / ${removed.colorValue || "-"}.`,
      oldValues: current,
      planId,
    });
    refreshPlanner(planId);
    nextPath = successUrl(plannerDetailPath(planId), "Planning line removed.");
  } catch (error) {
    nextPath = errorUrl(
      plannerDetailPath(planId),
      error instanceof Error ? error.message : "Could not remove planning line.",
    );
  }

  redirect(nextPath);
}

export async function removePlanRowAction(formData: FormData) {
  const planId = text(formData, "planId");
  const lineIds = Array.from(new Set(
    formData
      .getAll("lineId")
      .map((value) => String(value).trim())
      .filter(Boolean),
  ));
  let nextPath = plannerDetailPath(planId);
  try {
    const profile = await requireUser(nextPath);
    requireSuperAdmin(profile);
    await requirePlanningEditablePlan(planId);
    if (!lineIds.length) {
      throw new Error("At least one planning line is required to remove a row.");
    }

    const lines = await listPlanLines(planId);
    const linesById = new Map(lines.map((line) => [line.id, line]));
    const invalidLine = lineIds.find((lineId) => !linesById.has(lineId));
    if (invalidLine) {
      throw new Error("Planning row contains a line that does not belong to this plan.");
    }

    const oldValues = lineIds.map((lineId) => linesById.get(lineId));
    const removed = [];
    for (const lineId of lineIds) {
      removed.push(await removePlanLine(lineId));
    }

    const rowLabel = oldValues
      .map((line) => line?.colorValue || line?.variantTitle || line?.productName)
      .find(Boolean) ?? "planning row";
    await auditPlan({
      actionType: "remove_plan_row",
      changedBy: profile.authUserId,
      newValues: removed,
      note: `Removed planning row ${rowLabel}.`,
      oldValues,
      planId,
    });
    refreshPlanner(planId);
    nextPath = successUrl(plannerDetailPath(planId), "Planning row removed.");
  } catch (error) {
    nextPath = errorUrl(
      plannerDetailPath(planId),
      error instanceof Error ? error.message : "Could not remove planning row.",
    );
  }

  redirect(nextPath);
}

export async function createPoFromNewProductPlanAction(formData: FormData) {
  const planId = text(formData, "planId");
  redirect(errorUrl(
    plannerDetailPath(planId),
    "This planner is for opening quantity planning only and does not create a PO.",
  ));
}

export async function cancelNewProductPlanAction(formData: FormData) {
  const planId = text(formData, "planId");
  let nextPath = `/new-product-opening-buy-planner/${encodeURIComponent(planId)}`;
  try {
    const profile = await requireUser(nextPath);
    requireSuperAdmin(profile);
    if (!planId) {
      throw new Error("Plan ID is required.");
    }

    const current = await getNewProductPlan(planId);
    if (!current) {
      throw new Error("Plan not found.");
    }
    if (["po_created", "closed"].includes(current.status)) {
      throw new Error("PO-created or closed plans cannot be cancelled.");
    }
    if (current.status === "cancelled") {
      throw new Error("This plan is already cancelled.");
    }

    const reason = nullableText(formData, "cancelReason");
    const supabase = getSupabaseServiceClient();
    if (!supabase) {
      throw new Error("Supabase is not configured.");
    }

    const { error } = await supabase
      .from("po_new_product_plans")
      .update({
        notes: [current.notes, reason ? `Cancellation reason: ${reason}` : ""].filter(Boolean).join("\n"),
        status: "cancelled",
      })
      .eq("id", planId);
    if (error) {
      throw new Error(error.message);
    }

    await auditPlan({
      actionType: "cancelled",
      changedBy: profile.authUserId,
      newValues: { status: "cancelled" },
      note: reason || "Plan cancelled.",
      oldValues: current,
      planId,
    });
    refreshPlanner(planId);
    nextPath = successUrl(`/new-product-opening-buy-planner/${planId}`, "Plan cancelled.");
  } catch (error) {
    nextPath = errorUrl(
      `/new-product-opening-buy-planner/${encodeURIComponent(planId)}`,
      error instanceof Error ? error.message : "Could not cancel plan.",
    );
  }

  redirect(nextPath);
}
