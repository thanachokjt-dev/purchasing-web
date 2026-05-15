import "server-only";

import { getCurrentUserProfile, type CurrentUserProfile } from "@/lib/auth";
import {
  canApprovePaymentRequest,
  canManagePayments,
  getProfileAccessRole,
} from "@/lib/access-control";
import {
  PAYMENT_DOCUMENT_TYPES,
  type PaymentDocumentType,
} from "@/lib/payment-approval-shared";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

export type PaymentRequestStatus =
  | "draft"
  | "pending_review"
  | "pending_approval"
  | "approved"
  | "paid"
  | "rejected"
  | "cancelled"
  | "voided";

export type PaymentApprovalStepType =
  | "retail_review"
  | "reviewer"
  | "preliminary_approval"
  | "final_approval";

export type PaymentApprovalStepStatus =
  | "pending"
  | "active"
  | "approved"
  | "rejected"
  | "skipped"
  | "cancelled";

export type ApprovalUserOption = {
  authUserId: string;
  displayName: string;
  email: string;
  role: string;
};

export type PaymentRequestDocument = {
  createdAt: string;
  createdBy: string;
  createdByProfile?: ApprovalUserOption;
  documentTitle: string;
  documentType: PaymentDocumentType;
  documentUrl: string;
  id: string;
  isActive: boolean;
  note: string;
  paymentLineId: string;
  paymentRequestId: string;
  poId: string;
  removeReason: string;
  removedAt: string;
  removedBy: string;
  removedByProfile?: ApprovalUserOption;
  updatedAt: string;
  updatedBy: string;
  updatedByProfile?: ApprovalUserOption;
};

export type PaymentProofAuditLog = {
  actionType: string;
  changedAt: string;
  changedBy: string;
  changedByProfile?: ApprovalUserOption;
  id: string;
  newContentType: string;
  newExternalUrl: string;
  newFileName: string;
  newStoragePath: string;
  oldContentType: string;
  oldExternalUrl: string;
  oldFileName: string;
  oldStoragePath: string;
  paymentRequestId: string;
  reason: string;
};

export type PaymentRequestDocumentAuditLog = {
  actionType: string;
  changedAt: string;
  changedBy: string;
  changedByProfile?: ApprovalUserOption;
  documentId: string;
  id: string;
  newDocumentType: string;
  newNote: string;
  newTitle: string;
  newUrl: string;
  oldDocumentType: string;
  oldNote: string;
  oldTitle: string;
  oldUrl: string;
  paymentRequestId: string;
  reason: string;
};

export type PaymentRequestAuditLog = {
  actionType: string;
  changedAt: string;
  changedBy: string;
  changedByProfile?: ApprovalUserOption;
  id: string;
  newStatus: string;
  newValues: Record<string, unknown> | null;
  oldStatus: string;
  oldValues: Record<string, unknown> | null;
  paymentRequestId: string;
  reason: string;
};

export type PaymentApprovalStep = {
  actionAt: string;
  actionBy: string;
  activeAt: string;
  assignedRole: string;
  assignedUserId: string;
  assignedUser?: ApprovalUserOption;
  evidenceRequired: boolean;
  evidenceUrl: string;
  id: string;
  isRequired: boolean;
  note: string;
  status: PaymentApprovalStepStatus;
  stepOrder: number;
  stepType: PaymentApprovalStepType;
};

