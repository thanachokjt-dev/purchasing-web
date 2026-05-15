"use client";

import { useEffect, useMemo, useState } from "react";

type IncomingView = "active" | "all";

const DISPLAY_STORAGE_KEY = "rp.incomingEta.displayControls.v1";
const DEFAULT_DISPLAY_SETTINGS = {
  active: 100,
  background: 10,
  guide: 32,
  showBarValues: false,
};
const CAPTURE_DISPLAY_SETTINGS = {
  active: 100,
  background: 8,
  guide: 34,
  showBarValues: false,
};

type IncomingRow = {
  balanceQty?: number;
  dateReceived?: string | null;
  etaDate?: string | null;
  lineCount?: number;
  poId?: string | null;
  receivedQty?: number;
  supplierName?: string | null;
  source?: "active" | "historical";
  totalIncomingQty?: number;
  totalQty?: number;
};

type UnscheduledRow = {
  incomingQty?: number;
  supplierName?: string | null;
};

type Selection = {
  date: string;
  label: string;
  source: "all" | "active" | "historical";
};

type DisplaySettings = typeof DEFAULT_DISPLAY_SETTINGS;

function formatMonth(date: string) {
  if (!date) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(`${date.slice(0, 7)}-01T00:00:00Z`));
}

function formatDate(date: string) {
  if (!date) {
    return "";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${date.slice(0, 10)}T00:00:00Z`));
}

function rowDate(row: IncomingRow, view: IncomingView) {
  if (view === "all" && row.source === "historical") {
    return row.dateReceived || row.etaDate || "";
  }

  return row.etaDate || row.dateReceived || "";
}

function monthKey(date: string) {
  return date.slice(0, 7);
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function normalize(value: string | null | undefined) {
  return value?.trim() || "";
}

function clampPercent(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, Math.round(value)));
}

function normalizeDisplaySettings(value: Partial<DisplaySettings>): DisplaySettings {
  return {
    active: clampPercent(value.active ?? DEFAULT_DISPLAY_SETTINGS.active, 20, 100),
    background: clampPercent(value.background ?? DEFAULT_DISPLAY_SETTINGS.background, 0, 60),
    guide: clampPercent(value.guide ?? DEFAULT_DISPLAY_SETTINGS.guide, 0, 60),
    showBarValues: value.showBarValues === true,
  };
}

function displayOpacity(value: number) {
  return (value / 100).toFixed(2);
}

function getInitialDisplaySettings() {
  if (typeof window === "undefined") {
    return DEFAULT_DISPLAY_SETTINGS;
  }

  try {
    const saved = window.localStorage.getItem(DISPLAY_STORAGE_KEY);
    return saved
      ? normalizeDisplaySettings(JSON.parse(saved) as Partial<DisplaySettings>)
      : DEFAULT_DISPLAY_SETTINGS;
  } catch {
    return DEFAULT_DISPLAY_SETTINGS;
  }
}

export function IncomingEtaSync({
  incomingView,
  rows,
  today,
  unscheduledRows,
}: {
  incomingView: IncomingView;
  rows: IncomingRow[];
  today: string;
  unscheduledRows: UnscheduledRow[];
}) {
  const [supplier, setSupplier] = useState("");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [displaySettings, setDisplaySettings] = useState<DisplaySettings>(
    DEFAULT_DISPLAY_SETTINGS,
  );
  const [displaySettingsLoaded, setDisplaySettingsLoaded] = useState(false);
  const suppliers = useMemo(
    () =>
      Array.from(
        new Set(rows.map((row) => normalize(row.supplierName)).filter(Boolean)),
      ).sort((a, b) => a.localeCompare(b)),
    [rows],
  );

  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        if (supplier && normalize(row.supplierName) !== supplier) {
          return false;
        }
        if (incomingView === "active" && row.source === "historical") {
          return false;
        }
        if (!selection) {
          return true;
        }

        const date = rowDate(row, incomingView);
        if (!date) {
          return false;
        }
        if (selection.source === "active" && row.source === "historical") {
          return false;
        }
        if (selection.source === "historical" && row.source !== "historical") {
          return false;
        }

        return selection.date.length === 7
          ? monthKey(date) === selection.date
          : date.slice(0, 10) === selection.date;
      }),
    [incomingView, rows, selection, supplier],
  );

  const summary = [
    supplier || "All suppliers",
    incomingView === "all" ? "All" : "Active Incoming",
    selection?.label,
  ].filter(Boolean).join(" · ");
  const filteredUnscheduledRows = useMemo(
    () =>
      unscheduledRows.filter((row) =>
        supplier ? normalize(row.supplierName) === supplier : true,
      ),
    [supplier, unscheduledRows],
  );
  const sevenDays = addDays(today, 7);
  const thirtyDays = addDays(today, 30);
  const activeFilteredRows = filteredRows.filter((row) => row.source !== "historical");
  const scheduledQty = activeFilteredRows.reduce(
    (sum, row) => sum + Number(row.balanceQty ?? row.totalIncomingQty ?? 0),
    0,
  );
  const noEtaQty = filteredUnscheduledRows.reduce(
    (sum, row) => sum + Number(row.incomingQty ?? 0),
    0,
  );
  const arrivingIn7DaysQty = activeFilteredRows
    .filter((row) => row.etaDate && row.etaDate >= today && row.etaDate <= sevenDays)
    .reduce((sum, row) => sum + Number(row.balanceQty ?? row.totalIncomingQty ?? 0), 0);
  const arrivingIn30DaysQty = activeFilteredRows
    .filter((row) => row.etaDate && row.etaDate >= today && row.etaDate <= thirtyDays)
    .reduce((sum, row) => sum + Number(row.balanceQty ?? row.totalIncomingQty ?? 0), 0);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setDisplaySettings(getInitialDisplaySettings());
      setDisplaySettingsLoaded(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!displaySettingsLoaded) {
      return;
    }

    try {
      window.localStorage.setItem(DISPLAY_STORAGE_KEY, JSON.stringify(displaySettings));
    } catch {
      // Display controls are still useful without localStorage persistence.
    }
  }, [displaySettings, displaySettingsLoaded]);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-incoming-sync-root]");
    if (!root) {
      return;
    }

    root.style.setProperty("--incoming-active-opacity", displayOpacity(displaySettings.active));
    root.style.setProperty(
      "--incoming-background-opacity",
      displayOpacity(displaySettings.background),
    );
    root.style.setProperty("--incoming-guide-opacity", displayOpacity(displaySettings.guide));
    root.style.setProperty(
      "--incoming-minor-guide-opacity",
      displayOpacity(Math.max(0, displaySettings.guide - 10)),
    );
    root.style.setProperty(
      "--incoming-month-guide-opacity",
      displayOpacity(Math.min(60, displaySettings.guide + 12)),
    );
    root.querySelectorAll<HTMLElement>("[data-incoming-value-label]").forEach((node) => {
      node.hidden = !displaySettings.showBarValues;
    });

    root.querySelectorAll<HTMLElement>("[data-incoming-supplier-list]").forEach((node) => {
      node.dataset.activeSupplier = supplier;
    });
    root.querySelectorAll<HTMLElement>("[data-incoming-sync-summary]").forEach((node) => {
      node.textContent = summary;
    });
    root.querySelectorAll<HTMLElement>("[data-incoming-kpi='pipeline']").forEach((node) => {
      node.textContent = (scheduledQty + noEtaQty).toLocaleString("en-US");
    });
    root.querySelectorAll<HTMLElement>("[data-incoming-kpi='scheduled']").forEach((node) => {
      node.textContent = scheduledQty.toLocaleString("en-US");
    });
    root.querySelectorAll<HTMLElement>("[data-incoming-kpi='no-eta']").forEach((node) => {
      node.textContent = noEtaQty.toLocaleString("en-US");
    });
    root.querySelectorAll<HTMLElement>("[data-incoming-kpi='arriving-7']").forEach((node) => {
      node.textContent = arrivingIn7DaysQty.toLocaleString("en-US");
    });
    root.querySelectorAll<HTMLElement>("[data-incoming-kpi='arriving-30']").forEach((node) => {
      node.textContent = arrivingIn30DaysQty.toLocaleString("en-US");
    });

    const visibleKeys = new Set(
      filteredRows.map((row) =>
        [
          normalize(row.supplierName),
          row.etaDate || "",
          row.dateReceived || "",
          row.source || "active",
        ].join("||"),
      ),
    );

    let visibleCount = 0;
    root.querySelectorAll<HTMLElement>("[data-incoming-record-row]").forEach((node) => {
      const key = [
        node.dataset.incomingSupplier || "",
        node.dataset.incomingEtaDate || "",
        node.dataset.incomingDateReceived || "",
        node.dataset.incomingSource || "active",
      ].join("||");
      const visible = visibleKeys.has(key);
      node.hidden = !visible;
      if (visible) {
        visibleCount += 1;
      }
    });

    root.querySelectorAll<HTMLElement>("[data-incoming-empty-state]").forEach((node) => {
      node.hidden = visibleCount > 0;
    });
    root.querySelectorAll<HTMLDetailsElement>("[data-incoming-extra-details]").forEach((node) => {
      if (supplier || selection) {
        node.open = true;
      }
    });

    root.querySelectorAll<HTMLElement>("[data-incoming-chart-day]").forEach((node) => {
      const date = node.dataset.incomingDate || "";
      const hasSupplier = filteredRows.some((row) => rowDate(row, incomingView).slice(0, 10) === date);
      node.dataset.filteredOut = hasSupplier ? "false" : "true";
      node.dataset.selected = selection?.date === date ? "true" : "false";
    });

    root.querySelectorAll<HTMLElement>("[data-incoming-month]").forEach((node) => {
      const month = node.dataset.incomingMonth || "";
      const hasSupplier = filteredRows.some((row) => monthKey(rowDate(row, incomingView)) === month);
      node.dataset.filteredOut = hasSupplier ? "false" : "true";
      node.dataset.selected = selection?.date === month ? "true" : "false";
    });

    root.querySelectorAll<HTMLElement>("[data-selected-date-detail]").forEach((node) => {
      const date = node.dataset.selectedDate || "";
      const visible = Boolean(selection && selection.date.length === 10 && selection.date === date);
      node.hidden = !visible;
    });

    let visibleNoEtaRows = 0;
    root.querySelectorAll<HTMLElement>("[data-incoming-no-eta-row]").forEach((node) => {
      const visible = !supplier || node.dataset.incomingSupplier === supplier;
      node.hidden = !visible;
      if (visible) {
        visibleNoEtaRows += 1;
      }
    });
    root.querySelectorAll<HTMLElement>("[data-incoming-no-eta-empty]").forEach((node) => {
      node.hidden = visibleNoEtaRows > 0 || noEtaQty > 0;
    });
  }, [arrivingIn30DaysQty, arrivingIn7DaysQty, displaySettings, filteredRows, incomingView, noEtaQty, scheduledQty, selection, supplier, summary]);

  const updateDisplaySetting = (key: keyof DisplaySettings, value: number) => {
    const limits = {
      active: [20, 100],
      background: [0, 60],
      guide: [0, 60],
    } satisfies Record<Exclude<keyof DisplaySettings, "showBarValues">, [number, number]>;
    if (key === "showBarValues") {
      return;
    }
    const [min, max] = limits[key];

    setDisplaySettings((current) => ({
      ...current,
      [key]: clampPercent(value, min, max),
    }));
  };

  const displayControlRows: Array<{
    key: Exclude<keyof DisplaySettings, "showBarValues">;
    label: string;
    max: number;
    min: number;
  }> = [
    { key: "active", label: "Active bar intensity", min: 20, max: 100 },
    { key: "background", label: "Background bar intensity", min: 0, max: 60 },
    { key: "guide", label: "Guide line intensity", min: 0, max: 60 },
  ];

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const chartButton = target?.closest<HTMLElement>("[data-incoming-chart-select]");
      if (!chartButton) {
        return;
      }

      const date = chartButton.dataset.incomingDate || "";
      const source = (chartButton.dataset.incomingSource || "all") as Selection["source"];
      if (!date) {
        return;
      }

      setSelection({
        date,
        label: date.length === 7 ? formatMonth(date) : formatDate(date),
        source,
      });
    };

    const onClearSelection = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest("[data-incoming-clear-selection]")) {
        return;
      }

      setSelection(null);
    };

    document.addEventListener("click", onClick);
    document.addEventListener("click", onClearSelection);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("click", onClearSelection);
    };
  }, []);

  return (
    <div className="mb-3 rounded-md border border-[#dfe4ea] bg-white px-3 py-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#64707d]">
          Supplier
          <select
            className="h-9 min-w-[220px] rounded-md border border-[#cfd6df] bg-white px-2 text-sm normal-case tracking-normal text-[#172026]"
            onChange={(event) => {
              setSupplier(event.target.value);
              setSelection(null);
            }}
            value={supplier}
          >
            <option value="">All suppliers</option>
            {suppliers.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <div className="min-w-0 text-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64707d]">
            Showing records for
          </p>
          <p className="mt-1 font-semibold text-[#172026]" data-incoming-sync-summary>
            {summary}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {selection ? (
            <button
              className="inline-flex h-9 items-center justify-center rounded-md border border-[#cfd6df] bg-white px-3 text-sm font-semibold text-[#364252] hover:bg-[#f7f9fb]"
              onClick={() => setSelection(null)}
              type="button"
            >
              Clear chart selection
            </button>
          ) : null}
          <button
            className="inline-flex h-9 items-center justify-center rounded-md border border-[#cfd6df] bg-white px-3 text-sm font-semibold text-[#364252] hover:bg-[#f7f9fb]"
            onClick={() => {
              setSupplier("");
              setSelection(null);
            }}
            type="button"
          >
            Show all records
          </button>
        </div>
      </div>
      <div className="mt-3 border-t border-[#edf1f5] pt-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64707d]">
              Display Controls
            </p>
            <div className="mt-2 grid gap-3 md:grid-cols-3">
              {displayControlRows.map((control) => (
                <label
                  className="grid min-w-0 gap-1 text-xs font-semibold text-[#52606d]"
                  key={control.key}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span>{control.label}</span>
                    <span className="font-mono text-[#172026]">
                      {displaySettings[control.key]}%
                    </span>
                  </span>
                  <input
                    aria-label={control.label}
                    className="h-2 w-full accent-[#255f85]"
                    max={control.max}
                    min={control.min}
                    onChange={(event) =>
                      updateDisplaySetting(control.key, Number(event.target.value))
                    }
                    step="1"
                    type="range"
                    value={displaySettings[control.key]}
                  />
                </label>
              ))}
            </div>
            <label className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-[#52606d]">
              <input
                checked={displaySettings.showBarValues}
                className="size-4 accent-[#255f85]"
                onChange={(event) =>
                  setDisplaySettings((current) => ({
                    ...current,
                    showBarValues: event.target.checked,
                  }))
                }
                type="checkbox"
              />
              Show bar values
            </label>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              className="inline-flex h-9 items-center justify-center rounded-md border border-[#cfd6df] bg-white px-3 text-sm font-semibold text-[#364252] hover:bg-[#f7f9fb]"
              onClick={() => setDisplaySettings(DEFAULT_DISPLAY_SETTINGS)}
              type="button"
            >
              Reset view
            </button>
            <button
              className="inline-flex h-9 items-center justify-center rounded-md bg-[#172026] px-3 text-sm font-semibold text-white hover:bg-[#2b3540]"
              onClick={() => setDisplaySettings(CAPTURE_DISPLAY_SETTINGS)}
              type="button"
            >
              Capture mode
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
