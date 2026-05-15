import Link from "next/link";
import { ChangePasswordForm } from "@/app/account/change-password/change-password-form";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  await requireUser("/account/change-password");

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f7f9] px-5 py-10 text-[#172026]">
      <section className="w-full max-w-md rounded-lg border border-[#dfe4ea] bg-white p-6 shadow-sm">
        <Link className="text-sm font-semibold text-[#255f85]" href="/po">
          Back to PO Portal
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-normal">Change Password</h1>
        <p className="mt-2 text-sm leading-6 text-[#52606d]">
          Choose a new password with at least 6 characters.
        </p>
        <div className="mt-6">
          <ChangePasswordForm />
        </div>
      </section>
    </main>
  );
}
