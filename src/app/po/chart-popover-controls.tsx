"use client";

import { useEffect } from "react";

export function ChartPopoverControls() {
  useEffect(() => {
    const closeAll = () => {
      document.querySelectorAll<HTMLDetailsElement>("details[data-chart-popover][open]")
        .forEach((details) => {
          details.open = false;
        });
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) {
        return;
      }

      const closeButton = target.closest("[data-chart-popover-close]");
      if (closeButton) {
        event.preventDefault();
        closeButton.closest<HTMLDetailsElement>("details[data-chart-popover]")?.removeAttribute("open");
        return;
      }

      if (!target.closest("details[data-chart-popover]")) {
        closeAll();
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeAll();
      }
    };

    const onToggle = (event: Event) => {
      const current = event.target as HTMLDetailsElement | null;
      if (!current?.matches?.("details[data-chart-popover]") || !current.open) {
        return;
      }

      document.querySelectorAll<HTMLDetailsElement>("details[data-chart-popover][open]")
        .forEach((details) => {
          if (details !== current) {
            details.open = false;
          }
        });
    };

    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("toggle", onToggle, true);

    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("toggle", onToggle, true);
    };
  }, []);

  return null;
}
