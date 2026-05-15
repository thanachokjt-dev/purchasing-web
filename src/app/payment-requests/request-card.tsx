import Link from "next/link";
import type { ReactNode } from "react";
import {
  AccountingPaymentForm,
  ApprovalStepActionForm,
  CorrectPaymentSlipForm,
  EditSupportingDocumentForm,
  RemoveSupportingDocumentForm,
  SupportingDocumentForm,
  VoidPaymentRequestForm,
} from "@/app/payment-requests/forms";
import type { CurrentUserProfile } from "@/lib/auth";
import {
  canActOnStep,
  canConfirmPayment,
  canCorrectPaymentProof,
  canManagePaymentDocuments,
  canPrintPaymentPack,
  canVoidPaymentRequest,
  type PaymentApprovalRequest,
  type PaymentProofAuditLog,
  type PaymentRequestDocumentAuditLog,
  type PaymentApprovalStep,
} from "@/lib/payment-approvals";

const statusClass: Record<string, string> = {
  active: "bg-[#e8f1ff] text-[#255f85]",
  approved: "bg-[#eaf6ef] text-[#1f6b3d]",
  cancelled: "bg-[#eef0f3] text-[#5c6670]",
  paid: "bg-[#eaf6ef] text-[#1f6b3d]",
  pending: "bg-[#fff4e5] text-[#946200]",
  pending_approval: "bg-[#fff4e5] text-[#946200]",
  pending_review: "bg-[#e8f1ff] text-[#255f85]",
  rejected: "bg-[#fff0f0] text-[#b42318]",
  skipped: "bg-[#eef0f3] text-[#5c6670]",
  voided: "bg-[#fff0f0] text-[#b42318]",
};

const workflowStepLabels: Record<string, string> = {
  final_approval: "Final approval",
  paid: "Paid",
  preliminary_approval: "Kevin preliminary",
  rejected: "Rejected",
  retail_review: "Retail review",
  reviewer: "Optional reviewer",
  submitted: "Submitted",
  voided: "Voided",
};

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    currency: currency || "THB",
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function formatDateTime(value: string) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(new Date(value));
}

function label(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function userName(step: PaymentApprovalStep) {
  return step.assignedUser?.displayName || step.assignedUser?.email || step.assignedRole || "-";
}

function documentTypeLabel(value: string) {
  return label(value);
}

function actor(
  profile?: { displayName: string; email: string },
  fallback = "-",
) {
  return profile?.displayName || profile?.email || fallback;
}

function proofSummary(log: PaymentProofAuditLog, prefix: "old" | "new") {
  const fileName = prefix === "old" ? log.oldFileName : log.newFileName;
  const externalUrl = prefix === "old" ? log.oldExternalUrl : log.newExternalUrl;
  const storagePath = prefix === "old" ? log.oldStoragePath : log.newStoragePath;

  return fileName || externalUrl || storagePath || "-";
}

function documentAuditSummary(log: PaymentRequestDocumentAuditLog, prefix: "old" | "new") {
  const title = prefix === "old" ? log.oldTitle : log.newTitle;
  const url = prefix === "old" ? log.oldUrl : log.newUrl;

  return [title, url].filter(Boolean).join(" | ") || "-";
}

function valueSummary(value: unknown) {
  if (!value || typeof value !== "object") {
    return "-";
  }

  return JSON.stringify(value);
}

function compactDate(value: string) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeZone: "Asia/Bangkok",
  }).format(new Date(`${value}T00:00:00`));
}

function paymentTitle(request: PaymentApprovalRequest) {
  return request.paymentType || "Payment request";
}

function activeStep(request: PaymentApprovalRequest) {
  return request.steps.find((step) => step.status === "active");
}

function waitingFor(request: PaymentApprovalRequest) {
  if (request.requestStatus === "approved") {
    return "Accounting";
  }
  if (request.requestStatus === "paid") {
    return "Complete";
  }
  if (request.requestStatus === "voided") {
    return "Voided";
  }
  if (["cancelled", "rejected"].includes(request.requestStatus)) {
    return "No one";
  }

  const step = activeStep(request);
  return step ? userName(step) : "-";
}

