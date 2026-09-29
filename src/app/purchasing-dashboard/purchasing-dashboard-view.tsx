"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  expenseCategories,
  type PurchasingDashboardData,
} from "@/lib/purchasing-dashboard-model";

const money = (value: number) =>
  value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const qty = (value: number) =>
  value.toLocaleString("en-US", { maximumFractionDigits: 2 });
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
const cell = "px-4 py-3 text-right tabular-nums whitespace-nowrap";
const panel = "rounded-xl border border-slate-200 bg-white";
const control = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";

export function Sparkline({
  values,
  color = "#2563eb",
}: {
  values: number[];
  color?: string;
}) {
  const max = Math.max(...values, 1);
  const points = values
    .map((value, index) => `${6 + index * 32},${34 - (value / max) * 28}`)
    .join(" ");
  return (
    <svg
      width="110"
      height="40"
      viewBox="0 0 110 40"
      role="img"
      aria-label={`แนวโน้ม 4 เดือน: ${values.map(money).join(", ")}`}
    >
      <title>{values.map(money).join(" → ")}</title>
      <path d="M6 34H102" stroke="#e2e8f0" />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {values.map((value, index) => (
        <circle
          key={index}
          cx={6 + index * 32}
          cy={34 - (value / max) * 28}
          r="2.8"
          fill={color}
        />
      ))}
    </svg>
  );
}

