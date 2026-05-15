"use client";

import { useActionState } from "react";
import {
  approvePaymentStepAction,
  addPaymentRequestDocumentAction,
  confirmAccountingPaymentAction,
  correctPaymentSlipAction,
  rejectPaymentStepAction,
  removePaymentRequestDocumentAction,
  submitPaymentRequestAction,
  updatePaymentRequestDocumentAction,
  voidPaymentRequestAction,
  type PaymentRequestActionState,
} from "@/app/payment-requests/actions";
import type {
  ApprovalUserOption,
  PaymentApprovalRequest,
  PaymentRequestDocument,
  PaymentApprovalStep,
} from "@/lib/payment-approvals";
import {
  PAYMENT_DOCUMENT_TYPES,
  type PaymentDocumentType,
} from "@/lib/payment-approval-shared";

const initialState: PaymentRequestActionState = {
  ok: false,
  message: "",
};

const inputClass =
  "h-9 w-full rounded-md border border-[#cfd6df] bg-white px-2 text-sm text-[#172026] outline-none focus:border-[#255f85]";
const buttonClass =
  "inline-flex h-9 items-center justify-center rounded-md bg-[#172026] px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButtonClass =
  "inline-flex h-9 items-center justify-center rounded-md border border-[#cfd6df] bg-white px-3 text-sm font-semibold text-[#364252] disabled:cursor-not-allowed disabled:opacity-60";

function ActionMessage({ state }: { state: PaymentRequestActionState }) {
  if (!state.message) {
    return null;
  }

  return (
    <p
      className={`rounded-md px-3 py-2 text-sm font-medium ${
        state.ok
          ? "border border-[#cdebd8] bg-[#f0fbf4] text-[#1f6b3d]"
          : "border border-[#ffd6d6] bg-[#fff5f5] text-[#b42318]"
      }`}
    >
      {state.message}
    </p>
  );
}

function userLabel(user: ApprovalUserOption) {
  return user.displayName ? `${user.displayName} (${user.email})` : user.email;
}

function optionByRole(users: ApprovalUserOption[], role: string) {
  return users.filter((user) => user.role === role);
}

function documentTypeLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function SubmitPaymentRequestForm({
  approvalUsers,
  paymentLineId,
  poId,
}: {
  approvalUsers: ApprovalUserOption[];
  paymentLineId: string;
  poId: string;
}) {
  const [state, formAction, pending] = useActionState(
    submitPaymentRequestAction,
    initialState,
  );
  const retailManagers = optionByRole(approvalUsers, "retail_manager");
  const reviewers = optionByRole(approvalUsers, "reviewer");
  const finalApprovers = optionByRole(approvalUsers, "final_approver");
  const kevin = approvalUsers.find(
    (user) => user.email.toLowerCase() === "kevin@bangtaomuaythai.com",
  );

  return (
    <details className="rounded-md border border-[#dfe4ea] bg-white">
      <summary className="cursor-pointer list-none px-3 py-2 text-sm font-semibold text-[#255f85] hover:bg-[#f7f9fb]">
        Submit for Approval
      </summary>
      <form
        action={formAction}
        className="grid gap-3 border-t border-[#edf1f5] p-3"
      >
        <input name="poId" type="hidden" value={poId} />
        <input name="paymentLineId" type="hidden" value={paymentLineId} />
        <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#64707d]">
          Retail Manager
          <select className={inputClass} name="retailManagerEmail" required>
            {retailManagers.map((user) => (
              <option key={user.authUserId} value={user.email}>
                {userLabel(user)}
              </option>
            ))}
          </select>
        </label>
        <div className="grid gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64707d]">
            Optional Reviewers
          </p>
          {reviewers.map((user) => (
            <label className="flex items-center gap-2 text-sm" key={user.authUserId}>
              <input name="reviewerEmail" type="checkbox" value={user.email} />
              {userLabel(user)}
            </label>
          ))}
          {reviewers.length === 0 ? (
            <p className="text-xs text-[#8a96a3]">No reviewer profiles found.</p>
          ) : null}
        </div>
        {kevin ? (
          <label className="flex items-center gap-2 text-sm">
            <input name="includeKevin" type="checkbox" value="yes" />
            Include Kevin preliminary approval
          </label>
        ) : null}
        <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#64707d]">
          Final Approver
          <select className={inputClass} name="finalApproverEmail" required>
            {finalApprovers.map((user) => (
              <option key={user.authUserId} value={user.email}>
                {userLabel(user)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#64707d]">
          Request Note
          <textarea
            className="min-h-20 rounded-md border border-[#cfd6df] bg-white px-2 py-2 text-sm text-[#172026] outline-none focus:border-[#255f85]"
            name="requestNote"
            placeholder="Optional context for approvers"
          />
        </label>
        <ActionMessage state={state} />
        <button className={buttonClass} disabled={pending} type="submit">
          {pending ? "Submitting..." : "Submit Request"}
        </button>
      </form>
    </details>
  );
}

export function ApprovalStepActionForm({
  canAct,
  isSuperAdmin,
  request,
  step,
}: {
  canAct: boolean;
  isSuperAdmin: boolean;
  request: PaymentApprovalRequest;
  step: PaymentApprovalStep;
}) {
  const [approveState, approveAction, approving] = useActionState(
    approvePaymentStepAction,
    initialState,
  );
  const [rejectState, rejectAction, rejecting] = useActionState(
    rejectPaymentStepAction,
    initialState,
  );

  if (!canAct) {
    return null;
  }

  return (
    <div className="mt-3 grid gap-3 rounded-md border border-[#dfe4ea] bg-[#fbfcfd] p-3">
      <form action={approveAction} className="grid gap-2">
        <input name="requestId" type="hidden" value={request.id} />
        <input name="stepId" type="hidden" value={step.id} />
        <input name="poId" type="hidden" value={request.poId} />
        <textarea
          className="min-h-16 rounded-md border border-[#cfd6df] bg-white px-2 py-2 text-sm outline-none focus:border-[#255f85]"
          name="note"
          placeholder="Approval note"
        />
        {isSuperAdmin ? (
          <div className="grid gap-2 rounded-md border border-[#e2e7ed] bg-white p-2">
            <label className="flex items-center gap-2 text-sm">
              <input name="manualExternal" type="checkbox" value="yes" />
              Record manual external approval
            </label>
            <select className={inputClass} name="evidenceType">
              <option value="whatsapp">WhatsApp</option>
              <option value="email">Email</option>
              <option value="google_drive">Google Drive</option>
              <option value="onedrive">OneDrive</option>
              <option value="other">Other</option>
            </select>
            <input
              className={inputClass}
              name="evidenceUrl"
              placeholder="Evidence URL required for manual external approval"
              type="url"
            />
          </div>
        ) : null}
        <ActionMessage state={approveState} />
        <button className={buttonClass} disabled={approving} type="submit">
          {approving ? "Approving..." : "Approve Step"}
        </button>
      </form>
      <form action={rejectAction} className="grid gap-2 border-t border-[#edf1f5] pt-3">
        <input name="requestId" type="hidden" value={request.id} />
        <input name="stepId" type="hidden" value={step.id} />
        <input name="poId" type="hidden" value={request.poId} />
        <textarea
          className="min-h-16 rounded-md border border-[#cfd6df] bg-white px-2 py-2 text-sm outline-none focus:border-[#255f85]"
          name="note"
          placeholder="Reject note"
        />
        <ActionMessage state={rejectState} />
        <button className={secondaryButtonClass} disabled={rejecting} type="submit">
          {rejecting ? "Rejecting..." : "Reject Step"}
        </button>
      </form>
    </div>
  );
}

function todayBangkok() {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Bangkok",
    year: "numeric",
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function AccountingPaymentForm({
  request,
}: {
  request: PaymentApprovalRequest;
}) {
  const [state, formAction, pending] = useActionState(
    confirmAccountingPaymentAction,
    initialState,
  );
  const fxRate = request.requestedFxRate || (request.requestedCurrency === "THB" ? 1 : 0);
  const thbAmount = request.requestedThbAmount || request.requestedAmount * (fxRate || 1);

  return (
    <details className="mt-3 rounded-md border border-[#dfe4ea] bg-[#fbfcfd]">
      <summary className="cursor-pointer list-none px-3 py-2 text-sm font-semibold text-[#255f85] hover:bg-white">
        Record Payment
      </summary>
      <form action={formAction} className="grid gap-3 border-t border-[#edf1f5] p-3">
        <input name="requestId" type="hidden" value={request.id} />
        <input name="poId" type="hidden" value={request.poId} />
        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#64707d]">
            Actual Paid Amount
            <input
              className={inputClass}
              defaultValue={request.requestedAmount || ""}
              min="0.01"
              name="accountingPaidAmount"
              required
              step="0.01"
              type="number"
            />
          </label>
          <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#64707d]">
            Currency
            <input
              className={inputClass}
              defaultValue={request.requestedCurrency || "THB"}
              name="accountingCurrency"
              required
            />
          </label>
          <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#64707d]">
            FX Rate
            <input
              className={inputClass}
              defaultValue={fxRate || 1}
              min="0.000001"
              name="accountingFxRate"
              required
              step="0.000001"
              type="number"
            />
          </label>
          <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#64707d]">
            THB Paid Amount
            <input
              className={inputClass}
              defaultValue={thbAmount || ""}
              min="0.01"
              name="accountingThbAmount"
              required
              step="0.01"
              type="number"
            />
          </label>
          <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#64707d]">
            Paid Date
            <input
              className={inputClass}
              defaultValue={todayBangkok()}
              name="paidDate"
              type="date"
            />
          </label>
          <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#64707d]">
            Payment Reference
            <input
              className={inputClass}
              name="paymentReference"
              placeholder="Bank reference"
            />
          </label>
        </div>
        <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#64707d]">
          Upload Slip File
          <input
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="block w-full rounded-md border border-[#cfd6df] bg-white px-2 py-2 text-sm text-[#172026] file:mr-3 file:rounded-md file:border-0 file:bg-[#172026] file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white"
            name="paymentSlipFile"
            type="file"
          />
          <span className="text-[11px] normal-case tracking-normal text-[#667380]">
            Payment slip proof is required. Upload slip image/PDF or provide external URL. Max 10 MB.
          </span>
        </label>
        <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#64707d]">
          External Payment Slip URL
          <input
            className={inputClass}
            name="paymentSlipUrl"
            placeholder="https://..."
            type="url"
          />
        </label>
        <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#64707d]">
          Accounting Note
          <textarea
            className="min-h-20 rounded-md border border-[#cfd6df] bg-white px-2 py-2 text-sm outline-none focus:border-[#255f85]"
            name="accountingNote"
          />
        </label>
        <ActionMessage state={state} />
        <button className={buttonClass} disabled={pending} type="submit">
          {pending ? "Recording..." : "Confirm Paid"}
        </button>
      </form>
    </details>
  );
}

export function CorrectPaymentSlipForm({
  canCorrect,
  request,
}: {
  canCorrect: boolean;
  request: PaymentApprovalRequest;
}) {
  const [state, formAction, pending] = useActionState(
    correctPaymentSlipAction,
    initialState,
  );

  if (!canCorrect) {
    return null;
  }

  return (
    <details className="mt-3 rounded-md border border-[#cdebd8] bg-white/70">
      <summary className="cursor-pointer list-none px-3 py-2 text-sm font-semibold text-[#255f85] hover:bg-white">
        Correct Payment Proof
      </summary>
      <form action={formAction} className="grid gap-3 border-t border-[#cdebd8] p-3">
        <input name="requestId" type="hidden" value={request.id} />
        <input name="poId" type="hidden" value={request.poId} />
        <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#64707d]">
          Replacement Slip File
          <input
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="block w-full rounded-md border border-[#cfd6df] bg-white px-2 py-2 text-sm text-[#172026] file:mr-3 file:rounded-md file:border-0 file:bg-[#172026] file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white"
            name="paymentSlipFile"
            type="file"
          />
          <span className="text-[11px] normal-case tracking-normal text-[#667380]">
            JPG, PNG, WebP, or PDF. Max 10 MB. Old proof is retained in audit history.
          </span>
        </label>
        <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#64707d]">
          Replacement External Slip URL
          <input
            className={inputClass}
            defaultValue={request.paymentSlipUrl}
            name="paymentSlipUrl"
            placeholder="https://..."
            type="url"
          />
        </label>
        <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#64707d]">
          Correction Reason
          <textarea
            className="min-h-16 rounded-md border border-[#cfd6df] bg-white px-2 py-2 text-sm outline-none focus:border-[#255f85]"
            name="reason"
            placeholder="Explain why this payment proof is being corrected"
            required
          />
        </label>
        <ActionMessage state={state} />
        <button className={buttonClass} disabled={pending} type="submit">
          {pending ? "Correcting..." : "Save Slip Correction"}
        </button>
      </form>
    </details>
  );
}

export function SupportingDocumentForm({
  canManage,
  request,
}: {
  canManage: boolean;
  request: PaymentApprovalRequest;
}) {
  const [state, formAction, pending] = useActionState(
    addPaymentRequestDocumentAction,
    initialState,
  );

  if (!canManage) {
    return null;
  }

  return (
    <details className="mt-3 rounded-md border border-[#dfe4ea] bg-[#fbfcfd]">
      <summary className="cursor-pointer list-none px-3 py-2 text-sm font-semibold text-[#255f85] hover:bg-white">
        Add Supporting Document Link
      </summary>
      <form action={formAction} className="grid gap-3 border-t border-[#edf1f5] p-3">
        <input name="requestId" type="hidden" value={request.id} />
        <input name="poId" type="hidden" value={request.poId} />
        <input name="paymentLineId" type="hidden" value={request.paymentLineId} />
        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#64707d]">
            Document Type
            <select className={inputClass} name="documentType" required>
              {PAYMENT_DOCUMENT_TYPES.map((type: PaymentDocumentType) => (
                <option key={type} value={type}>
                  {documentTypeLabel(type)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#64707d]">
            Title
            <input
              className={inputClass}
              name="documentTitle"
              placeholder="Supplier invoice, quote, import docs..."
              required
            />
          </label>
        </div>
        <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#64707d]">
          URL
          <input className={inputClass} name="documentUrl" placeholder="https://..." required type="url" />
        </label>
        <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#64707d]">
          Note
          <textarea
            className="min-h-16 rounded-md border border-[#cfd6df] bg-white px-2 py-2 text-sm outline-none focus:border-[#255f85]"
            name="note"
          />
        </label>
        <ActionMessage state={state} />
        <button className={buttonClass} disabled={pending} type="submit">
          {pending ? "Adding..." : "Add Link"}
        </button>
      </form>
    </details>
  );
}

export function EditSupportingDocumentForm({
  canManage,
  document,
  request,
}: {
  canManage: boolean;
  document: PaymentRequestDocument;
  request: PaymentApprovalRequest;
}) {
  const [state, formAction, pending] = useActionState(
    updatePaymentRequestDocumentAction,
    initialState,
  );

  if (!canManage) {
    return null;
  }

  return (
    <details className="mt-3 rounded-md border border-[#dfe4ea] bg-white">
      <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold text-[#255f85] hover:bg-[#f7f9fb]">
        Edit
      </summary>
      <form action={formAction} className="grid gap-3 border-t border-[#edf1f5] p-3">
        <input name="documentId" type="hidden" value={document.id} />
        <input name="requestId" type="hidden" value={request.id} />
        <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#64707d]">
          Document Type
          <select className={inputClass} defaultValue={document.documentType} name="documentType" required>
            {PAYMENT_DOCUMENT_TYPES.map((type: PaymentDocumentType) => (
              <option key={type} value={type}>
                {documentTypeLabel(type)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#64707d]">
          Title
          <input className={inputClass} defaultValue={document.documentTitle} name="documentTitle" required />
        </label>
        <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#64707d]">
          URL
          <input className={inputClass} defaultValue={document.documentUrl} name="documentUrl" required type="url" />
        </label>
        <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#64707d]">
          Note
          <textarea
            className="min-h-16 rounded-md border border-[#cfd6df] bg-white px-2 py-2 text-sm outline-none focus:border-[#255f85]"
            defaultValue={document.note}
            name="note"
          />
        </label>
        <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#64707d]">
          Correction Reason
          <textarea
            className="min-h-16 rounded-md border border-[#cfd6df] bg-white px-2 py-2 text-sm outline-none focus:border-[#255f85]"
            name="reason"
            placeholder="Required after approval or payment"
            required={["approved", "paid"].includes(request.requestStatus)}
          />
        </label>
        <ActionMessage state={state} />
        <button className={buttonClass} disabled={pending} type="submit">
          {pending ? "Saving..." : "Save Document Changes"}
        </button>
      </form>
    </details>
  );
}

export function RemoveSupportingDocumentForm({
  canManage,
  document,
  request,
}: {
  canManage: boolean;
  document: PaymentRequestDocument;
  request: PaymentApprovalRequest;
}) {
  const [state, formAction, pending] = useActionState(
    removePaymentRequestDocumentAction,
    initialState,
  );

  if (!canManage) {
    return null;
  }

  return (
    <details className="mt-2 rounded-md border border-[#ffd6d6] bg-white">
      <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold text-[#b42318] hover:bg-[#fff5f5]">
        Remove from Current Pack
      </summary>
      <form action={formAction} className="grid gap-3 border-t border-[#ffd6d6] p-3">
        <input name="documentId" type="hidden" value={document.id} />
        <input name="requestId" type="hidden" value={request.id} />
        <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#64707d]">
          Removal Reason
          <textarea
            className="min-h-16 rounded-md border border-[#cfd6df] bg-white px-2 py-2 text-sm outline-none focus:border-[#255f85]"
            name="reason"
            placeholder="Explain why this document should no longer appear as current support"
            required
          />
        </label>
        <ActionMessage state={state} />
        <button className={secondaryButtonClass} disabled={pending} type="submit">
          {pending ? "Removing..." : "Remove Document"}
        </button>
      </form>
    </details>
  );
}

export function VoidPaymentRequestForm({
  canVoid,
  request,
}: {
  canVoid: boolean;
  request: PaymentApprovalRequest;
}) {
  const [state, formAction, pending] = useActionState(
    voidPaymentRequestAction,
    initialState,
  );

  if (!canVoid) {
    return null;
  }

  return (
    <details className="mt-3 rounded-md border border-[#ffd6d6] bg-[#fffafa]">
      <summary className="cursor-pointer list-none px-3 py-2 text-sm font-semibold text-[#b42318] hover:bg-white">
        Void Payment Request
      </summary>
      <form action={formAction} className="grid gap-3 border-t border-[#ffd6d6] p-3">
        <input name="requestId" type="hidden" value={request.id} />
        <input name="poId" type="hidden" value={request.poId} />
        <label className="flex items-start gap-2 text-sm text-[#364252]">
          <input className="mt-1" name="confirmVoid" required type="checkbox" value="yes" />
          I understand this will void the payment request for active workflows, keep all history,
          and may revert the linked payment row only when it can be matched to this request.
        </label>
        <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#64707d]">
          Void Reason
          <textarea
            className="min-h-20 rounded-md border border-[#cfd6df] bg-white px-2 py-2 text-sm outline-none focus:border-[#255f85]"
            name="reason"
            placeholder="Test record only, wrong slip uploaded, duplicate request..."
            required
          />
        </label>
        <ActionMessage state={state} />
        <button className={secondaryButtonClass} disabled={pending} type="submit">
          {pending ? "Voiding..." : "Void Payment Request"}
        </button>
      </form>
    </details>
  );
}
