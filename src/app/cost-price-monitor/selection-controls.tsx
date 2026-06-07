"use client";

import { createContext, type ReactNode, useContext, useMemo, useState } from "react";

type SelectionContextValue = {
  clear: () => void;
  estimatedLandCost: string;
  isAllPageSelected: boolean;
  isSelected: (groupKey: string) => boolean;
  pageGroupKeys: string[];
  setEstimatedLandCost: (value: string) => void;
  selectedCount: number;
  selectedGroupKeys: string[];
  toggle: (groupKey: string, checked: boolean) => void;
  togglePage: (checked: boolean) => void;
};

const SelectionContext = createContext<SelectionContextValue | null>(null);

function useSelection() {
  const context = useContext(SelectionContext);
  if (!context) {
    throw new Error("CostPriceMonitor selection controls must be used inside CostPriceMonitorSelectionProvider.");
  }
  return context;
}

function hrefWithSelection(baseHref: string, selectedGroupKeys: string[], estimatedLandCost: string) {
  const url = new URL(baseHref, "http://local");
  url.searchParams.delete("selected");
  for (const groupKey of selectedGroupKeys) {
    url.searchParams.append("selected", groupKey);
  }
  url.searchParams.set("estimatedLandCost", estimatedLandCost);
  return `${url.pathname}${url.search}`;
}

export function CostPriceMonitorSelectionProvider({
  children,
  defaultEstimatedLandCost,
  pageGroupKeys,
}: {
  children: ReactNode;
  defaultEstimatedLandCost: number;
  pageGroupKeys: string[];
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [estimatedLandCost, setEstimatedLandCost] = useState(() => String(defaultEstimatedLandCost));
  const selectedGroupKeys = useMemo(() => [...selected].sort((left, right) => left.localeCompare(right)), [selected]);
  const isAllPageSelected = pageGroupKeys.length > 0 && pageGroupKeys.every((groupKey) => selected.has(groupKey));

  const value = useMemo<SelectionContextValue>(
    () => ({
      clear: () => setSelected(new Set()),
      estimatedLandCost,
      isAllPageSelected,
      isSelected: (groupKey) => selected.has(groupKey),
      pageGroupKeys,
      setEstimatedLandCost,
      selectedCount: selected.size,
      selectedGroupKeys,
      toggle: (groupKey, checked) =>
        setSelected((current) => {
          const next = new Set(current);
          if (checked) {
            next.add(groupKey);
          } else {
            next.delete(groupKey);
          }
          return next;
        }),
      togglePage: (checked) =>
        setSelected((current) => {
          const next = new Set(current);
          for (const groupKey of pageGroupKeys) {
            if (checked) {
              next.add(groupKey);
            } else {
              next.delete(groupKey);
            }
          }
          return next;
        }),
    }),
    [estimatedLandCost, isAllPageSelected, pageGroupKeys, selected, selectedGroupKeys],
  );

  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

export function SelectionActionLink({
  baseHref,
  children,
  className,
  target,
}: {
  baseHref: string;
  children: ReactNode;
  className: string;
  target?: string;
}) {
  const { estimatedLandCost, selectedGroupKeys } = useSelection();
  return (
    <a className={className} href={hrefWithSelection(baseHref, selectedGroupKeys, estimatedLandCost)} target={target}>
      {children}
    </a>
  );
}

export function EstimatedLandCostInput() {
  const { estimatedLandCost, setEstimatedLandCost } = useSelection();
  return (
    <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#64707d]">
      Max estimated land cost / unit
      <input
        className="h-10 w-32 rounded-md border border-[#cfd6df] bg-white px-3 text-sm font-semibold text-[#172026] outline-none focus:border-[#255f85]"
        min="0"
        onChange={(event) => setEstimatedLandCost(event.currentTarget.value)}
        step="1"
        type="number"
        value={estimatedLandCost}
      />
    </label>
  );
}

export function SelectedRowsSummary() {
  const { clear, selectedCount } = useSelection();
  return (
    <div className="flex items-center gap-2 text-sm font-semibold text-[#44515f]">
      <span>{selectedCount} selected</span>
      {selectedCount > 0 ? (
        <button className="rounded-md border border-[#cfd6df] px-2 py-1 text-xs text-[#364252]" onClick={clear} type="button">
          Clear
        </button>
      ) : null}
    </div>
  );
}

export function SelectAllRowsCheckbox() {
  const { isAllPageSelected, pageGroupKeys, togglePage } = useSelection();
  return (
    <input
      aria-label="Select all product families on this page"
      checked={isAllPageSelected}
      disabled={pageGroupKeys.length === 0}
      onChange={(event) => togglePage(event.currentTarget.checked)}
      type="checkbox"
    />
  );
}

export function RowSelectionCheckbox({ groupKey }: { groupKey: string }) {
  const { isSelected, toggle } = useSelection();
  return (
    <input
      aria-label="Select product family"
      checked={isSelected(groupKey)}
      onChange={(event) => toggle(groupKey, event.currentTarget.checked)}
      type="checkbox"
    />
  );
}
