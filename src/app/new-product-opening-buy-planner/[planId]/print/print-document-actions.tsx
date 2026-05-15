"use client";

import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";

function safeTitlePart(value: string) {
  return value
    .trim()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function PrintDocumentActions({
  planId,
  planName,
  planNumber,
  supplier,
}: {
  planId: string;
  planName: string;
  planNumber: string;
  supplier: string;
}) {
  return (
    <div className="new-product-print-actions">
      <Link
        className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#cfd6df] bg-white px-4 text-sm font-semibold text-[#172026]"
        href={`/new-product-opening-buy-planner/${encodeURIComponent(planId)}`}
      >
        <ArrowLeft size={16} />
        Back to planner
      </Link>
      <button
        className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#172026] px-4 text-sm font-semibold text-white"
        onClick={() => {
          const previousTitle = document.title;
          document.title = [
            "NewProductPlan",
            safeTitlePart(supplier || "NoSupplier"),
            safeTitlePart(planNumber || "Draft"),
            safeTitlePart(planName || "Untitled"),
          ].filter(Boolean).join("_");
          window.print();
          window.setTimeout(() => {
            document.title = previousTitle;
          }, 500);
        }}
        type="button"
      >
        <Printer size={16} />
        Print / Export PDF
      </button>
    </div>
  );
}
