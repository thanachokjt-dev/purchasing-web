"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

export function LoadingSpinner({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block size-4 shrink-0 rounded-full border-2 border-current border-r-transparent loading-spin ${className}`}
    />
  );
}

export function LoadingLabel({
  children,
  loading,
  loadingText,
}: {
  children: ReactNode;
  loading: boolean;
  loadingText: string;
}) {
  return (
    <span className="inline-flex items-center justify-center gap-2">
      {loading ? <LoadingSpinner /> : null}
      <span>{loading ? loadingText : children}</span>
    </span>
  );
}

export function PendingSubmitButton({
  children,
  className,
  form,
  loadingText,
}: {
  children: ReactNode;
  className: string;
  form?: string;
  loadingText: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button className={className} disabled={pending} form={form} type="submit">
      <LoadingLabel loading={pending} loadingText={loadingText}>
        {children}
      </LoadingLabel>
    </button>
  );
}
