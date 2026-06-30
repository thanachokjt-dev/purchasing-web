"use client";

import { useActionState, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import {
  saveDashboardSkuCostOverrideAction,
  saveDashboardSkuCostOverridesBulkAction,
} from "@/app/dashboard/actions";
import {
  initialDashboardBulkSkuCostOverrideState,
  type DashboardBulkSkuCostOverrideState,
} from "@/app/dashboard/missing-cost-sku-state";
import { LoadingLabel } from "@/app/loading-controls";
import type { StockValueData } from "@/lib/stock-value-data";

type DashboardSearchParams = {
  stockCostError?: string;
  stockCostSaved?: string;
  stockCostSku?: string;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}

function RowSaveButton({ sku }: { sku: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      className="inline-flex h-8 w-full items-center justify-center rounded-md bg-[#172026] px-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
      disabled={pending}
      formAction={saveDashboardSkuCostOverrideAction}
      onClick={(event) => {
        const form = event.currentTarget.form;
        const input = form?.elements.namedItem("saveSku");
        if (input instanceof HTMLInputElement) {
          input.value = sku;
        }
      }}
      type="submit"
    >
      <LoadingLabel loading={pending} loadingText="Saving">
        Save cost
      </LoadingLabel>
    </button>
  );
}

function BulkSaveButton({ dirtyCount, pending }: { dirtyCount: number; pending: boolean }) {
  return (
    <button
      className="inline-flex h-9 items-center justify-center rounded-md bg-[#172026] px-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
      disabled={dirtyCount === 0 || pending}
      type="submit"
    >
      <LoadingLabel loading={pending} loadingText="Saving">
        Save all edited costs{dirtyCount > 0 ? ` (${dirtyCount})` : ""}
      </LoadingLabel>
    </button>
  );
}

function failedMessageForSku(state: DashboardBulkSkuCostOverrideState, sku: string) {
  const failedRows = Array.isArray(state.failedRows) ? state.failedRows : [];
  return failedRows.find((row) => row.sku === sku)?.message ?? "";
}

function stableBulkState(state: DashboardBulkSkuCostOverrideState | undefined): DashboardBulkSkuCostOverrideState {
  const failedRows = Array.isArray(state?.failedRows) ? state.failedRows : [];
  const savedSkus = Array.isArray(state?.savedSkus) ? state.savedSkus : [];
  const successRows = Array.isArray(state?.successRows) ? state.successRows : savedSkus;
  return {
    failedRows,
    message: state?.message ?? "",
    savedCount: typeof state?.savedCount === "number" ? state.savedCount : savedSkus.length,
    savedSkus,
    successRows,
    status: state?.status ?? "idle",
  };
}

export function MissingCostSkuTable({
  rows,
  stockCostStatus,
}: {
  rows: StockValueData["missingCostSkus"];
  stockCostStatus: DashboardSearchParams;
}) {
  const router = useRouter();
  const [dirtySkus, setDirtySkus] = useState<Set<string>>(() => new Set());
  const [state, formAction, pending] = useActionState(async (previousState: DashboardBulkSkuCostOverrideState, formData: FormData) => {
    const nextState = stableBulkState(await saveDashboardSkuCostOverridesBulkAction(previousState, formData));
    const savedSkus = Array.isArray(nextState.savedSkus) ? nextState.savedSkus : [];
    if (savedSkus.length > 0) {
      setDirtySkus((current) => {
        const next = new Set(current);
        for (const sku of savedSkus) {
          next.delete(sku);
        }
        return next;
      });
      router.refresh();
    }
    return nextState;
  }, initialDashboardBulkSkuCostOverrideState);
  const safeState = stableBulkState(state);
  const dirtySkuValues = useMemo(() => [...dirtySkus].sort((left, right) => left.localeCompare(right)), [dirtySkus]);
  const failedSkuSet = useMemo(() => {
    const failedRows = Array.isArray(safeState.failedRows) ? safeState.failedRows : [];
    return new Set(failedRows.map((row) => row.sku));
  }, [safeState.failedRows]);

  function handleChange(event: FormEvent<HTMLFormElement>) {
    const target = event.target;
    if (!(target instanceof HTMLElement) || target.dataset.dashboardCostInput !== "true") {
      return;
    }
    const row = target.closest<HTMLElement>("[data-dashboard-cost-row]");
    const sku = row?.dataset.sku;
    if (!sku) {
      return;
    }
    setDirtySkus((current) => {
      const next = new Set(current);
      next.add(sku);
      return next;
    });
  }

  return (
    <section className="rounded-lg border border-[#dfe4ea] bg-[#f9fafb] p-4">
      <form action={formAction} onChange={handleChange}>
        <input name="saveSku" type="hidden" defaultValue="" />
        {dirtySkuValues.map((sku) => (
          <input key={sku} name="dirtySku" type="hidden" value={sku} />
        ))}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[#172026]">Missing Cost SKUs</h3>
            <p className="mt-1 text-xs text-[#667380]">Positive-stock SKUs without a valid effective purchase cost.</p>
            <p className="mt-1 text-xs text-[#667380]">Saved here updates Cost Price Monitor SKU override.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900">
              Review before using for valuation
            </span>
            <BulkSaveButton dirtyCount={dirtySkuValues.length} pending={pending} />
          </div>
        </div>
        {safeState.message ? (
          <div
            className={`mt-3 rounded-md border p-3 text-sm font-semibold ${
              safeState.status === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : safeState.status === "partial"
                  ? "border-amber-200 bg-amber-50 text-amber-900"
                  : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {safeState.message}
          </div>
        ) : null}
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-[1380px] text-left text-xs">
            <thead className="text-[#5d6a78]">
              <tr className="border-b border-[#dfe4ea]">
                <th className="py-2 pr-3 font-semibold">SKU</th>
                <th className="py-2 pr-3 font-semibold">Product name</th>
                <th className="py-2 pr-3 font-semibold">Variant / size / color</th>
                <th className="py-2 pr-3 font-semibold">Supplier</th>
                <th className="py-2 pr-3 font-semibold">Category</th>
                <th className="py-2 pr-3 text-right font-semibold">Current Qty</th>
                <th className="py-2 font-semibold">Cost Status</th>
                <th className="py-2 pl-3 font-semibold">Manual purchase cost</th>
                <th className="py-2 pr-3 font-semibold">Manual landed cost</th>
                <th className="py-2 pr-3 font-semibold">Manual selling price</th>
                <th className="py-2 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.length > 0 ? (
                rows.map((row) => {
                  const rowError =
                    failedMessageForSku(safeState, row.sku) ||
                    (stockCostStatus.stockCostSku === row.sku ? stockCostStatus.stockCostError ?? "" : "");
                  return (
                    <tr
                      className={`border-b last:border-b-0 ${
                        failedSkuSet.has(row.sku) ? "border-red-200 bg-red-50/60" : "border-[#e6ebf0]"
                      }`}
                      data-dashboard-cost-row
                      data-sku={row.sku}
                      key={row.sku}
                    >
                      <td className="max-w-[160px] py-2 pr-3 align-top font-mono text-[11px] text-[#172026]">
                        {row.sku}
                        <input name="sku" type="hidden" value={row.sku} />
                      </td>
                      <td className="max-w-[260px] py-2 pr-3 align-top font-medium text-[#172026]">{row.productName}</td>
                      <td className="max-w-[200px] py-2 pr-3 align-top text-[#44515f]">{row.variantTitle || "N/A"}</td>
                      <td className="max-w-[160px] py-2 pr-3 align-top text-[#44515f]">{row.supplier}</td>
                      <td className="max-w-[160px] py-2 pr-3 align-top text-[#44515f]">{row.category}</td>
                      <td className="py-2 pr-3 text-right align-top font-semibold text-[#172026]">{formatNumber(row.currentQty)}</td>
                      <td className="py-2 align-top">
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                          {row.status}
                        </span>
                        {rowError ? <p className="mt-2 max-w-[220px] text-[11px] font-semibold text-red-700">{rowError}</p> : null}
                      </td>
                      <td className="py-2 pl-3 align-top">
                        <label className="sr-only" htmlFor={`manual-purchase-${row.sku}`}>
                          Manual purchase cost for {row.sku}
                        </label>
                        <input
                          className="h-8 w-full min-w-[120px] rounded-md border border-[#cfd6df] bg-white px-2 text-xs text-[#172026] outline-none focus:border-[#255f85]"
                          data-dashboard-cost-input="true"
                          id={`manual-purchase-${row.sku}`}
                          min="0.0001"
                          name="manualPurchasePrice"
                          placeholder="Purchase"
                          step="0.0001"
                          type="number"
                        />
                      </td>
                      <td className="py-2 pr-3 align-top">
                        <label className="sr-only" htmlFor={`manual-landed-${row.sku}`}>
                          Manual landed cost for {row.sku}
                        </label>
                        <input
                          className="h-8 w-full min-w-[120px] rounded-md border border-[#cfd6df] bg-white px-2 text-xs text-[#172026] outline-none focus:border-[#255f85]"
                          data-dashboard-cost-input="true"
                          id={`manual-landed-${row.sku}`}
                          min="0.0001"
                          name="manualLandedCost"
                          placeholder="Landed"
                          step="0.0001"
                          type="number"
                        />
                      </td>
                      <td className="py-2 pr-3 align-top">
                        <label className="sr-only" htmlFor={`manual-selling-${row.sku}`}>
                          Manual selling price for {row.sku}
                        </label>
                        <input
                          className="h-8 w-full min-w-[120px] rounded-md border border-[#cfd6df] bg-white px-2 text-xs text-[#172026] outline-none focus:border-[#255f85]"
                          data-dashboard-cost-input="true"
                          id={`manual-selling-${row.sku}`}
                          min="0.0001"
                          name="manualSellingPrice"
                          placeholder="Selling"
                          step="0.0001"
                          type="number"
                        />
                      </td>
                      <td className="py-2 align-top">
                        <RowSaveButton sku={row.sku} />
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td className="py-3 text-[#667380]" colSpan={11}>
                    All positive-stock SKUs have effective purchase cost.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </form>
    </section>
  );
}
