"use client";

import { LoadingLabel } from "@/app/loading-controls";
import { Trash2 } from "lucide-react";
import { useFormStatus } from "react-dom";

export function DeleteRowButton({ form }: { form: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      className="inline-flex h-8 w-fit items-center justify-center gap-1 rounded-md border border-[#ffd6d6] bg-white px-3 text-xs font-semibold text-[#b42318] disabled:text-[#d98c87]"
      disabled={pending}
      form={form}
      onClick={(event) => {
        if (!window.confirm("Remove this planning row from the matrix? This will not delete any product or SKU data.")) {
          event.preventDefault();
        }
      }}
      type="submit"
    >
      <LoadingLabel loading={pending} loadingText="Deleting...">
        <Trash2 size={13} />
        Delete row
      </LoadingLabel>
    </button>
  );
}