export type PaymentApprovalRequest = {
  accountingCurrency: string;
  accountingFxRate: number;
  accountingNote: string;
  accountingPaidAmount: number;
  accountingRecordedAt: string;
  accountingRecordedBy: string;
  accountingRecordedByProfile?: ApprovalUserOption;
  accountingThbAmount: number;
  approvedAt: string;
  cancelledAt: string;
  dueDate: string;
  id: string;
  paymentLineId: string;
  paymentReference: string;
  paymentSlipContentType: string;
  paymentSlipFileName: string;
  paymentSlipSignedUrl: string;
  paymentSlipStoragePath: string;
  paymentSlipUploadedAt: string;
  paymentSlipUploadedBy: string;
  paymentSlipUploadedByProfile?: ApprovalUserOption;
  paymentSlipUrl: string;
  paidAt: string;
  paidBy: string;
  paidByProfile?: ApprovalUserOption;
  paymentType: string;
  poId: string;
  rejectedAt: string;
  requestNote: string;
  requestStatus: PaymentRequestStatus;
  requestedAmount: number;
  requestedAt: string;
  requestedBy: string;
  requestedByProfile?: ApprovalUserOption;
  requestedCurrency: string;
  requestedFxRate: number;
  requestedThbAmount: number;
  documents: PaymentRequestDocument[];
  documentAuditLogs: PaymentRequestDocumentAuditLog[];
  proofAuditLogs: PaymentProofAuditLog[];
  requestAuditLogs: PaymentRequestAuditLog[];
  steps: PaymentApprovalStep[];
  voidReason: string;
  voidedAt: string;
  voidedBy: string;
  voidedByProfile?: ApprovalUserOption;
};

type ProfileRow = {
  auth_user_id: string | null;
  display_name: string | null;
  email: string;
  role: string | null;
};

type RequestRow = {
  accounting_currency?: string | null;
  accounting_fx_rate?: number | string | null;
  accounting_note?: string | null;
  accounting_paid_amount?: number | string | null;
  accounting_recorded_at?: string | null;
  accounting_recorded_by?: string | null;
  accounting_thb_amount?: number | string | null;
  approved_at: string | null;
  cancelled_at: string | null;
  due_date: string | null;
  id: string;
  paid_at?: string | null;
  paid_by?: string | null;
  payment_line_id: string | null;
  payment_reference?: string | null;
  payment_slip_content_type?: string | null;
  payment_slip_file_name?: string | null;
  payment_slip_storage_path?: string | null;
  payment_slip_uploaded_at?: string | null;
  payment_slip_uploaded_by?: string | null;
  payment_slip_url?: string | null;
  payment_type: string | null;
  po_id: string;
  rejected_at: string | null;
  request_note: string | null;
  request_status: PaymentRequestStatus;
  requested_amount: number | string | null;
  requested_at: string | null;
  requested_by: string | null;
  requested_currency: string | null;
  requested_fx_rate: number | string | null;
  requested_thb_amount: number | string | null;
  void_reason?: string | null;
  voided_at?: string | null;
  voided_by?: string | null;
};

type StepRow = {
  action_at: string | null;
  action_by: string | null;
  active_at: string | null;
  assigned_role: string | null;
  assigned_user_id: string | null;
  evidence_required: boolean | null;
  evidence_url: string | null;
  id: string;
  is_required: boolean | null;
  note: string | null;
  payment_request_id: string;
  status: PaymentApprovalStepStatus;
  step_order: number;
  step_type: PaymentApprovalStepType;
};

type DocumentRow = {
  created_at: string | null;
  created_by: string | null;
  document_title: string | null;
  document_type: string | null;
  document_url: string | null;
  id: string;
  is_active?: boolean | null;
  note: string | null;
  payment_line_id: string | null;
  payment_request_id: string;
  po_id: string | null;
  remove_reason?: string | null;
  removed_at?: string | null;
  removed_by?: string | null;
  updated_at?: string | null;
  updated_by?: string | null;
};

type ProofAuditRow = {
  action_type: string;
  changed_at: string | null;
  changed_by: string | null;
  id: string;
  new_content_type: string | null;
  new_external_url: string | null;
  new_file_name: string | null;
  new_storage_path: string | null;
  old_content_type: string | null;
  old_external_url: string | null;
  old_file_name: string | null;
  old_storage_path: string | null;
  payment_request_id: string;
  reason: string | null;
};

