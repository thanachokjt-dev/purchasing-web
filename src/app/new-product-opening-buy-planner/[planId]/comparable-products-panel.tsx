"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PendingSubmitButton } from "@/app/loading-controls";
import {
  addComparableProductAction,
  removeComparableProductAction,
  updateComparableProductAction,
} from "@/app/new-product-opening-buy-planner/actions";
import type {
  ComparableProductSearchResult,
  NewProductPlanComparable,
} from "@/lib/new-product-opening-buy";
import {
  matrixItemFamily,
  matrixSectionLabel,
  matrixSectionName,
  type MatrixItemLike,
} from "@/lib/po-size-matrix";

const inputClass =
  "mt-1 h-10 rounded-md border border-[#cfd6df] bg-white px-3 text-sm text-[#172026] outline-none focus:border-[#255f85]";
const labelClass = "grid gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#64707d]";

function skuCountLabel(count: number) {
  return `${count.toLocaleString("en-US")} SKU${count === 1 ? "" : "s"}`;
}

function comparableMatrixItem({
  productTitle,
  productType,
  sku,
}: {
  productTitle: string;
  productType?: string | null;
  sku?: string | null;
}): MatrixItemLike {
  return {
    fullName: [productTitle, productType, sku].filter(Boolean).join(" "),
    productName: productTitle,
    productTitle,
    sku,
    variantTitle: sku,
  };
}

function comparableFamilyLabel(item: MatrixItemLike) {
  const family = matrixItemFamily(item);
  return matrixSectionLabel(matrixSectionName(item, item.productName || item.productTitle || "Comparable"), family);
}

