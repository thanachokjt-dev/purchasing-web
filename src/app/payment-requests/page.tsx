import Link from "next/link";
import { redirect } from "next/navigation";
import { PaymentRequestCard } from "@/app/payment-requests/request-card";
import { requireUser } from "@/lib/auth";
import { getProfileAccessRole } from "@/lib/access-control";
import { getVisiblePaymentRequests } from "@/lib/payment-approvals";
import { canAccessPaymentWorkbench, defaultLandingForUser, roleLabel } from "@/lib/role-nav";

export const dynamic = "force-dynamic";

function stepTypeForRole(role: string) {
  const map: Record<string, string[]> = {
    final_approver: ["final_approval"],
    preliminary_approver: ["preliminary_approval"],
    retail_manager: ["retail_review"],
    reviewer: ["reviewer"],
  };

  return map[role] ?? [];
}

function sectionCopy(role: string, view: string) {
  if (role === "accounting") {
    return {
      description: "Approved requests waiting for payment, paid requests, missing proof checks, and packs ready to print.",
      title: "Accounting Desk",
    };
  }
  if (role === "super_admin") {
    return {
      description: "All payment approval requests, including pending, approved, paid, rejected, cancelled, and voided history.",
      title: "Approval Control Room",
    };
  }
  if (view === "history") {
    return {
      description: "Previously actioned payment approval requests visible to you.",
      title: "Approval History",
    };
  }
  return {
    description: "Payment approval requests assigned to you and visible request history.",
    title: role === "retail_manager" ? "Retail Review" : "My Approval Workbench",
  };
}

function uniqueRequests<T extends { id: string }>(requests: T[]) {
  return Array.from(new Map(requests.map((request) => [request.id, request])).values());
}

export default async function PaymentRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const params = await searchParams;
  const currentUser = await requireUser("/payment-requests");
  if (!canAccessPaymentWorkbench(currentUser)) {
    redirect(defaultLandingForUser(currentUser));
  }
  const { requests } = await getVisiblePaymentRequests();
  const view = params.view ?? "";
  const isExecutiveReadonly = getProfileAccessRole(currentUser) === "executive_readonly";
  const roleStepTypes = stepTypeForRole(currentUser.role);
  const activeAssigned = requests.filter((request) =>
    request.steps.some(
      (step) =>
          step.status === "active" &&
        (currentUser.role === "super_admin" ||
          isExecutiveReadonly ||
          step.assignedUserId === currentUser.authUserId) &&
        (roleStepTypes.length === 0 || roleStepTypes.includes(step.stepType)),
    ),
  );
  const actedByMe = requests.filter((request) =>
    request.steps.some(
      (step) =>
        step.actionBy === currentUser.authUserId ||
        (step.assignedUserId === currentUser.authUserId &&
          ["approved", "rejected", "cancelled"].includes(step.status)),
    ),
  );
  const createdByMe = requests.filter(
    (request) => request.requestedBy === currentUser.authUserId,
  );
  const accountingReady = requests.filter((request) => request.requestStatus === "approved");
  const paidRequests = requests.filter((request) => request.requestStatus === "paid");
  const missingProof = paidRequests.filter(
    (request) => !request.paymentSlipStoragePath && !request.paymentSlipUrl,
  );
  const packReady = requests.filter((request) => ["approved", "paid"].includes(request.requestStatus));
  const otherVisible = requests.filter((request) =>
    !uniqueRequests([...activeAssigned, ...createdByMe, ...actedByMe]).some(
      (known) => known.id === request.id,
    ),
  );
  const copy = sectionCopy(isExecutiveReadonly ? "super_admin" : currentUser.role, view);

  const sections =
    currentUser.role === "accounting" && !isExecutiveReadonly
      ? [
          ["Approved Waiting for Payment", accountingReady],
          ["Payment Packs Ready", packReady],
          ["Paid Requests", paidRequests],
          ["Missing Slip / Proof", missingProof],
        ] as const
      : currentUser.role === "super_admin" || isExecutiveReadonly
        ? [
            ["Needs Action", activeAssigned],
            ["Pending", requests.filter((request) => ["pending_review", "pending_approval"].includes(request.requestStatus))],
            ["Approved", accountingReady],
            ["Paid", paidRequests],
            ["Voided / Cancelled / Rejected History", requests.filter((request) => ["voided", "cancelled", "rejected"].includes(request.requestStatus))],
          ] as const
        : [
            ["Needs My Action", activeAssigned],
            ["My Review History", actedByMe],
            ["Created By Me", createdByMe],
            ["Other Visible Requests", otherVisible],
          ] as const;

  return (
    <main className="min-h-screen bg-[#f6f7f9] px-5 py-8 text-[#172026]">
      <div className="mx-auto grid max-w-6xl gap-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64707d]">
              Payment Approvals
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal">
              {copy.title}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#52606d]">
              {copy.description}
            </p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#64707d]">
              Role: {roleLabel(currentUser.role)}
            </p>
          </div>
          <Link
            className="rounded-md border border-[#cfd6df] bg-white px-3 py-2 text-sm font-semibold text-[#364252]"
            href={defaultLandingForUser(currentUser)}
          >
            My Workbench
          </Link>
        </header>

        {sections.map(([title, sectionRequests]) => (
          <section className="grid gap-3" key={title}>
            <h2 className="text-lg font-semibold">{title}</h2>
            {sectionRequests.length > 0 ? (
              sectionRequests.map((request) => (
              <PaymentRequestCard
                currentUser={currentUser}
                key={`${title}-${request.id}`}
                request={request}
                showPoLink
              />
              ))
            ) : (
              <p className="rounded-lg border border-[#dfe4ea] bg-white p-4 text-sm text-[#667380]">
                No requests in this section.
              </p>
            )}
          </section>
        ))}
      </div>
    </main>
  );
}
