import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  ClipboardList,
  Clock3,
  FileSpreadsheet,
  Landmark,
  Mail,
  Plus,
  Tags,
  UserRound,
} from "lucide-react";
import {
  addSupplierContactAction,
  savePurchasingTagAction,
  saveSupplierSetupAction,
} from "@/app/purchasing-setup/actions";
import { PendingSubmitButton } from "@/app/loading-controls";
import {
  getPurchasingSetupData,
  type PurchasingTag,
  type SupplierSetup,
} from "@/lib/purchasing-setup";

export const dynamic = "force-dynamic";

const inputClass =
  "h-10 w-full rounded-md border border-[#cfd6df] bg-white px-3 text-sm text-[#172026] outline-none focus:border-[#255f85]";
const smallInputClass =
  "h-9 w-full rounded-md border border-[#cfd6df] bg-white px-2 text-sm text-[#172026] outline-none focus:border-[#255f85]";
const labelClass =
  "grid gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#64707d]";
const buttonClass =
  "inline-flex h-10 items-center justify-center rounded-md bg-[#172026] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButtonClass =
  "inline-flex h-10 items-center justify-center rounded-md border border-[#cfd6df] bg-white px-4 text-sm font-semibold text-[#364252]";
const sectionClass = "rounded-lg border border-[#dfe4ea] bg-white shadow-sm";

function supplierSubtitle(supplier: SupplierSetup) {
  return [
    supplier.productScope,
    supplier.paymentTerms,
    supplier.contactEmail,
  ].filter(Boolean).join(" / ");
}

function supplierStatusClass(isActive: boolean) {
  return isActive
    ? "bg-[#eaf6ef] text-[#1f6b3d]"
    : "bg-[#eef0f3] text-[#5c6670]";
}

