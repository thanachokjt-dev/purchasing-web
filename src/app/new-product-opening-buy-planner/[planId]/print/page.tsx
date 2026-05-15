/* eslint-disable @next/next/no-img-element */
import type { CSSProperties } from "react";
import { notFound, redirect } from "next/navigation";
import { PrintDocumentActions } from "@/app/new-product-opening-buy-planner/[planId]/print/print-document-actions";
import { requireUser } from "@/lib/auth";
import {
  getEstimatedComparableDemand,
  getNewProductPlan,
  getPlanLineSummary,
  type EstimatedComparableDemand,
  type NewProductPlan,
  type NewProductPlanDetail,
  type NewProductPlanLine,
} from "@/lib/new-product-opening-buy";
import {
  matrixItemFamily,
  matrixItemSize,
  matrixProductName,
  matrixSectionLabel,
  matrixSectionName,
  sortMatrixSizes,
  type MatrixFamily,
  type MatrixItemLike,
} from "@/lib/po-size-matrix";
import { canAccessAdminControlTower, defaultLandingForRole } from "@/lib/role-nav";

export const dynamic = "force-dynamic";

function formatNumber(value: number, digits = 0) {
  return value.toLocaleString("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function adjustmentPercentValue(value: number) {
  return Math.round((value - 1) * 100);
}

function formatAdjustmentPercent(value: number) {
  return `${adjustmentPercentValue(value)}%`;
}

function adjustmentToneClass(value: number) {
  const percent = adjustmentPercentValue(value);
  if (percent > 0) {
    return "new-product-print-adjustment-positive";
  }
  if (percent < 0) {
    return "new-product-print-adjustment-negative";
  }
  return "new-product-print-adjustment-neutral";
}

function planningNote(plan: NewProductPlan) {
  const season = adjustmentPercentValue(plan.seasonFactor);
  const confidence = adjustmentPercentValue(plan.confidenceFactor);
  const risk = adjustmentPercentValue(plan.riskFactor);
  const reductions = [
    season < 0 ? `low-season demand (${season}%)` : "",
    confidence < 0 ? `lower confidence (${confidence}%)` : "",
    risk < 0 ? `market risk (${risk}%)` : "",
  ].filter(Boolean);
  if (!reductions.length) {
    return `This opening buy uses the current demand estimate and is planned to cover approximately ${plan.targetCoverageDays} days of stock.`;
  }
  return `This order quantity has been adjusted for ${reductions.join(", ")} while still targeting approximately ${plan.targetCoverageDays} days of stock.`;
}

function formatDate(value: string) {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value));
}