function primaryActionLabel(
  currentUser: CurrentUserProfile,
  request: PaymentApprovalRequest,
) {
  const step = activeStep(request);

  if (step && canActOnStep(currentUser, step)) {
    return "Review this step";
  }
  if (canConfirmPayment(currentUser, request)) {
    return "Record payment";
  }
  if (canPrintPaymentPack(currentUser, request)) {
    return "Print pack";
  }
  if (request.requestStatus === "paid") {
    return "Review proof";
  }
  return "View workflow";
}

function workflowStatusClass(status: string, active: boolean) {
  if (active) {
    return "border-[#255f85] bg-[#e8f1ff] text-[#255f85]";
  }
  if (["approved", "paid", "done"].includes(status)) {
    return "border-[#cdebd8] bg-[#f0fbf4] text-[#1f6b3d]";
  }
  if (["voided", "rejected", "cancelled"].includes(status)) {
    return "border-[#ffd6d6] bg-[#fff5f5] text-[#b42318]";
  }
  return "border-[#dfe4ea] bg-white text-[#667380]";
}

function workflowItems(request: PaymentApprovalRequest) {
  const byType = new Map(request.steps.map((step) => [step.stepType, step]));
  const submittedStatus = request.requestedAt ? "approved" : "pending";

  const base = [
    {
      actor: actor(request.requestedByProfile, request.requestedBy),
      active: false,
      key: "submitted",
      meta: request.requestedAt ? formatDateTime(request.requestedAt) : "",
      status: submittedStatus,
    },
    ...(["retail_review", "reviewer", "preliminary_approval", "final_approval"] as const).map(
      (stepType) => {
        const step = byType.get(stepType);
        const isOptionalStep = stepType === "reviewer" || stepType === "preliminary_approval";
        return {
          actor: step ? userName(step) : isOptionalStep ? "Not included" : "-",
          active: step?.status === "active",
          key: stepType,
          meta: step?.actionAt ? formatDateTime(step.actionAt) : "",
          status: step?.status ?? (isOptionalStep ? "skipped" : "pending"),
        };
      },
    ),
    {
      actor: request.paidAt ? actor(request.paidByProfile, request.paidBy) : "Accounting",
      active: request.requestStatus === "approved",
      key: "paid",
      meta: request.paidAt ? formatDateTime(request.paidAt) : "",
      status: request.requestStatus === "paid" ? "paid" : "pending",
    },
    {
      actor: request.voidedAt ? actor(request.voidedByProfile, request.voidedBy) : "Admin",
      active: request.requestStatus === "voided",
      key: "voided",
      meta: request.voidedAt ? formatDateTime(request.voidedAt) : "",
      status: request.requestStatus === "voided" ? "voided" : "pending",
    },
  ];

  if (request.requestStatus === "rejected") {
    base.push({
      actor: "Approver",
      active: true,
      key: "rejected",
      meta: request.rejectedAt ? formatDateTime(request.rejectedAt) : "",
      status: "rejected",
    });
  }

  return base;
}

