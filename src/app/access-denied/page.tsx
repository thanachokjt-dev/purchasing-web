import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { defaultLandingForRole, roleLabel } from "@/lib/role-nav";

export const dynamic = "force-dynamic";

export default async function AccessDeniedPage() {
  const profile = await requireUser("/access-denied");
  const landing = defaultLandingForRole(profile.role);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f7f9] px-5 py-10 text-[#172026]">
      <section className="w-full max-w-lg rounded-lg border border-[#dfe4ea] bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64707d]">
          Access denied
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-normal">
          This page is not available for your role.
        </h1>
        <p className="mt-3 text-sm leading-6 text-[#52606d]">
          You are signed in as {profile.displayName || profile.email} with role{" "}
          <span className="font-semibold">{roleLabel(profile.role)}</span>.
        </p>
        <Link
          className="mt-5 inline-flex rounded-md bg-[#172026] px-4 py-2 text-sm font-semibold text-white"
          href={landing}
        >
          Go to My Workbench
        </Link>
      </section>
    </main>
  );
}