function formatDateTime(value: string) {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function statusLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function matrixItemFromLine(line: NewProductPlanLine): MatrixItemLike {
  return {
    fullName: [
      line.productName,
      line.variantTitle,
      line.sizeValue,
      line.colorValue,
      line.plannedSku,
    ].filter(Boolean).join(" "),
    productName: line.productName,
    productTitle: line.productName,
    sku: line.plannedSku,
    variantTitle: [line.variantTitle, line.sizeValue].filter(Boolean).join(" "),
  };
}

function matrixRowKey(line: NewProductPlanLine) {
  const item = matrixItemFromLine(line);
  return [
    matrixSectionLabel(matrixSectionName(item, line.productName || "New product"), matrixItemFamily(item)),
    matrixProductName(item),
    line.colorValue || line.variantTitle || "Variant",
  ].join("::");
}

type MatrixRow = {
  color: string;
  imageUrl: string;
  key: string;
  lineIds: string[];
  linesBySize: Map<string, NewProductPlanLine>;
  mockupImageUrl: string;
  name: string;
};

type MatrixSection = {
  family: MatrixFamily;
  key: string;
  label: string;
  rows: MatrixRow[];
  sizeColumns: string[];
};

function comparableImageMaps(estimate: EstimatedComparableDemand | null) {
  return {
    byProductSizeColor: new Map(
      (estimate?.groups ?? [])
        .filter((group) => group.imageUrl)
        .map((group) => [
          [group.productName, group.size, group.color].map((value) => value.trim().toLowerCase()).join("::"),
          group.imageUrl,
        ]),
    ),
    bySizeColor: new Map(
      (estimate?.groups ?? [])
        .filter((group) => group.imageUrl)
        .map((group) => [
          [group.size, group.color].map((value) => value.trim().toLowerCase()).join("::"),
          group.imageUrl,
        ]),
    ),
  };
}

function buildMatrixSections(
  lines: NewProductPlanLine[],
  plan: NewProductPlan,
  estimate: EstimatedComparableDemand | null,
): MatrixSection[] {
  const imageMaps = comparableImageMaps(estimate);
  function bestLineImage(line: NewProductPlanLine) {
    if (line.imageUrl) {
      return line.imageUrl;
    }
    const productSizeColorKey = [line.productName, line.sizeValue, line.colorValue]
      .map((value) => value.trim().toLowerCase())
      .join("::");
    const sizeColorKey = [line.sizeValue, line.colorValue]
      .map((value) => value.trim().toLowerCase())
      .join("::");
    return imageMaps.byProductSizeColor.get(productSizeColorKey) || imageMaps.bySizeColor.get(sizeColorKey) || "";
  }

  return Array.from(
    lines.reduce((sections, line) => {
      const item = matrixItemFromLine(line);
      const family = matrixItemFamily(item);
      const sectionName = matrixSectionName(item, line.productName || "New product");
      const sectionLabel = matrixSectionLabel(sectionName, family);
      const sectionKey = `${sectionName.toLowerCase()}::${family}`;
      const section = sections.get(sectionKey) ?? {
        family,
        key: sectionKey,
        label: sectionLabel,
        rows: new Map<string, MatrixRow>(),
        sizes: new Set<string>(),
      };
      const size = matrixItemSize(item);
      const key = matrixRowKey(line);
      const row = section.rows.get(key) ?? {
        color: line.colorValue || line.variantTitle || "",
        imageUrl: bestLineImage(line),
        key,
        lineIds: [],
        linesBySize: new Map<string, NewProductPlanLine>(),
        mockupImageUrl: line.mockupImageUrl,
        name: matrixProductName(item) || line.productName || plan.planName || "New product",
      };
      if (!row.lineIds.includes(line.id)) {
        row.lineIds.push(line.id);
      }
      row.linesBySize.set(size, line);
      section.sizes.add(size);
      if (!row.imageUrl) {
        row.imageUrl = bestLineImage(line);
      }
      if (!row.mockupImageUrl) {
        row.mockupImageUrl = line.mockupImageUrl;
      }
      section.rows.set(key, row);
      sections.set(sectionKey, section);
      return sections;
    }, new Map<string, {
      family: MatrixFamily;
      key: string;
      label: string;
      rows: Map<string, MatrixRow>;
      sizes: Set<string>;
    }>())
      .values(),
  )
    .map((section): MatrixSection => ({
      family: section.family,
      key: section.key,
      label: section.label,
      rows: Array.from(section.rows.values())
        .sort((a, b) => a.name.localeCompare(b.name) || a.color.localeCompare(b.color)),
      sizeColumns: sortMatrixSizes(Array.from(section.sizes), section.family),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function qtyHeatmapStyle(qty: number, sectionMaxQty: number): CSSProperties {
  if (!Number.isFinite(qty) || qty <= 0 || sectionMaxQty <= 0) {
    return {};
  }
  const ratio = Math.max(0, Math.min(1, qty / sectionMaxQty));
  if (ratio < 0.18) {
    return { backgroundColor: "#fbfcf6" };
  }
  if (ratio < 0.42) {
    return { backgroundColor: "#fff4c7" };
  }
  if (ratio < 0.72) {
    return { backgroundColor: "#dff3d8" };
  }
  return { backgroundColor: "#bfe7dc" };
}

function comparablePrintRows(plan: NewProductPlanDetail, estimate: EstimatedComparableDemand | null) {
  const details = estimate?.details ?? [];
  return plan.comparables.flatMap((comparable) => {
    const matchingDetails = details.filter(
      (detail) => detail.comparableProduct.trim().toLowerCase() === comparable.comparableTitleSnapshot.trim().toLowerCase(),
    );

    if (!matchingDetails.length) {
      return [{
        ...comparable,
        averageDemandHm: 0,
        displayTitle: comparable.comparableTitleSnapshot,
        familyLabel: comparable.productType || (comparable.comparableSku ? "SKU-level" : "Product-level"),
        imageUrl: comparable.imageUrl,
        rowKey: comparable.id,
        skuCount: comparable.variantCount || (comparable.comparableSku ? 1 : 0),
        weightedDemandHm: 0,
      }];
    }

    const groups = matchingDetails.reduce((map, detail) => {
      const color = detail.color.trim() || "Unspecified";
      const key = color.toLowerCase();
      const current = map.get(key) ?? {
        color,
        details: [] as typeof matchingDetails,
        imageUrl: "",
      };
      current.details.push(detail);
      if (!current.imageUrl && detail.imageUrl) {
        current.imageUrl = detail.imageUrl;
      }
      map.set(key, current);
      return map;
    }, new Map<string, { color: string; details: typeof matchingDetails; imageUrl: string }>());

    return Array.from(groups.values())
      .sort((a, b) => a.color.localeCompare(b.color))
      .map((group) => {
        const demandDetails = group.details.filter((detail) => detail.demandHm > 0);
        const averageDemandHm = demandDetails.length
          ? demandDetails.reduce((sum, detail) => sum + detail.demandHm, 0) / demandDetails.length
          : 0;
        const familyLabel =
          group.details.find((detail) => detail.sectionLabel)?.sectionLabel ||
          comparable.productType ||
          (comparable.comparableSku ? "SKU-level" : "Product-level");

        return {
          ...comparable,
          averageDemandHm,
          displayTitle: `${comparable.comparableTitleSnapshot} - ${group.color}`,
          familyLabel,
          imageUrl: group.imageUrl || comparable.imageUrl,
          rowKey: `${comparable.id}:${group.color.toLowerCase()}`,
          skuCount: group.details.length,
          weightedDemandHm: averageDemandHm * comparable.weight,
        };
      });
  });
}

function SummaryGrid({ items }: { items: Array<[string, string, string?]> }) {
  return (
    <div className="new-product-print-grid">
      {items.map(([label, value, className]) => (
        <div className={className} key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

function QuantityMatrixPrintTable({ sections, total }: { sections: MatrixSection[]; total: number }) {
  if (!sections.length) {
    return <p className="new-product-print-note">No planning quantity lines generated yet.</p>;
  }

  return (
    <>
      <div className="new-product-print-matrix-stack">
        {sections.map((section) => {
          const sectionTotal = section.rows.reduce(
            (sum, row) => sum + Array.from(row.linesBySize.values()).reduce((rowSum, line) => rowSum + line.finalQty, 0),
            0,
          );
          const sectionMaxQty = Math.max(
            0,
            ...section.rows.flatMap((row) =>
              Array.from(row.linesBySize.values()).map((line) => line.finalQty),
            ),
          );
          return (
            <section className="new-product-print-matrix-section" key={section.key}>
              <h3>{section.label}</h3>
              <table className="new-product-print-table new-product-print-matrix-table">
                <colgroup>
                  <col className="new-product-print-col-image" />
                  <col className="new-product-print-col-image" />
                  <col className="new-product-print-col-name" />
                  <col className="new-product-print-col-style" />
                  {section.sizeColumns.map((size) => (
                    <col className="new-product-print-col-qty" key={`col-${size}`} />
                  ))}
                  <col className="new-product-print-col-total" />
                </colgroup>
                <thead>
                  <tr>
                    <th><span className="new-product-print-header-label">Comparable<br />Image</span></th>
                    <th><span className="new-product-print-header-label">Mockup<br />Image</span></th>
                    <th><span className="new-product-print-header-label">Planning Name</span></th>
                    <th><span className="new-product-print-header-label">Color /<br />Style</span></th>
                    {section.sizeColumns.map((size) => (
                      <th key={size}>{size}</th>
                    ))}
                    <th><span className="new-product-print-header-label">Total<br />Qty</span></th>
                  </tr>
                </thead>
                <tbody>
                  {section.rows.map((row) => {
                    const rowTotal = Array.from(row.linesBySize.values()).reduce((sum, line) => sum + line.finalQty, 0);
                    return (
                      <tr key={row.key}>
                        <td>
                          {row.imageUrl ? (
                            <img alt="" className="new-product-print-image" src={row.imageUrl} />
                          ) : (
                            <span className="new-product-print-placeholder">No comparable</span>
                          )}
                        </td>
                        <td>
                          {row.mockupImageUrl ? (
                            <img alt="" className="new-product-print-image" src={row.mockupImageUrl} />
                          ) : (
                            <span className="new-product-print-placeholder">No mockup</span>
                          )}
                        </td>
                        <td>{row.name}</td>
                        <td>{row.color || "-"}</td>
                        {section.sizeColumns.map((size) => {
                          const line = row.linesBySize.get(size);
                          return (
                            <td
                              className="new-product-print-number new-product-print-qty-cell"
                              key={size}
                              style={line ? qtyHeatmapStyle(line.finalQty, sectionMaxQty) : undefined}
                            >
                              {line ? formatNumber(line.finalQty) : "-"}
                            </td>
                          );
                        })}
                        <td className="new-product-print-number new-product-print-row-total">{formatNumber(rowTotal)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="new-product-print-number" colSpan={section.sizeColumns.length + 5}>Section Total</td>
                    <td className="new-product-print-number">{formatNumber(sectionTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </section>
          );
        })}
      </div>
      <p className="new-product-print-total">All Qty Total: {formatNumber(total)}</p>
    </>
  );
}

export default async function NewProductOpeningBuyPlanPrintPage({
  params,
}: {
  params: Promise<{ planId: string }>;
}) {
  const { planId } = await params;
  const currentUser = await requireUser(`/new-product-opening-buy-planner/${encodeURIComponent(planId)}/print`);
  if (!canAccessAdminControlTower(currentUser)) {
    redirect(
      `/access-denied?from=${encodeURIComponent(
        `/new-product-opening-buy-planner/${planId}/print`,
      )}&next=${encodeURIComponent(defaultLandingForRole(currentUser.role))}`,
    );
  }

  const plan = await getNewProductPlan(planId);
  if (!plan) {
    notFound();
  }
  const [estimate, summary] = await Promise.all([
    getEstimatedComparableDemand(plan.id),
    getPlanLineSummary(plan.id),
  ]);
  const matrixSections = buildMatrixSections(plan.lines, plan, estimate);
  const allQtyTotal = plan.lines.reduce((sum, line) => sum + line.finalQty, 0);
  const comparables = comparablePrintRows(plan, estimate);
  const planSummaryCards: Array<[string, string, string?]> = [
    ["Supplier", plan.supplierNameSnapshot || plan.supplierCode || "-", ""],
    ["Category", plan.category || "-", ""],
    ["Planned launch", formatDate(plan.plannedLaunchDate), "new-product-print-card-key"],
    ["Target coverage", `${plan.targetCoverageDays} days`, "new-product-print-card-key"],
    ["Budget cap", plan.budgetCapThb ? formatNumber(plan.budgetCapThb, 2) : "-", ""],
    ["Created", `${formatDateTime(plan.createdAt)} / ${plan.createdByProfile?.displayName || plan.createdByProfile?.email || "-"}`, ""],
    ["Updated", formatDateTime(plan.updatedAt), ""],
    ["Matrix lines", String(summary.lineCount), "new-product-print-card-key"],
  ];
  const adjustmentSummaryCards: Array<[string, string, string?]> = [
    ["Channel filter", plan.channelFilter || "All channels", ""],
    ["Season adjustment", formatAdjustmentPercent(plan.seasonFactor), adjustmentToneClass(plan.seasonFactor)],
    ["Confidence adjustment", formatAdjustmentPercent(plan.confidenceFactor), adjustmentToneClass(plan.confidenceFactor)],
    ["Risk adjustment", formatAdjustmentPercent(plan.riskFactor), adjustmentToneClass(plan.riskFactor)],
    ["Global qty adjustment", "0%", "new-product-print-adjustment-neutral"],
    ["Target coverage", `${plan.targetCoverageDays} days`, "new-product-print-card-key"],
  ];

  return (
    <main className="new-product-print-page">
      <PrintDocumentActions
        planId={plan.id}
        planName={plan.planName}
        planNumber={plan.planNumber}
        supplier={plan.supplierNameSnapshot || plan.supplierCode}
      />
      <article className="new-product-print-document">
        <header className="new-product-print-header">
          <div>
            <p className="new-product-print-kicker">{plan.planNumber}</p>
            <h1>{plan.planName}</h1>
            <p>This is a planning summary only and does not create a PO.</p>
          </div>
          <div className="new-product-print-status">
            <p>Status: {statusLabel(plan.status)}</p>
            <p>Printed: {formatDateTime(new Date().toISOString())}</p>
          </div>
        </header>

        <section className="new-product-print-section">
          <h2>Plan Summary</h2>
          <SummaryGrid items={planSummaryCards} />
        </section>

        <section className="new-product-print-section">
          <h2>Adjustment Summary</h2>
          <SummaryGrid items={adjustmentSummaryCards} />
          <p className="new-product-print-note">
            0% = no change, -25% = reduce by 25%, 50% = increase by 50%.
          </p>
          <p className="new-product-print-note">{planningNote(plan)}</p>
        </section>

        <section className="new-product-print-section">
          <h2>Comparable Product Summary</h2>
          <table className="new-product-print-table">
            <thead>
              <tr>
                <th>Image</th>
                <th>Comparable Product</th>
                <th>Family</th>
                <th>SKU Count</th>
                <th>Weight</th>
                <th>Demand Source</th>
                <th>Avg Demand HM</th>
                <th>Weighted HM</th>
              </tr>
            </thead>
            <tbody>
              {comparables.length ? comparables.map((comparable) => (
                <tr key={comparable.rowKey}>
                  <td>
                    {comparable.imageUrl ? (
                      <img alt="" className="new-product-print-image" src={comparable.imageUrl} />
                    ) : (
                      <span className="new-product-print-placeholder">No image</span>
                    )}
                  </td>
                  <td>{comparable.displayTitle}</td>
                  <td>{comparable.familyLabel}</td>
                  <td className="new-product-print-number">{formatNumber(comparable.skuCount)}</td>
                  <td className="new-product-print-number">{formatNumber(comparable.weight, 2)}</td>
                  <td>Purchasing Decision Demand HM</td>
                  <td className="new-product-print-number">{comparable.averageDemandHm ? formatNumber(comparable.averageDemandHm, 4) : "-"}</td>
                  <td className="new-product-print-number">{comparable.weightedDemandHm ? formatNumber(comparable.weightedDemandHm, 4) : "-"}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={8}>No comparable reference products selected.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="new-product-print-section new-product-print-matrix-summary">
          <h2>Quantity Matrix Summary</h2>
          <QuantityMatrixPrintTable sections={matrixSections} total={allQtyTotal} />
        </section>
      </article>
    </main>
  );
}
