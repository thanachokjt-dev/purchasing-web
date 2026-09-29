export const expenseCategories = [
  { key: "new", label: "ออเดอร์สินค้าใหม่", color: "#2563eb" },
  { key: "existing", label: "ชำระออเดอร์เดิม", color: "#0d9488" },
  { key: "shipping", label: "ขนส่งและศุลกากร", color: "#d97706" },
  { key: "vat", label: "VAT / IMPORT VAT", color: "#7c3aed" },
  { key: "other", label: "ค่าใช้จ่ายสินค้าอื่น ๆ", color: "#64748b" },
] as const;
export type ExpenseCategory = (typeof expenseCategories)[number]["key"];
export type PurchaseOrder = {
  po_id: string;
  po_date: string | null;
  created_at: string;
  work_status: string;
  cancelled_at: string | null;
  currency: string;
  supplier_name_snapshot: string;
  supplier_code: string;
};
export type PurchaseLine = {
  id: string;
  po_id: string;
  sku: string;
  product_title_snapshot: string | null;
  variant_title_snapshot: string | null;
  ordered_qty: number | string;
  cancelled_qty: number | string;
  unit_price: number | string | null;
  currency: string | null;
  line_status: string | null;
  source_payload: Record<string, unknown> | null;
};
export type PurchasePayment = {
  id: string;
  po_id: string;
  payment_date: string | null;
  payment_type: string | null;
  payment_status: string | null;
  currency: string | null;
  amount: number | string | null;
  amount_thb: number | string | null;
  exchange_rate: number | string | null;
  vat_amount_thb: number | string | null;
  reference: string | null;
  note: string | null;
};
export type ProductMeta = {
  sku: string;
  name: string;
  category: string;
  groupKey: string;
};
export type NewProductLine = {
  poId: string;
  date: string;
  sku: string;
  groupKey: string;
  name: string;
  category: string;
  qty: number;
  unitThb: number | null;
  costThb: number | null;
};
export type SpendRecord = {
  paymentId: string;
  date: string;
  poId: string;
  supplier: string;
  type: string;
  category: ExpenseCategory;
  amountThb: number;
  grossThb: number;
  groupKey: string;
  groupName: string;
  sku: string;
  reference: string;
  note: string;
};
export type NewProductGroup = {
  key: string;
  name: string;
  category: string;
  skus: string[];
  quantities: number[];
  costs: number[];
  paid: number[];
  missingCostQty: number;
  lines: NewProductLine[];
};
const number = (value: unknown) =>
  Number.isFinite(Number(value)) ? Number(value) : 0;
const norm = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9ก-๙]/g, "");
const money = (value: number) => Math.round(value * 100) / 100;

export function purchasingPeriod(today = new Date()) {
  const end = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(today);
  const [year, month] = end.split("-").map(Number);
  const months = Array.from({ length: 4 }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 4 + index, 1));
    return {
      key: date.toISOString().slice(0, 7),
      label: new Intl.DateTimeFormat("th-TH", {
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(date),
    };
  });
  return { start: months[0].key + "-01", end, months };
}

export function classifyExpense(
  type: string | null,
): "product" | "shipping" | "vat" | "other" {
  const value = norm(type ?? "");
  if (
    ["vat", "importvat", "vatimportvat", "ภาษี", "ภาษีมูลค่าเพิ่ม"].includes(
      value,
    )
  )
    return "vat";
  if (
    /shipping|freight|customs|clearance|duty|brokerage|ศุลกากร|พิธีการ|ขนส่ง/.test(
      value,
    )
  )
    return "shipping";
  if (!value || /other|fine|penalty|อื่น|ปรับ/.test(value)) return "other";
  return "product";
}

export function classifyPaymentExpense(
  payment: Pick<PurchasePayment, "payment_type" | "reference" | "note">,
) {
  const type = classifyExpense(payment.payment_type);
  if (type !== "other") return type;
  // Legacy Other rows sometimes explicitly identify VAT or customs in reference/note.
  for (const description of [payment.reference, payment.note]) {
    const described = classifyExpense(description);
    if (described === "vat" || described === "shipping") return described;
  }
  return type;
}

