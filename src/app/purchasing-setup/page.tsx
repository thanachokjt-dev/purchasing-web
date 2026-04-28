import Link from "next/link";
import { ArrowLeft, ClipboardList, FileSpreadsheet, Tags } from "lucide-react";
import {
  addSupplierContactAction,
  savePurchasingTagAction,
  saveSupplierSetupAction,
} from "@/app/purchasing-setup/actions";
import { getPurchasingSetupData } from "@/lib/purchasing-setup";

export const dynamic = "force-dynamic";

const inputClass =
  "h-10 rounded-md border border-[#cfd6df] bg-white px-3 text-sm text-[#172026] outline-none focus:border-[#255f85]";
const smallInputClass =
  "h-9 rounded-md border border-[#cfd6df] bg-white px-2 text-sm text-[#172026] outline-none focus:border-[#255f85]";
const labelClass = "grid gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#64707d]";
const buttonClass =
  "inline-flex h-10 items-center justify-center rounded-md bg-[#172026] px-4 text-sm font-semibold text-white";

export default async function PurchasingSetupPage() {
  const data = await getPurchasingSetupData();
  const activeTags = data.tags.filter((tag) => tag.isActive);
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
            <Link
              className="inline-flex h-10 items-center gap-2 rounded-md border border-[#cfd6df] bg-[#f9fafb] px-3 font-medium text-[#364252]"
              href="/"
            >
              <ArrowLeft size={16} />
              Dashboard
            </Link>
            <Link
              className="inline-flex h-10 items-center gap-2 rounded-md border border-[#cfd6df] bg-[#f9fafb] px-3 font-medium text-[#364252]"
              href="/purchasing-decision"
            >
              <FileSpreadsheet size={16} />
              Purchasing Decision
            </Link>
            <Link
              className="inline-flex h-10 items-center gap-2 rounded-md border border-[#cfd6df] bg-[#f9fafb] px-3 font-medium text-[#364252]"
              href="/po"
            >
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

        <section className="grid gap-3 md:grid-cols-3">
          {[
            ["Suppliers", data.suppliers.length, "master supplier profiles"],
            ["Contacts", data.contacts.length, "people by supplier"],
            ["Active tags", activeTags.length, "allowed sheet tags"],
          ].map(([label, value, detail]) => (
            <article
              className="rounded-lg border border-[#dfe4ea] bg-white p-4 shadow-sm"
              key={label}
            >
              <p className="text-sm font-medium text-[#5d6a78]">{label}</p>
              <p className="mt-2 text-3xl font-semibold">{value}</p>
              <p className="mt-2 text-sm text-[#667380]">{detail}</p>
            </article>
          ))}
        </section>

        <section className="rounded-lg border border-[#dfe4ea] bg-white shadow-sm">
          <div className="border-b border-[#e2e7ed] p-5">
            <h2 className="text-lg font-semibold">Supplier Profiles</h2>
            <p className="mt-1 text-sm text-[#667380]">
              Safety and lead time here become the default for matching supplier
              rows in Purchasing Decision Sheet. SKU rows can still override them.
            </p>
          </div>
          <div className="divide-y divide-[#edf1f5]">
            {data.suppliers.map((supplier) => {
              const contacts = contactsBySupplier.get(supplier.supplierCode) ?? [];
              return (
                <article className="grid gap-4 p-5" key={supplier.supplierCode}>
                  <form action={saveSupplierSetupAction} className="grid gap-3">
                    <div className="grid gap-3 lg:grid-cols-[0.8fr_1.4fr_0.5fr_0.7fr_0.7fr]">
                      <label className={labelClass}>
                        Code
                        <input
                          className={inputClass}
                          name="supplierCode"
                          readOnly
                          value={supplier.supplierCode}
                        />
                      </label>
                      <label className={labelClass}>
                        Supplier Name
                        <input
                          className={inputClass}
                          defaultValue={supplier.supplierName}
                          name="supplierName"
                          required
                        />
                      </label>
                      <label className={labelClass}>
                        Currency
                        <input className={inputClass} defaultValue={supplier.currency} name="currency" />
                      </label>
                      <label className={labelClass}>
                        Safety Days
                        <input className={inputClass} defaultValue={supplier.safetyDays} min="0" name="safetyDays" type="number" />
                      </label>
                      <label className={labelClass}>
                        Lead Time
                        <input className={inputClass} defaultValue={supplier.leadTimeDays} min="0" name="leadTimeDays" type="number" />
                      </label>
                    </div>
                    <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_1fr]">
                      <label className={labelClass}>
                        Bank
                        <input className={inputClass} defaultValue={supplier.bankName} name="bankName" />
                      </label>
                      <label className={labelClass}>
                        Account Name
                        <input className={inputClass} defaultValue={supplier.bankAccountName} name="bankAccountName" />
                      </label>
                      <label className={labelClass}>
                        Account No
                        <input className={inputClass} defaultValue={supplier.bankAccountNo} name="bankAccountNo" />
                      </label>
                      <label className={labelClass}>
                        Contact Email
                        <input className={inputClass} defaultValue={supplier.contactEmail} name="contactEmail" type="email" />
                      </label>
                    </div>
                    <div className="grid gap-3 lg:grid-cols-[1.2fr_0.7fr_1.2fr_1.4fr_auto]">
                      <label className={labelClass}>
                        Payment Terms
                        <input className={inputClass} defaultValue={supplier.paymentTerms} name="paymentTerms" />
                      </label>
                      <label className={labelClass}>
                        MOQ
                        <input className={inputClass} defaultValue={supplier.moq} name="moq" />
                      </label>
                      <label className={labelClass}>
                        Product Scope
                        <input className={inputClass} defaultValue={supplier.productScope} name="productScope" />
                      </label>
                      <label className={labelClass}>
                        Profile Note
                        <input className={inputClass} defaultValue={supplier.profileNote} name="profileNote" />
                      </label>
                      <label className={`${labelClass} min-w-28`}>
                        Score
                        <input className={inputClass} defaultValue={supplier.profileScore} min="0" name="profileScore" step="0.1" type="number" />
                      </label>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <label className="flex items-center gap-2 text-sm font-semibold text-[#52606d]">
                        <input defaultChecked={supplier.isActive} name="isActive" type="checkbox" />
                        Active supplier
                      </label>
                      <button className={buttonClass} type="submit">
                        Save Supplier
                      </button>
                    </div>
                  </form>

                  <div className="rounded-lg border border-[#e2e7ed] bg-[#fbfcfd] p-4">
                    <h3 className="text-sm font-semibold">Contacts</h3>
                    <div className="mt-3 grid gap-2">
                      {contacts.length > 0 ? (
                        contacts.map((contact) => (
                          <div className="grid gap-1 rounded-md bg-white px-3 py-2 text-sm" key={contact.id}>
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
                      <button className="h-9 rounded-md bg-[#172026] px-3 text-xs font-semibold text-white" type="submit">
                        Add Contact
                      </button>
                      <label className="flex items-center gap-2 text-xs font-semibold text-[#52606d] lg:col-span-2">
                        <input name="isPrimary" type="checkbox" />
                        Primary contact
                      </label>
                      <input className={`${smallInputClass} lg:col-span-4`} name="note" placeholder="Contact note" />
                    </form>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="rounded-lg border border-[#dfe4ea] bg-white shadow-sm">
          <div className="border-b border-[#e2e7ed] p-5">
            <div className="flex items-center gap-2">
              <Tags size={18} />
              <h2 className="text-lg font-semibold">Tag Catalog</h2>
            </div>
            <p className="mt-1 text-sm text-[#667380]">
              These are the only active tags selectable in Purchasing Decision Sheet.
            </p>
          </div>
          <div className="grid gap-5 p-5 xl:grid-cols-[0.8fr_1.2fr]">
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
              <button className={buttonClass} type="submit">
                Save Tag
              </button>
            </form>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[#f3f5f7] text-xs uppercase tracking-[0.12em] text-[#65717f]">
                  <tr>
                    <th className="px-3 py-3 font-semibold">Tag</th>
                    <th className="px-3 py-3 font-semibold">Category</th>
                    <th className="px-3 py-3 font-semibold">Description</th>
                    <th className="px-3 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf1f5]">
                  {data.tags.map((tag) => (
                    <tr key={tag.tag}>
                      <td className="px-3 py-3">
                        <p className="font-semibold">{tag.label}</p>
                        <p className="font-mono text-xs text-[#667380]">{tag.tag}</p>
                      </td>
                      <td className="px-3 py-3">{tag.category}</td>
                      <td className="px-3 py-3 text-[#52606d]">{tag.description || "-"}</td>
                      <td className="px-3 py-3">
                        <span className={`rounded-md px-2 py-1 text-xs font-semibold ${tag.isActive ? "bg-[#eaf6ef] text-[#1f6b3d]" : "bg-[#eef0f3] text-[#5c6670]"}`}>
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
