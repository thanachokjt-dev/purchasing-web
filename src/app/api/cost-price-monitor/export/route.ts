import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/lib/auth";
import {
  getCostPriceMonitorData,
} from "@/lib/cost-price-monitor";
import { costPriceMonitorXlsx } from "@/lib/cost-price-monitor-export";
import { canAccessCostPriceMonitor } from "@/lib/role-nav";

export const dynamic = "force-dynamic";

function safeFilenamePart(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function exportFilename({
  group,
  isSelected,
  stamp,
  suppliers,
}: {
  group: string;
  isSelected: boolean;
  stamp: string;
  suppliers: string[];
}) {
  if (isSelected) {
    return `cost_price_monitor_selected_${stamp}.xlsx`;
  }
  const supplierPart = suppliers.length === 1 ? safeFilenamePart(suppliers[0]) : suppliers.length > 1 ? "multiple_suppliers" : "";
  const groupPart = safeFilenamePart(group);
  if (!supplierPart && !groupPart) {
    return `cost_price_monitor_export_${stamp}.xlsx`;
  }
  return `cost_price_monitor_${supplierPart || "all"}${groupPart ? `_${groupPart}` : ""}_${stamp}.xlsx`;
}

export async function GET(request: NextRequest) {
  const profile = await getCurrentUserProfile();
  if (!profile?.isActive) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  if (!canAccessCostPriceMonitor(profile)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const supplierFilters = searchParams.getAll("supplier");
  const selectedFilters = searchParams.getAll("selected");
  const data = await getCostPriceMonitorData({
    category: searchParams.get("category") ?? undefined,
    direction: searchParams.get("direction") ?? undefined,
    exportAll: true,
    group: searchParams.get("group") ?? undefined,
    lowMarginOnly: searchParams.get("lowMarginOnly") ?? undefined,
    missingCostOnly: searchParams.get("missingCostOnly") ?? undefined,
    poStatus: searchParams.get("poStatus") ?? undefined,
    q: searchParams.get("q") ?? undefined,
    selected: selectedFilters.length ? selectedFilters : undefined,
    sort: searchParams.get("sort") ?? undefined,
    supplier: supplierFilters.length ? supplierFilters : undefined,
    visibility: searchParams.get("visibility") ?? undefined,
  });
  const stamp = new Date().toISOString().slice(0, 10);
  const group = searchParams.get("group") ?? "";
  const filename = exportFilename({ group, isSelected: data.filters.selectedGroupKeys.length > 0, stamp, suppliers: data.filters.suppliers });

  return new NextResponse(costPriceMonitorXlsx(data.rows, data.warnings), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  });
}
