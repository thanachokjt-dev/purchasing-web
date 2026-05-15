import Link from "next/link";
import { logoutAction } from "@/app/auth/actions";
import { getCurrentUserProfile } from "@/lib/auth";
import { defaultLandingForRole, navItemsForRole, roleLabel } from "@/lib/role-nav";

export async function AccountMenu() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    return null;
  }

  return (
    <div className="fixed right-4 top-4 z-40 text-sm print:hidden">
      <details className="group rounded-md border border-[#cfd6df] bg-white shadow-sm">
        <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-3 py-2 font-semibold text-[#172026] hover:bg-[#f7f9fb]">
          Account
          <span className="text-xs text-[#667380]">{roleLabel(profile.role)}</span>
        </summary>
        <div className="w-72 border-t border-[#edf1f5] p-3">
          <p className="font-semibold text-[#172026]">
            {profile.displayName || profile.email}
          </p>
          {profile.displayName ? (
            <p className="mt-1 break-words text-xs text-[#667380]">{profile.email}</p>
          ) : null}
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#667380]">
            {roleLabel(profile.role)}
          </p>
          <div className="mt-3 grid gap-2">
            <Link
              className="rounded-md border border-[#cfd6df] px-3 py-2 font-semibold text-[#364252] hover:bg-[#f7f9fb]"
              href={defaultLandingForRole(profile.role)}
            >
              My Workbench
            </Link>
            <div className="grid gap-1 border-t border-[#edf1f5] pt-2">
              {navItemsForRole(profile.role).map((item) => (
                <Link
                  className="rounded-md px-3 py-1.5 text-sm font-semibold text-[#364252] hover:bg-[#f7f9fb]"
                  href={item.href}
                  key={`${item.key}-${item.href}`}
                  prefetch={false}
                >
                  {item.label}
                </Link>
              ))}
            </div>
            <Link
              className="rounded-md border border-[#cfd6df] px-3 py-2 font-semibold text-[#364252] hover:bg-[#f7f9fb]"
              href="/account/change-password"
            >
              Change Password
            </Link>
            <form action={logoutAction}>
              <button
                className="w-full rounded-md border border-[#cfd6df] px-3 py-2 text-left font-semibold text-[#364252] hover:bg-[#f7f9fb]"
                type="submit"
              >
                Logout
              </button>
            </form>
          </div>
        </div>
      </details>
    </div>
  );
}
