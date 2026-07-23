import { NextRequest, NextResponse } from "next/server";
import { getPurchasingDecisionData } from "@/lib/purchasing-decision-data";

export const dynamic = "force-dynamic";

function csvCell(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function csvRow(values: Array<string | number | null | undefined>) {
  return values.map(csvCell).join(",");
}

function selectedAlerts(searchParams: URLSearchParams) {
  const alerts = searchParams.getAll("alert").flatMap((value) =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );

  return alerts.length ? alerts : "all";
}

function selectedStock(searchParams: URLSearchParams) {
  const stocks = searchParams.getAll("stock").flatMap((value) =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );

  return stocks.length ? stocks : "all";
}

function selectedTags(searchParams: URLSearchParams) {
  const tags = searchParams.getAll("tag").flatMap((value) =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );

  return tags.length ? tags : "all";
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const data = await getPurchasingDecisionData({
    alert: selectedAlerts(searchParams),
    capSelling: searchParams.get("capSelling") ?? undefined,
    itemStatus: searchParams.get("status") ?? "all",
    lifetimeWeight: searchParams.get("lifetimeWeight"),
    limit: null,
    q: searchParams.get("q") ?? "",
    recentFloor: searchParams.get("recentFloor"),
    round10: searchParams.get("round10") ?? "positive",
    sellingWeight: searchParams.get("sellingWeight"),
    stock: selectedStock(searchParams),
    supplier: searchParams.get("supplier") ?? "all",
    tag: selectedTags(searchParams),
    visibility: searchParams.get("visibility") ?? "active",
  });
  const headers = [
    "SKU",
    "Product",
    "Main Name",
    "Item Status",
    "Tags",
    "Supplier",
    "Supplier Source",
    "Hidden",
    "Hide Reason",
    "On Hand",
    "Total Sale",
    "Demand 30D",
    "Demand HM",
    "Safety Days",
    "Lead Time Days",
    "Order Cycle Days",
    "Reorder Point",
    "Target Qty",
    "Order Qty",
    "Round 10",
    "Order Qty Mode",
    "Coming",
    "Pending Coming",
    "Stock Value",
    "Coming Value",
    "Alert",
    "Stock Position",
    "Stock Alert",
    "Over Qty",
    "Over Days",
    "Note",
  ];
  const rows = data.lines.map((line) =>
    csvRow([
      line.sku,
      line.productName,
      line.mainName,
      line.itemStatus,
      line.tags.join("; "),
      line.supplier,
      line.supplierSource,
      line.hidden ? "yes" : "no",
      line.hideReason,
      line.onHandUnits,
      line.totalSale,
      line.demand30Days,
      line.demandIndexHm,
      line.safetyDays,
      line.leadTimeDays,
      line.orderCycleDays,
      line.reorderPointUnits,
      line.ropUnitsRaw,
      line.manualRopUnits ?? line.ropUnitsRounded,
      line.ropUnitsRounded,
      line.orderQtyMode,
      line.coming,
      line.pendingComing,
      line.inventoryValue,
      line.comingValue,
      line.ropAlert,
      line.stockPositionUnits,
      line.stockAlert,
      line.overstockUnits,
      line.overstockDays,
      line.note,
    ]),
  );
  const csv = [csvRow(headers), ...rows].join("\r\n");
  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(`\uFEFF${csv}`, {
    headers: {
      "Content-Disposition": `attachment; filename="purchasing-decision-${stamp}.csv"`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}
