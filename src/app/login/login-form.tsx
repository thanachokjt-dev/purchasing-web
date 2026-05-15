"use client";

import { useActionState } from "react";
import { loginAction, type AuthActionState } from "@/app/auth/actions";

const initialState: AuthActionState = {
  error: "",
  success: "",
};

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="grid gap-4">
      <input name="next" type="hidden" value={next} />
      <label className="grid gap-1 text-sm font-semibold text-[#364252]">
        Email
        <input
          autoComplete="email"
          className="h-11 rounded-md border border-[#cfd6df] bg-white px-3 text-sm outline-none focus:border-[#255f85]"
          name="email"
          required
          type="email"
        />
      </label>
      <label className="grid gap-1 text-sm font-semibold text-[#364252]">
        Password
        <input
          autoComplete="current-password"
          className="h-11 rounded-md border border-[#cfd6df] bg-white px-3 text-sm outline-none focus:border-[#255f85]"
          minLength={6}
          name="password"
          required
          type="password"
        />
      </label>
      {state.error ? (
        <p className="rounded-md border border-[#ffd6d6] bg-[#fff5f5] px-3 py-2 text-sm font-medium text-[#b42318]">
          {state.error}
        </p>
      ) : null}
      <button
        className="h-11 rounded-md bg-[#172026] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
