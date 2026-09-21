import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, ClipboardCheck, Plus } from "lucide-react";
import { createStockCountSessionAction } from "@/app/stock-count/actions";
import { StockCountEditor } from "@/app/stock-count/stock-count-editor";
import { PoSidebarNav } from "@/app/po/sidebar-nav";
import { PendingSubmitButton } from "@/app/loading-controls";
import { requireUser } from "@/lib/auth";
import {
  canAccessStockCounts,
  canEditStockCountLocation,
  currentWeekStart,
  getStockCountSession,
  listStockCountSessions,
  type StockCountLocation,
} from "@/lib/stock-counts";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ session?: string }>;
};

const locationLabels: Record<StockCountLocation, string> = {
  warehouse: "Warehouse Stock",
  retail: "Retail Stock",
};

function statusClass(status: string) {
  return status === "completed"
    ? "bg-[#e7f5ec] text-[#1f6b3d]"
    : "bg-[#fff4da] text-[#7b5a16]";
}

export default async function StockCountPage({ searchParams }: PageProps) {
  const profile = await requireUser("/stock-count");
  if (!canAccessStockCounts(profile)) redirect("/access-denied?from=%2Fstock-count");
  const query = await searchParams;
  const sessions = await listStockCountSessions();
  const selectedId = query.session ?? sessions[0]?.id;
  const selected = selectedId ? await getStockCountSession(selectedId) : null;
  const weekStart = currentWeekStart();

  return (
    <div className="min-h-screen bg-[#f3f5f7] text-[#172026] lg:grid lg:grid-cols-[220px_minmax(0,1fr)]">
      <PoSidebarNav active="stock-count" />
      <main className="min-w-0">
        <header className="border-b border-[#d9dde3] bg-white">
          <div className="mx-auto flex max-w-[1800px] flex-col gap-4 px-5 py-5 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64707d]">Weekly Inventory Control</p>
              <h1 className="mt-2 text-3xl font-semibold">Weekly Stock Count</h1>
              <p className="mt-2 text-sm text-[#52606d]">Separate warehouse and retail counts. Catalog only—no current system quantity is shown or loaded.</p>
            </div>
            <Link className="inline-flex h-10 items-center justify-center rounded-md border border-[#cfd6df] bg-white px-4 text-sm font-semibold text-[#364252]" href="/po">
              Back to PO Portal
            </Link>
          </div>
        </header>

        <div className="mx-auto grid max-w-[1800px] gap-5 px-5 py-6 sm:px-8">
          <section className="grid gap-4 xl:grid-cols-2">
            {(["warehouse", "retail"] as const).map((location) => {
              const latest = sessions.find((session) => session.locationType === location);
              const canEdit = canEditStockCountLocation(profile, location);
              return (
                <article className="rounded-lg border border-[#dfe4ea] bg-white p-5 shadow-sm" key={location}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2"><ClipboardCheck size={18} /><h2 className="text-lg font-semibold">{locationLabels[location]}</h2></div>
                      <p className="mt-2 text-sm text-[#667380]">One saved count per week, with independent history.</p>
                    </div>
                    {latest ? <Link className="text-sm font-semibold text-[#255f85]" href={`/stock-count?session=${latest.id}`}>Open latest</Link> : null}
                  </div>
                  {canEdit ? (
                    <form action={createStockCountSessionAction} className="mt-4 flex flex-wrap items-end gap-2 rounded-md bg-[#f7f9fb] p-3">
                      <input name="location" type="hidden" value={location} />
                      <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#64707d]">
                        Week starting Monday
                        <input className="h-10 rounded-md border border-[#cfd6df] bg-white px-3 text-sm" defaultValue={weekStart} name="weekStart" type="date" />
                      </label>
                      <PendingSubmitButton className="inline-flex h-10 items-center gap-2 rounded-md bg-[#172026] px-4 text-sm font-semibold text-white" loadingText="Creating...">
                        <Plus size={16} /> Create / Open Week
                      </PendingSubmitButton>
                    </form>
                  ) : null}
                </article>
              );
            })}
          </section>

          <section className="rounded-lg border border-[#dfe4ea] bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-[#e2e7ed] px-5 py-4"><CalendarDays size={18} /><h2 className="font-semibold">Count History</h2></div>
            <div className="flex gap-2 overflow-x-auto p-4">
              {sessions.length ? sessions.map((session) => (
                <Link
                  className={`min-w-52 rounded-md border px-3 py-2 text-sm ${selected?.session.id === session.id ? "border-[#255f85] bg-[#edf6fb]" : "border-[#dfe4ea] bg-white"}`}
                  href={`/stock-count?session=${session.id}`}
                  key={session.id}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{locationLabels[session.locationType]}</span>
                    <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${statusClass(session.status)}`}>{session.status}</span>
                  </div>
                  <p className="mt-1 text-xs text-[#667380]">Week of {session.weekStart} · {session.countedLines}/{session.totalLines}</p>
                </Link>
              )) : <p className="text-sm text-[#667380]">No weekly counts yet. Create the first warehouse or retail week above.</p>}
            </div>
          </section>

          {selected ? (
            <section className="grid gap-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#64707d]">{locationLabels[selected.session.locationType]}</p>
                  <h2 className="mt-1 text-2xl font-semibold">Week of {selected.session.weekStart}</h2>
                </div>
                <span className={`rounded-md px-3 py-1.5 text-xs font-bold uppercase ${statusClass(selected.session.status)}`}>{selected.session.status}</span>
              </div>
              <StockCountEditor
                canEdit={canEditStockCountLocation(profile, selected.session.locationType)}
                lines={selected.lines}
                session={selected.session}
              />
            </section>
          ) : null}
        </div>
      </main>
    </div>
  );
}
