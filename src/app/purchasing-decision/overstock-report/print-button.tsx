"use client";

import { Printer } from "lucide-react";
import { useState } from "react";
import { LoadingLabel } from "@/app/loading-controls";

export function PrintOverstockReportButton() {
  const [printing, setPrinting] = useState(false);

  return (
    <button
      className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#172026] px-4 text-sm font-semibold text-white"
      onClick={() => {
        setPrinting(true);
        window.print();
        window.setTimeout(() => setPrinting(false), 300);
      }}
      type="button"
    >
      <Printer size={16} />
      <LoadingLabel loading={printing} loadingText="Preparing...">
        Print report
      </LoadingLabel>
    </button>
  );
}
