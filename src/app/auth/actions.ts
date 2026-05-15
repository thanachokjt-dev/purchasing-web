"use server";

import { redirect } from "next/navigation";
import {
  clearAuthCookies,
  getCurrentUserProfile,
  signInWithPassword,
  updateCurrentUserPassword,
} from "@/lib/auth";
import { defaultLandingForUser } from "@/lib/role-nav";

export type AuthActionState = {
  error: string;
  success: string;
};

const emptyState: AuthActionState = {
  error: "",
  success: "",
};

function safeNextPath(value: FormDataEntryValue | null) {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : "";
}

export async function loginAction(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const requestedNext = safeNextPath(formData.get("next"));

  if (!email || !password) {
    return { ...emptyState, error: "Enter your email and password." };
  }

  const result = await signInWithPassword(email, password);

  if (result.error) {
    return { ...emptyState, error: result.error };
  }

  const profile = await getCurrentUserProfile();
  const roleLanding = profile ? defaultLandingForUser(profile) : "/login";
  redirect(requestedNext || roleLanding);
}

export async function logoutAction() {
  await clearAuthCookies();
  redirect("/login");
}

export async function changePasswordAction(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (password.length < 6) {
    return { ...emptyState, error: "Password must be at least 6 characters." };
  }

  if (password !== confirmPassword) {
    return { ...emptyState, error: "Passwords do not match." };
  }

  const result = await updateCurrentUserPassword(password);

  if (result.error) {
    return { ...emptyState, error: result.error };
  }

  return {
    error: "",
    success: "Password changed. You can keep working in this session.",
  };
}
