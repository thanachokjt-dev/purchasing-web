"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { usePathname } from "next/navigation";

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
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent(loading ? "app-loading-start" : "app-loading-stop"),
    );
  }, [loading]);

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

export function LoadingWordmark() {
  return (
    <span aria-label="Loading" className="loading-wordmark" role="status">
      {"Loading".split("").map((letter, index) => (
        <span
          aria-hidden="true"
          className="loading-letter"
          key={`${letter}-${index}`}
          style={{ animationDelay: `${index * 0.08}s` }}
        >
          {letter}
        </span>
      ))}
    </span>
  );
}

function isModifiedClick(event: MouseEvent) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
}

function isInternalUrl(href: string) {
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
    return false;
  }

  const url = new URL(href, window.location.href);
  return url.origin === window.location.origin && url.href !== window.location.href;
}

export function GlobalLoadingOverlay() {
  const [visible, setVisible] = useState(false);
  const pathname = usePathname();
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("app-loading-stop"));
  }, [pathname]);

  useEffect(() => {
    const showSoon = () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = window.setTimeout(() => setVisible(true), 120);
    };

    const hide = () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setVisible(false);
    };

    const handleAppLoadingStart = () => showSoon();
    const handleAppLoadingStop = () => hide();
    const handleClick = (event: MouseEvent) => {
      if (isModifiedClick(event) || event.defaultPrevented) {
        return;
      }

      const target = event.target instanceof Element ? event.target : null;
      const link = target?.closest("a[href]");
      if (link instanceof HTMLAnchorElement && isInternalUrl(link.href)) {
        showSoon();
      }
    };

    document.addEventListener("click", handleClick, true);
    window.addEventListener("app-loading-start", handleAppLoadingStart);
    window.addEventListener("app-loading-stop", handleAppLoadingStop);
    window.addEventListener("pageshow", hide);
    window.addEventListener("popstate", hide);

    return () => {
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener("app-loading-start", handleAppLoadingStart);
      window.removeEventListener("app-loading-stop", handleAppLoadingStop);
      window.removeEventListener("pageshow", hide);
      window.removeEventListener("popstate", hide);
      hide();
    };
  }, []);

  return (
    <div
      aria-hidden={!visible}
      className={`global-loading-overlay ${visible ? "global-loading-overlay-visible" : ""}`}
    >
      <LoadingWordmark />
    </div>
  );
}
