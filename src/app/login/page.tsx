import { redirect } from "next/navigation";
import { LoginForm } from "@/app/login/login-form";
import { getCurrentUserProfile } from "@/lib/auth";
import { defaultLandingForUser } from "@/lib/role-nav";

export const dynamic = "force-dynamic";

function safeNextPath(value: string | undefined) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  const profile = await getCurrentUserProfile();

  if (profile?.isActive) {
    redirect(next || defaultLandingForUser(profile));
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f7f9] px-5 py-10 text-[#172026]">
      <section className="w-full max-w-md rounded-lg border border-[#dfe4ea] bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64707d]">
          Purchasing Control Room
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-normal">Sign in</h1>
        <p className="mt-2 text-sm leading-6 text-[#52606d]">
          Use your approved company account to access PO and purchasing tools.
        </p>
        <div className="mt-6">
          <LoginForm next={next} />
        </div>
      </section>
    </main>
  );
}
