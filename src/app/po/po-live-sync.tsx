"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";

const changeKey = "rp.po.changed";

export function notifyPoChanged(
  { refreshCurrent = true }: { refreshCurrent?: boolean } = {},
) {
  try { localStorage.setItem(changeKey, `${Date.now()}:${Math.random()}`); } catch { /* Polling remains available. */ }
  if (refreshCurrent) {
    window.dispatchEvent(new Event(changeKey));
  }
}

export function PoLiveSync() {
  const router = useRouter();
  const [, startTransition] = useTransition();
  useEffect(() => {
    let version: string | undefined;
    let busy = false;
    let queued = false;
    const controller = new AbortController();
    const refresh = () => {
      queued = true;
      if (document.visibilityState !== "visible" || document.querySelector('form[data-dirty="true"]')) return;
      queued = false;
      startTransition(() => router.refresh());
    };
    const check = async () => {
      if (busy || document.visibilityState !== "visible") return;
      busy = true;
      try {
        const response = await fetch("/api/po/version", { cache: "no-store", signal: controller.signal });
        if (!response.ok) return;
        const next = (await response.json()).version as string;
        if (version !== undefined && next !== version) refresh();
        version = next;
        if (queued) refresh();
      } catch { /* Retry on the next tick; never replace saved data with an empty response. */ }
      finally { busy = false; }
    };
    const onStorage = (event: StorageEvent) => { if (event.key === changeKey) refresh(); };
    const onVisible = () => { refresh(); void check(); };
    void check();
    const timer = window.setInterval(check, 15000);
    window.addEventListener("storage", onStorage);
    window.addEventListener(changeKey, refresh);
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(changeKey, refresh);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);
  return <p className="text-xs text-[#64707d]">อัปเดตข้อมูล PO อัตโนมัติ · ตรวจการเปลี่ยนแปลงทุก 15 วินาที</p>;
}
