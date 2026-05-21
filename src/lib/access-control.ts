import "server-only";

import type { CurrentUserProfile } from "@/lib/auth";

export type AccessRole =
  | "super_admin"
  | "executive_readonly"
  | "incoming_eta_viewer"
  | "dashboard_only"
  | "admin";

const incomingEtaViewerEmails = new Set([
  "sam@bangtaomuaythai.com",
  "lewis@bangtaomuaythai.com",
  "saytarn.a@bangtaomuaythai.com",
  "chonlasit.c@bangtaomuaythai.com",
]);

const executiveReadonlyEmails = new Set([
  "kevin@bangtaomuaythai.com",
  "will@bangtaomuaythai.com",
]);

const dashboardOnlyEmails = new Set<string>();

export function normalizeAccessEmail(email: string | null | undefined) {
  return String(email ?? "").trim().toLowerCase();
}

export function getUserAccessRole(email: string | null | undefined): AccessRole {
  const normalizedEmail = normalizeAccessEmail(email);

  if (incomingEtaViewerEmails.has(normalizedEmail)) {
    return "incoming_eta_viewer";
  }
  if (executiveReadonlyEmails.has(normalizedEmail)) {
    return "executive_readonly";
  }
  if (dashboardOnlyEmails.has(normalizedEmail)) {
    return "dashboard_only";
  }

  return "admin";
}

export function getProfileAccessRole(profile: CurrentUserProfile): AccessRole {
  const emailRole = getUserAccessRole(profile.email);
  if (emailRole !== "admin") {
    return emailRole;
  }

  return profile.role === "super_admin" ? "super_admin" : "admin";
}

export function canViewIncomingEtaOnly(email: string | null | undefined) {
  return getUserAccessRole(email) === "incoming_eta_viewer";
}

export function canViewAllPages(email: string | null | undefined) {
  const role = getUserAccessRole(email);
  return role !== "incoming_eta_viewer" && role !== "dashboard_only";
}

export function canOpenPoDetail(email: string | null | undefined) {
  return getUserAccessRole(email) !== "incoming_eta_viewer";
}

export function canCreatePo(email: string | null | undefined) {
  return getUserAccessRole(email) === "admin";
}

export function canEditPo(email: string | null | undefined) {
  return getUserAccessRole(email) === "admin";
}

export function canReceivePo(email: string | null | undefined) {
  return getUserAccessRole(email) === "admin";
}

export function canManagePayments(email: string | null | undefined) {
  return getUserAccessRole(email) === "admin";
}

export function canApprovePaymentRequest(email: string | null | undefined) {
  return getUserAccessRole(email) === "admin";
}

export function readonlyAccessLabel(profile: CurrentUserProfile) {
  const role = getProfileAccessRole(profile);
  if (role === "incoming_eta_viewer") {
    return "Incoming ETA view only";
  }
  if (role === "executive_readonly") {
    return "Read-only access";
  }
  if (role === "dashboard_only") {
    return "Dashboard only";
  }
  return "";
}