function SectionDetails({
  children,
  defaultOpen = false,
  summary,
}: {
  children: ReactNode;
  defaultOpen?: boolean;
  summary: ReactNode;
}) {
  return (
    <details
      className="rounded-md border border-[#dfe4ea] bg-white"
      open={defaultOpen}
    >
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-[#172026] hover:bg-[#f7f9fb]">
        {summary}
      </summary>
      <div className="border-t border-[#edf1f5] p-4">{children}</div>
    </details>
  );
}

export function PaymentRequestCard({
  currentUser,
  request,
  showPoLink = false,
}: {
  currentUser: CurrentUserProfile;
  request: PaymentApprovalRequest;
  showPoLink?: boolean;
}) {
  const visibleDocuments = request.documents.filter((document) => document.isActive);
  const requestActiveStep = activeStep(request);
  const canManageDocuments = canManagePaymentDocuments(currentUser, request);
  const canConfirm = canConfirmPayment(currentUser, request);
  const canCorrectProof = canCorrectPaymentProof(currentUser, request);
  const canPrintPack = canPrintPaymentPack(currentUser, request);
  const canVoid = canVoidPaymentRequest(currentUser, request);
  const hasProof =
    request.paymentSlipStoragePath ||
    request.paymentSlipUrl ||
    request.accountingRecordedAt ||
    request.requestStatus === "paid";
  const showPaymentProofSection = hasProof || canConfirm;
  const showAdminTools =
    canVoid ||
    canCorrectProof ||
    (currentUser.role === "super_admin" && request.requestStatus === "voided");

  return (
    <article className="rounded-lg border border-[#dfe4ea] bg-white shadow-sm" id={`payment-request-${request.id}`}>
      <section className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#64707d]">
              Summary
            </p>
            <h3 className="mt-1 text-base font-semibold text-[#172026]">
              {paymentTitle(request)}
            </h3>
            <p className="mt-1 text-xl font-semibold text-[#172026]">
              {formatCurrency(request.requestedAmount, request.requestedCurrency)}
            </p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#667380]">
              <span>THB {request.requestedThbAmount.toLocaleString("en-US")}</span>
              <span>Due {request.dueDate ? compactDate(request.dueDate) : "-"}</span>
              <span>PO {request.poId || "-"}</span>
            </div>
            {showPoLink ? (
              <Link
                className="mt-2 inline-flex text-sm font-semibold text-[#255f85]"
                href={`/po/${encodeURIComponent(request.poId)}`}
              >
                Open {request.poId}
              </Link>
            ) : null}
          </div>

          <div className="grid min-w-[210px] gap-2 text-sm">
            <span
              className={`justify-self-start rounded-md px-2 py-1 text-xs font-semibold ${
                statusClass[request.requestStatus] ?? "bg-[#eef0f3] text-[#5c6670]"
              }`}
            >
              {label(request.requestStatus)}
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64707d]">
                Waiting for
              </p>
              <p className="mt-1 font-semibold text-[#172026]">{waitingFor(request)}</p>
            </div>
            <a
              className="inline-flex h-9 items-center justify-center rounded-md bg-[#172026] px-3 text-sm font-semibold text-white"
              href={
                primaryActionLabel(currentUser, request) === "Print pack"
                  ? `/payment-requests/${encodeURIComponent(request.id)}/approval-pack`
                  : `#payment-request-workflow-${request.id}`
              }
            >
              {primaryActionLabel(currentUser, request)}
            </a>
          </div>
        </div>
      </section>

      <section
        className="border-t border-[#edf1f5] bg-[#fbfcfd] p-4"
        id={`payment-request-workflow-${request.id}`}
      >
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#172026]">
              Workflow / Approval status
            </p>
            <p className="mt-1 text-xs text-[#667380]">
              {requestActiveStep ? `Current step: ${label(requestActiveStep.stepType)}` : `Status: ${label(request.requestStatus)}`}
            </p>
          </div>
        </div>
        <div className="grid gap-2 md:grid-cols-4 lg:grid-cols-7">
          {workflowItems(request).map((item) => (
            <div
              className={`rounded-md border p-2 text-xs ${workflowStatusClass(item.status, item.active)}`}
              key={item.key}
            >
              <p className="font-semibold">{workflowStepLabels[item.key] ?? label(item.key)}</p>
              <p className="mt-1">{label(item.status)}</p>
              <p className="mt-1 truncate text-[11px]">{item.actor}</p>
              {item.meta ? <p className="mt-1 text-[11px]">{item.meta}</p> : null}
            </div>
          ))}
        </div>
        <div className="mt-3 grid gap-2">
          {request.steps.map((step) => (
            <details
              className={`rounded-md border bg-white ${
                step.status === "active" ? "border-[#255f85]" : "border-[#edf1f5]"
              }`}
              key={step.id}
              open={step.status === "active" && canActOnStep(currentUser, step)}
            >
              <summary className="cursor-pointer list-none px-3 py-2">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#172026]">
                      {step.stepOrder}. {workflowStepLabels[step.stepType] ?? label(step.stepType)}
                    </p>
                    <p className="mt-1 text-xs text-[#667380]">
                      Assigned to {userName(step)}
                    </p>
                  </div>
                  <span
                    className={`rounded-md px-2 py-1 text-xs font-semibold ${
                      statusClass[step.status] ?? "bg-[#eef0f3] text-[#5c6670]"
                    }`}
                  >
                    {label(step.status)}
                  </span>
                </div>
              </summary>
              <div className="border-t border-[#edf1f5] p-3">
                {step.actionAt ? (
                  <p className="text-xs text-[#667380]">
                    Actioned at {formatDateTime(step.actionAt)}
                  </p>
                ) : null}
                {step.note ? (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-[#364252]">
                    {step.note}
                  </p>
                ) : null}
                {step.evidenceUrl ? (
                  <a
                    className="mt-2 inline-flex text-sm font-semibold text-[#255f85]"
                    href={step.evidenceUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Evidence URL
                  </a>
                ) : null}
                <ApprovalStepActionForm
                  canAct={canActOnStep(currentUser, step)}
                  isSuperAdmin={currentUser.role === "super_admin"}
                  request={request}
                  step={step}
                />
              </div>
            </details>
          ))}
        </div>
      </section>

      <div className="grid gap-3 border-t border-[#edf1f5] p-4">
        <SectionDetails
          defaultOpen={visibleDocuments.length > 0}
          summary={`Supporting documents (${visibleDocuments.length})`}
        >
          {visibleDocuments.length > 0 ? (
            <div className="grid gap-2">
              {visibleDocuments.map((document) => (
                <div className="rounded-md border border-[#edf1f5] bg-[#fbfcfd] p-3" key={document.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <a
                        className="text-sm font-semibold text-[#255f85]"
                        href={document.documentUrl}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        {document.documentTitle}
                      </a>
                      <p className="mt-1 text-xs text-[#667380]">
                        {documentTypeLabel(document.documentType)} | Added by{" "}
                        {document.createdByProfile?.displayName ||
                          document.createdByProfile?.email ||
                          document.createdBy ||
                          "-"}
                      </p>
                    </div>
                  </div>
                  {document.note ? (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-[#364252]">{document.note}</p>
                  ) : null}
                  {document.updatedAt ? (
                    <p className="mt-2 text-xs text-[#667380]">
                      Updated at {formatDateTime(document.updatedAt)} by{" "}
                      {actor(document.updatedByProfile, document.updatedBy)}
                    </p>
                  ) : null}
                  {canManageDocuments ? (
                    <details className="mt-2 rounded-md border border-[#dfe4ea] bg-white">
                      <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold text-[#255f85]">
                        Document actions
                      </summary>
                      <div className="border-t border-[#edf1f5] p-3">
                        <EditSupportingDocumentForm
                          canManage={canManageDocuments}
                          document={document}
                          request={request}
                        />
                        <RemoveSupportingDocumentForm
                          canManage={canManageDocuments}
                          document={document}
                          request={request}
                        />
                      </div>
                    </details>
                  ) : null}
                  {request.documentAuditLogs.some((log) => log.documentId === document.id) ? (
                    <details className="mt-2 rounded-md border border-[#edf1f5] bg-white">
                      <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold text-[#64707d]">
                        Document history
                      </summary>
                      <div className="grid gap-2 border-t border-[#edf1f5] p-3">
                        {request.documentAuditLogs
                          .filter((log) => log.documentId === document.id)
                          .map((log) => (
                            <div className="rounded-md bg-[#fbfcfd] p-2 text-xs" key={log.id}>
                              <p className="font-semibold">{label(log.actionType)}</p>
                              <p>
                                Changed by {actor(log.changedByProfile, log.changedBy)} at{" "}
                                {formatDateTime(log.changedAt)}
                              </p>
                              {log.reason ? <p>Reason: {log.reason}</p> : null}
                              <p className="break-all">Old: {documentAuditSummary(log, "old")}</p>
                              <p className="break-all">New: {documentAuditSummary(log, "new")}</p>
                            </div>
                          ))}
                      </div>
                    </details>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-md border border-dashed border-[#dfe4ea] bg-[#fbfcfd] px-3 py-2 text-sm text-[#667380]">
              No supporting document links attached.
            </p>
          )}
          <SupportingDocumentForm
            canManage={canManageDocuments}
            request={request}
          />
          {request.documentAuditLogs.some((log) => log.actionType === "removed") ? (
            <details className="mt-3 rounded-md border border-[#edf1f5] bg-[#fbfcfd]">
              <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold text-[#64707d]">
                Removed document history
              </summary>
              <div className="grid gap-2 border-t border-[#edf1f5] p-3">
                {request.documentAuditLogs
                  .filter((log) => log.actionType === "removed")
                  .map((log) => (
                    <div className="rounded-md bg-white p-2 text-xs" key={log.id}>
                      <p className="font-semibold">{log.oldTitle || "Removed document"}</p>
                      <p>
                        Removed by {actor(log.changedByProfile, log.changedBy)} at{" "}
                        {formatDateTime(log.changedAt)}
                      </p>
                      <p>Reason: {log.reason || "-"}</p>
                      <p className="break-all">URL: {log.oldUrl || "-"}</p>
                    </div>
                  ))}
              </div>
            </details>
          ) : null}
        </SectionDetails>

        {showPaymentProofSection ? (
          <SectionDetails
            defaultOpen={canConfirm}
            summary="Payment proof / accounting"
          >
            {request.requestStatus === "paid" ? (
              <div className="rounded-md border border-[#cdebd8] bg-[#f0fbf4] p-3 text-sm text-[#1f6b3d]">
                <p className="font-semibold">Payment Recorded</p>
                <p className="mt-1">
                  {formatCurrency(
                    request.accountingPaidAmount,
                    request.accountingCurrency || request.requestedCurrency,
                  )}{" "}
                  | THB {request.accountingThbAmount.toLocaleString("en-US")}
                </p>
                <p className="mt-1 text-xs">
                  Paid at {formatDateTime(request.paidAt)} | Recorded at{" "}
                  {formatDateTime(request.accountingRecordedAt)}
                </p>
                <p className="mt-1 text-xs">
                  Paid by{" "}
                  {request.paidByProfile?.displayName ||
                    request.paidByProfile?.email ||
                    request.paidBy ||
                    "-"}
                </p>
                {request.paymentReference ? (
                  <p className="mt-1 text-xs">Reference: {request.paymentReference}</p>
                ) : null}
                {request.paymentSlipStoragePath ? (
                  <div className="mt-2 rounded-md border border-[#cdebd8] bg-white/70 p-2">
                    <p className="text-xs font-semibold text-[#1f6b3d]">
                      Uploaded Slip: {request.paymentSlipFileName || "Payment proof"}
                    </p>
                    <p className="mt-1 text-xs">
                      Uploaded at {formatDateTime(request.paymentSlipUploadedAt)} by{" "}
                      {request.paymentSlipUploadedByProfile?.displayName ||
                        request.paymentSlipUploadedByProfile?.email ||
                        request.paymentSlipUploadedBy ||
                        "-"}
                    </p>
                    {request.paymentSlipSignedUrl ? (
                      <a
                        className="mt-2 inline-flex text-sm font-semibold text-[#255f85]"
                        href={request.paymentSlipSignedUrl}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        View Slip
                      </a>
                    ) : null}
                  </div>
                ) : null}
                {request.paymentSlipUrl ? (
                  <a
                    className="mt-2 inline-flex text-sm font-semibold text-[#255f85]"
                    href={request.paymentSlipUrl}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    Payment slip URL
                  </a>
                ) : null}
                {request.accountingNote ? (
                  <p className="mt-2 whitespace-pre-wrap text-sm">{request.accountingNote}</p>
                ) : null}
              </div>
            ) : null}
            {canConfirm ? (
              <AccountingPaymentForm request={request} />
            ) : null}
            {request.proofAuditLogs.length > 0 ? (
              <details className="mt-3 rounded-md border border-[#cdebd8] bg-white">
                <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold text-[#64707d]">
                  Payment proof correction history
                </summary>
                <div className="grid gap-2 border-t border-[#cdebd8] p-3">
                  {request.proofAuditLogs.map((log) => (
                    <div className="rounded-md border border-[#edf1f5] bg-white p-2" key={log.id}>
                      <p className="text-xs font-semibold">{label(log.actionType)}</p>
                      <p className="mt-1 text-xs">
                        Changed by {actor(log.changedByProfile, log.changedBy)} at{" "}
                        {formatDateTime(log.changedAt)}
                      </p>
                      <p className="mt-1 text-xs">Reason: {log.reason}</p>
                      <p className="mt-1 break-all text-xs">Old: {proofSummary(log, "old")}</p>
                      <p className="mt-1 break-all text-xs">New: {proofSummary(log, "new")}</p>
                    </div>
                  ))}
                </div>
              </details>
            ) : null}
          </SectionDetails>
        ) : null}

        <SectionDetails
          summary={`Audit history (${request.requestAuditLogs.length})`}
        >
          <p className="mb-3 text-xs text-[#667380]">
            Requested by{" "}
            {request.requestedByProfile?.displayName ||
              request.requestedByProfile?.email ||
              request.requestedBy ||
              "-"}{" "}
            at {formatDateTime(request.requestedAt)}
          </p>
          {request.requestNote ? (
            <p className="mb-3 whitespace-pre-wrap rounded-md border border-[#edf1f5] bg-[#fbfcfd] p-3 text-sm text-[#364252]">
              {request.requestNote}
            </p>
          ) : null}
          {request.requestAuditLogs.length > 0 ? (
            <div className="grid gap-2">
              {request.requestAuditLogs.map((log) => (
                <div className="rounded-md bg-[#fbfcfd] p-2 text-xs" key={log.id}>
                  <p className="font-semibold">{label(log.actionType)}</p>
                  <p>
                    Changed by {actor(log.changedByProfile, log.changedBy)} at{" "}
                    {formatDateTime(log.changedAt)}
                  </p>
                  <p>
                    Status: {log.oldStatus || "-"} -&gt; {log.newStatus || "-"}
                  </p>
                  {log.reason ? <p>Reason: {log.reason}</p> : null}
                  <p className="mt-1 break-all">Old: {valueSummary(log.oldValues)}</p>
                  <p className="mt-1 break-all">New: {valueSummary(log.newValues)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[#667380]">No audit entries recorded.</p>
          )}
        </SectionDetails>

        {showAdminTools ? (
          <SectionDetails summary="Admin tools">
            {request.requestStatus === "voided" ? (
              <div className="mb-3 rounded-md border border-[#ffd6d6] bg-[#fff5f5] p-3 text-sm text-[#b42318]">
                <p className="font-semibold">Voided</p>
                <p className="mt-1">
                  Voided at {formatDateTime(request.voidedAt)} by{" "}
                  {actor(request.voidedByProfile, request.voidedBy)}
                </p>
                <p className="mt-1 whitespace-pre-wrap">Reason: {request.voidReason || "-"}</p>
                {(request.paymentSlipStoragePath || request.paymentSlipUrl) ? (
                  <div className="mt-2 rounded-md border border-[#ffd6d6] bg-white/70 p-2 text-xs">
                    <p className="font-semibold">Obsolete Payment Proof Retained</p>
                    {request.paymentSlipFileName ? <p>Slip file: {request.paymentSlipFileName}</p> : null}
                    {request.paymentSlipStoragePath ? (
                      <p className="break-all">Storage path: {request.paymentSlipStoragePath}</p>
                    ) : null}
                    {request.paymentSlipUrl ? (
                      <p className="break-all">External URL: {request.paymentSlipUrl}</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
            <CorrectPaymentSlipForm
              canCorrect={canCorrectProof}
              request={request}
            />
            <VoidPaymentRequestForm
              canVoid={canVoid}
              request={request}
            />
          </SectionDetails>
        ) : null}

        {canPrintPack ? (
          <Link
            className="inline-flex rounded-md border border-[#cfd6df] bg-white px-3 py-2 text-sm font-semibold text-[#364252] hover:bg-[#f7f9fb]"
            href={`/payment-requests/${encodeURIComponent(request.id)}/approval-pack`}
          >
            Print Payment Approval Pack
          </Link>
        ) : null}
      </div>
    </article>
  );
}
