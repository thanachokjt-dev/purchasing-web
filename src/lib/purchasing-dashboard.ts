import "server-only";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { matrixProductName, matrixSectionName } from "@/lib/po-size-matrix";
import {
  buildPurchasingDashboard,
  type ProductMeta,
  type PurchaseOrder,
  type PurchaseLine,
  type PurchasePayment,
} from "@/lib/purchasing-dashboard-model";

type CatalogRow = {
  sku: string;
  updated_at: string;
  products:
    | {
        product_title: string;
        product_type: string | null;
        tags: string[] | null;
      }
    | Array<{
        product_title: string;
        product_type: string | null;
        tags: string[] | null;
      }>
    | null;
};
type ControlRow = {
  sku: string;
  main_name_override: string | null;
  product_name_override: string | null;
  tags_override: string[] | null;
};

function majorCategory(source: string) {
  const value = source.toLowerCase();
  if (/kid|child|เด็ก/.test(value)) return "สินค้าเด็ก";
  if (/supplement|nutrition|อาหารเสริม/.test(value)) return "อาหารเสริม";
  if (/cream|care|balm|ครีม/.test(value)) return "ผลิตภัณฑ์ดูแลร่างกาย";
  if (/glove|shin|fight gear|protect|อุปกรณ์ฝึก/.test(value))
    return "อุปกรณ์ฝึกและป้องกัน";
  if (
    /apparel|fight wear|shirt|short|pants|bra|compression|rash|เสื้อผ้า/.test(
      value,
    )
  )
    return "เสื้อผ้า";
  if (/accessor|bag|wrap|cap|hat|อุปกรณ์เสริม/.test(value))
    return "อุปกรณ์เสริม";
  return source || "ยังไม่จัดหมวด";
}

export async function getPurchasingDashboardData() {
  const client = getSupabaseServiceClient();
  if (!client) throw new Error("ไม่สามารถเชื่อมต่อฐานข้อมูลจัดซื้อได้");
  async function all<T>(
    table: string,
    columns: string,
    order: string,
  ): Promise<T[]> {
    const rows: T[] = [];
    for (let from = 0; ; from += 1000) {
      const result = await client!
        .from(table)
        .select(columns)
        .order(order)
        .range(from, from + 999);
      if (result.error)
        throw new Error(
          `โหลดข้อมูล ${table} ไม่สำเร็จ: ${result.error.message}`,
        );
      const batch = result.data as unknown as T[];
      rows.push(...batch);
      if (batch.length < 1000) return rows;
    }
  }
  const [orders, lines, payments, catalog, controls] = await Promise.all([
    all<PurchaseOrder>(
      "po_orders",
      "po_id,po_date,created_at,work_status,cancelled_at,currency,supplier_name_snapshot,supplier_code",
      "po_id",
    ),
    all<PurchaseLine>(
      "po_items",
      "id,po_id,sku,product_title_snapshot,variant_title_snapshot,ordered_qty,cancelled_qty,unit_price,currency,line_status,source_payload",
      "id",
    ),
    all<PurchasePayment>(
      "po_payments",
      "id,po_id,payment_date,payment_type,payment_status,currency,amount,amount_thb,exchange_rate,vat_amount_thb,reference,note",
      "id",
    ),
    all<CatalogRow>(
      "product_variants",
      "sku,updated_at,products(product_title,product_type,tags)",
      "id",
    ),
    all<ControlRow>(
      "purchasing_decision_controls",
      "sku,main_name_override,product_name_override,tags_override",
      "sku",
    ),
  ]);
  const controlMap = new Map(controls.map((control) => [control.sku, control]));
  const metadata = new Map<string, ProductMeta>();
  function setMeta(sku: string, title: string, tags: string[], type = "") {
    const control = controlMap.get(sku);
    const name =
      control?.main_name_override ||
      matrixProductName({
        productTitle: control?.product_name_override || title,
        sku,
      });
    const category = majorCategory(
      type ||
        matrixSectionName(
          {
            productTitle: name,
            sku,
            tags: control?.tags_override?.length ? control.tags_override : tags,
          },
          "ยังไม่จัดหมวด",
        ),
    );
    metadata.set(sku, {
      sku,
      name,
      category,
      groupKey: `${category}|${name}`
        .normalize("NFKC")
        .toLowerCase()
        .replace(/\s*[/–—-]\s*/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    });
  }
  for (const line of lines)
    if (!metadata.has(line.sku))
      setMeta(line.sku, line.product_title_snapshot || line.sku, []);
  for (const row of catalog.sort((a, b) =>
    a.updated_at.localeCompare(b.updated_at),
  )) {
    const product = Array.isArray(row.products)
      ? row.products[0]
      : row.products;
    if (row.sku && product)
      setMeta(
        row.sku,
        product.product_title,
        product.tags || [],
        product.product_type || "",
      );
  }
  return buildPurchasingDashboard(orders, lines, payments, [
    ...metadata.values(),
  ]);
}
