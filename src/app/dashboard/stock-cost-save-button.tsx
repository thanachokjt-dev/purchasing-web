"use client";

import { useFormStatus } from "react-dom";
import { LoadingLabel } from "@/app/loading-controls";

export function StockCostSaveButton() {
  const { pending } = useFormStatus();

  return (
    <button
      className="inline-flex h-8 w-full items-center justify-center rounded-md bg-[#172026] px-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
      disabled={pending}
      type="submit"
    >
      <LoadingLabel loading={pending} loadingText="Saving">
        Save cost
      </LoadingLabel>
    </button>
  );
}
