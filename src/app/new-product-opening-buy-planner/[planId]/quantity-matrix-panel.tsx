/* eslint-disable @next/next/no-img-element */
import { PendingSubmitButton } from "@/app/loading-controls";
import { DeleteRowButton } from "@/app/new-product-opening-buy-planner/[planId]/delete-row-button";
import { MatrixDirtyTracker } from "@/app/new-product-opening-buy-planner/[planId]/matrix-save-controls";
import { PrintSummaryButton } from "@/app/new-product-opening-buy-planner/[planId]/print-summary-button";
import {
  applyGlobalQtyAdjustmentAction,
  generatePlanLinesAction,
  removePlanRowAction,
  updatePlanMatrixAction,
} from "@/app/new-product-opening-buy-planner/actions";
import type {
  EstimatedComparableDemand,
  NewProductPlan,
  NewProductPlanLine,
  NewProductPlanLineSummary,
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

const inputClass =
  "h-9 rounded-md border border-[#cfd6df] bg-white px-2 text-sm text-[#172026] outline-none focus:border-[#255f85]";

function formatNumber(value: number, digits = 0) {
  return value.toLocaleString("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function adjustmentPercentValue(value: number) {
  return Math.round((value - 1) * 100);
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

function matrixRowKey(line: NewProductPlanLine) {
  const item = matrixItemFromLine(line);
  return [
    matrixSectionLabel(matrixSectionName(item, line.productName || "New product"), matrixItemFamily(item)),
    matrixProductName(item),
    line.colorValue || line.variantTitle || "Variant",
  ].join("::");
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

export function QuantityMatrixPanel({
  canEdit,
  estimate,
  lines,
  planId,
  plan,
  summary,
}: {
  canEdit: boolean;
  estimate: EstimatedComparableDemand | null;
  lines: NewProductPlanLine[];
  planId: string;
  plan: NewProductPlan;
  summary: NewProductPlanLineSummary;
}) {
  const hasEstimate = Boolean(estimate?.groups.length);
  const warnings = [
    !estimate?.summary.comparableCount ? "No comparable references selected yet." : "",
    estimate?.summary.comparableCount && !hasEstimate ? "No estimate is available yet." : "",
    !lines.length ? "No plan lines generated yet." : "",
    summary.budgetWarning ? "Estimated cost exceeds the plan budget cap." : "",
    summary.budgetComparisonNote,
    "This is planning only and does not create a PO.",
  ].filter(Boolean);
  const estimateImageByProductSizeColor = new Map(
    (estimate?.groups ?? []).map((group) => [
      [group.productName, group.size, group.color].map((value) => value.trim().toLowerCase()).join("::"),
      group.imageUrl,
    ]),
  );
  const estimateImageBySizeColor = new Map(
    (estimate?.groups ?? [])
      .filter((group) => group.imageUrl)
      .map((group) => [
        [group.size, group.color].map((value) => value.trim().toLowerCase()).join("::"),
        group.imageUrl,
      ]),
  );
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
    return estimateImageByProductSizeColor.get(productSizeColorKey) || estimateImageBySizeColor.get(sizeColorKey) || "";
  }
  const matrixSections = Array.from(
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
  const allQtyTotal = lines.reduce((sum, line) => sum + line.finalQty, 0);
  const hasMultipleMatrixSections = matrixSections.length > 1;
  const matrixFormId = `new-product-matrix-${planId}`;

  return (
    <section className="rounded-lg border border-[#dfe4ea] bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#e2e7ed] p-5">
        <div>
          <h2 className="text-lg font-semibold">Quantity Matrix</h2>
          <p className="mt-1 text-sm text-[#667380]">
            Suggested opening qty becomes editable planning lines. This does not create a PO.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && matrixSections.length ? (
            <>
              <MatrixDirtyTracker formId={matrixFormId} />
              <PendingSubmitButton
                className="inline-flex h-10 items-center justify-center rounded-md bg-[#172026] px-4 text-sm font-semibold text-white disabled:bg-[#a6b0ba]"
                form={matrixFormId}
                loadingText="Saving..."
              >
                Save Matrix
              </PendingSubmitButton>
            </>
          ) : null}
          <PrintSummaryButton planId={plan.id} />
          {!canEdit ? (
            <span className="rounded-md bg-[#eef0f2] px-3 py-2 text-xs font-semibold text-[#52606d]">
              Read-only
            </span>
          ) : null}
        </div>
      </div>
      {canEdit ? (
        <div className="border-b border-[#edf1f5] bg-[#fbfcfd] p-5">
          <form action={applyGlobalQtyAdjustmentAction} className="grid gap-4">
            <input name="planId" type="hidden" value={planId} />
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#64707d]">
                Channel Filter
                <input className={inputClass} defaultValue={plan.channelFilter} name="channelFilter" placeholder="All channels" />
              </label>
              {[
                ["Season Adjustment %", "seasonFactorPercent", adjustmentPercentValue(plan.seasonFactor)],
                ["Confidence Adjustment %", "confidenceFactorPercent", adjustmentPercentValue(plan.confidenceFactor)],
                ["Risk Adjustment %", "riskFactorPercent", adjustmentPercentValue(plan.riskFactor)],
                ["Global Qty Adjustment %", "qtyAdjustmentPercent", 0],
              ].map(([label, name, value]) => (
                <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#64707d]" key={String(name)}>
                  {label}
                  <span className="relative">
                    <input
                      className={`${inputClass} w-full pr-8 text-right`}
                      defaultValue={Number(value)}
                      min="-100"
                      name={String(name)}
                      step="1"
                      type="number"
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-semibold text-[#64707d]">%</span>
                  </span>
                </label>
              ))}
            </div>
            <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto] lg:items-end">
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#64707d]">
                Planning note
                <textarea
                  className="min-h-20 rounded-md border border-[#cfd6df] bg-white px-3 py-2 text-sm normal-case tracking-normal text-[#172026] outline-none focus:border-[#255f85]"
                  defaultValue={planningNote(plan)}
                  name="planningNote"
                />
              </label>
              <button
                className="inline-flex h-10 items-center justify-center rounded-md border border-[#cfd6df] bg-white px-4 text-sm font-semibold text-[#172026]"
                formAction={generatePlanLinesAction}
                type="submit"
              >
                Generate Qty Matrix
              </button>
              <PendingSubmitButton
                className="inline-flex h-10 items-center justify-center rounded-md bg-[#172026] px-4 text-sm font-semibold text-white disabled:bg-[#a6b0ba]"
                loadingText="Applying..."
              >
                Apply to Matrix
              </PendingSubmitButton>
            </div>
            <p className="text-sm leading-6 text-[#667380]">
              Use adjustment percentages relative to the base estimate. Enter 0% for no change, -25% to reduce by 25%, or 50% to increase by 50%.
              <span className="block">0% = ไม่เปลี่ยน, -25% = ลด 25%, 50% = เพิ่ม 50%</span>
              <span className="block">
                Calculation: base demand qty, channel filter when available, season adjustment factor, confidence adjustment factor, risk adjustment factor, global qty adjustment factor, round to order multiple, then manual qty overrides final qty. Locked lines are skipped.
              </span>
            </p>
          </form>
        </div>
      ) : null}

      <div className="grid gap-3 border-b border-[#edf1f5] p-5 md:grid-cols-2 xl:grid-cols-6">
        {[
          ["Total suggested qty", formatNumber(summary.totalSuggestedQty)],
          ["Final planned qty", formatNumber(summary.totalFinalQty)],
          ["Estimated cost", formatNumber(summary.totalEstimatedCost, 2)],
          ["Lines", String(summary.lineCount)],
          ["Manual overrides", String(summary.manualOverrideCount)],
          ["Locked lines", String(summary.lockedLineCount)],
        ].map(([title, value]) => (
          <div className="rounded-lg border border-[#edf1f5] bg-[#f8fafc] p-3" key={title}>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64707d]">{title}</p>
            <p className="mt-2 text-sm font-semibold text-[#172026]">{value}</p>
          </div>
        ))}
      </div>

      {warnings.length > 0 ? (
        <div className="border-b border-[#edf1f5] bg-[#fffaf0] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#946200]">Planning notes</p>
          <ul className="mt-2 grid gap-1 text-sm text-[#6f4f00]">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="p-5">
        {canEdit ? (
          <form action={updatePlanMatrixAction} id={matrixFormId}>
            <input name="planId" type="hidden" value={planId} />
          </form>
        ) : null}
        {hasMultipleMatrixSections ? (
          <p className="mb-4 rounded-md border border-[#d7e4ee] bg-[#f5fbff] px-3 py-2 text-sm font-semibold text-[#255f85]">
            Comparable products use multiple product families, so the matrix is split by detected section and size system.
          </p>
        ) : null}
        {matrixSections.length ? (
          <div className="grid gap-5">
            {matrixSections.map((section) => {
              const sectionTotal = section.rows.reduce(
                (sum, row) => sum + Array.from(row.linesBySize.values()).reduce((rowSum, line) => rowSum + line.finalQty, 0),
                0,
              );
              return (
                <div className="overflow-x-auto rounded-lg border border-[#edf1f5]" key={section.key}>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#edf1f5] bg-[#f8fafc] px-4 py-3">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-[#172026]">{section.label}</h3>
                    <span className="text-xs font-semibold text-[#64707d]">
                      {section.sizeColumns.length} option columns / Section total {formatNumber(sectionTotal)}
                    </span>
                  </div>
                  <table className="min-w-full divide-y divide-[#edf1f5] text-sm">
                    <thead className="bg-[#f8fafc] text-left text-xs font-semibold uppercase tracking-[0.08em] text-[#64707d]">
                      <tr>
                        <th className="sticky left-0 z-20 w-28 bg-[#f8fafc] px-4 py-3">Comparable Image</th>
                        <th className="sticky left-28 z-20 w-32 bg-[#f8fafc] px-4 py-3">Mockup Image</th>
                        <th className="sticky left-60 z-20 min-w-56 bg-[#f8fafc] px-4 py-3">Planning Name</th>
                        {section.sizeColumns.map((size) => (
                          <th className="min-w-32 px-4 py-3 text-center" key={size}>{size}</th>
                        ))}
                        <th className="min-w-28 px-4 py-3 text-right">Total Qty</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#edf1f5]">
                      {section.rows.map((row) => {
                  const rowTotal = Array.from(row.linesBySize.values()).reduce((sum, line) => sum + line.finalQty, 0);
                  const deleteRowFormId = `delete-plan-row-${row.lineIds[0]}`;
                  return (
                  <tr className="align-top" key={row.key}>
                    <td className="sticky left-0 z-10 border-r border-[#edf1f5] bg-white px-4 py-3">
                      {row.imageUrl ? (
                        <img alt="" className="h-14 w-14 rounded-md object-cover" src={row.imageUrl} />
                      ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-md border border-dashed border-[#cfd6df] bg-[#f8fafc] text-xs font-semibold text-[#a6b0ba]">
                          No comparable
                        </div>
                      )}
                    </td>
                    <td className="sticky left-28 z-10 border-r border-[#edf1f5] bg-white px-4 py-3">
                      <div className="grid w-24 gap-2">
                        {row.mockupImageUrl ? (
                          <img alt="" className="h-14 w-14 rounded-md border border-[#dfe4ea] object-cover" src={row.mockupImageUrl} />
                        ) : (
                          <div className="flex h-14 w-14 items-center justify-center rounded-md border border-dashed border-[#cfd6df] bg-[#fbfcfd] text-xs font-semibold text-[#a6b0ba]">
                            No mockup
                          </div>
                        )}
                        {canEdit ? (
                          <input
                            accept="image/*"
                            className="block w-full text-[11px] text-[#52606d] file:mr-0 file:h-7 file:w-full file:rounded-md file:border-0 file:bg-[#eef4f8] file:px-2 file:text-[11px] file:font-semibold file:text-[#255f85]"
                            form={matrixFormId}
                            name={`mockupImage:${row.key}`}
                            type="file"
                          />
                        ) : null}
                      </div>
                    </td>
                    <td className="sticky left-60 z-10 border-r border-[#edf1f5] bg-white px-4 py-3">
                      {canEdit ? (
                        <>
                          <div className="grid min-w-56 gap-2">
                            <input form={matrixFormId} name="matrixRowKey" type="hidden" value={row.key} />
                            {row.lineIds.map((lineId) => (
                              <input form={matrixFormId} key={lineId} name={`rowLineId:${row.key}`} type="hidden" value={lineId} />
                            ))}
                            <label className="grid gap-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64707d]">
                              Planning name
                              <input className={`${inputClass} h-8 font-semibold`} defaultValue={row.name} form={matrixFormId} name={`productName:${row.key}`} />
                            </label>
                            <label className="grid gap-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64707d]">
                              Color / style
                              <input className={`${inputClass} h-8`} defaultValue={row.color} form={matrixFormId} name={`colorValue:${row.key}`} />
                            </label>
                            <p className="text-[11px] font-medium normal-case tracking-normal text-[#667380]">
                              Edit rows and qty, then use Save Matrix once.
                            </p>
                          </div>
                          <form action={removePlanRowAction} className="mt-2" id={deleteRowFormId}>
                            <input name="planId" type="hidden" value={planId} />
                            {row.lineIds.map((lineId) => (
                              <input key={lineId} name="lineId" type="hidden" value={lineId} />
                            ))}
                            <DeleteRowButton form={deleteRowFormId} />
                          </form>
                        </>
                      ) : (
                        <>
                          <p className="font-semibold">{row.name}</p>
                          {row.color ? <p className="mt-1 text-xs text-[#667380]">{row.color}</p> : null}
                        </>
                      )}
                    </td>
                    {section.sizeColumns.map((size) => {
                      const line = row.linesBySize.get(size);
                      if (!line) {
                        return <td className="bg-[#fbfcfd] px-4 py-3 text-center text-[#a6b0ba]" key={size}>-</td>;
                      }
                      return (
                        <td className="px-2 py-3" key={line.id}>
                          <div className="grid gap-1">
                            {canEdit ? (
                              <>
                                <input form={matrixFormId} name="matrixLineId" type="hidden" value={line.id} />
                                <input form={matrixFormId} name={`unitCost:${line.id}`} type="hidden" value={line.unitCost ?? ""} />
                                <input form={matrixFormId} name={`orderMultiple:${line.id}`} type="hidden" value={line.orderMultiple} />
                                <input form={matrixFormId} name={`variantNote:${line.id}`} type="hidden" value={line.variantNote} />
                                <input className={`${inputClass} w-24 text-right font-mono`} defaultValue={line.manualQty ?? line.finalQty} form={matrixFormId} min={0} name={`manualQty:${line.id}`} step={1} type="number" />
                                <div className="flex items-center justify-between gap-1 text-[11px] text-[#667380]">
                                  <span>Sug {formatNumber(line.suggestedOpeningQty)}</span>
                                  <label className="inline-flex items-center gap-1">
                                    <input defaultChecked={line.lockedQty} form={matrixFormId} name={`lockedQty:${line.id}`} type="checkbox" />
                                    Lock
                                  </label>
                                </div>
                              </>
                            ) : (
                              <span className="font-mono font-semibold">{formatNumber(line.finalQty)}</span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-right font-mono font-semibold">{formatNumber(rowTotal)}</td>
                  </tr>
                  );
                      })}
                    </tbody>
                    <tfoot className="bg-[#f8fafc] text-sm font-semibold">
                      <tr>
                        <td className="px-4 py-3 text-right" colSpan={section.sizeColumns.length + 3}>Section Total</td>
                        <td className="px-4 py-3 text-right font-mono">{formatNumber(sectionTotal)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              );
            })}
            <div className="rounded-lg border border-[#edf1f5] bg-[#f8fafc] px-4 py-3 text-right text-sm font-semibold">
              All Qty Total <span className="ml-3 font-mono">{formatNumber(allQtyTotal)}</span>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-[#edf1f5] px-4 py-5 text-sm text-[#667380]">
            No planning quantity lines yet. Generate the qty matrix from the estimate when ready.
          </div>
        )}
      </div>
    </section>
  );
}
