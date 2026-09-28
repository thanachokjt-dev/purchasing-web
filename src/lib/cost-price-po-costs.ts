export type PoCost = {
  poId: string; date: string; status: string; reference: string; qty: number;
  unitThb: number | null; landThb: number | null; totalThb: number | null;
  currency: string; fx: number | null; unitUsd: number | null;
};

type Payment = { currency?: string | null; amount?: number | string | null; payment_type?: string | null; exchange_rate?: number | string | null };
export type CostLine = {
  ordered_qty?: number | string | null;
  po_id: string | null; currency?: string | null; unit_price: number | string | null;
  landed_unit_cost?: number | string | null; freight_unit_cost?: number | string | null;
  payment_freight_amount_thb?: number | string | null; source_payload?: Record<string, unknown> | null;
};
type Order = { currency?: string | null; po_id: string | null; po_date: string | null; work_status: string | null;
  supplier_invoice_no?: string | null; quotation_reference?: string | null; po_payments?: Payment[] };
const positive = (value: unknown) => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : null;

/** Convert each PO independently; never borrow costs or exchange rates from another PO. */
export function poCosts(entries: Array<{ line: CostLine; qty: number; order: Order | null; timestamp: number }>): PoCost[] {
  const groups = new Map<string, { cost: PoCost; timestamp: number; base: number; land: number; usd: number; baseSafe: boolean; landSafe: boolean; hasUsd: boolean; fx: Set<number>; currencies: Set<string> }>();
  for (const { line, qty, order, timestamp } of entries) {
    if (qty <= 0) continue;
    const id = line.po_id ?? order?.po_id ?? "";
    const currency = (line.currency || order?.currency || "").trim().toUpperCase();
    const payload = line.source_payload ?? {};
    const rates = (order?.po_payments ?? []).filter(p => (p.currency ?? "").toUpperCase() === currency && positive(p.amount) && positive(p.exchange_rate) &&
      !["shipping", "freight", "vat", "vat_import_vat", "fine", "penalty", "other", "other_cost"].includes((p.payment_type ?? "").toLowerCase())).map(p => Number(p.exchange_rate));
    const fx = currency === "THB" ? 1 : positive(payload.appliedFxRate) ?? (rates.length ? Number((rates.reduce((a, b) => a + b, 0) / rates.length).toFixed(6)) : null);
    const unit = Number(line.unit_price) || 0;
    const freight = positive(line.freight_unit_cost) ?? Math.max((Number(line.landed_unit_cost) || unit) - unit, 0);
    // Allocation is stored for the original ordered quantity, before cancellations.
    const hasPaymentAllocation = positive(line.payment_freight_amount_thb) != null || payload.paymentFreightAllocation != null;
    const landThb = hasPaymentAllocation ? (Number(line.payment_freight_amount_thb) || 0) / (positive(line.ordered_qty) ?? qty) : fx == null ? (freight === 0 ? 0 : null) : freight * fx;
    const usd = currency === "USD" ? unit : positive(payload.unitPriceUsd);
    let group = groups.get(id);
    if (!group) {
      group = { cost: { poId: id, date: order?.po_date ?? "", status: order?.work_status ?? "", reference: order?.supplier_invoice_no || order?.quotation_reference || "", qty: 0,
        unitThb: null, landThb: null, totalThb: null, currency, fx, unitUsd: null }, timestamp, base: 0, land: 0, usd: 0, baseSafe: true, landSafe: true, hasUsd: true, fx: new Set(), currencies: new Set() };
      groups.set(id, group);
    }
    group.cost.qty += qty;
    group.timestamp = Math.max(group.timestamp, timestamp);
    group.baseSafe &&= fx != null;
    group.landSafe &&= landThb != null;
    group.base += unit * (fx ?? 0) * qty;
    group.land += (landThb ?? 0) * qty;
    group.hasUsd &&= usd != null;
    group.usd += (usd ?? 0) * qty;
    group.currencies.add(currency);
    const recordedFx = currency === "THB" ? positive(payload.appliedFxRate) ?? 1 : fx;
    if (recordedFx != null) group.fx.add(recordedFx);
  }
  return [...groups.values()].sort((a, b) => b.timestamp - a.timestamp || a.cost.poId.localeCompare(b.cost.poId)).map(g => ({
    ...g.cost, unitThb: g.baseSafe ? g.base / g.cost.qty : null, landThb: g.landSafe ? g.land / g.cost.qty : null,
    totalThb: g.baseSafe && g.landSafe ? (g.base + g.land) / g.cost.qty : null, unitUsd: g.hasUsd ? g.usd / g.cost.qty : null,
    currency: [...g.currencies].join(" / "), fx: g.fx.size === 1 ? [...g.fx][0] : null,
  }));
}