function ComparableSearchResultRow({
  alreadySelected,
  defaultNote,
  defaultWeight,
  planId,
  result,
}: {
  alreadySelected: boolean;
  defaultNote: string;
  defaultWeight: string;
  planId: string;
  result: ComparableProductSearchResult;
}) {
  return (
    <form action={addComparableProductAction}>
      <input name="planId" type="hidden" value={planId} />
      <input name="comparableProductId" type="hidden" value={result.productId} />
      <input name="comparableTitleSnapshot" type="hidden" value={result.productTitle} />
      <input name="weight" type="hidden" value={defaultWeight || "1"} />
      <input name="note" type="hidden" value={defaultNote} />
      <button
        className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-[#f3f5f7] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={alreadySelected}
        type="submit"
      >
        {result.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt=""
            className="size-9 rounded border border-[#dfe4ea] object-cover"
            src={result.imageUrl}
          />
        ) : (
          <span className="grid size-9 shrink-0 place-items-center rounded border border-[#dfe4ea] bg-[#f3f5f7] text-[10px] text-[#7a8794]">
            SKU
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-[#172026]">
            {result.productTitle}
          </span>
          <span className="block text-xs text-[#7a8794]">
            {skuCountLabel(result.variantCount)}
            {result.productType ? ` / ${result.productType}` : ""}
          </span>
          <span className="mt-1 inline-flex rounded bg-[#eef6fb] px-1.5 py-0.5 text-[11px] font-semibold text-[#255f85]">
            {comparableFamilyLabel(comparableMatrixItem({
              productTitle: result.productTitle,
              productType: result.productType,
            }))}
          </span>
          {result.matchedExamples.length ? (
            <span className="block truncate text-[11px] text-[#8a96a3]">
              Matches: {result.matchedExamples.join(", ")}
            </span>
          ) : null}
        </span>
        <span className="shrink-0 text-xs font-semibold text-[#255f85]">
          {alreadySelected ? "Added" : "Add"}
        </span>
      </button>
    </form>
  );
}

export function ComparableProductsPanel({
  canEdit,
  comparables,
  planId,
}: {
  canEdit: boolean;
  comparables: NewProductPlanComparable[];
  planId: string;
}) {
  const selectedProductIds = useMemo(
    () => new Set(comparables.map((comparable) => comparable.comparableProductId)),
    [comparables],
  );
  const searchRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ComparableProductSearchResult[]>([]);
  const [searchError, setSearchError] = useState("");
  const [defaultWeight, setDefaultWeight] = useState("1");
  const [defaultNote, setDefaultNote] = useState("");
  const normalizedQuery = query.trim();
  const selectedFamilyLabels = useMemo(
    () => new Set(comparables.map((comparable) => comparableFamilyLabel(comparableMatrixItem({
      productTitle: comparable.comparableTitleSnapshot,
      productType: comparable.productType,
      sku: comparable.comparableSku,
    })))),
    [comparables],
  );

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!searchRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useEffect(() => {
    if (normalizedQuery.length < 2) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setSearchError("");
      try {
        const response = await fetch(
          `/api/new-product-opening-buy-planner/comparable-search?q=${encodeURIComponent(normalizedQuery)}`,
          { signal: controller.signal },
        );
        const payload = (await response.json()) as {
          error?: string;
          items?: ComparableProductSearchResult[];
        };
        if (!response.ok) {
          throw new Error(payload.error || "Could not search reference products.");
        }
        setResults(payload.items ?? []);
        setOpen(true);
      } catch (error) {
        if (!controller.signal.aborted) {
          setResults([]);
          setSearchError(error instanceof Error ? error.message : "Could not search reference products.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 220);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [normalizedQuery]);

  const showDropdown = canEdit && open && normalizedQuery.length >= 2;
  const duplicateVisible = results.some((result) => selectedProductIds.has(result.productId));

  return (
    <section className="rounded-lg border border-[#dfe4ea] bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#e2e7ed] p-5">
        <div>
          <h2 className="text-lg font-semibold">Comparable Products</h2>
          <p className="mt-1 text-sm text-[#667380]">
            Comparable products are selected at main product level. All variants/SKUs under the selected product will be used as reference data.
          </p>
        </div>
        {!canEdit ? (
          <span className="rounded-md bg-[#eef0f2] px-3 py-2 text-xs font-semibold text-[#52606d]">
            Read-only
          </span>
        ) : null}
      </div>

      {canEdit ? (
        <div className="border-b border-[#edf1f5] p-5">
          <div className="grid gap-3 md:grid-cols-[minmax(280px,420px)_110px_minmax(180px,1fr)]">
            <div className="relative z-[80] grid gap-1" ref={searchRef}>
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#65717f]">
                Search reference products
              </span>
              <input
                autoComplete="new-password"
                autoCorrect="off"
                className="h-9 w-full rounded-md border border-[#cfd6df] bg-white px-2 text-sm text-[#172026] outline-none focus:border-[#255f85]"
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setQuery(nextValue);
                  setOpen(true);
                  if (nextValue.trim().length < 2) {
                    setResults([]);
                    setLoading(false);
                    setSearchError("");
                  }
                }}
                onFocus={() => setOpen(true)}
                placeholder="Main product name, SKU, or variant"
                spellCheck={false}
                value={query}
              />
              {showDropdown ? (
                <div className="absolute top-full z-[100] mt-1 max-h-80 w-[420px] max-w-[calc(100vw-3rem)] overflow-y-auto rounded-md border border-[#cfd6df] bg-white p-1 shadow-xl">
                  {loading ? (
                    <div className="px-3 py-3 text-sm font-semibold text-[#667380]">Searching...</div>
                  ) : searchError ? (
                    <div className="px-3 py-3 text-sm font-semibold text-[#b42318]">{searchError}</div>
                  ) : results.length ? (
                    results.map((result) => (
                      <ComparableSearchResultRow
                        alreadySelected={selectedProductIds.has(result.productId)}
                        defaultNote={defaultNote}
                        defaultWeight={defaultWeight}
                        key={result.productId}
                        planId={planId}
                        result={result}
                      />
                    ))
                  ) : (
                    <div className="px-3 py-3 text-sm text-[#667380]">No matching products found</div>
                  )}
                </div>
              ) : null}
            </div>
            <label className={labelClass}>
              Default weight
              <input
                className="h-9 rounded-md border border-[#cfd6df] px-2 text-sm"
                min="0.01"
                onChange={(event) => setDefaultWeight(event.target.value)}
                step="0.01"
                type="number"
                value={defaultWeight}
              />
            </label>
            <label className={labelClass}>
              Note for selected product
              <input
                className="h-9 rounded-md border border-[#cfd6df] px-2 text-sm"
                onChange={(event) => setDefaultNote(event.target.value)}
                placeholder="Optional planning note"
                value={defaultNote}
              />
            </label>
          </div>

          {normalizedQuery.length === 1 ? (
            <p className="mt-3 text-sm font-semibold text-[#946200]">Enter at least 2 characters to search.</p>
          ) : null}
          {duplicateVisible ? (
            <p className="mt-3 text-sm font-semibold text-[#255f85]">
              This product is already selected as a comparable reference.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="p-5">
        {selectedFamilyLabels.size > 1 ? (
          <p className="mb-4 rounded-md border border-[#d7e4ee] bg-[#f5fbff] px-3 py-2 text-sm font-semibold text-[#255f85]">
            Multiple product families are selected. The Quantity Matrix will split them into separate planning sections.
          </p>
        ) : null}
        <div className="overflow-x-auto rounded-lg border border-[#edf1f5]">
          <table className="min-w-full divide-y divide-[#edf1f5] text-sm">
            <thead className="bg-[#f8fafc] text-left text-xs font-semibold uppercase tracking-[0.08em] text-[#64707d]">
              <tr>
                <th className="px-4 py-3">Comparable product</th>
                <th className="px-4 py-3">Detected family</th>
                <th className="px-4 py-3">Image</th>
                <th className="px-4 py-3">Scope</th>
                <th className="px-4 py-3">SKUs included</th>
                <th className="px-4 py-3">Weight</th>
                <th className="px-4 py-3">Note</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf1f5]">
              {comparables.length > 0 ? (
                comparables.map((comparable) => {
                  const familyLabel = comparableFamilyLabel(comparableMatrixItem({
                    productTitle: comparable.comparableTitleSnapshot,
                    productType: comparable.productType,
                    sku: comparable.comparableSku,
                  }));
                  return (
                  <tr key={comparable.id}>
                    <td className="px-4 py-3 font-semibold">{comparable.comparableTitleSnapshot || "-"}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-md bg-[#eef6fb] px-2 py-1 text-xs font-semibold text-[#255f85]">
                        {familyLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {comparable.imageUrl ? (
                        <span className="inline-flex items-center gap-2 text-xs font-semibold text-[#1f6b3d]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img alt="" className="size-9 rounded border border-[#dfe4ea] object-cover" src={comparable.imageUrl} />
                          Available
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-[#8a96a3]">No image</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[#52606d]">
                      {comparable.comparableSku ? "SKU-level / Single SKU" : "Product-level / All variants"}
                    </td>
                    <td className="px-4 py-3 text-[#52606d]">
                      {comparable.comparableSku || (comparable.variantCount ? skuCountLabel(comparable.variantCount) : "All variants")}
                    </td>
                    <td className="px-4 py-3 font-mono">{comparable.weight.toLocaleString("en-US")}</td>
                    <td className="px-4 py-3 text-[#52606d]">{comparable.note || "-"}</td>
                    <td className="px-4 py-3 text-right">
                      {canEdit ? (
                        <details className="inline-block text-left">
                          <summary className="cursor-pointer list-none rounded-md border border-[#cfd6df] px-3 py-2 text-xs font-semibold text-[#172026]">
                            Edit
                          </summary>
                          <div className="absolute right-8 z-10 mt-2 w-80 rounded-lg border border-[#dfe4ea] bg-white p-4 shadow-lg">
                            <form action={updateComparableProductAction} className="grid gap-3">
                              <input name="planId" type="hidden" value={planId} />
                              <input name="comparableId" type="hidden" value={comparable.id} />
                              <label className={labelClass}>
                                Weight
                                <input
                                  className={inputClass}
                                  defaultValue={comparable.weight}
                                  min="0.01"
                                  name="weight"
                                  step="0.01"
                                  type="number"
                                />
                              </label>
                              <label className={labelClass}>
                                Note
                                <input className={inputClass} defaultValue={comparable.note} name="note" />
                              </label>
                              <div className="flex justify-between gap-2">
                                <PendingSubmitButton
                                  className="inline-flex h-9 items-center justify-center rounded-md bg-[#172026] px-3 text-xs font-semibold text-white"
                                  loadingText="Saving..."
                                >
                                  Save
                                </PendingSubmitButton>
                              </div>
                            </form>
                            <form action={removeComparableProductAction} className="mt-3">
                              <input name="planId" type="hidden" value={planId} />
                              <input name="comparableId" type="hidden" value={comparable.id} />
                              <PendingSubmitButton
                                className="inline-flex h-9 items-center justify-center rounded-md border border-[#ffd6d6] bg-white px-3 text-xs font-semibold text-[#b42318]"
                                loadingText="Removing..."
                              >
                                Remove
                              </PendingSubmitButton>
                            </form>
                          </div>
                        </details>
                      ) : (
                        <span className="text-xs text-[#8a96a3]">Read-only</span>
                      )}
                    </td>
                  </tr>
                  );
                })
              ) : (
                <tr>
                  <td className="px-4 py-5 text-sm text-[#667380]" colSpan={8}>
                    No comparable reference products selected yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
