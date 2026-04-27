"use client";

import { useFormStatus } from "react-dom";

export function DecisionSaveButton() {
  const { pending } = useFormStatus();

  return (
    <button
      className="inline-flex h-10 items-center justify-center rounded-md bg-[#172026] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
      disabled={pending}
      type="submit"
    >
      {pending ? "Saving..." : "Save visible rows"}
    </button>
  );
}

export function DecisionCreatePoButton() {
  const { pending } = useFormStatus();

  return (
    <button
      className="inline-flex h-10 items-center justify-center rounded-md bg-[#172026] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
      disabled={pending}
      form="decision-create-po-form"
      type="submit"
    >
      {pending ? "Creating..." : "Create PO"}
    </button>
  );
}

export function SelectionButtons() {
  function setSelection(checked: boolean) {
    document
      .querySelectorAll<HTMLInputElement>("[data-decision-select='sku']")
      .forEach((input) => {
        input.checked = checked;
      });
  }

  return (
    <div className="flex items-center gap-2">
      <button
        className="h-10 rounded-md border border-[#cfd6df] bg-white px-3 text-xs font-semibold text-[#364252]"
        onClick={() => setSelection(true)}
        type="button"
      >
        Select all
      </button>
      <button
        className="h-10 rounded-md border border-[#cfd6df] bg-white px-3 text-xs font-semibold text-[#667380]"
        onClick={() => setSelection(false)}
        type="button"
      >
        Clear
      </button>
    </div>
  );
}
