import "server-only";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

export type PoUploadTask = {
  id: string;
  po_id: string;
  payment_type: string;
  payment_status: string;
  xero_status: string;
  amount: number;
  currency: string;
  due_date: string | null;
  reference: string | null;
  po_orders: { supplier_name: string | null; work_status: string; po_title: string | null };
};

export async function getPoUploadTasks(): Promise<{ tasks: PoUploadTask[]; error: string }> {
  const db = getSupabaseServiceClient();
  if (!db) return { tasks: [], error: "ไม่สามารถเชื่อมต่อรายการติดตามได้" };
  const tasks: PoUploadTask[] = [];
  // Independent of the active-workbench filters and pagination, including closed POs.
  for (let from = 0; ; from += 500) {
    const { data, error } = await db.from("po_payments")
      .select("id,po_id,payment_type,payment_status,xero_status,amount,currency,due_date,reference,po_orders!inner(supplier_name:supplier_name_snapshot,work_status,po_title)")
      .neq("xero_status", "uploaded")
      .not("po_orders.work_status", "in", '(cancelled,canceled)')
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("id", { ascending: true }).range(from, from + 499);
    if (error) {
      console.error("PO upload tasks:", error.message);
      return { tasks: [], error: "โหลดงานติดตามไม่สำเร็จ กรุณารีเฟรชอีกครั้ง" };
    }
    tasks.push(...(data as unknown as PoUploadTask[]));
    if (data.length < 500) return { tasks, error: "" };
  }
}
