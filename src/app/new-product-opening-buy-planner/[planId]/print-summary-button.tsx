"use client";

import { Printer } from "lucide-react";

declare global {
  interface Window {
    __newProductMatrixDirty?: boolean;
  }
}

export function PrintSummaryButton({
  planId,
}: {
  planId: string;
}) {
  return (
    <a
      className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#cfd6df] bg-white px-4 text-sm font-semibold text-[#172026]"
      href={`/new-product-opening-buy-planner/${encodeURIComponent(planId)}/print`}
      onClick={(event) => {
        if (!window.__newProductMatrixDirty) {
          return;
        }
        const confirmed = window.confirm("Please save changes before printing. Open the print summary anyway?");
        if (!confirmed) {
          event.preventDefault();
        }
      }}
      rel="noreferrer"
      target="_blank"
      title="Opens a dedicated print summary."
    >
      <Printer size={16} />
      Print Summary
    </a>
  );
}
