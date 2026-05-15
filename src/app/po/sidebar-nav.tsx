import Link from "next/link";
import { getCurrentUserProfile } from "@/lib/auth";
import { navItemsForUser } from "@/lib/role-nav";

type SidebarNavKey = "po" | "reorder" | string;

export async function PoSidebarNav({ active }: { active: SidebarNavKey }) {
  const profile = await getCurrentUserProfile();
  const navItems = profile ? navItemsForUser(profile) : [];

  return (
    <aside className="sticky top-0 hidden h-screen self-start overflow-y-auto bg-[#0d233f] text-white lg:block">
      <nav className="flex min-h-full flex-col gap-1 px-3 py-4 text-[13px]">
        <div className="mb-3 rounded-lg bg-white/8 px-3 py-3">
          <p className="text-sm font-semibold">PO Portal</p>
          <p className="mt-1 text-[11px] text-slate-300">
            Procurement Control Tower
          </p>
        </div>
        {navItems.map((item) => (
          <Link
            className={`block rounded-md px-2.5 py-1.5 font-medium ${
              item.key === active
                ? "bg-white text-[#0d233f] shadow-sm"
                : "text-slate-300 hover:bg-white/10 hover:text-white"
            }`}
            href={item.href}
            key={`${item.href}-${item.label}`}
            prefetch={false}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
