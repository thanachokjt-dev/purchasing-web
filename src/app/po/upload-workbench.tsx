"use client";

import Link from "next/link";
import { useState } from "react";
import type { PoUploadTask } from "@/lib/po-upload-tasks";

const labels: Record<string, string> = {
  shipping: "Shipping", freight: "Freight", vat_import_vat: "VAT / IMPORT VAT",
  fine: "Fine / penalty", other: "Other", balance: "Balance",
};
function isExpense(task: PoUploadTask) {
  return /shipping|freight|vat|fine|penalty|other|duty/i.test(task.payment_type);
}

export function UploadWorkbench({ tasks, error }: { tasks: PoUploadTask[]; error: string }) {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const filtered = tasks.filter((task) => {
    if (filter === "expenses" && !isExpense(task)) return false;
    if (filter === "payments" && isExpense(task)) return false;
    return `${task.po_id} ${task.po_orders.po_title ?? ""} ${task.po_orders.supplier_name ?? ""} ${task.payment_type} ${task.reference ?? ""}`
      .toLowerCase().includes(query.toLowerCase().trim());
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / 20));
  const currentPage = Math.min(page, pageCount);
  const expenseCount = tasks.filter(isExpense).length;
  return (
    <section id="upload-workbench" className="min-w-0 rounded-lg border border-[#dfe4ea] bg-white shadow-sm">
      <div className="grid gap-4 border-b border-[#e2e7ed] p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#255f85]">Working · PO follow-up</p>
          <h2 className="mt-1 text-lg font-semibold">งานติดตาม Upload / Xero <span className="text-[#255f85]">({tasks.length})</span></h2>
          <p className="mt-1 text-sm text-[#64707d]">แยก task ตามรายการที่ยังไม่เป็น uploaded รวม PO ที่ปิดแล้ว · บันทึกเป็น uploaded ใน Payment แล้วงานจะออกจากรายการนี้</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {[["all", `ทั้งหมด ${tasks.length}`], ["expenses", `Shipping / ค่าใช้จ่ายอื่น ${expenseCount}`], ["payments", `ค่าสินค้า / งวดชำระ ${tasks.length - expenseCount}`]].map(([value, label]) => (
            <button key={value} type="button" aria-pressed={filter === value}
              onClick={() => { setFilter(value); setPage(1); }}
              className={`rounded-md border px-3 py-2 text-sm font-semibold ${filter === value ? "border-[#255f85] bg-[#eef4f8] text-[#255f85]" : "border-[#dfe4ea]"}`}>{label}</button>
          ))}
          <input aria-label="ค้นหางาน Upload" placeholder="ค้นหา PO / Supplier / ค่าใช้จ่าย" value={query}
            onChange={(event) => { setQuery(event.target.value); setPage(1); }}
            className="min-w-60 flex-1 rounded-md border border-[#cfd6df] px-3 py-2 text-sm" />
        </div>
      </div>
      {error ? <p role="alert" className="p-5 text-red-700">{error}</p> : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-[#f3f5f7] text-xs uppercase text-[#64707d]"><tr>
                {["PO / Supplier", "Task", "Amount", "Due", "Payment", "Xero", ""].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-[#edf1f5]">
                {filtered.slice((currentPage - 1) * 20, currentPage * 20).map((task) => (
                  <tr key={task.id}>
                    <td className="px-4 py-3"><p className="font-semibold">{task.po_id}</p><p className="text-xs text-[#64707d]">{task.po_orders.supplier_name || "-"} · {task.po_orders.work_status}</p></td>
                    <td className="px-4 py-3"><p className="font-semibold">Upload {labels[task.payment_type] ?? task.payment_type}</p><p className="text-xs text-[#64707d]">{task.reference || "ยังไม่มี Reference"}</p></td>
                    <td className="px-4 py-3 font-mono">{Number(task.amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {task.currency}{Number(task.amount) === 0 ? <p className="text-xs text-[#9a6700]">รอระบุยอด</p> : null}</td>
                    <td className="px-4 py-3">{task.due_date || "ยังไม่กำหนด"}</td>
                    <td className="px-4 py-3">{task.payment_status}</td>
                    <td className="px-4 py-3"><span className="rounded bg-amber-50 px-2 py-1 font-semibold text-amber-800">{task.xero_status}</span></td>
                    <td className="px-4 py-3"><Link prefetch={false} className="whitespace-nowrap font-semibold text-[#255f85] underline" href={`/po/${encodeURIComponent(task.po_id)}#payment-${task.id}`}>เปิดรายการ →</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 ? <p className="p-5 text-sm text-[#64707d]">{tasks.length ? "ไม่พบงานตามตัวกรองนี้" : "ไม่มีงานค้าง Upload / Xero"}</p> : null}
          <div className="flex items-center justify-end gap-3 border-t border-[#e2e7ed] px-5 py-3 text-sm">
            <span>{filtered.length} tasks · หน้า {currentPage} / {pageCount}</span>
            <button type="button" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)} className="rounded border px-3 py-1 disabled:opacity-40">ก่อนหน้า</button>
            <button type="button" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)} className="rounded border px-3 py-1 disabled:opacity-40">ถัดไป</button>
          </div>
        </>
      )}
    </section>
  );
}