type DocumentAuditRow = {
  action_type: string;
  changed_at: string | null;
  changed_by: string | null;
  document_id: string | null;
  id: string;
  new_document_type: string | null;
  new_note: string | null;
  new_title: string | null;
  new_url: string | null;
  old_document_type: string | null;
  old_note: string | null;
  old_title: string | null;
  old_url: string | null;
  payment_request_id: string;
  reason: string | null;
};

type RequestAuditRow = {
  action_type: string;
  changed_at: string | null;
  changed_by: string | null;
  id: string;
  new_status: string | null;
  new_values: Record<string, unknown> | null;
  old_status: string | null;
  old_values: Record<string, unknown> | null;
  payment_request_id: string;
  reason: string | null;
};

const REQUEST_SELECT_PHASE_2 =
  "id,po_id,payment_line_id,request_status,payment_type,requested_amount,requested_currency,requested_fx_rate,requested_thb_amount,due_date,request_note,requested_by,requested_at,approved_at,rejected_at,cancelled_at";
const REQUEST_SELECT_WITH_ACCOUNTING =
  `${REQUEST_SELECT_PHASE_2},accounting_paid_amount,accounting_currency,accounting_fx_rate,accounting_thb_amount,paid_at,paid_by,payment_reference,payment_slip_url,accounting_note,accounting_recorded_at,accounting_recorded_by`;
const REQUEST_SELECT_WITH_PROOF =
  `${REQUEST_SELECT_WITH_ACCOUNTING},payment_slip_storage_path,payment_slip_file_name,payment_slip_content_type,payment_slip_uploaded_at,payment_slip_uploaded_by,voided_at,voided_by,void_reason`;

