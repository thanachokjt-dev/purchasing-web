"use client";

import { type FormEvent, type ReactNode, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { LoadingLabel } from "@/app/loading-controls";

type ManualOverrideFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
};

function SaveAllButton({ dirtyCount, disabled }: { dirtyCount: number; disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#172026] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
      disabled={disabled || dirtyCount === 0 || pending}
      type="submit"
    >
      <LoadingLabel loading={pending} loadingText="Saving">
        Save All Overrides
      </LoadingLabel>
    </button>
  );
}

export function RowOverrideSubmitButton({
  children,
  className,
  disabled,
  groupKey,
  loadingText,
  sku,
}: {
  children: ReactNode;
  className: string;
  disabled?: boolean;
  groupKey?: string;
  loadingText: string;
  sku?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      className={className}
      disabled={disabled || pending}
      name={sku ? "saveSku" : "saveGroupKey"}
      type="submit"
      value={sku ?? groupKey}
    >
      <LoadingLabel loading={pending} loadingText={loadingText}>
        {children}
      </LoadingLabel>
    </button>
  );
}

export function ManualOverrideForm({ action, children, className, disabled = false }: ManualOverrideFormProps) {
  const [dirtyGroupKeys, setDirtyGroupKeys] = useState<Set<string>>(() => new Set());
  const [dirtySkus, setDirtySkus] = useState<Set<string>>(() => new Set());
  const dirtyValues = useMemo(() => [...dirtyGroupKeys].sort((left, right) => left.localeCompare(right)), [dirtyGroupKeys]);
  const dirtySkuValues = useMemo(() => [...dirtySkus].sort((left, right) => left.localeCompare(right)), [dirtySkus]);

  function handleChange(event: FormEvent<HTMLFormElement>) {
    const target = event.target;
    if (!(target instanceof HTMLElement) || target.dataset.overrideInput !== "true") {
      return;
    }
    const row = target.closest<HTMLElement>("[data-override-row]");
    const groupKey = row?.dataset.groupKey;
    const skuRow = target.closest<HTMLElement>("[data-sku-override-row]");
    const sku = skuRow?.dataset.sku;
    if (sku) {
      setDirtySkus((current) => {
        const next = new Set(current);
        next.add(sku);
        return next;
      });
      return;
    }
    if (!groupKey) {
      return;
    }
    setDirtyGroupKeys((current) => {
      const next = new Set(current);
      next.add(groupKey);
      return next;
    });
  }

  return (
    <form action={action} className={className} onChange={handleChange}>
      {dirtyValues.map((groupKey) => (
        <input key={groupKey} name="dirtyGroupKey" type="hidden" value={groupKey} />
      ))}
      {dirtySkuValues.map((sku) => (
        <input key={sku} name="dirtySku" type="hidden" value={sku} />
      ))}
      <div className="flex flex-wrap items-center gap-3 border-b border-[#e1e6ec] bg-[#fbfcfd] px-4 py-3">
        <SaveAllButton dirtyCount={dirtyValues.length + dirtySkuValues.length} disabled={disabled} />
        <span className="text-xs font-semibold text-[#667380]">
          {dirtyValues.length + dirtySkuValues.length > 0
            ? `${dirtyValues.length + dirtySkuValues.length} changed row${dirtyValues.length + dirtySkuValues.length === 1 ? "" : "s"}`
            : "No unsaved override changes"}
        </span>
      </div>
      {children}
    </form>
  );
}