function MonthlyChart({ data }: { data: PurchasingDashboardData }) {
  const max = Math.max(...data.monthly, 1),
    height = 225;
  return (
    <div className="p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">เงินจ่ายจริง แยกตามเดือนและประเภท</h2>
        <span className="text-xs text-slate-500">
          เดือนล่าสุดยังไม่ครบเดือน
        </span>
      </div>
      <svg
        viewBox="0 0 760 315"
        className="mt-5 w-full"
        role="img"
        aria-label="กราฟแท่งซ้อนยอดจ่ายจริง 4 เดือน"
      >
        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => (
          <g key={fraction}>
            <line
              x1="85"
              x2="745"
              y1={260 - fraction * height}
              y2={260 - fraction * height}
              stroke="#e2e8f0"
              strokeDasharray="3 4"
            />
            <text
              x="75"
              y={264 - fraction * height}
              textAnchor="end"
              fill="#64748b"
              fontSize="12"
            >
              {qty(max * fraction)}
            </text>
          </g>
        ))}
        {data.period.months.map((month, index) => {
          let bottom = 260;
          const x = 125 + index * 160;
          return (
            <g key={month.key}>
              {data.categories.map((category) => {
                const value = category.monthly[index],
                  h = (value / max) * height;
                bottom -= h;
                return (
                  <Link
                    key={category.key}
                    href={`/purchasing-dashboard?view=details&category=${category.key}`}
                  >
                    <rect
                      x={x}
                      y={bottom}
                      width="86"
                      height={h}
                      fill={category.color}
                    >
                      <title>{`${month.label} · ${category.label}: ${money(value)} THB`}</title>
                    </rect>
                  </Link>
                );
              })}
              <text
                x={x + 43}
                y={250 - (data.monthly[index] / max) * height}
                textAnchor="middle"
                fill="#172026"
                fontSize="12"
                fontWeight="600"
              >
                {money(data.monthly[index])}
              </text>
              <text
                x={x + 43}
                y="292"
                textAnchor="middle"
                fill="#64748b"
                fontSize="13"
              >
                {month.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-600">
        {data.categories.map((category) => (
          <Link
            key={category.key}
            href={`/purchasing-dashboard?view=details&category=${category.key}`}
            className="flex items-center gap-2"
          >
            <span
              className="size-2.5 rounded-full"
              style={{ background: category.color }}
            />
            {category.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

function CategoryTable({ data }: { data: PurchasingDashboardData }) {
  return (
    <section className={`${panel} overflow-hidden`}>
      <h2 className="px-5 pt-5 font-semibold">เปรียบเทียบค่าใช้จ่าย 4 เดือน</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-5 py-3 text-left">ประเภท</th>
              {data.period.months.map((month) => (
                <th className={cell} key={month.key}>
                  {month.label}
                </th>
              ))}
              <th className={cell}>รวม THB</th>
              <th className={cell}>สัดส่วน</th>
              <th className={cell}>Sparkline</th>
            </tr>
          </thead>
          <tbody>
            {data.categories.map((category) => (
              <tr key={category.key} className="border-t border-slate-100">
                <td className="px-5 py-3 whitespace-nowrap">
                  <Link
                    href={`/purchasing-dashboard?view=details&category=${category.key}`}
                    className="font-medium hover:text-blue-700"
                  >
                    {category.label}
                  </Link>
                </td>
                {category.monthly.map((value, index) => (
                  <td className={cell} key={index}>
                    {money(value)}
                  </td>
                ))}
                <td className={`${cell} font-semibold`}>
                  {money(category.total)}
                </td>
                <td className={cell}>
                  {data.grossPaid > 0
                    ? ((category.total / data.grossPaid) * 100).toFixed(1)
                    : "0.0"}
                  %
                </td>
                <td className={cell}>
                  <Sparkline values={category.monthly} color={category.color} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t bg-slate-50 font-semibold">
            <tr>
              <td className="px-5 py-3">รวมยอดจ่ายจริง</td>
              {data.monthly.map((value, index) => (
                <td key={index} className={cell}>
                  {money(value)}
                </td>
              ))}
              <td className={cell}>{money(data.grossPaid)}</td>
              <td className={cell}>{data.grossPaid ? "100%" : "0%"}</td>
              <td className={cell}>
                <Sparkline values={data.monthly} color="#0d233f" />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

function NewOrderComparison({ data }: { data: PurchasingDashboardData }) {
  const quantities = data.period.months.map((_, index) =>
    data.newGroups.reduce((total, group) => total + group.quantities[index], 0),
  );
  const costs = data.period.months.map((_, index) =>
    data.newGroups.reduce((total, group) => total + group.costs[index], 0),
  );
  return (
    <section className={`${panel} overflow-hidden`}>
      <div className="px-5 pt-5">
        <h2 className="font-semibold">การสั่งสินค้าใหม่ ตามวันที่ PO</h2>
        <p className="mt-1 text-xs text-slate-500">
          มูลค่าสั่งซื้อจากต้นทุนดิบ THB แยกจากยอดเงินที่จ่ายแล้ว ·
          มูลค่าแสดงเฉพาะรายการที่ทราบต้นทุน
        </p>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-5 py-3 text-left">รายการ</th>
              {data.period.months.map((month) => (
                <th key={month.key} className={cell}>
                  {month.label}
                </th>
              ))}
              <th className={cell}>รวม</th>
              <th className={cell}>Sparkline</th>
            </tr>
          </thead>
          <tbody>
            {[
              {
                label: "จำนวนสินค้าใหม่ (ชิ้น)",
                values: quantities,
                format: qty,
              },
              { label: "มูลค่าสินค้าใหม่ (THB)", values: costs, format: money },
            ].map((row) => (
              <tr key={row.label} className="border-t border-slate-100">
                <td className="px-5 py-3 whitespace-nowrap">{row.label}</td>
                {row.values.map((value, index) => (
                  <td key={index} className={cell}>
                    {row.format(value)}
                  </td>
                ))}
                <td className={`${cell} font-semibold`}>
                  {row.format(sum(row.values))}
                </td>
                <td className={cell}>
                  <Sparkline values={row.values} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function NewProducts({ data }: { data: PurchasingDashboardData }) {
  const [search, setSearch] = useState(""),
    [category, setCategory] = useState("");
  const categories = [
    ...new Set(data.newGroups.map((group) => group.category)),
  ];
  const groups = data.newGroups.filter(
    (group) =>
      (!category || group.category === category) &&
      `${group.name} ${group.skus.join(" ")}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <section className={`${panel} p-5 sm:p-6`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">
            สินค้าในออเดอร์แรก · รวมเป็นกลุ่มสินค้า
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Qty และมูลค่าสินค้าตามวันที่ PO · ยอดจ่ายตามวันที่ Payment ·
            ต้นทุนดิบไม่รวม Landed cost
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            className={control}
            aria-label="ค้นหาสินค้าใหม่"
            placeholder="ค้นหาชื่อ / SKU"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            className={control}
            aria-label="หมวดสินค้าใหม่"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="">ทุกหมวดสินค้า</option>
            {categories.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-5 space-y-5">
        {categories
          .filter((value) => !category || value === category)
          .map((value) => {
            const rows = groups.filter((group) => group.category === value);
            if (!rows.length) return null;
            return (
              <div key={value}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {value} · {rows.length} กลุ่ม
                </h3>
                {rows.map((group) => (
                  <details
                    key={group.key}
                    className="mb-2 rounded-lg border border-slate-200"
                  >
                    <summary className="cursor-pointer px-4 py-3">
                      <span className="inline-grid w-[calc(100%-1.5rem)] gap-3 align-middle sm:grid-cols-[minmax(180px,1fr)_90px_100px_145px_145px_110px]">
                        <span className="font-medium text-sm">
                          {group.name}
                          <small className="mt-1 block text-slate-500">
                            {group.skus.length} SKU
                          </small>
                        </span>
                        <span className="text-sm tabular-nums">
                          <small className="block text-slate-500">Qty</small>
                          {qty(sum(group.quantities))}
                        </span>
                        <span className="text-sm">
                          <small className="block text-slate-500">
                            ต้นทุนขาด
                          </small>
                          {qty(group.missingCostQty)} ชิ้น
                        </span>
                        <span className="text-sm tabular-nums">
                          <small className="block text-slate-500">
                            มูลค่าสินค้า THB
                          </small>
                          {money(sum(group.costs))}
                        </span>
                        <span className="text-sm tabular-nums">
                          <small className="block text-slate-500">
                            จ่ายจริง ไม่รวม VAT
                          </small>
                          {money(sum(group.paid))}
                        </span>
                        <Sparkline values={group.paid} />
                      </span>
                    </summary>
                    <div className="overflow-x-auto border-t border-slate-100">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-4 py-3 text-left">SKU / PO</th>
                            {data.period.months.map((month) => (
                              <th key={month.key} className={cell}>
                                Qty {month.label}
                              </th>
                            ))}
                            <th className={cell}>ต้นทุนดิบ / หน่วย THB</th>
                            <th className={cell}>มูลค่าสินค้า THB</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.lines.map((line, index) => (
                            <tr
                              key={`${line.poId}-${line.sku}-${index}`}
                              className="border-t border-slate-100"
                            >
                              <td className="px-4 py-3">
                                <span className="block font-medium">
                                  {line.sku}
                                </span>
                                <Link
                                  className="text-blue-600"
                                  href={`/po/${encodeURIComponent(line.poId)}`}
                                >
                                  {line.poId}
                                </Link>
                              </td>
                              {data.period.months.map((month) => (
                                <td key={month.key} className={cell}>
                                  {line.date.startsWith(month.key)
                                    ? qty(line.qty)
                                    : "—"}
                                </td>
                              ))}
                              <td className={cell}>
                                {line.unitThb == null
                                  ? "ไม่มีต้นทุน / FX"
                                  : money(line.unitThb)}
                              </td>
                              <td className={cell}>
                                {line.costThb == null
                                  ? "—"
                                  : money(line.costThb)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {!group.lines.length && (
                        <p className="p-4 text-xs text-slate-500">
                          PO ครั้งแรกอยู่นอกช่วง 4 เดือนนี้ มีเฉพาะ Payment
                          ที่จ่ายในช่วงนี้ ตรวจ PO ได้จากตารางรายการจ่ายด้านล่าง
                        </p>
                      )}
                    </div>
                  </details>
                ))}
              </div>
            );
          })}
        {!groups.length && (
          <p className="py-6 text-center text-sm text-slate-500">
            ไม่พบสินค้าในเงื่อนไขนี้
          </p>
        )}
      </div>
    </section>
  );
}

function Payments({
  data,
  initialCategory,
}: {
  data: PurchasingDashboardData;
  initialCategory: string;
}) {
  const [category, setCategory] = useState(initialCategory),
    [month, setMonth] = useState(""),
    [supplier, setSupplier] = useState(""),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(0);
  const rows = useMemo(
    () =>
      data.records
        .filter(
          (row) =>
            (!category || row.category === category) &&
            (!month || row.date.startsWith(month)) &&
            (!supplier || row.supplier === supplier) &&
            `${row.poId} ${row.groupName} ${row.sku} ${row.type} ${row.reference} ${row.note}`
              .toLowerCase()
              .includes(search.toLowerCase()),
        )
        .sort(
          (a, b) =>
            b.date.localeCompare(a.date) || a.poId.localeCompare(b.poId),
        ),
    [data, category, month, supplier, search],
  );
  const pages = Math.max(Math.ceil(rows.length / 50), 1),
    current = Math.min(page, pages - 1);
  const suppliers = [
    ...new Set(data.records.map((row) => row.supplier)),
  ].sort();
  return (
    <section className={`${panel} overflow-hidden`}>
      <div className="p-5">
        <h2 className="font-semibold">รายละเอียดเงินจ่ายจริง</h2>
        <p className="mt-1 text-xs text-slate-500">
          แยกส่วน VAT และปันส่วนสินค้าใหม่/เดิมตามมูลค่าสินค้าใน PO แต่ละรายการ
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <select
            aria-label="ประเภทค่าใช้จ่าย"
            className={control}
            value={category}
            onChange={(event) => {
              setCategory(event.target.value);
              setPage(0);
            }}
          >
            <option value="">ทั้ง 5 ประเภท</option>
            {expenseCategories.map((item) => (
              <option value={item.key} key={item.key}>
                {item.label}
              </option>
            ))}
          </select>
          <select
            aria-label="เดือนที่จ่าย"
            className={control}
            value={month}
            onChange={(event) => {
              setMonth(event.target.value);
              setPage(0);
            }}
          >
            <option value="">ทั้ง 4 เดือน</option>
            {data.period.months.map((item) => (
              <option value={item.key} key={item.key}>
                {item.label}
              </option>
            ))}
          </select>
          <select
            aria-label="ซัพพลายเออร์"
            className={control}
            value={supplier}
            onChange={(event) => {
              setSupplier(event.target.value);
              setPage(0);
            }}
          >
            <option value="">ทุกซัพ</option>
            {suppliers.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <input
            aria-label="ค้นหารายการจ่าย"
            className={control}
            placeholder="ค้นหา PO / SKU / ประเภท"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(0);
            }}
          />
        </div>
        <p className="mt-3 text-sm">
          {qty(rows.length)} ส่วนรายการ · ยอดตามตัวกรอง{" "}
          <strong>
            {money(rows.reduce((total, row) => total + row.amountThb, 0))} THB
          </strong>
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              {[
                "วันที่จ่าย",
                "PO / ซัพ",
                "ประเภท Payment",
                "หมวดค่าใช้จ่าย",
                "สินค้า / SKU",
                "จำนวนเงิน THB",
              ].map((label) => (
                <th
                  key={label}
                  className={`px-4 py-3 whitespace-nowrap ${label === "จำนวนเงิน THB" ? "text-right" : "text-left"}`}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(current * 50, (current + 1) * 50).map((row, index) => (
              <tr
                key={`${row.paymentId}-${index}`}
                className="border-t border-slate-100"
              >
                <td className="px-4 py-3 whitespace-nowrap">{row.date}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/po/${encodeURIComponent(row.poId)}`}
                    className="block font-medium text-blue-600"
                  >
                    {row.poId}
                  </Link>
                  <span className="text-slate-500">{row.supplier}</span>
                </td>
                <td className="px-4 py-3">
                  {row.type}
                  <small className="block text-slate-500">
                    {row.reference}
                  </small>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {
                    expenseCategories.find((item) => item.key === row.category)
                      ?.label
                  }
                </td>
                <td className="px-4 py-3">
                  {row.groupName ||
                    (row.category === "existing"
                      ? "ปันส่วนไม่ได้: ไม่พบต้นทุนครบ"
                      : "—")}
                  <small className="block text-slate-500">{row.sku}</small>
                </td>
                <td className={`${cell} font-medium`}>
                  {money(row.amountThb)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <p className="p-8 text-center text-sm text-slate-500">
            ไม่พบรายการจ่ายในเงื่อนไขนี้
          </p>
        )}
      </div>
      <div className="flex items-center justify-between border-t px-5 py-3 text-sm text-slate-500">
        <span>
          หน้า {current + 1} / {pages}
        </span>
        <div className="flex gap-2">
          <button
            className={`${control} disabled:opacity-40`}
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
          >
            ก่อนหน้า
          </button>
          <button
            className={`${control} disabled:opacity-40`}
            disabled={current >= pages - 1}
            onClick={() => setPage(current + 1)}
          >
            ถัดไป
          </button>
        </div>
      </div>
    </section>
  );
}

export function PurchasingDashboardView({
  data,
  detail = false,
  initialCategory = "",
}: {
  data: PurchasingDashboardData;
  detail?: boolean;
  initialCategory?: string;
}) {
  const newQty = sum(data.newGroups.flatMap((group) => group.quantities)),
    newValue = sum(data.newGroups.flatMap((group) => group.costs));
  return (
    <div className="space-y-6 p-4 sm:p-8">
      <p className="text-xs leading-5 text-slate-500">
        ยอดจ่ายจริงใช้เฉพาะ Payment ที่ Paid ตามวันที่จ่าย แยก VAT
        รวมไว้ในหมวดภาษีแล้ว · สินค้าใหม่ = SKU ใน PO ครั้งแรกจากประวัติทั้งหมด
        รวม SKU ในตระกูลเดียวกัน · Excel ส่งออกครบทั้ง 4 เดือน
      </p>
      {data.warnings.length > 0 && (
        <details className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <summary className="cursor-pointer font-medium">
            ข้อมูลที่ต้องตรวจสอบ {data.warnings.length} ข้อ
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {data.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </details>
      )}
      {!detail ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: "จ่ายจริงรวม THB",
                value: money(data.grossPaid),
                note: `${data.paymentCount} Payment · ${data.poCount} PO`,
              },
              {
                label: "สินค้าใหม่ในช่วงนี้",
                value: `${qty(newQty)} ชิ้น`,
                note: `มูลค่าต้นทุนดิบ ${money(newValue)} THB`,
              },
              {
                label: "ขนส่งและศุลกากร THB",
                value: money(data.categories[2].total),
                note: "Shipping + Freight + ค่าพิธีการ",
              },
              {
                label: "ภาษีรวม THB",
                value: money(data.categories[3].total),
                note: "VAT แยกจากยอดรวม + Import VAT",
              },
            ].map((card) => (
              <article className={`${panel} p-5`} key={card.label}>
                <p className="text-sm text-slate-500">{card.label}</p>
                <p className="mt-3 text-2xl font-semibold tabular-nums">
                  {card.value}
                </p>
                <p className="mt-2 text-xs text-slate-500">{card.note}</p>
              </article>
            ))}
          </div>
          <section className={panel}>
            <MonthlyChart data={data} />
          </section>
          <CategoryTable data={data} />
          <NewOrderComparison data={data} />
          <div
            className={`${panel} flex flex-wrap items-center justify-between gap-3 p-5`}
          >
            <div>
              <h2 className="font-semibold">เปิดดูสินค้าและรายการจ่าย</h2>
              <p className="mt-1 text-sm text-slate-500">
                {data.newGroups.length} กลุ่มออเดอร์แรก · เปิดดู SKU และ PO
                ที่เกี่ยวข้อง
              </p>
            </div>
            <Link
              href="/purchasing-dashboard?view=details"
              className="rounded-lg bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700"
            >
              ดูรายละเอียด →
            </Link>
          </div>
        </>
      ) : (
        <>
          <CategoryTable data={data} />
          <NewProducts data={data} />
          <Payments data={data} initialCategory={initialCategory} />
        </>
      )}
      <p className="text-xs text-slate-400">
        ข้อมูลอ่านจาก PO / Payment ล่าสุด ·{" "}
        {new Intl.DateTimeFormat("th-TH", {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "Asia/Bangkok",
        }).format(new Date(data.generatedAt))}
      </p>
    </div>
  );
}
