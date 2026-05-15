import { logoutAction } from "@/app/auth/actions";

export const dynamic = "force-dynamic";

export default function InactiveAccountPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f7f9] px-5 py-10 text-[#172026]">
      <section className="w-full max-w-md rounded-lg border border-[#dfe4ea] bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-normal">Account inactive</h1>
        <p className="mt-2 text-sm leading-6 text-[#52606d]">
          Your account exists, but it is not active for this purchasing app.
          Please contact an administrator.
        </p>
        <form action={logoutAction} className="mt-6">
          <button
            className="h-10 rounded-md bg-[#172026] px-4 text-sm font-semibold text-white"
            type="submit"
          >
            Sign out
          </button>
        </form>
      </section>
    </main>
  );
}
