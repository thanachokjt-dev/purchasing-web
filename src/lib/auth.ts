import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

export const AUTH_ACCESS_COOKIE = "rp_access_token";
export const AUTH_REFRESH_COOKIE = "rp_refresh_token";

export const USER_ROLES = [
  "super_admin",
  "final_approver",
  "preliminary_approver",
  "reviewer",
  "retail_manager",
  "accounting",
  "viewer",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export type CurrentUserProfile = {
  authUserId: string;
  displayName: string;
  email: string;
  isActive: boolean;
  role: UserRole;
};

type UserProfileRow = {
  auth_user_id: string | null;
  display_name: string | null;
  email: string;
  id: string;
  is_active: boolean | null;
  role: string | null;
};

const cookieOptions = {
  httpOnly: true,
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

function normalizeRole(role: string | null | undefined): UserRole {
  return USER_ROLES.includes(role as UserRole) ? (role as UserRole) : "viewer";
}

function mapProfile(userId: string, profile: UserProfileRow): CurrentUserProfile {
  return {
    authUserId: profile.auth_user_id ?? userId,
    displayName: profile.display_name ?? "",
    email: profile.email,
    isActive: profile.is_active ?? true,
    role: normalizeRole(profile.role),
  };
}

function getAuthClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return null;
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

export async function setAuthCookies(session: {
  access_token: string;
  expires_in?: number;
  refresh_token: string;
}) {
  const store = await cookies();

  store.set(AUTH_ACCESS_COOKIE, session.access_token, {
    ...cookieOptions,
    maxAge: session.expires_in ?? 60 * 60,
  });
  store.set(AUTH_REFRESH_COOKIE, session.refresh_token, {
    ...cookieOptions,
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearAuthCookies() {
  const store = await cookies();
  store.delete(AUTH_ACCESS_COOKIE);
  store.delete(AUTH_REFRESH_COOKIE);
}

export async function signInWithPassword(email: string, password: string) {
  const client = getAuthClient();

  if (!client) {
    return { error: "Supabase auth environment variables are missing." };
  }

  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session || !data.user.email) {
    return { error: error?.message ?? "Unable to sign in." };
  }

  await setAuthCookies(data.session);

  return { error: "", userId: data.user.id };
}

export async function getCurrentUserProfile(): Promise<CurrentUserProfile | null> {
  const store = await cookies();
  const accessToken = store.get(AUTH_ACCESS_COOKIE)?.value;

  if (!accessToken) {
    return null;
  }

  const authClient = getAuthClient();
  const supabase = getSupabaseServiceClient();

  if (!authClient || !supabase) {
    return null;
  }

  const { data: userData, error: userError } = await authClient.auth.getUser(accessToken);
  const user = userData.user;

  if (userError || !user?.email) {
    return null;
  }

  const selectProfile = "id, auth_user_id, display_name, email, is_active, role";
  const { data: profileByAuthId } = await supabase
    .from("user_profiles")
    .select(selectProfile)
    .eq("auth_user_id", user.id)
    .maybeSingle<UserProfileRow>();

  if (profileByAuthId) {
    return mapProfile(user.id, profileByAuthId);
  }

  const { data: profileByEmail } = await supabase
    .from("user_profiles")
    .select(selectProfile)
    .eq("email", user.email.toLowerCase())
    .maybeSingle<UserProfileRow>();

  if (!profileByEmail) {
    return {
      authUserId: user.id,
      displayName: "",
      email: user.email,
      isActive: false,
      role: "viewer",
    };
  }

  return mapProfile(user.id, profileByEmail);
}

export async function requireUser(nextPath: string) {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  if (!profile.isActive) {
    redirect("/inactive");
  }

  return profile;
}

export async function updateCurrentUserPassword(password: string) {
  const profile = await getCurrentUserProfile();
  const supabase = getSupabaseServiceClient();

  if (!profile || !supabase) {
    return { error: "Please sign in again before changing your password." };
  }

  const { error } = await supabase.auth.admin.updateUserById(profile.authUserId, {
    password,
  });

  return { error: error?.message ?? "" };
}
