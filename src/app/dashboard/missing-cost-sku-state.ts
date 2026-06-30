export type DashboardBulkSkuCostOverrideState = {
  failedRows: Array<{ message: string; sku: string }>;
  message: string;
  savedCount: number;
  savedSkus: string[];
  successRows: string[];
  status: "idle" | "error" | "partial" | "success";
};

export const initialDashboardBulkSkuCostOverrideState: DashboardBulkSkuCostOverrideState = {
  failedRows: [],
  message: "",
  savedCount: 0,
  savedSkus: [],
  successRows: [],
  status: "idle",
};
