import "server-only";

import type { CurrentUserProfile } from "@/lib/auth";
import { getProfileAccessRole } from "@/lib/access-control";
import type { MatrixFamily } from "@/lib/po-size-matrix";
import {
  buildStockCountCatalogSnapshot,
  type StockCountCatalogRow,
} from "@/lib/stock-count-catalog";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

export type StockCountLocation = "warehouse" | "retail";
export type StockCountStatus = "draft" | "completed";

export type StockCountSession = {
  id: string;
  weekStart: string;
  locationType: StockCountLocation;
  status: StockCountStatus;
  createdAt: string;
  completedAt: string | null;
  totalLines: number;
  countedLines: number;
};

export type StockCountLine = {
  id: string;
  sku: string;
  productGroupKey: string;
  sectionName: string;
  family: MatrixFamily;
  productName: string;
  size: string;
  tags: string[];
  countedQty: number | null;
  sortOrder: number;
};

type SessionRow = {
  id: string;
  week_start: string;
  location_type: StockCountLocation;
  status: StockCountStatus;
  created_at: string;
  completed_at: string | null;
  total_lines: number;
  counted_lines: number;
};

type LineRow = {
  id: string;
  sku: string;
  product_group_key: string;
  section_name: string;
  family: MatrixFamily;
  product_name: string;
  size: string;
  tags: string[] | null;
  counted_qty: number | null;
  sort_order: number;
};

function requireSupabase() {
  const supabase = getSupabaseServiceClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

export function canAccessStockCounts(profile: CurrentUserProfile) {
  const accessRole = getProfileAccessRole(profile);
  return profile.role === "super_admin"
    || profile.role === "retail_manager"
    || accessRole === "warehouse_staff";
}

export function canEditStockCountLocation(
  profile: CurrentUserProfile,
  location: StockCountLocation,
) {
  if (profile.role === "super_admin") return true;
  if (getProfileAccessRole(profile) === "warehouse_staff") return location === "warehouse";
  return profile.role === "retail_manager" && location === "retail";
}

export function normalizeWeekStart(value: string) {
  const parsed = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) throw new Error("Invalid week date.");
  const day = parsed.getUTCDay() || 7;
  parsed.setUTCDate(parsed.getUTCDate() - day + 1);
  return parsed.toISOString().slice(0, 10);
}

export function currentWeekStart() {
  return normalizeWeekStart(new Date().toISOString().slice(0, 10));
}

async function fetchCatalog() {
  const supabase = requireSupabase();
  const result: StockCountCatalogRow[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("product_variants")
      .select("id,sku,variant_title,effective_status,option1_name,option1_value,option2_name,option2_value,option3_name,option3_value,products(product_title,product_type,tags,status)")
      .order("sku", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as unknown as StockCountCatalogRow[];
    result.push(...page);
    if (page.length < pageSize) break;
  }
  return result;
}

export async function createStockCountSession(
  profile: CurrentUserProfile,
  weekStart: string,
  location: StockCountLocation,
) {
  if (!canEditStockCountLocation(profile, location)) throw new Error("You cannot create this stock count.");
  const supabase = requireSupabase();
  const lines = buildStockCountCatalogSnapshot(await fetchCatalog());
  if (!lines.length) throw new Error("No active catalog items were found.");
  const { data, error } = await supabase.rpc("create_weekly_stock_count_session", {
    p_week_start: normalizeWeekStart(weekStart),
    p_location_type: location,
    p_created_by: profile.authUserId,
    p_lines: lines,
  });
  if (error) throw new Error(error.message);
  return String(data);
}

function mapLine(row: LineRow): StockCountLine {
  return {
    id: row.id,
    sku: row.sku,
    productGroupKey: row.product_group_key,
    sectionName: row.section_name,
    family: row.family,
    productName: row.product_name,
    size: row.size,
    tags: row.tags ?? [],
    countedQty: row.counted_qty,
    sortOrder: row.sort_order,
  };
}

async function fetchStockCountLines(sessionId: string) {
  const supabase = requireSupabase();
  const rows: LineRow[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("weekly_stock_count_lines")
      .select("id,sku,product_group_key,section_name,family,product_name,size,tags,counted_qty,sort_order")
      .eq("session_id", sessionId)
      .order("sort_order", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as LineRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows.map(mapLine);
}

export async function getStockCountSession(sessionId: string) {
  const supabase = requireSupabase();
  const [sessionResult, linesResult] = await Promise.all([
    supabase
      .from("weekly_stock_count_sessions")
      .select("id,week_start,location_type,status,created_at,completed_at,total_lines,counted_lines")
      .eq("id", sessionId)
      .maybeSingle<SessionRow>(),
    fetchStockCountLines(sessionId),
  ]);
  if (sessionResult.error) throw new Error(sessionResult.error.message);
  if (!sessionResult.data) return null;
  const lines = linesResult;
  const row = sessionResult.data;
  return {
    session: {
      id: row.id,
      weekStart: row.week_start,
      locationType: row.location_type,
      status: row.status,
      createdAt: row.created_at,
      completedAt: row.completed_at,
      totalLines: lines.length,
      countedLines: lines.filter((line) => line.countedQty !== null).length,
    } satisfies StockCountSession,
    lines,
  };
}

export async function listStockCountSessions(limit = 24) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("weekly_stock_count_sessions")
    .select("id,week_start,location_type,status,created_at,completed_at,total_lines,counted_lines")
    .order("week_start", { ascending: false })
    .order("location_type", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as SessionRow[]).map((row) => {
    return {
      id: row.id,
      weekStart: row.week_start,
      locationType: row.location_type,
      status: row.status,
      createdAt: row.created_at,
      completedAt: row.completed_at,
      totalLines: row.total_lines,
      countedLines: row.counted_lines,
    } satisfies StockCountSession;
  });
}

export async function saveStockCountValues(
  profile: CurrentUserProfile,
  session: StockCountSession,
  values: Array<{ lineId: string; countedQty: number | null }>,
) {
  if (!canEditStockCountLocation(profile, session.locationType)) throw new Error("You cannot edit this stock count.");
  if (session.status !== "draft") throw new Error("Completed stock counts cannot be edited.");
  const normalized = values.map((value) => {
    if (value.countedQty !== null && (!Number.isInteger(value.countedQty) || value.countedQty < 0)) {
      throw new Error("Counts must be whole numbers 0 or greater.");
    }
    return { line_id: value.lineId, counted_qty: value.countedQty };
  });
  const { error } = await requireSupabase().rpc("save_weekly_stock_count_values", {
    p_session_id: session.id,
    p_updated_by: profile.authUserId,
    p_values: normalized,
  });
  if (error) throw new Error(error.message);
}

export async function completeStockCountSession(profile: CurrentUserProfile, session: StockCountSession) {
  if (!canEditStockCountLocation(profile, session.locationType)) throw new Error("You cannot complete this stock count.");
  const { error } = await requireSupabase().rpc("complete_weekly_stock_count_session", {
    p_session_id: session.id,
    p_completed_by: profile.authUserId,
  });
  if (error) throw new Error(error.message);
}