/** Largest remainder allocation in satang, so every payment reconciles exactly. */
export function allocateMoney(amount: number, weights: number[]) {
  const cents = Math.round(amount * 100);
  const total = weights.reduce((sum, weight) => sum + Math.max(weight, 0), 0);
  if (total <= 0) return weights.map(() => 0);
  const raw = weights.map((weight) => (cents * Math.max(weight, 0)) / total);
  const result = raw.map(Math.floor);
  let remaining = cents - result.reduce((sum, value) => sum + value, 0);
  const order = raw
    .map((value, index) => ({ index, fraction: value - result[index] }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (const item of order) {
    if (remaining-- <= 0) break;
    result[item.index]++;
  }
  return result.map((value) => value / 100);
}

export function buildPurchasingDashboard(
  orders: PurchaseOrder[],
  items: PurchaseLine[],
  payments: PurchasePayment[],
  metadata: ProductMeta[],
  today = new Date(),
) {
  const period = purchasingPeriod(today);
  const inPeriod = (date: string) => date >= period.start && date <= period.end;
  const monthIndex = (date: string) =>
    period.months.findIndex((month) => month.key === date.slice(0, 7));
  const orderMap = new Map(orders.map((order) => [order.po_id, order]));
  const metaMap = new Map(metadata.map((meta) => [meta.sku, meta]));
  const paymentMap = new Map<string, PurchasePayment[]>();
  for (const payment of payments)
    paymentMap.set(payment.po_id, [
      ...(paymentMap.get(payment.po_id) ?? []),
      payment,
    ]);
  const validOrder = (order: PurchaseOrder) =>
    !order.cancelled_at &&
    !["draft", "cancelled"].includes(order.work_status.toLowerCase());
  const validItems = items.filter((item) => {
    const order = orderMap.get(item.po_id);
    return (
      order &&
      validOrder(order) &&
      item.line_status !== "cancelled" &&
      number(item.ordered_qty) - number(item.cancelled_qty) > 0
    );
  });
  const orderRank = (order: PurchaseOrder) =>
    `${order.po_date || "0000-00-00"}|${order.created_at}|${order.po_id}`;
  const firstPo = new Map<string, string>();
  for (const item of [...validItems].sort((a, b) =>
    orderRank(orderMap.get(a.po_id)!).localeCompare(
      orderRank(orderMap.get(b.po_id)!),
    ),
  )) {
    if (item.sku && !firstPo.has(item.sku)) firstPo.set(item.sku, item.po_id);
  }
  const lineInfo = new Map<string, NewProductLine>();
  for (const item of validItems) {
    const order = orderMap.get(item.po_id)!;
    const meta = metaMap.get(item.sku) ?? {
      sku: item.sku,
      name: item.product_title_snapshot || item.sku || "ไม่ระบุสินค้า",
      category: "ยังไม่จัดหมวด",
      groupKey: item.sku || item.id,
    };
    const currency = (item.currency || order.currency).trim().toUpperCase();
    const applied = number(item.source_payload?.appliedFxRate);
    const rates = (paymentMap.get(item.po_id) ?? [])
      .filter(
        (payment) =>
          (payment.currency ?? "").toUpperCase() === currency &&
          classifyExpense(payment.payment_type) === "product" &&
          number(payment.amount) > 0 &&
          number(payment.exchange_rate) > 0,
      )
      .map((payment) => number(payment.exchange_rate));
    const fx =
      currency === "THB"
        ? 1
        : applied > 0
          ? applied
          : rates.length
            ? rates.reduce((a, b) => a + b, 0) / rates.length
            : null;
    const qty = number(item.ordered_qty) - number(item.cancelled_qty);
    const unitThb =
      number(item.unit_price) > 0 && fx != null
        ? number(item.unit_price) * fx
        : null;
    lineInfo.set(item.id, {
      poId: item.po_id,
      date: order.po_date || "",
      sku: item.sku,
      groupKey: meta.groupKey,
      name: meta.name,
      category: meta.category,
      qty,
      unitThb,
      costThb: unitThb == null ? null : unitThb * qty,
    });
  }
  const groups = new Map<string, NewProductGroup>();
  const groupFor = (line: NewProductLine) => {
    let group = groups.get(line.groupKey);
    if (!group) {
      group = {
        key: line.groupKey,
        name: line.name,
        category: line.category,
        skus: [],
        quantities: [0, 0, 0, 0],
        costs: [0, 0, 0, 0],
        paid: [0, 0, 0, 0],
        missingCostQty: 0,
        lines: [],
      };
      groups.set(line.groupKey, group);
    }
    if (!group.skus.includes(line.sku)) group.skus.push(line.sku);
    return group;
  };
  const isFirst = (line: NewProductLine) =>
    firstPo.get(line.sku) === line.poId && Boolean(line.date);
  for (const line of lineInfo.values()) {
    if (!isFirst(line) || !inPeriod(line.date)) continue;
    const group = groupFor(line),
      index = monthIndex(line.date);
    group.lines.push(line);
    group.quantities[index] += line.qty;
    group.costs[index] += line.costThb ?? 0;
    if (line.costThb == null) group.missingCostQty += line.qty;
  }
  const records: SpendRecord[] = [];
  const warnings: string[] = [];
  let missingFx = 0,
    undatedPaid = 0,
    unallocated = 0,
    grossPaid = 0;
  const linesByPo = new Map<string, NewProductLine[]>();
  for (const line of lineInfo.values())
    linesByPo.set(line.poId, [...(linesByPo.get(line.poId) ?? []), line]);
  for (const payment of payments) {
    if ((payment.payment_status ?? "paid").toLowerCase() !== "paid") continue;
    if (!payment.payment_date) {
      undatedPaid++;
      continue;
    }
    if (!inPeriod(payment.payment_date)) continue;
    const order = orderMap.get(payment.po_id);
    const currency = (payment.currency || order?.currency || "")
      .trim()
      .toUpperCase();
    const fx =
      currency === "THB"
        ? 1
        : number(payment.exchange_rate) > 0
          ? number(payment.exchange_rate)
          : null;
    // Require recorded FX for foreign payments even if a stale THB amount exists.
    if (fx == null) {
      missingFx++;
      continue;
    }
    const gross = money(
      payment.amount_thb != null
        ? number(payment.amount_thb)
        : number(payment.amount) * fx,
    );
    if (gross < 0) {
      warnings.push(`Payment ${payment.id} เป็นยอดติดลบ จึงยังไม่รวม`);
      continue;
    }
    grossPaid = money(grossPaid + gross);
    const type = classifyPaymentExpense(payment);
    const vat =
      type === "vat"
        ? 0
        : money(Math.min(gross, Math.max(number(payment.vat_amount_thb), 0)));
    const add = (
      category: ExpenseCategory,
      amountThb: number,
      line?: NewProductLine,
    ) => {
      records.push({
        paymentId: payment.id,
        date: payment.payment_date!,
        poId: payment.po_id,
        supplier: order?.supplier_name_snapshot || "ไม่ระบุซัพ",
        type: payment.payment_type || "ไม่ระบุประเภท",
        category,
        amountThb,
        grossThb: gross,
        groupKey: line?.groupKey || "",
        groupName: line?.name || "",
        sku: line?.sku || "",
        reference: payment.reference || "",
        note: payment.note || "",
      });
    };
    if (vat > 0) add("vat", vat);
    const net = money(gross - vat);
    if (type !== "product") {
      add(type, net);
      continue;
    }
    const lines = linesByPo.get(payment.po_id) ?? [];
    if (!lines.length || lines.some((line) => line.costThb == null)) {
      add("existing", net);
      unallocated++;
      continue;
    }
    const shares = allocateMoney(
      net,
      lines.map((line) => line.costThb!),
    );
    lines.forEach((line, index) => {
      const category = isFirst(line) ? "new" : "existing";
      add(category, shares[index], line);
      if (category === "new") {
        const group = groupFor(line);
        group.paid[monthIndex(payment.payment_date!)] += shares[index];
      }
    });
  }
  if (missingFx)
    warnings.push(`${missingFx} Payment ไม่มี FX ที่ใช้ได้ ยังไม่รวมยอด THB`);
  if (undatedPaid)
    warnings.push(
      `${undatedPaid} Payment จ่ายแล้วไม่มีวันที่ จึงระบุเดือนไม่ได้`,
    );
  if (unallocated)
    warnings.push(
      `${unallocated} Payment ปันส่วนสินค้าใหม่/เดิมไม่ได้เพราะข้อมูลต้นทุนไม่ครบ แสดงไว้ในออเดอร์เดิมและระบุในรายละเอียด`,
    );
  const missingQty = [...groups.values()].reduce(
    (sum, group) => sum + group.missingCostQty,
    0,
  );
  if (missingQty)
    warnings.push(
      `สินค้าใหม่ ${missingQty.toLocaleString()} ชิ้นไม่มีต้นทุนดิบหรือ FX มูลค่าสินค้าแสดงเฉพาะส่วนที่ทราบ`,
    );
  const categories = expenseCategories.map((category) => {
    const monthly = period.months.map((month) =>
      money(
        records
          .filter(
            (record) =>
              record.category === category.key &&
              record.date.startsWith(month.key),
          )
          .reduce((sum, record) => sum + record.amountThb, 0),
      ),
    );
    return {
      ...category,
      monthly,
      total: money(monthly.reduce((a, b) => a + b, 0)),
    };
  });
  const monthly = period.months.map((_, index) =>
    money(
      categories.reduce((sum, category) => sum + category.monthly[index], 0),
    ),
  );
  const newGroups = [...groups.values()].sort(
    (a, b) =>
      a.category.localeCompare(b.category) || a.name.localeCompare(b.name),
  );
  return {
    period,
    categories,
    monthly,
    grossPaid,
    warnings,
    newGroups,
    records,
    generatedAt: today.toISOString(),
    paymentCount: new Set(records.map((record) => record.paymentId)).size,
    poCount: new Set(records.map((record) => record.poId)).size,
  };
}
export type PurchasingDashboardData = ReturnType<
  typeof buildPurchasingDashboard
>;