function productScopeSet(supplier?: SupplierSetup) {
  return new Set(
    (supplier?.productScope ?? "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  );
}

function SupplierFields({
  mode,
  supplier,
  tagOptions,
}: {
  mode: "create" | "edit";
  supplier?: SupplierSetup;
  tagOptions: PurchasingTag[];
}) {
  const selectedScope = productScopeSet(supplier);

  return (
    <>
      <div className="grid gap-3 lg:grid-cols-[0.8fr_1.6fr_0.6fr_0.7fr_0.7fr]">
        <label className={labelClass}>
          Supplier Code
          <input
            className={inputClass}
            defaultValue={supplier?.supplierCode ?? ""}
            name="supplierCode"
            placeholder={mode === "create" ? "auto if blank" : undefined}
            readOnly={mode === "edit"}
          />
        </label>
        <label className={labelClass}>
          Supplier Name
          <input
            className={inputClass}
            defaultValue={supplier?.supplierName ?? ""}
            name="supplierName"
            placeholder="Supplier company name"
            required
          />
        </label>
        <label className={labelClass}>
          Currency
          <input
            className={inputClass}
            defaultValue={supplier?.currency ?? "THB"}
            name="currency"
            placeholder="THB"
          />
        </label>
        <label className={labelClass}>
          Safety Days
          <input
            className={inputClass}
            defaultValue={supplier?.safetyDays ?? 14}
            min="0"
            name="safetyDays"
            type="number"
          />
        </label>
        <label className={labelClass}>
          Lead Time
          <input
            className={inputClass}
            defaultValue={supplier?.leadTimeDays ?? 60}
            min="0"
            name="leadTimeDays"
            type="number"
          />
        </label>
      </div>

      <div className="grid gap-3 lg:grid-cols-4">
        <label className={labelClass}>
          Payment Terms
          <input
            className={inputClass}
            defaultValue={supplier?.paymentTerms ?? ""}
            name="paymentTerms"
            placeholder="deposit / balance / credit term"
          />
        </label>
        <label className={labelClass}>
          MOQ
          <input className={inputClass} defaultValue={supplier?.moq ?? ""} name="moq" />
        </label>
        <label className={labelClass}>
          Product Scope
          <input
            className={inputClass}
            defaultValue={supplier?.productScope ?? ""}
            name="productScope"
            placeholder="T-shirts, gloves, bags..."
          />
        </label>
        <label className={labelClass}>
          Contact Email
          <input
            className={inputClass}
            defaultValue={supplier?.contactEmail ?? ""}
            name="contactEmail"
            placeholder="supplier@email.com"
            type="email"
          />
        </label>
      </div>

      <div className="grid gap-2 rounded-lg border border-[#e2e7ed] bg-[#fbfcfd] p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64707d]">
            Add Scope Tags
          </p>
          <span className="text-xs font-medium text-[#667380]">
            From Tag Catalog, merged with Product Scope
          </span>
        </div>
        <div className="grid max-h-48 gap-2 overflow-auto sm:grid-cols-2 lg:grid-cols-4">
          {tagOptions.map((tag) => {
            const checked =
              selectedScope.has(tag.tag.toLowerCase()) ||
              selectedScope.has(tag.label.toLowerCase());
            return (
              <label
                className="flex min-h-9 items-center gap-2 rounded-md border border-[#dfe4ea] bg-white px-2 py-1 text-sm font-medium text-[#364252]"
                key={tag.tag}
                title={tag.description || tag.label}
              >
                <input
                  defaultChecked={checked}
                  name="supplierTag"
                  type="checkbox"
                  value={tag.tag}
                />
                <span className="truncate">{tag.label || tag.tag}</span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_0.5fr]">
        <label className={labelClass}>
          Bank
          <input className={inputClass} defaultValue={supplier?.bankName ?? ""} name="bankName" />
        </label>
        <label className={labelClass}>
          Account Name
          <input
            className={inputClass}
            defaultValue={supplier?.bankAccountName ?? ""}
            name="bankAccountName"
          />
        </label>
        <label className={labelClass}>
          Account No
          <input
            className={inputClass}
            defaultValue={supplier?.bankAccountNo ?? ""}
            name="bankAccountNo"
          />
        </label>
        <label className={labelClass}>
          Score
          <input
            className={inputClass}
            defaultValue={supplier?.profileScore ?? 0}
            min="0"
            name="profileScore"
            step="0.1"
            type="number"
          />
        </label>
      </div>

      <label className={labelClass}>
        Profile Note
        <input
          className={inputClass}
          defaultValue={supplier?.profileNote ?? ""}
          name="profileNote"
          placeholder="Reliability, quality, negotiation notes"
        />
      </label>
    </>
  );
}

export default async function PurchasingSetupPage() {
  const data = await getPurchasingSetupData();
  const activeTags = data.tags.filter((tag) => tag.isActive);
  const activeSuppliers = data.suppliers.filter((supplier) => supplier.isActive);
  const contactsBySupplier = new Map(
    data.suppliers.map((supplier) => [
      supplier.supplierCode,
      data.contacts.filter((contact) => contact.supplierCode === supplier.supplierCode),
    ]),
  );

  return (
    <main className="min-h-screen bg-[#f6f7f9] text-[#172026]">
      <header className="border-b border-[#d9dde3] bg-white">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-5 px-5 py-5 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64707d]">
              Purchasing Setup
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal">
              Suppliers & Tags Master
            </h1>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-[#52606d]">
              Controlled master data for supplier profiles, payment terms, bank
              details, contact people, default safety/lead time, and tag catalog
              used by Purchasing Decision Sheet.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Link className={secondaryButtonClass} href="/">
              <ArrowLeft size={16} />
              Dashboard
            </Link>
            <Link className={secondaryButtonClass} href="/purchasing-decision">
              <FileSpreadsheet size={16} />
              Purchasing Decision
            </Link>
            <Link className={secondaryButtonClass} href="/po">
              <ClipboardList size={16} />
              PO Portal
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1600px] gap-6 px-5 py-6 sm:px-8">
        {!data.setupReady ? (
          <section className="rounded-lg border border-[#f0d9aa] bg-[#fffaf0] p-4 text-sm text-[#6f5a31]">
            Apply `supabase/migrations/009_purchasing_setup_master.sql` in Supabase
            to enable saving bank/contact/tag setup. This page is showing fallback
            suppliers and Shopify tags until then.
          </section>
        ) : null}

        <section className="grid gap-3 md:grid-cols-4">
          {[
            ["Suppliers", data.suppliers.length, "all supplier profiles", Building2],
            ["Active", activeSuppliers.length, "selectable in planning", BadgeCheck],
            ["Contacts", data.contacts.length, "people by supplier", UserRound],
            ["Active tags", activeTags.length, "allowed sheet tags", Tags],
          ].map(([label, value, detail, Icon]) => {
            const CardIcon = Icon as typeof Building2;
            return (
              <article
                className="rounded-lg border border-[#dfe4ea] bg-white p-4 shadow-sm"
                key={String(label)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-[#5d6a78]">{String(label)}</p>
                    <p className="mt-2 text-3xl font-semibold">{String(value)}</p>
                  </div>
                  <span className="rounded-md bg-[#edf6fb] p-2 text-[#255f85]">
                    <CardIcon size={18} />
                  </span>
                </div>
                <p className="mt-2 text-sm text-[#667380]">{String(detail)}</p>
              </article>
            );
          })}
        </section>

        <section className={sectionClass}>
          <div className="border-b border-[#e2e7ed] p-5">
            <div className="flex items-center gap-2">
              <Plus size={18} />
              <h2 className="text-lg font-semibold">Add Supplier</h2>
            </div>
            <p className="mt-1 text-sm text-[#667380]">
              Add a new supplier once, then reuse it in Purchasing Decision and PO creation.
            </p>
          </div>
          <form action={saveSupplierSetupAction} className="grid gap-4 p-5">
            <SupplierFields mode="create" tagOptions={activeTags} />
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#edf1f5] pt-4">
              <label className="flex items-center gap-2 text-sm font-semibold text-[#52606d]">
                <input defaultChecked name="isActive" type="checkbox" />
                Active supplier
              </label>
              <PendingSubmitButton className={buttonClass} loadingText="Adding...">
                Add Supplier
              </PendingSubmitButton>
            </div>
          </form>
        </section>

        <section className={sectionClass}>
          <div className="border-b border-[#e2e7ed] p-5">
            <h2 className="text-lg font-semibold">Supplier Profiles</h2>
            <p className="mt-1 text-sm text-[#667380]">
              Each supplier is collapsed for scanning. Open a row only when you need to edit
              profile, banking, planning defaults, or contacts.
            </p>
          </div>
          <div className="divide-y divide-[#edf1f5]">
            {data.suppliers.map((supplier) => {
              const contacts = contactsBySupplier.get(supplier.supplierCode) ?? [];
              return (
                <details className="group" key={supplier.supplierCode}>
                  <summary className="grid cursor-pointer gap-3 px-5 py-4 hover:bg-[#fbfcfd] lg:grid-cols-[minmax(280px,1.4fr)_0.8fr_0.6fr_0.7fr_0.6fr_auto] lg:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-base font-semibold">
                          {supplier.supplierName}
                        </p>
                        <span className="rounded-md bg-[#eef4f8] px-2 py-1 font-mono text-xs font-semibold text-[#255f85]">
                          {supplier.supplierCode}
                        </span>
                        <span
                          className={`rounded-md px-2 py-1 text-xs font-semibold ${supplierStatusClass(
                            supplier.isActive,
                          )}`}
                        >
                          {supplier.isActive ? "active" : "inactive"}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-sm text-[#667380]">
                        {supplierSubtitle(supplier) || "No scope, payment, or email yet"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-[#52606d]">
                      <Landmark size={15} />
                      <span>{supplier.bankName || "No bank"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-[#52606d]">
                      <Mail size={15} />
                      <span>{contacts.length} contacts</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-[#52606d]">
                      <Clock3 size={15} />
                      <span>
                        {supplier.safetyDays}d safety / {supplier.leadTimeDays}d lead
                      </span>
                    </div>
                    <div className="text-sm font-semibold text-[#52606d]">
                      {supplier.currency || "THB"}
                    </div>
                    <span className="text-sm font-semibold text-[#255f85] group-open:hidden">
                      Edit
                    </span>
                    <span className="hidden text-sm font-semibold text-[#255f85] group-open:inline">
                      Close
                    </span>
                  </summary>

                  <div className="grid gap-4 border-t border-[#edf1f5] bg-[#fbfcfd] p-5">
                    <form action={saveSupplierSetupAction} className="grid gap-4 rounded-lg border border-[#e2e7ed] bg-white p-4">
                      <SupplierFields mode="edit" supplier={supplier} tagOptions={activeTags} />
                      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#edf1f5] pt-4">
                        <label className="flex items-center gap-2 text-sm font-semibold text-[#52606d]">
                          <input defaultChecked={supplier.isActive} name="isActive" type="checkbox" />
                          Active supplier
                        </label>
                        <PendingSubmitButton className={buttonClass} loadingText="Saving...">
                          Save Supplier
                        </PendingSubmitButton>
                      </div>
                    </form>

                    <div className="rounded-lg border border-[#e2e7ed] bg-white p-4">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-semibold">Contacts</h3>
                        <span className="rounded-md bg-[#f3f5f7] px-2 py-1 text-xs font-semibold text-[#52606d]">
                          {contacts.length}
                        </span>
                      </div>
                      <div className="mt-3 grid gap-2 lg:grid-cols-2">
                        {contacts.length > 0 ? (
                          contacts.map((contact) => (
                            <div className="grid gap-1 rounded-md border border-[#edf1f5] bg-[#fbfcfd] px-3 py-2 text-sm" key={contact.id}>
                              <p className="font-semibold">
                                {contact.contactName}
                                {contact.isPrimary ? " / Primary" : ""}
                              </p>
                              <p className="text-[#667380]">
                                {contact.department || "No department"}
                                {contact.email ? ` / ${contact.email}` : ""}
                                {contact.phone ? ` / ${contact.phone}` : ""}
                                {contact.lineId ? ` / Line ${contact.lineId}` : ""}
                              </p>
                              {contact.note ? <p>{contact.note}</p> : null}
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-[#667380]">No contacts yet.</p>
                        )}
                      </div>
                      <form action={addSupplierContactAction} className="mt-4 grid gap-2 lg:grid-cols-[1fr_1fr_1fr_1fr_1fr_auto]">
                        <input name="supplierCode" type="hidden" value={supplier.supplierCode} />
                        <input className={smallInputClass} name="contactName" placeholder="Name" required />
                        <input className={smallInputClass} name="department" placeholder="Department / role" />
                        <input className={smallInputClass} name="email" placeholder="Email" type="email" />
                        <input className={smallInputClass} name="phone" placeholder="Phone" />
                        <input className={smallInputClass} name="lineId" placeholder="Line ID" />
                        <PendingSubmitButton
                          className="inline-flex h-9 items-center justify-center rounded-md bg-[#172026] px-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                          loadingText="Adding..."
                        >
                          Add Contact
                        </PendingSubmitButton>
                        <label className="flex items-center gap-2 text-xs font-semibold text-[#52606d] lg:col-span-2">
                          <input name="isPrimary" type="checkbox" />
                          Primary contact
                        </label>
                        <input className={`${smallInputClass} lg:col-span-4`} name="note" placeholder="Contact note" />
                      </form>
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        </section>

        <section className={sectionClass}>
          <div className="border-b border-[#e2e7ed] p-5">
            <div className="flex items-center gap-2">
              <Tags size={18} />
              <h2 className="text-lg font-semibold">Tag Catalog</h2>
            </div>
            <p className="mt-1 text-sm text-[#667380]">
              These are the only active tags selectable in Purchasing Decision Sheet.
            </p>
          </div>
          <div className="grid gap-5 p-5 xl:grid-cols-[0.7fr_1.3fr]">
            <form action={savePurchasingTagAction} className="grid gap-3 rounded-lg border border-[#e2e7ed] bg-[#fbfcfd] p-4">
              <label className={labelClass}>
                Tag key
                <input className={inputClass} name="tag" placeholder="e.g. core, event, high_margin" required />
              </label>
              <label className={labelClass}>
                Label
                <input className={inputClass} name="label" placeholder="Display label" />
              </label>
              <label className={labelClass}>
                Category
                <input className={inputClass} name="category" placeholder="planning / supplier / commercial" />
              </label>
              <label className={labelClass}>
                Description
                <input className={inputClass} name="description" placeholder="When to use this tag" />
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold text-[#52606d]">
                <input defaultChecked name="isActive" type="checkbox" />
                Active tag
              </label>
              <PendingSubmitButton className={buttonClass} loadingText="Saving...">
                Save Tag
              </PendingSubmitButton>
            </form>
            <div className="max-h-[560px] overflow-auto rounded-lg border border-[#e2e7ed]">
              <table className="min-w-full text-left text-sm">
                <thead className="sticky top-0 bg-[#f3f5f7] text-xs uppercase tracking-[0.12em] text-[#65717f]">
                  <tr>
                    <th className="px-3 py-3 font-semibold">Tag</th>
                    <th className="px-3 py-3 font-semibold">Category</th>
                    <th className="px-3 py-3 font-semibold">Description</th>
                    <th className="px-3 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf1f5] bg-white">
                  {data.tags.map((tag) => (
                    <tr key={tag.tag}>
                      <td className="px-3 py-3">
                        <p className="font-semibold">{tag.label}</p>
                        <p className="font-mono text-xs text-[#667380]">{tag.tag}</p>
                      </td>
                      <td className="px-3 py-3">{tag.category}</td>
                      <td className="px-3 py-3 text-[#52606d]">{tag.description || "-"}</td>
                      <td className="px-3 py-3">
                        <span className={`rounded-md px-2 py-1 text-xs font-semibold ${supplierStatusClass(tag.isActive)}`}>
                          {tag.isActive ? "active" : "inactive"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
