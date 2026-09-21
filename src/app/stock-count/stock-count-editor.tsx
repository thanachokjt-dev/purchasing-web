"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Download, Save, Upload } from "lucide-react";
import {
  completeStockCountSessionAction,
  importStockCountCsvAction,
  saveStockCountValuesAction,
} from "@/app/stock-count/actions";
import { matrixSectionLabel, sortMatrixSizes, type MatrixFamily } from "@/lib/po-size-matrix";
import type { StockCountLine, StockCountSession } from "@/lib/stock-counts";

type ProductRow = {
  key: string;
  productName: string;
  tags: string[];
  linesBySize: Map<string, StockCountLine>;
};

type MatrixSection = {
  key: string;
  label: string;
  family: MatrixFamily;
  sizes: string[];
  rows: ProductRow[];
};

function buildSections(lines: StockCountLine[]) {
  const sections = new Map<string, { family: MatrixFamily; section: string; lines: StockCountLine[] }>();
  for (const line of lines) {
    const key = `${line.sectionName}\u0000${line.family}`;
    const section = sections.get(key) ?? { family: line.family, section: line.sectionName, lines: [] };
    section.lines.push(line);
    sections.set(key, section);
  }
  return Array.from(sections, ([key, section]) => {
    const products = new Map<string, ProductRow>();
    for (const line of section.lines) {
      const row = products.get(line.productGroupKey) ?? {
        key: line.productGroupKey,
        productName: line.productName,
        tags: line.tags,
        linesBySize: new Map(),
      };
      row.linesBySize.set(line.size, line);
      products.set(line.productGroupKey, row);
    }
    return {
      key,
      label: matrixSectionLabel(section.section, section.family),
      family: section.family,
      sizes: sortMatrixSizes(section.lines.map((line) => line.size), section.family),
      rows: Array.from(products.values()),
    } satisfies MatrixSection;
  });
}

const buttonClass = "inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50";

