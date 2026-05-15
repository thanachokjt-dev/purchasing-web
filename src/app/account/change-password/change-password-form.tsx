"use client";

import { useActionState } from "react";
import { changePasswordAction, type AuthActionState } from "@/app/auth/actions";

const initialState: AuthActionState = {
  error: "",
  success: "",
};

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePasswordAction, initialState);

  return (
    <form action={formAction} className="grid gap-4">
      <label className="grid gap-1 text-sm font-semibold text-[#364252]">
        New password
        <input
          autoComplete="new-password"
          className="h-11 rounded-md border border-[#cfd6df] bg-white px-3 text-sm outline-none focus:border-[#255f85]"
          minLength={6}
          name="password"
          required
          type="password"
        />
      </label>
      <label className="grid gap-1 text-sm font-semibold text-[#364252]">
        Confirm new password
        <input
          autoComplete="new-password"
          className="h-11 rounded-md border border-[#cfd6df] bg-white px-3 text-sm outline-none focus:border-[#255f85]"
          minLength={6}
          name="confirmPassword"
          required
          type="password"
        />
      </label>
      {state.error ? (
        <p className="rounded-md border border-[#ffd6d6] bg-[#fff5f5] px-3 py-2 text-sm font-medium text-[#b42318]">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="rounded-md border border-[#cdebd8] bg-[#f0fbf4] px-3 py-2 text-sm font-medium text-[#1f6b3d]">
          {state.success}
        </p>
      ) : null}
      <button
        className="h-11 rounded-md bg-[#172026] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Saving..." : "Change password"}
      </button>
    </form>
  );
}
