import "server-only";

import type { CurrentUserProfile, UserRole } from "@/lib/auth";
import {
  getUserAccessRole,
  canViewIncomingEtaOnly,
  getProfileAccessRole,
} from "@/lib/access-control";

export type RoleNavItem = {
  href: string;
  key: string;
  label: string;
};

const navByRole: Record<UserRole, RoleNavItem[]> = {
  accounting: [
    { href: "/payment-requests?view=accounting", key: "accounting-desk", label: "Accounting Desk" },
    { href: "/cost-price-monitor", key: "cost-price-monitor", label: "Cost Price Monitor" },
    { href: "/payment-requests?view=accounting", key: "payments", label: "Payments" },
    { href: "/payment-requests", key: "approvals", label: "Approval Requests" },
    { href: "/payment-requests?view=packs", key: "payment-packs", label: "Payment Packs" },
    { href: "/payment-requests?view=paid", key: "reports", label: "Reports" },
  ],
  final_approver: [
    { href: "/payment-requests?view=my-approvals", key: "my-approvals", label: "My Approvals" },
    { href: "/payment-requests?view=history", key: "approval-history", label: "Approval History" },
  ],
  preliminary_approver: [
    { href: "/payment-requests?view=my-approvals", key: "my-reviews", label: "My Reviews" },
    { href: "/payment-requests?view=history", key: "approval-history", label: "Approval History" },
  ],
  retail_manager: [
    { href: "/payment-requests?view=retail-review", key: "retail-review", label: "Retail Review" },
    { href: "/payment-requests?view=history", key: "review-history", label: "Review History" },
  ],
  reviewer: [
    { href: "/payment-requests?view=my-reviews", key: "my-reviews", label: "My Reviews" },
    { href: "/payment-requests?view=history", key: "review-history", label: "Review History" },
  ],
  super_admin: [
    { href: "/dashboard", key: "dashboard", label: "Dashboard" },
    { href: "/po", key: "po", label: "PO Portal" },
    { href: "/cost-price-monitor", key: "cost-price-monitor", label: "Cost Price Monitor" },
    { href: "/purchasing-decision", key: "reorder", label: "Reorder Planning" },
    {
      href: "/new-product-opening-buy-planner",
      key: "new-product-planner",
      label: "New Product Planner",
    },
    { href: "/po#eta-schedule", key: "incoming", label: "Incoming ETA" },
    { href: "/po#payment-timeline", key: "payments", label: "Payments" },
    { href: "/payment-requests", key: "approvals", label: "Approval Requests" },
    { href: "/po#pipeline", key: "orders", label: "Purchase Orders" },
    { href: "/po#workbench", key: "workbench", label: "Workbench" },
    { href: "/po#pipeline", key: "suppliers", label: "Suppliers" },
    { href: "/purchasing-decision/overstock-report", key: "reports", label: "Reports" },
    { href: "/purchasing-setup", key: "settings", label: "Settings" },
  ],
  viewer: [
    { href: "/access-denied", key: "limited-dashboard", label: "Limited Dashboard" },
  ],
};

export function roleLabel(role: string) {
  return role
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function navItemsForRole(role: UserRole) {
  return navByRole[role];
}

export function navItemsForUser(profile: CurrentUserProfile) {
  if (canViewIncomingEtaOnly(profile.email)) {
    return [{ href: "/po", key: "po", label: "PO Portal" }];
  }
  if (getProfileAccessRole(profile) === "dashboard_only") {
    return [{ href: "/dashboard", key: "dashboard", label: "Dashboard" }];
  }
  if (getProfileAccessRole(profile) === "executive_readonly") {
    return navByRole.super_admin.filter((item) => item.key !== "cost-price-monitor");
  }

  return navByRole[profile.role];
}

export function defaultLandingForRole(role: UserRole) {
  const landingByRole: Record<UserRole, string> = {
    accounting: "/payment-requests?view=accounting",
    final_approver: "/payment-requests?view=my-approvals",
    preliminary_approver: "/payment-requests?view=my-approvals",
    retail_manager: "/payment-requests?view=retail-review",
    reviewer: "/payment-requests?view=my-reviews",
    super_admin: "/dashboard",
    viewer: "/inactive",
  };

  return landingByRole[role];
}

export function defaultLandingForUser(profile: CurrentUserProfile) {
  if (canViewIncomingEtaOnly(profile.email)) {
    return "/po";
  }
  if (getUserAccessRole(profile.email) === "dashboard_only") {
    return "/dashboard";
  }
  if (getProfileAccessRole(profile) === "executive_readonly") {
    return "/dashboard";
  }

  return defaultLandingForRole(profile.role);
}

export function canAccessAdminControlTower(profile: CurrentUserProfile) {
  return profile.role === "super_admin" || getProfileAccessRole(profile) === "executive_readonly";
}

export function canAccessDashboard(profile: CurrentUserProfile) {
  const accessRole = getProfileAccessRole(profile);
  return (
    profile.role === "super_admin" ||
    accessRole === "executive_readonly" ||
    accessRole === "dashboard_only"
  );
}

export function canAccessPaymentWorkbench(profile: CurrentUserProfile) {
  if (canViewIncomingEtaOnly(profile.email)) {
    return false;
  }
  if (getProfileAccessRole(profile) === "executive_readonly") {
    return true;
  }

  return [
    "accounting",
    "final_approver",
    "preliminary_approver",
    "retail_manager",
    "reviewer",
    "super_admin",
  ].includes(profile.role);
}

export function canAccessCostPriceMonitor(profile: CurrentUserProfile) {
  const accessRole = getProfileAccessRole(profile);
  return (
    (profile.role === "super_admin" || profile.role === "accounting") &&
    (accessRole === "super_admin" || accessRole === "admin")
  );
}