function numeric(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function schemaColumnMiss(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes("schema cache") || normalized.includes("column");
}

async function paymentRequestRowsForPo(poId: string) {
  const supabase = getSupabaseServiceClient();

  if (!supabase) {
    return [];
  }

  const query = () =>
    supabase
      .from("payment_requests")
      .select(REQUEST_SELECT_WITH_PROOF)
      .eq("po_id", poId)
      .order("created_at", { ascending: false });
  const { data, error } = await query();

  if (!error) {
    return (data ?? []) as RequestRow[];
  }

  if (!schemaColumnMiss(error.message)) {
    return [];
  }

  const { data: accountingData, error: accountingError } = await supabase
    .from("payment_requests")
    .select(REQUEST_SELECT_WITH_ACCOUNTING)
    .eq("po_id", poId)
    .order("created_at", { ascending: false });

  if (!accountingError) {
    return (accountingData ?? []) as RequestRow[];
  }

  if (!schemaColumnMiss(accountingError.message)) {
    return [];
  }

  const { data: fallbackData, error: fallbackError } = await supabase
    .from("payment_requests")
    .select(REQUEST_SELECT_PHASE_2)
    .eq("po_id", poId)
    .order("created_at", { ascending: false });

  if (fallbackError) {
    return [];
  }

  return (fallbackData ?? []) as RequestRow[];
}

async function visiblePaymentRequestRows() {
  const supabase = getSupabaseServiceClient();

  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("payment_requests")
    .select(REQUEST_SELECT_WITH_PROOF)
    .order("created_at", { ascending: false })
    .limit(100);

  if (!error) {
    return (data ?? []) as RequestRow[];
  }

  if (!schemaColumnMiss(error.message)) {
    return [];
  }

  const { data: accountingData, error: accountingError } = await supabase
    .from("payment_requests")
    .select(REQUEST_SELECT_WITH_ACCOUNTING)
    .order("created_at", { ascending: false })
    .limit(100);

  if (!accountingError) {
    return (accountingData ?? []) as RequestRow[];
  }

  if (!schemaColumnMiss(accountingError.message)) {
    return [];
  }

  const { data: fallbackData, error: fallbackError } = await supabase
    .from("payment_requests")
    .select(REQUEST_SELECT_PHASE_2)
    .order("created_at", { ascending: false })
    .limit(100);

  if (fallbackError) {
    return [];
  }

  return (fallbackData ?? []) as RequestRow[];
}

function profileOption(row: ProfileRow): ApprovalUserOption | null {
  if (!row.auth_user_id) {
    return null;
  }

  return {
    authUserId: row.auth_user_id,
    displayName: row.display_name ?? "",
    email: row.email,
    role: row.role ?? "viewer",
  };
}

function mapRequest(
  request: RequestRow,
  documentAuditLogs: DocumentAuditRow[],
  documents: DocumentRow[],
  proofAuditLogs: ProofAuditRow[],
  requestAuditLogs: RequestAuditRow[],
  steps: StepRow[],
  profilesByAuthId: Map<string, ApprovalUserOption>,
) {
  return {
    accountingCurrency: request.accounting_currency ?? "",
    accountingFxRate: numeric(request.accounting_fx_rate),
    accountingNote: request.accounting_note ?? "",
    accountingPaidAmount: numeric(request.accounting_paid_amount),
    accountingRecordedAt: request.accounting_recorded_at ?? "",
    accountingRecordedBy: request.accounting_recorded_by ?? "",
    accountingRecordedByProfile: request.accounting_recorded_by
      ? profilesByAuthId.get(request.accounting_recorded_by)
      : undefined,
    accountingThbAmount: numeric(request.accounting_thb_amount),
    approvedAt: request.approved_at ?? "",
    cancelledAt: request.cancelled_at ?? "",
    dueDate: request.due_date ?? "",
    id: request.id,
    paymentLineId: request.payment_line_id ?? "",
    paymentReference: request.payment_reference ?? "",
    paymentSlipContentType: request.payment_slip_content_type ?? "",
    paymentSlipFileName: request.payment_slip_file_name ?? "",
    paymentSlipSignedUrl: "",
    paymentSlipStoragePath: request.payment_slip_storage_path ?? "",
    paymentSlipUploadedAt: request.payment_slip_uploaded_at ?? "",
    paymentSlipUploadedBy: request.payment_slip_uploaded_by ?? "",
    paymentSlipUploadedByProfile: request.payment_slip_uploaded_by
      ? profilesByAuthId.get(request.payment_slip_uploaded_by)
      : undefined,
    paymentSlipUrl: request.payment_slip_url ?? "",
    paidAt: request.paid_at ?? "",
    paidBy: request.paid_by ?? "",
    paidByProfile: request.paid_by ? profilesByAuthId.get(request.paid_by) : undefined,
    paymentType: request.payment_type ?? "",
    poId: request.po_id,
    rejectedAt: request.rejected_at ?? "",
    requestNote: request.request_note ?? "",
    requestStatus: request.request_status,
    requestedAmount: numeric(request.requested_amount),
    requestedAt: request.requested_at ?? "",
    requestedBy: request.requested_by ?? "",
    requestedByProfile: request.requested_by
      ? profilesByAuthId.get(request.requested_by)
      : undefined,
    requestedCurrency: request.requested_currency ?? "THB",
    requestedFxRate: numeric(request.requested_fx_rate),
    requestedThbAmount: numeric(request.requested_thb_amount),
    documents: documents
      .filter((document) => document.payment_request_id === request.id)
      .map((document) => ({
        createdAt: document.created_at ?? "",
        createdBy: document.created_by ?? "",
        createdByProfile: document.created_by
          ? profilesByAuthId.get(document.created_by)
          : undefined,
        documentTitle: document.document_title ?? "",
        documentType: PAYMENT_DOCUMENT_TYPES.includes(document.document_type as PaymentDocumentType)
          ? (document.document_type as PaymentDocumentType)
          : "other",
        documentUrl: document.document_url ?? "",
        id: document.id,
        isActive: document.is_active ?? true,
        note: document.note ?? "",
        paymentLineId: document.payment_line_id ?? "",
        paymentRequestId: document.payment_request_id,
        poId: document.po_id ?? "",
        removeReason: document.remove_reason ?? "",
        removedAt: document.removed_at ?? "",
        removedBy: document.removed_by ?? "",
        removedByProfile: document.removed_by
          ? profilesByAuthId.get(document.removed_by)
          : undefined,
        updatedAt: document.updated_at ?? "",
        updatedBy: document.updated_by ?? "",
        updatedByProfile: document.updated_by
          ? profilesByAuthId.get(document.updated_by)
          : undefined,
      })),
    documentAuditLogs: documentAuditLogs
      .filter((log) => log.payment_request_id === request.id)
      .map((log) => ({
        actionType: log.action_type,
        changedAt: log.changed_at ?? "",
        changedBy: log.changed_by ?? "",
        changedByProfile: log.changed_by ? profilesByAuthId.get(log.changed_by) : undefined,
        documentId: log.document_id ?? "",
        id: log.id,
        newDocumentType: log.new_document_type ?? "",
        newNote: log.new_note ?? "",
        newTitle: log.new_title ?? "",
        newUrl: log.new_url ?? "",
        oldDocumentType: log.old_document_type ?? "",
        oldNote: log.old_note ?? "",
        oldTitle: log.old_title ?? "",
        oldUrl: log.old_url ?? "",
        paymentRequestId: log.payment_request_id,
        reason: log.reason ?? "",
      })),
    proofAuditLogs: proofAuditLogs
      .filter((log) => log.payment_request_id === request.id)
      .map((log) => ({
        actionType: log.action_type,
        changedAt: log.changed_at ?? "",
        changedBy: log.changed_by ?? "",
        changedByProfile: log.changed_by ? profilesByAuthId.get(log.changed_by) : undefined,
        id: log.id,
        newContentType: log.new_content_type ?? "",
        newExternalUrl: log.new_external_url ?? "",
        newFileName: log.new_file_name ?? "",
        newStoragePath: log.new_storage_path ?? "",
        oldContentType: log.old_content_type ?? "",
        oldExternalUrl: log.old_external_url ?? "",
        oldFileName: log.old_file_name ?? "",
        oldStoragePath: log.old_storage_path ?? "",
        paymentRequestId: log.payment_request_id,
        reason: log.reason ?? "",
      })),
    requestAuditLogs: requestAuditLogs
      .filter((log) => log.payment_request_id === request.id)
      .map((log) => ({
        actionType: log.action_type,
        changedAt: log.changed_at ?? "",
        changedBy: log.changed_by ?? "",
        changedByProfile: log.changed_by ? profilesByAuthId.get(log.changed_by) : undefined,
        id: log.id,
        newStatus: log.new_status ?? "",
        newValues: log.new_values ?? null,
        oldStatus: log.old_status ?? "",
        oldValues: log.old_values ?? null,
        paymentRequestId: log.payment_request_id,
        reason: log.reason ?? "",
      })),
    steps: steps
      .filter((step) => step.payment_request_id === request.id)
      .sort((a, b) => a.step_order - b.step_order)
      .map((step) => ({
        actionAt: step.action_at ?? "",
        actionBy: step.action_by ?? "",
        activeAt: step.active_at ?? "",
        assignedRole: step.assigned_role ?? "",
        assignedUserId: step.assigned_user_id ?? "",
        assignedUser: step.assigned_user_id
          ? profilesByAuthId.get(step.assigned_user_id)
          : undefined,
        evidenceRequired: step.evidence_required ?? false,
        evidenceUrl: step.evidence_url ?? "",
        id: step.id,
        isRequired: step.is_required ?? true,
        note: step.note ?? "",
        status: step.status,
        stepOrder: step.step_order,
        stepType: step.step_type,
      })),
    voidReason: request.void_reason ?? "",
    voidedAt: request.voided_at ?? "",
    voidedBy: request.voided_by ?? "",
    voidedByProfile: request.voided_by ? profilesByAuthId.get(request.voided_by) : undefined,
  } satisfies PaymentApprovalRequest;
}

export async function getApprovalUserOptions() {
  const supabase = getSupabaseServiceClient();

  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("user_profiles")
    .select("auth_user_id,display_name,email,role")
    .eq("is_active", true)
    .in("role", [
      "super_admin",
      "final_approver",
      "preliminary_approver",
      "reviewer",
      "retail_manager",
    ])
    .order("email", { ascending: true });

  if (error) {
    return [];
  }

  return ((data ?? []) as ProfileRow[]).flatMap((row) => {
    const option = profileOption(row);
    return option ? [option] : [];
  });
}

export async function getPaymentRequestsForPo(poId: string) {
  const requests = await paymentRequestRowsForPo(poId);

  if (!requests.length) {
    return [];
  }

  return hydrateRequests(requests);
}

export async function getVisiblePaymentRequests() {
  const profile = await getCurrentUserProfile();
  const supabase = getSupabaseServiceClient();

  if (!profile || !supabase) {
    return { profile, requests: [] as PaymentApprovalRequest[] };
  }

  const allRequests = await visiblePaymentRequestRows();

  if (!allRequests.length) {
    return { profile, requests: [] as PaymentApprovalRequest[] };
  }

  const requests = await hydrateRequests(allRequests);

  if (profile.role === "super_admin" || getProfileAccessRole(profile) === "executive_readonly") {
    return { profile, requests };
  }

  const visible = requests.filter(
    (request) =>
      request.requestStatus !== "voided" &&
      (request.requestedBy === profile.authUserId ||
        request.steps.some((step) => step.assignedUserId === profile.authUserId) ||
        (profile.role === "accounting" &&
          ["approved", "paid"].includes(request.requestStatus))),
  );

  return { profile, requests: visible };
}

async function paymentRequestDocumentRows(requestIds: string[]) {
  const supabase = getSupabaseServiceClient();

  if (!supabase || requestIds.length === 0) {
    return [] as DocumentRow[];
  }

  const { data, error } = await supabase
    .from("payment_request_documents")
    .select(
      "id,payment_request_id,po_id,payment_line_id,document_type,document_title,document_url,note,created_by,created_at,is_active,updated_by,updated_at,removed_by,removed_at,remove_reason",
    )
    .in("payment_request_id", requestIds)
    .order("created_at", { ascending: false });

  if (!error) {
    return (data ?? []) as DocumentRow[];
  }

  if (!schemaColumnMiss(error.message)) {
    return [];
  }

  const { data: fallbackData, error: fallbackError } = await supabase
    .from("payment_request_documents")
    .select(
      "id,payment_request_id,po_id,payment_line_id,document_type,document_title,document_url,note,created_by,created_at",
    )
    .in("payment_request_id", requestIds)
    .order("created_at", { ascending: false });

  if (fallbackError) {
    return [];
  }

  return (fallbackData ?? []) as DocumentRow[];
}

async function paymentProofAuditRows(requestIds: string[]) {
  const supabase = getSupabaseServiceClient();

  if (!supabase || requestIds.length === 0) {
    return [] as ProofAuditRow[];
  }

  const { data, error } = await supabase
    .from("payment_proof_audit_logs")
    .select(
      "id,payment_request_id,action_type,old_storage_path,old_file_name,old_content_type,old_external_url,new_storage_path,new_file_name,new_content_type,new_external_url,reason,changed_by,changed_at",
    )
    .in("payment_request_id", requestIds)
    .order("changed_at", { ascending: false });

  if (error) {
    return [];
  }

  return (data ?? []) as ProofAuditRow[];
}

async function paymentDocumentAuditRows(requestIds: string[]) {
  const supabase = getSupabaseServiceClient();

  if (!supabase || requestIds.length === 0) {
    return [] as DocumentAuditRow[];
  }

  const { data, error } = await supabase
    .from("payment_request_document_audit_logs")
    .select(
      "id,document_id,payment_request_id,action_type,old_document_type,old_title,old_url,old_note,new_document_type,new_title,new_url,new_note,reason,changed_by,changed_at",
    )
    .in("payment_request_id", requestIds)
    .order("changed_at", { ascending: false });

  if (error) {
    return [];
  }

  return (data ?? []) as DocumentAuditRow[];
}

async function paymentRequestAuditRows(requestIds: string[]) {
  const supabase = getSupabaseServiceClient();

  if (!supabase || requestIds.length === 0) {
    return [] as RequestAuditRow[];
  }

  const { data, error } = await supabase
    .from("payment_request_audit_logs")
    .select(
      "id,payment_request_id,action_type,old_status,new_status,old_values,new_values,reason,changed_by,changed_at",
    )
    .in("payment_request_id", requestIds)
    .order("changed_at", { ascending: false });

  if (error) {
    return [];
  }

  return (data ?? []) as RequestAuditRow[];
}

async function hydrateRequests(requests: RequestRow[]) {
  const supabase = getSupabaseServiceClient();

  if (!supabase || requests.length === 0) {
    return [];
  }

  const requestIds = requests.map((request) => request.id);
  const [{ data: steps }, documents, proofAuditLogs, documentAuditLogs, requestAuditLogs] = await Promise.all([
    supabase
      .from("payment_approval_steps")
      .select(
        "id,payment_request_id,step_order,step_type,assigned_user_id,assigned_role,is_required,status,active_at,action_by,action_at,note,evidence_url,evidence_required",
      )
      .in("payment_request_id", requestIds)
      .order("step_order", { ascending: true }),
    paymentRequestDocumentRows(requestIds),
    paymentProofAuditRows(requestIds),
    paymentDocumentAuditRows(requestIds),
    paymentRequestAuditRows(requestIds),
  ]);

  const authUserIds = new Set<string>();
  for (const request of requests) {
    if (request.requested_by) {
      authUserIds.add(request.requested_by);
    }
    if (request.paid_by) {
      authUserIds.add(request.paid_by);
    }
    if (request.accounting_recorded_by) {
      authUserIds.add(request.accounting_recorded_by);
    }
    if (request.payment_slip_uploaded_by) {
      authUserIds.add(request.payment_slip_uploaded_by);
    }
    if (request.voided_by) {
      authUserIds.add(request.voided_by);
    }
  }
  for (const step of (steps ?? []) as StepRow[]) {
    if (step.assigned_user_id) {
      authUserIds.add(step.assigned_user_id);
    }
    if (step.action_by) {
      authUserIds.add(step.action_by);
    }
  }
  for (const document of (documents ?? []) as DocumentRow[]) {
    if (document.created_by) {
      authUserIds.add(document.created_by);
    }
    if (document.updated_by) {
      authUserIds.add(document.updated_by);
    }
    if (document.removed_by) {
      authUserIds.add(document.removed_by);
    }
  }
  for (const log of proofAuditLogs) {
    if (log.changed_by) {
      authUserIds.add(log.changed_by);
    }
  }
  for (const log of documentAuditLogs) {
    if (log.changed_by) {
      authUserIds.add(log.changed_by);
    }
  }
  for (const log of requestAuditLogs) {
    if (log.changed_by) {
      authUserIds.add(log.changed_by);
    }
  }

  const profilesByAuthId = new Map<string, ApprovalUserOption>();
  if (authUserIds.size > 0) {
    const { data: profiles } = await supabase
      .from("user_profiles")
      .select("auth_user_id,display_name,email,role")
      .in("auth_user_id", Array.from(authUserIds));

    for (const profile of (profiles ?? []) as ProfileRow[]) {
      const option = profileOption(profile);
      if (option) {
        profilesByAuthId.set(option.authUserId, option);
      }
    }
  }

  const mapped = requests.map((request) =>
    mapRequest(
      request,
      documentAuditLogs,
      (documents ?? []) as DocumentRow[],
      proofAuditLogs,
      requestAuditLogs,
      (steps ?? []) as StepRow[],
      profilesByAuthId,
    ),
  );

  await Promise.all(
    mapped.map(async (request) => {
      if (!request.paymentSlipStoragePath) {
        return;
      }

      const { data } = await supabase.storage
        .from("payment-proofs")
        .createSignedUrl(request.paymentSlipStoragePath, 60 * 60);

      request.paymentSlipSignedUrl = data?.signedUrl ?? "";
    }),
  );

  return mapped;
}

export async function getPaymentRequestById(requestId: string) {
  const supabase = getSupabaseServiceClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("payment_requests")
    .select(REQUEST_SELECT_WITH_PROOF)
    .eq("id", requestId)
    .maybeSingle();

  if (!error && data) {
    const requests = await hydrateRequests([data as RequestRow]);
    return requests[0] ?? null;
  }

  if (error && !schemaColumnMiss(error.message)) {
    return null;
  }

  const { data: fallbackData, error: fallbackError } = await supabase
    .from("payment_requests")
    .select(REQUEST_SELECT_PHASE_2)
    .eq("id", requestId)
    .maybeSingle();

  if (fallbackError || !fallbackData) {
    return null;
  }

  const requests = await hydrateRequests([fallbackData as RequestRow]);
  return requests[0] ?? null;
}

export function canViewPaymentRequest(
  profile: CurrentUserProfile,
  request: PaymentApprovalRequest,
) {
  return (
    profile.role === "super_admin" ||
    profile.role === "accounting" ||
    request.requestedBy === profile.authUserId ||
    request.steps.some((step) => step.assignedUserId === profile.authUserId)
  );
}

export function canManagePaymentDocuments(
  profile: CurrentUserProfile,
  request: PaymentApprovalRequest,
) {
  if (!canManagePayments(profile.email)) {
    return false;
  }

  return (
    profile.role === "super_admin" ||
    profile.role === "accounting" ||
    request.requestedBy === profile.authUserId ||
    request.steps.some((step) => step.assignedUserId === profile.authUserId)
  );
}

export function canPrintPaymentPack(
  profile: CurrentUserProfile,
  request: PaymentApprovalRequest,
) {
  return (
    ["approved", "paid"].includes(request.requestStatus) &&
    (profile.role === "super_admin" ||
      profile.role === "accounting" ||
      request.requestedBy === profile.authUserId ||
      request.steps.some((step) => step.assignedUserId === profile.authUserId))
  );
}

export function canActOnStep(profile: CurrentUserProfile, step: PaymentApprovalStep) {
  if (!canApprovePaymentRequest(profile.email)) {
    return false;
  }

  return (
    step.status === "active" &&
    (profile.role === "super_admin" || step.assignedUserId === profile.authUserId)
  );
}

export function canConfirmPayment(profile: CurrentUserProfile, request: PaymentApprovalRequest) {
  if (!canManagePayments(profile.email)) {
    return false;
  }

  return (
    request.requestStatus === "approved" &&
    (profile.role === "accounting" || profile.role === "super_admin")
  );
}

export function canCorrectPaymentProof(profile: CurrentUserProfile, request: PaymentApprovalRequest) {
  if (!canManagePayments(profile.email)) {
    return false;
  }

  return (
    request.requestStatus === "paid" &&
    (profile.role === "accounting" || profile.role === "super_admin")
  );
}

export function canVoidPaymentRequest(profile: CurrentUserProfile, request: PaymentApprovalRequest) {
  if (!canManagePayments(profile.email)) {
    return false;
  }

  return (
    profile.role === "super_admin" &&
    ["approved", "paid", "pending_approval", "pending_review"].includes(request.requestStatus)
  );
}
