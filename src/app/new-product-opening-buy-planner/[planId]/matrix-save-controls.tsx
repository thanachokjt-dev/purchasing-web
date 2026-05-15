"use client";

import { useEffect, useState } from "react";

declare global {
  interface Window {
    __newProductMatrixDirty?: boolean;
  }
}

export function MatrixDirtyTracker({ formId }: { formId: string }) {
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const form = document.getElementById(formId);
    if (!form) {
      return;
    }

    const markDirty = () => {
      window.__newProductMatrixDirty = true;
      setDirty(true);
    };
    const markClean = () => {
      window.__newProductMatrixDirty = false;
      setDirty(false);
    };
    const markDirtyForMatrixControl = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLSelectElement ||
        target instanceof HTMLTextAreaElement
      ) {
        if (target.form?.id === formId || target.getAttribute("form") === formId) {
          markDirty();
        }
      }
    };
    const warnIfDirty = (event: BeforeUnloadEvent) => {
      if (!window.__newProductMatrixDirty) {
        return;
      }
      event.preventDefault();
      event.returnValue = "";
    };

    document.addEventListener("input", markDirtyForMatrixControl);
    document.addEventListener("change", markDirtyForMatrixControl);
    form.addEventListener("submit", markClean);
    window.addEventListener("beforeunload", warnIfDirty);

    return () => {
      document.removeEventListener("input", markDirtyForMatrixControl);
      document.removeEventListener("change", markDirtyForMatrixControl);
      form.removeEventListener("submit", markClean);
      window.removeEventListener("beforeunload", warnIfDirty);
    };
  }, [formId]);

  return dirty ? (
    <span className="rounded-md bg-[#fff4e5] px-3 py-2 text-xs font-semibold text-[#946200]">
      Unsaved matrix changes
    </span>
  ) : null;
}
