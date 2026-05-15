import type { SupabaseClient } from "@supabase/supabase-js";

export type SalesSummaryRefreshResult = {
  refreshedDates: string[];
  refreshedDemandRows: number;
  rowsRefreshed: number;
};

function normalizeSalesDate(value: string | null | undefined) {
  const salesDate = value?.slice(0, 10);
  return salesDate && /^\d{4}-\d{2}-\d{2}$/.test(salesDate) ? salesDate : null;
}

export async function refreshSalesBySkuDayForDates(
  supabase: SupabaseClient,
  dates: Array<string | null | undefined>,
): Promise<SalesSummaryRefreshResult> {
  const refreshedDates = Array.from(
    new Set(dates.map(normalizeSalesDate).filter(Boolean) as string[]),
  ).sort();

  if (!refreshedDates.length) {
    return {
      refreshedDates,
      refreshedDemandRows: 0,
      rowsRefreshed: 0,
    };
  }

  const { data, error } = await supabase.rpc(
    "refresh_sales_by_sku_day_for_dates",
    {
      target_dates: refreshedDates,
    },
  );

  if (error) {
    throw new Error(
      `Could not refresh sales_by_sku_day summary. Apply migration 020 first: ${error.message}`,
    );
  }

  return {
    refreshedDates,
    refreshedDemandRows: Number(data ?? 0),
    rowsRefreshed: Number(data ?? 0),
  };
}

export async function backfillSalesSummaryAndDemand(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc("backfill_sales_summary_and_demand");

  if (error) {
    throw new Error(
      `Could not backfill sales_by_sku_day and demand_index_current. Apply migration 024 first: ${error.message}`,
    );
  }

  return data as {
    demand_index_current_rows?: number;
    finished_at?: string;
    sales_by_sku_day_rows?: number;
  } | null;
}