export function StockCountEditor({
  canEdit,
  lines,
  session,
}: {
  canEdit: boolean;
  lines: StockCountLine[];
  session: StockCountSession;
}) {
  const router = useRouter();
  const uploadRef = useRef<HTMLInputElement>(null);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(lines.map((line) => [line.id, line.countedQty === null ? "" : String(line.countedQty)])),
  );
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const sections = useMemo(() => buildSections(lines), [lines]);
  const isEditable = canEdit && session.status === "draft";
  const counted = Object.values(values).filter((value) => value !== "").length;

  function setCount(lineId: string, raw: string) {
    if (raw && (!/^\d+$/.test(raw) || Number(raw) < 0)) return;
    setValues((current) => ({ ...current, [lineId]: raw }));
    setDirty((current) => new Set(current).add(lineId));
    setMessage("");
  }

  function save() {
    if (!dirty.size) return;
    const payload = Array.from(dirty, (lineId) => ({
      lineId,
      countedQty: values[lineId] === "" ? null : Number(values[lineId]),
    }));
    startTransition(async () => {
      try {
        const result = await saveStockCountValuesAction(session.id, payload);
        setDirty(new Set());
        setMessage(`Saved ${result.saved} count cells.`);
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to save counts.");
      }
    });
  }

  async function upload(file: File) {
    setIsUploading(true);
    setMessage("Reading CSV...");
    try {
      const result = await importStockCountCsvAction(session.id, await file.text());
      setValues((current) => {
        const next = { ...current };
        for (const value of result.values) {
          next[value.lineId] = value.countedQty === null ? "" : String(value.countedQty);
        }
        return next;
      });
      setMessage(`Imported ${result.saved} count cells.`);
      setDirty(new Set());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to import CSV.");
    } finally {
      setIsUploading(false);
      if (uploadRef.current) uploadRef.current.value = "";
    }
  }

  function complete() {
    if (dirty.size) {
      setMessage("Save pending changes before completing this count.");
      return;
    }
    if (counted !== lines.length) {
      setMessage(`Complete every cell first (${counted}/${lines.length}). Blank means not counted; use 0 when none.`);
      return;
    }
    if (!window.confirm("Complete and lock this weekly stock count?")) return;
    startTransition(async () => {
      try {
        await completeStockCountSessionAction(session.id);
        setMessage("Stock count completed.");
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to complete stock count.");
      }
    });
  }

  function requireSavedExport(event: React.MouseEvent<HTMLAnchorElement>) {
    if (!dirty.size) return;
    event.preventDefault();
    setMessage(`Save ${dirty.size} pending count cell${dirty.size === 1 ? "" : "s"} before exporting to Shopify.`);
  }

  return (
    <div className="grid gap-4">
      <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#d7dee7] bg-white/95 p-3 shadow-sm backdrop-blur">
        <div>
          <p className="text-sm font-semibold text-[#172026]">{counted.toLocaleString()} / {lines.length.toLocaleString()} variants counted</p>
          <p className="text-xs text-[#667380]">Blank = not counted · 0 = counted, no stock</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a className={`${buttonClass} border border-[#cfd6df] bg-white text-[#364252]`} href={`/api/stock-count/${session.id}/export`}>
            <Download size={16} /> Export CSV
          </a>
          <a className={`${buttonClass} border border-[#cfd6df] bg-white text-[#364252]`} href={`/api/stock-count/${session.id}/export-pdf`}>
            <Download size={16} /> Export PDF
          </a>
          <a
            className={`${buttonClass} border border-[#8bc6a2] bg-[#edf8f1] text-[#1f6b3d]`}
            href={`/api/stock-count/${session.id}/export-shopify`}
            onClick={requireSavedExport}
          >
            <Download size={16} /> Export to Shopify
          </a>
          {isEditable ? (
            <>
              <input
                accept=".csv,text/csv"
                className="hidden"
                onChange={(event) => event.target.files?.[0] && void upload(event.target.files[0])}
                ref={uploadRef}
                type="file"
              />
              <button className={`${buttonClass} border border-[#cfd6df] bg-white text-[#364252]`} disabled={isPending || isUploading} onClick={() => uploadRef.current?.click()} type="button">
                <Upload size={16} /> {isUploading ? "Importing..." : "Import CSV"}
              </button>
              <button className={`${buttonClass} bg-[#172026] text-white`} disabled={isPending || !dirty.size} onClick={save} type="button">
                <Save size={16} /> {isPending ? "Saving..." : `Save${dirty.size ? ` (${dirty.size})` : ""}`}
              </button>
              <button className={`${buttonClass} bg-[#1f6b3d] text-white`} disabled={isPending} onClick={complete} type="button">
                <CheckCircle2 size={16} /> Complete
              </button>
            </>
          ) : null}
        </div>
        {message ? <p className="w-full whitespace-pre-line rounded-md bg-[#f3f6f8] px-3 py-2 text-sm text-[#364252]">{message}</p> : null}
      </div>

      {sections.map((section) => (
        <section className="overflow-hidden rounded-lg border border-[#d7dee7] bg-white" key={section.key}>
          <div className="border-b border-[#d7dee7] bg-[#f7f9fb] px-4 py-3">
            <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-[#4f5f70]">{section.label}</h2>
            <p className="mt-1 text-xs text-[#667380]">{section.rows.length} product designs</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead className="bg-[#eef2f6] text-[11px] uppercase tracking-[0.08em] text-[#64707d]">
                <tr>
                  <th className="sticky left-0 z-10 min-w-[320px] border-r border-[#d7dee7] bg-[#eef2f6] px-4 py-3 text-left">Product</th>
                  {section.sizes.map((size) => <th className="min-w-24 px-3 py-3 text-right" key={size}>{size}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e4e9ef]">
                {section.rows.map((row) => (
                  <tr className="hover:bg-[#fbfcfd]" key={row.key}>
                    <td className="sticky left-0 z-10 border-r border-[#e4e9ef] bg-white px-4 py-3">
                      <p className="font-semibold text-[#172026]">{row.productName}</p>
                      <p className="mt-1 max-w-[300px] truncate text-xs text-[#778390]" title={row.tags.join(", ")}>{row.tags.join(" · ") || "Untagged"}</p>
                    </td>
                    {section.sizes.map((size) => {
                      const line = row.linesBySize.get(size);
                      return (
                        <td className={`px-2 py-2 text-right ${line ? "bg-[#fffdf8]" : "bg-[#f3f5f7]"}`} key={size}>
                          {line ? (
                            <input
                              aria-label={`${row.productName} ${size}`}
                              className="h-10 w-20 rounded-md border border-[#c9d1da] bg-white px-2 text-right font-mono font-semibold outline-none focus:border-[#255f85] focus:ring-2 focus:ring-[#255f85]/15 disabled:bg-[#eef1f4]"
                              disabled={!isEditable || isPending}
                              inputMode="numeric"
                              min="0"
                              onChange={(event) => setCount(line.id, event.target.value)}
                              title={line.sku}
                              type="number"
                              value={values[line.id] ?? ""}
                            />
                          ) : <span className="text-[#b8c0c8]">—</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
