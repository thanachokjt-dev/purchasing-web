"use server";

import { revalidatePath } from "next/cache";
import {
  canApprovePaymentRequest,
  canManagePayments,
} from "@/lib/access-control";
import { getCurrentUserProfile } from "@/lib/auth";
import {
  canCorrectPaymentProof,
  canManagePaymentDocuments,
  getPaymentRequestById,
} from "@/lib/payment-approvals";
import {
  PAYMENT_DOCUMENT_TYPES,
  type PaymentDocumentType,
} from "@/lib/payment-approval-shared";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

export type PaymentRequestActionState = {
  ok: boolean;
  message: string;
};

const initialError = (message: string): PaymentRequestActionState => ({
  ok: false,
  message,
});
const success = (message: string): PaymentRequestActionState => ({
  ok: true,
  message,
});

type ProfileRow = {
  auth_user_id: string | null;
  email: string;
  role: string | null;
};

type PaymentRow = {
  amount: number | string | null;
  amount_thb?: number | string | null;
  currency: string | null;
  due_date?: string | null;
  exchange_rate?: number | string | null;
  id: string;
  payment_date: string | null;
  payment_status?: string | null;
  payment_type: string | null;
  po_id: string | null;
};

type StepRow = {
  assigned_user_id: string | null;
  id: string;
  is_required: boolean | null;
  status: string;
  step_order: number;
  step_type: string;
};

type AccountingRequestRow = {
  accounting_currency?: string | null;
  accounting_fx_rate?: number | string | null;
  accounting_paid_amount?: number | string | null;
  accounting_recorded_at?: string | null;
  accounting_thb_amount?: number | string | null;
  id: string;
  paid_at?: string | null;
  paid_by?: string | null;
  payment_reference?: string | null;
  payment_slip_content_type?: string | null;
  payment_slip_file_name?: string | null;
  payment_line_id: string | null;
  payment_slip_storage_path?: string | null;
  payment_slip_url?: string | null;
  po_id: string;
  request_status: string;
};

type LinkedPaymentRow = {
  amount: number | string | null;
  amount_thb: number | string | null;
  currency: string | null;
  exchange_rate: number | string | null;
  id: string;
  note: string | null;
  paid_by?: string | null;
  payment_date: string | null;
  payment_status: string | null;
  reference: string | null;
};

type DocumentRow = {
  document_title: string | null;
  document_type: string | null;
  document_url: string | null;
  id: string;
  is_active?: boolean | null;
  note: string | null;
  payment_line_id: string | null;
  payment_request_id: string;
  po_id: string | null;
};

type SlipFile = {
  arrayBuffer: () => Promise<ArrayBuffer>;
  name: string;
  size: number;
  type: string;
};

const INITIAL_APPROVER_EMAILS = {
  finalApprover: "will@bangtaomuaythai.com",
  kevin: "kevin@bangtaomuaythai.com",
  lewis: "lewis@bangtaomuaythai.com",
  retailManager: "saytarn.a@bangtaomuaythai.com",
};
const PAYMENT_PROOF_BUCKET = "payment-proofs";
const MAX_PAYMENT_PROOF_BYTES = 10 * 1024 * 1024;
const ALLOWED_PAYMENT_PROOF_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function schemaObjectMissing(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("schema cache") ||
    normalized.includes("column") ||
    normalized.includes("relation") ||
    normalized.includes("does not exist")
  );
}

function text(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function optionalText(formData: FormData, name: string) {
  const value = text(formData, name);
  return value || null;
}

function numeric(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function positiveAmount(formData: FormData, name: string) {
  const value = numeric(text(formData, name));
  if (value <= 0) {
    throw new Error(`${name} must be greater than 0.`);
  }
  return value;
}

function positiveRate(formData: FormData, name: string) {
  const value = numeric(text(formData, name));
  if (value <= 0) {
    throw new Error(`${name} must be greater than 0.`);
  }
  return value;
}

function paidDateValue(formData: FormData) {
  const paidDate = text(formData, "paidDate");
  if (!paidDate) {
    return new Date();
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paidDate)) {
    throw new Error("Paid date must be a valid date.");
  }
  return new Date(`${paidDate}T00:00:00+07:00`);
}

function validateOptionalUrl(value: string | null, label = "Payment slip URL") {
  if (!value) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid URL.`);
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error(`${label} must start with http or https.`);
  }
  return value;
}

function validateRequiredUrl(value: string | null, label: string) {
  const url = validateOptionalUrl(value, label);
  if (!url) {
    throw new Error(`${label} is required.`);
  }
  return url;
}

function requiredReason(formData: FormData, name = "reason") {
  const reason = text(formData, name);
  if (!reason) {
    throw new Error("Correction reason is required.");
  }
  return reason;
}

function requiredVoidReason(formData: FormData) {
  const confirmed = text(formData, "confirmVoid") === "yes";
  if (!confirmed) {
    throw new Error("Confirm that this payment request should be voided.");
  }
  const reason = text(formData, "reason");
  if (!reason) {
    throw new Error("Void reason is required.");
  }
  return reason;
}

function uploadedSlipFile(formData: FormData) {
  const value = formData.get("paymentSlipFile");

  if (!value || typeof value !== "object") {
    return null;
  }

  const maybeFile = value as Partial<SlipFile>;

  if (
    typeof maybeFile.arrayBuffer !== "function" ||
    typeof maybeFile.name !== "string" ||
    typeof maybeFile.size !== "number"
  ) {
    return null;
  }

  if (maybeFile.size <= 0) {
    return null;
  }

  return maybeFile as SlipFile;
}

function safeFileName(name: string) {
  const cleanName = name
    .trim()
    .replace(/[/\\]/g, "-")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return cleanName || "payment-slip";
}

async function uploadPaymentSlip({
  file,
  requestId,
}: {
  file: SlipFile;
  requestId: string;
}) {
  const supabase = getSupabaseServiceClient();

  if (!supabase) {
    throw new Error("Supabase service credentials are required.");
  }

  if (!ALLOWED_PAYMENT_PROOF_TYPES.has(file.type)) {
    throw new Error("Payment slip must be a JPG, PNG, WebP, or PDF file.");
  }

  if (file.size > MAX_PAYMENT_PROOF_BYTES) {
    throw new Error("Payment slip file must be 10 MB or smaller.");
  }

  const fileName = safeFileName(file.name);
  const storagePath = `${requestId}/${Date.now()}-${fileName}`;
  const { error } = await supabase.storage
    .from(PAYMENT_PROOF_BUCKET)
    .upload(storagePath, file as File, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    throw new Error(error.message);
  }

  return {
    contentType: file.type,
    fileName,
    storagePath,
  };
}

function selectedValues(formData: FormData, name: string) {
  return formData
    .getAll(name)
    .map((value) => String(value).trim())
    .filter(Boolean);
}

function refreshPaymentRequestPaths(poId?: string | null) {
  revalidatePath("/payment-requests");
  if (poId) {
    revalidatePath(`/po/${encodeURIComponent(poId)}`);
  }
}

async function activeProfile() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    throw new Error("Please sign in.");
  }

  if (!profile.isActive) {
    throw new Error("Your account is inactive.");
  }

  return profile;
}

function assertCanManagePayments(email: string) {
  if (!canManagePayments(email)) {
    throw new Error("Read-only users cannot modify payment or PO payment data.");
  }
}

function assertCanApprovePayments(email: string) {
  if (!canApprovePaymentRequest(email)) {
    throw new Error("Read-only users cannot approve or reject payment requests.");
  }
}

async function profileByEmail(supabase: NonNullable<ReturnType<typeof getSupabaseServiceClient>>) {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("auth_user_id,email,role")
    .eq("is_active", true)
    .in("email", Object.values(INITIAL_APPROVER_EMAILS));

  if (error) {
    throw new Error(error.message);
  }

  return new Map(
    ((data ?? []) as ProfileRow[])
      .filter((profile) => profile.auth_user_id)
      .map((profile) => [profile.email.toLowerCase(), profile]),
  );
}

function requireProfile(
  profiles: Map<string, ProfileRow>,
  email: string,
  label: string,
) {
  const profile = profiles.get(email.toLowerCase());

  if (!profile?.auth_user_id) {
    throw new Error(`${label} user profile is missing or inactive.`);
  }

  return profile;
}

export async function submitPaymentRequestAction(
  _previousState: PaymentRequestActionState,
  formData: FormData,
): Promise<PaymentRequestActionState> {
  try {
    const profile = await activeProfile();
    assertCanManagePayments(profile.email);
    const supabase = getSupabaseServiceClient();

    if (!supabase) {
      throw new Error("Supabase service credentials are required.");
    }
    if (profile.role !== "super_admin") {
      throw new Error("Only super_admin can submit payment requests in this phase.");
    }

    const poId = text(formData, "poId");
    const paymentLineId = text(formData, "paymentLineId");

    if (!poId || !paymentLineId) {
      throw new Error("Payment row is required.");
    }

    const { data: payment, error: paymentError } = await supabase
      .from("po_payments")
      .select(
        "id,po_id,payment_date,payment_type,payment_status,due_date,amount,exchange_rate,amount_thb,currency",
      )
      .eq("id", paymentLineId)
      .eq("po_id", poId)
      .maybeSingle();

    if (paymentError) {
      throw new Error(paymentError.message);
    }
    if (!payment) {
      throw new Error("Payment row was not found.");
    }

    const paymentRow = payment as PaymentRow;
    const { data: existingRequest, error: existingError } = await supabase
      .from("payment_requests")
      .select("id,request_status")
      .eq("payment_line_id", paymentLineId)
      .in("request_status", ["pending_review", "pending_approval", "approved", "paid"])
      .limit(1);

    if (existingError) {
      throw new Error(existingError.message);
    }
    if ((existingRequest ?? []).length > 0) {
      throw new Error("Payment request already exists.");
    }

    const profiles = await profileByEmail(supabase);
    const retailManager = requireProfile(
      profiles,
      text(formData, "retailManagerEmail") || INITIAL_APPROVER_EMAILS.retailManager,
      "Retail manager",
    );
    const finalApprover = requireProfile(
      profiles,
      text(formData, "finalApproverEmail") || INITIAL_APPROVER_EMAILS.finalApprover,
      "Final approver",
    );
    const optionalReviewers = selectedValues(formData, "reviewerEmail")
      .map((email) => requireProfile(profiles, email, "Reviewer"));
    const includeKevin = text(formData, "includeKevin") === "yes";
    const kevin = includeKevin
      ? requireProfile(profiles, INITIAL_APPROVER_EMAILS.kevin, "Kevin preliminary approver")
      : null;

    const amount = numeric(paymentRow.amount);
    const exchangeRate = numeric(paymentRow.exchange_rate) || 1;
    const amountThb = numeric(paymentRow.amount_thb) || amount * exchangeRate;
    const requestedAt = new Date().toISOString();

    const { data: request, error: requestError } = await supabase
      .from("payment_requests")
      .insert({
        due_date: paymentRow.due_date || paymentRow.payment_date || null,
        payment_line_id: paymentLineId,
        payment_type: paymentRow.payment_type,
        po_id: poId,
        request_note: optionalText(formData, "requestNote"),
        request_status: "pending_review",
        requested_amount: amount,
        requested_at: requestedAt,
        requested_by: profile.authUserId,
        requested_currency: paymentRow.currency || "THB",
        requested_fx_rate: exchangeRate,
        requested_thb_amount: amountThb,
      })
      .select("id")
      .single();

    if (requestError || !request) {
      throw new Error(requestError?.message ?? "Could not create payment request.");
    }

    const steps = [
      {
        assigned_role: "retail_manager",
        assigned_user_id: retailManager.auth_user_id,
        is_required: true,
        payment_request_id: request.id,
        status: "active",
        step_order: 1,
        step_type: "retail_review",
        active_at: requestedAt,
      },
      ...optionalReviewers.map((reviewer, index) => ({
        assigned_role: "reviewer",
        assigned_user_id: reviewer.auth_user_id,
        is_required: true,
        payment_request_id: request.id,
        status: "pending",
        step_order: index + 2,
        step_type: "reviewer",
        active_at: null,
      })),
    ];

    let nextOrder = steps.length + 1;
    if (kevin) {
      steps.push({
        assigned_role: "preliminary_approver",
        assigned_user_id: kevin.auth_user_id,
        is_required: true,
        payment_request_id: request.id,
        status: "pending",
        step_order: nextOrder,
        step_type: "preliminary_approval",
        active_at: null,
      });
      nextOrder += 1;
    }

    steps.push({
      assigned_role: "final_approver",
      assigned_user_id: finalApprover.auth_user_id,
      is_required: true,
      payment_request_id: request.id,
      status: "pending",
      step_order: nextOrder,
      step_type: "final_approval",
      active_at: null,
    });

    const { error: stepError } = await supabase
      .from("payment_approval_steps")
      .insert(steps);

    if (stepError) {
      await supabase.from("payment_requests").delete().eq("id", request.id);
      throw new Error(stepError.message);
    }

    refreshPaymentRequestPaths(poId);
    return success("Payment request submitted for approval.");
  } catch (error) {
    return initialError(
      error instanceof Error ? error.message : "Submit payment request failed.",
    );
  }
}

export async function approvePaymentStepAction(
  _previousState: PaymentRequestActionState,
  formData: FormData,
): Promise<PaymentRequestActionState> {
  return actOnPaymentStep("approve", formData);
}

export async function rejectPaymentStepAction(
  _previousState: PaymentRequestActionState,
  formData: FormData,
): Promise<PaymentRequestActionState> {
  return actOnPaymentStep("reject", formData);
}

export async function confirmAccountingPaymentAction(
  _previousState: PaymentRequestActionState,
  formData: FormData,
): Promise<PaymentRequestActionState> {
  try {
    const profile = await activeProfile();
    assertCanManagePayments(profile.email);
    const supabase = getSupabaseServiceClient();

    if (!supabase) {
      throw new Error("Supabase service credentials are required.");
    }
    if (profile.role !== "accounting" && profile.role !== "super_admin") {
      throw new Error("Only accounting or super_admin can confirm payment.");
    }

    const requestId = text(formData, "requestId");
    const poId = text(formData, "poId");

    if (!requestId) {
      throw new Error("Payment request is required.");
    }

    const { data: request, error: requestError } = await supabase
      .from("payment_requests")
      .select("id,po_id,payment_line_id,request_status,payment_slip_storage_path")
      .eq("id", requestId)
      .maybeSingle();

    if (requestError) {
      throw new Error(requestError.message);
    }
    if (!request) {
      throw new Error("Payment request was not found.");
    }

    const requestRow = request as AccountingRequestRow;
    if (requestRow.request_status === "paid") {
      throw new Error("This payment request has already been recorded as paid.");
    }
    if (requestRow.request_status !== "approved") {
      throw new Error("Only approved payment requests can be recorded as paid.");
    }

    const accountingPaidAmount = positiveAmount(formData, "accountingPaidAmount");
    const accountingCurrency = text(formData, "accountingCurrency").toUpperCase() || "THB";
    const accountingFxRate = positiveRate(formData, "accountingFxRate");
    const accountingThbAmount =
      numeric(text(formData, "accountingThbAmount")) || accountingPaidAmount * accountingFxRate;
    const paidAt = paidDateValue(formData);
    const paymentReference = optionalText(formData, "paymentReference");
    const paymentSlipUrl = validateOptionalUrl(optionalText(formData, "paymentSlipUrl"));
    const paymentSlipFile = uploadedSlipFile(formData);

    if (!paymentSlipUrl && !paymentSlipFile) {
      throw new Error("Payment slip proof is required.");
    }

    const accountingNote = optionalText(formData, "accountingNote");
    const recordedAt = new Date().toISOString();
    const paidAtIso = paidAt.toISOString();
    const uploadedSlip = paymentSlipFile
      ? await uploadPaymentSlip({
          file: paymentSlipFile,
          requestId,
        })
      : null;

    const { error: updateRequestError } = await supabase
      .from("payment_requests")
      .update({
        accounting_currency: accountingCurrency,
        accounting_fx_rate: accountingFxRate,
        accounting_note: accountingNote,
        accounting_paid_amount: accountingPaidAmount,
        accounting_recorded_at: recordedAt,
        accounting_recorded_by: profile.authUserId,
        accounting_thb_amount: accountingThbAmount,
        paid_at: paidAtIso,
        paid_by: profile.authUserId,
        payment_reference: paymentReference,
        payment_slip_url: paymentSlipUrl,
        payment_slip_content_type: uploadedSlip?.contentType ?? null,
        payment_slip_file_name: uploadedSlip?.fileName ?? null,
        payment_slip_storage_path: uploadedSlip?.storagePath ?? null,
        payment_slip_uploaded_at: uploadedSlip ? recordedAt : null,
        payment_slip_uploaded_by: uploadedSlip ? profile.authUserId : null,
        request_status: "paid",
      })
      .eq("id", requestId)
      .eq("request_status", "approved");

    if (updateRequestError) {
      throw new Error(updateRequestError.message);
    }

    if (requestRow.payment_line_id) {
      const noteParts = [
        accountingNote,
        `Payment request ${requestId} recorded by accounting.`,
        uploadedSlip ? `Uploaded slip: ${uploadedSlip.fileName}` : "",
        paymentSlipUrl ? `Slip: ${paymentSlipUrl}` : "",
      ].filter(Boolean);
      const { error: paymentUpdateError } = await supabase
        .from("po_payments")
        .update({
          amount: accountingPaidAmount,
          amount_thb: accountingThbAmount,
          currency: accountingCurrency,
          exchange_rate: accountingFxRate,
          note: noteParts.join("\n"),
          paid_by: profile.email,
          payment_date: paidAtIso.slice(0, 10),
          payment_status: "paid",
          reference: paymentReference,
        })
        .eq("id", requestRow.payment_line_id)
        .eq("po_id", requestRow.po_id);

      if (paymentUpdateError) {
        throw new Error(paymentUpdateError.message);
      }
    }

    refreshPaymentRequestPaths(poId || requestRow.po_id);
    return success("Payment recorded by accounting.");
  } catch (error) {
    return initialError(
      error instanceof Error ? error.message : "Accounting confirmation failed.",
    );
  }
}

export async function addPaymentRequestDocumentAction(
  _previousState: PaymentRequestActionState,
  formData: FormData,
): Promise<PaymentRequestActionState> {
  try {
    const profile = await activeProfile();
    assertCanManagePayments(profile.email);
    const supabase = getSupabaseServiceClient();

    if (!supabase) {
      throw new Error("Supabase service credentials are required.");
    }

    const requestId = text(formData, "requestId");
    const poId = text(formData, "poId");
    const paymentLineId = optionalText(formData, "paymentLineId");
    const documentType = text(formData, "documentType") as PaymentDocumentType;
    const documentTitle = text(formData, "documentTitle");
    const documentUrl = validateRequiredUrl(optionalText(formData, "documentUrl"), "Document URL");
    const note = optionalText(formData, "note");

    if (!requestId) {
      throw new Error("Payment request is required.");
    }
    if (!PAYMENT_DOCUMENT_TYPES.includes(documentType)) {
      throw new Error("Document type is required.");
    }
    if (!documentTitle) {
      throw new Error("Document title is required.");
    }

    const request = await getPaymentRequestById(requestId);

    if (!request) {
      throw new Error("Payment request was not found.");
    }
    if (!canManagePaymentDocuments(profile, request)) {
      throw new Error("You do not have permission to add supporting documents.");
    }

    const { data: document, error } = await supabase.from("payment_request_documents").insert({
      created_by: profile.authUserId,
      document_title: documentTitle,
      document_type: documentType,
      document_url: documentUrl,
      is_active: true,
      note,
      payment_line_id: paymentLineId,
      payment_request_id: requestId,
      po_id: poId || request.poId,
    }).select("id").single();

    if (error) {
      throw new Error(error.message);
    }

    if (document) {
      const { error: auditError } = await supabase
        .from("payment_request_document_audit_logs")
        .insert({
          action_type: "created",
          changed_by: profile.authUserId,
          document_id: document.id,
          new_document_type: documentType,
          new_note: note,
          new_title: documentTitle,
          new_url: documentUrl,
          payment_request_id: requestId,
          reason: "Supporting document link added.",
        });

      if (auditError && !schemaObjectMissing(auditError.message)) {
        throw new Error(auditError.message);
      }
    }

    refreshPaymentRequestPaths(poId || request.poId);
    return success("Supporting document link added.");
  } catch (error) {
    return initialError(
      error instanceof Error ? error.message : "Add supporting document failed.",
    );
  }
}

export async function correctPaymentSlipAction(
  _previousState: PaymentRequestActionState,
  formData: FormData,
): Promise<PaymentRequestActionState> {
  try {
    const profile = await activeProfile();
    assertCanManagePayments(profile.email);
    const supabase = getSupabaseServiceClient();

    if (!supabase) {
      throw new Error("Supabase service credentials are required.");
    }

    const requestId = text(formData, "requestId");
    const poId = text(formData, "poId");
    const reason = requiredReason(formData);
    const paymentSlipUrl = validateOptionalUrl(optionalText(formData, "paymentSlipUrl"));
    const paymentSlipFile = uploadedSlipFile(formData);

    if (!requestId) {
      throw new Error("Payment request is required.");
    }
    if (!paymentSlipUrl && !paymentSlipFile) {
      throw new Error("New slip file or external slip URL is required.");
    }

    const request = await getPaymentRequestById(requestId);

    if (!request) {
      throw new Error("Payment request was not found.");
    }
    if (!canCorrectPaymentProof(profile, request)) {
      throw new Error("Only accounting or super_admin can correct payment proof.");
    }
    if (request.requestStatus !== "paid") {
      throw new Error("Only paid payment requests can have proof corrected.");
    }

    const uploadedSlip = paymentSlipFile
      ? await uploadPaymentSlip({
          file: paymentSlipFile,
          requestId,
        })
      : null;
    const changedAt = new Date().toISOString();
    const newStoragePath = uploadedSlip?.storagePath ?? (request.paymentSlipStoragePath || null);
    const newFileName = uploadedSlip?.fileName ?? (request.paymentSlipFileName || null);
    const newContentType = uploadedSlip?.contentType ?? (request.paymentSlipContentType || null);
    const newExternalUrl = paymentSlipUrl ?? null;

    const { error: updateError } = await supabase
      .from("payment_requests")
      .update({
        payment_slip_content_type: newContentType,
        payment_slip_file_name: newFileName,
        payment_slip_storage_path: newStoragePath,
        payment_slip_uploaded_at: uploadedSlip ? changedAt : request.paymentSlipUploadedAt || null,
        payment_slip_uploaded_by: uploadedSlip ? profile.authUserId : request.paymentSlipUploadedBy || null,
        payment_slip_url: newExternalUrl,
      })
      .eq("id", requestId)
      .eq("request_status", "paid");

    if (updateError) {
      throw new Error(updateError.message);
    }

    const actionType = uploadedSlip
      ? "slip_replaced"
      : request.paymentSlipUrl === paymentSlipUrl
        ? "slip_replaced"
        : "slip_url_updated";
    const { error: auditError } = await supabase
      .from("payment_proof_audit_logs")
      .insert({
        action_type: actionType,
        changed_at: changedAt,
        changed_by: profile.authUserId,
        new_content_type: newContentType,
        new_external_url: newExternalUrl,
        new_file_name: newFileName,
        new_storage_path: newStoragePath,
        old_content_type: request.paymentSlipContentType || null,
        old_external_url: request.paymentSlipUrl || null,
        old_file_name: request.paymentSlipFileName || null,
        old_storage_path: request.paymentSlipStoragePath || null,
        payment_request_id: requestId,
        reason,
      });

    if (auditError) {
      throw new Error(auditError.message);
    }

    refreshPaymentRequestPaths(poId || request.poId);
    return success("Payment slip proof corrected.");
  } catch (error) {
    return initialError(
      error instanceof Error ? error.message : "Payment proof correction failed.",
    );
  }
}

export async function updatePaymentRequestDocumentAction(
  _previousState: PaymentRequestActionState,
  formData: FormData,
): Promise<PaymentRequestActionState> {
  try {
    const profile = await activeProfile();
    assertCanManagePayments(profile.email);
    const supabase = getSupabaseServiceClient();

    if (!supabase) {
      throw new Error("Supabase service credentials are required.");
    }

    const documentId = text(formData, "documentId");
    const requestId = text(formData, "requestId");
    const documentType = text(formData, "documentType") as PaymentDocumentType;
    const documentTitle = text(formData, "documentTitle");
    const documentUrl = validateRequiredUrl(optionalText(formData, "documentUrl"), "Document URL");
    const note = optionalText(formData, "note");
    const reason = optionalText(formData, "reason");

    if (!documentId || !requestId) {
      throw new Error("Supporting document is required.");
    }
    if (!PAYMENT_DOCUMENT_TYPES.includes(documentType)) {
      throw new Error("Document type is required.");
    }
    if (!documentTitle) {
      throw new Error("Document title is required.");
    }

    const request = await getPaymentRequestById(requestId);

    if (!request) {
      throw new Error("Payment request was not found.");
    }
    if (!canManagePaymentDocuments(profile, request)) {
      throw new Error("You do not have permission to edit supporting documents.");
    }
    if (["approved", "paid"].includes(request.requestStatus) && !reason) {
      throw new Error("Correction reason is required.");
    }

    const { data: oldDocument, error: oldError } = await supabase
      .from("payment_request_documents")
      .select("id,payment_request_id,po_id,payment_line_id,document_type,document_title,document_url,note,is_active")
      .eq("id", documentId)
      .eq("payment_request_id", requestId)
      .maybeSingle();

    if (oldError) {
      throw new Error(oldError.message);
    }
    if (!oldDocument) {
      throw new Error("Supporting document was not found.");
    }

    const oldRow = oldDocument as DocumentRow;
    if (oldRow.is_active === false) {
      throw new Error("Removed supporting documents cannot be edited.");
    }

    const changedAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("payment_request_documents")
      .update({
        document_title: documentTitle,
        document_type: documentType,
        document_url: documentUrl,
        note,
        updated_at: changedAt,
        updated_by: profile.authUserId,
      })
      .eq("id", documentId)
      .eq("payment_request_id", requestId);

    if (updateError) {
      throw new Error(updateError.message);
    }

    const { error: auditError } = await supabase
      .from("payment_request_document_audit_logs")
      .insert({
        action_type: oldRow.document_url === documentUrl ? "updated" : "url_replaced",
        changed_at: changedAt,
        changed_by: profile.authUserId,
        document_id: documentId,
        new_document_type: documentType,
        new_note: note,
        new_title: documentTitle,
        new_url: documentUrl,
        old_document_type: oldRow.document_type,
        old_note: oldRow.note,
        old_title: oldRow.document_title,
        old_url: oldRow.document_url,
        payment_request_id: requestId,
        reason,
      });

    if (auditError) {
      throw new Error(auditError.message);
    }

    refreshPaymentRequestPaths(request.poId);
    return success("Supporting document updated.");
  } catch (error) {
    return initialError(
      error instanceof Error ? error.message : "Supporting document update failed.",
    );
  }
}

export async function removePaymentRequestDocumentAction(
  _previousState: PaymentRequestActionState,
  formData: FormData,
): Promise<PaymentRequestActionState> {
  try {
    const profile = await activeProfile();
    assertCanManagePayments(profile.email);
    const supabase = getSupabaseServiceClient();

    if (!supabase) {
      throw new Error("Supabase service credentials are required.");
    }

    const documentId = text(formData, "documentId");
    const requestId = text(formData, "requestId");
    const reason = requiredReason(formData);

    if (!documentId || !requestId) {
      throw new Error("Supporting document is required.");
    }

    const request = await getPaymentRequestById(requestId);

    if (!request) {
      throw new Error("Payment request was not found.");
    }
    if (!canManagePaymentDocuments(profile, request)) {
      throw new Error("You do not have permission to remove supporting documents.");
    }

    const { data: oldDocument, error: oldError } = await supabase
      .from("payment_request_documents")
      .select("id,payment_request_id,document_type,document_title,document_url,note,is_active")
      .eq("id", documentId)
      .eq("payment_request_id", requestId)
      .maybeSingle();

    if (oldError) {
      throw new Error(oldError.message);
    }
    if (!oldDocument) {
      throw new Error("Supporting document was not found.");
    }

    const oldRow = oldDocument as DocumentRow;
    if (oldRow.is_active === false) {
      throw new Error("Supporting document is already removed.");
    }

    const changedAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("payment_request_documents")
      .update({
        is_active: false,
        remove_reason: reason,
        removed_at: changedAt,
        removed_by: profile.authUserId,
        updated_at: changedAt,
        updated_by: profile.authUserId,
      })
      .eq("id", documentId)
      .eq("payment_request_id", requestId);

    if (updateError) {
      throw new Error(updateError.message);
    }

    const { error: auditError } = await supabase
      .from("payment_request_document_audit_logs")
      .insert({
        action_type: "removed",
        changed_at: changedAt,
        changed_by: profile.authUserId,
        document_id: documentId,
        old_document_type: oldRow.document_type,
        old_note: oldRow.note,
        old_title: oldRow.document_title,
        old_url: oldRow.document_url,
        payment_request_id: requestId,
        reason,
      });

    if (auditError) {
      throw new Error(auditError.message);
    }

    refreshPaymentRequestPaths(request.poId);
    return success("Supporting document removed from current pack.");
  } catch (error) {
    return initialError(
      error instanceof Error ? error.message : "Supporting document removal failed.",
    );
  }
}

export async function voidPaymentRequestAction(
  _previousState: PaymentRequestActionState,
  formData: FormData,
): Promise<PaymentRequestActionState> {
  try {
    const profile = await activeProfile();
    assertCanManagePayments(profile.email);
    const supabase = getSupabaseServiceClient();

    if (!supabase) {
      throw new Error("Supabase service credentials are required.");
    }
    if (profile.role !== "super_admin") {
      throw new Error("Only super_admin can void payment requests.");
    }

    const requestId = text(formData, "requestId");
    const poId = text(formData, "poId");
    const reason = requiredVoidReason(formData);

    if (!requestId) {
      throw new Error("Payment request is required.");
    }

    const { data: request, error: requestError } = await supabase
      .from("payment_requests")
      .select(
        "id,po_id,payment_line_id,request_status,payment_type,requested_amount,requested_currency,requested_fx_rate,requested_thb_amount,accounting_paid_amount,accounting_currency,accounting_fx_rate,accounting_thb_amount,paid_at,paid_by,payment_reference,payment_slip_url,payment_slip_storage_path,payment_slip_file_name,payment_slip_content_type,payment_slip_uploaded_at,payment_slip_uploaded_by,accounting_recorded_at",
      )
      .eq("id", requestId)
      .maybeSingle();

    if (requestError) {
      throw new Error(requestError.message);
    }
    if (!request) {
      throw new Error("Payment request was not found.");
    }

    const requestRow = request as AccountingRequestRow;
    if (requestRow.request_status === "voided") {
      throw new Error("Payment request is already voided.");
    }
    if (!["approved", "paid", "pending_approval", "pending_review"].includes(requestRow.request_status)) {
      throw new Error("Only active, approved, or paid requests can be voided.");
    }

    const changedAt = new Date().toISOString();
    const oldRequestValues = {
      accountingPaidAmount: requestRow.accounting_paid_amount ?? null,
      accountingRecordedAt: requestRow.accounting_recorded_at ?? null,
      paidAt: requestRow.paid_at ?? null,
      paidBy: requestRow.paid_by ?? null,
      paymentLineId: requestRow.payment_line_id,
      paymentReference: requestRow.payment_reference ?? null,
      paymentSlipFileName: requestRow.payment_slip_file_name ?? null,
      paymentSlipStoragePath: requestRow.payment_slip_storage_path ?? null,
      paymentSlipUrl: requestRow.payment_slip_url ?? null,
      poId: requestRow.po_id,
    };

    const { error: updateError } = await supabase
      .from("payment_requests")
      .update({
        request_status: "voided",
        void_reason: reason,
        voided_at: changedAt,
        voided_by: profile.authUserId,
      })
      .eq("id", requestId)
      .neq("request_status", "voided");

    if (updateError) {
      throw new Error(updateError.message);
    }

    const { error: stepCancelError } = await supabase
      .from("payment_approval_steps")
      .update({ status: "cancelled" })
      .eq("payment_request_id", requestId)
      .in("status", ["pending", "active"]);

    if (stepCancelError) {
      throw new Error(stepCancelError.message);
    }

    const { error: auditError } = await supabase
      .from("payment_request_audit_logs")
      .insert({
        action_type: "voided",
        changed_at: changedAt,
        changed_by: profile.authUserId,
        new_status: "voided",
        new_values: {
          voidReason: reason,
          voidedAt: changedAt,
          voidedBy: profile.authUserId,
        },
        old_status: requestRow.request_status,
        old_values: oldRequestValues,
        payment_request_id: requestId,
        reason,
      });

    if (auditError) {
      throw new Error(auditError.message);
    }

    if (requestRow.payment_line_id && requestRow.request_status === "paid") {
      const { data: payment, error: paymentError } = await supabase
        .from("po_payments")
        .select("id,payment_status,payment_date,paid_by,reference,note,amount,amount_thb,currency,exchange_rate")
        .eq("id", requestRow.payment_line_id)
        .eq("po_id", requestRow.po_id)
        .maybeSingle();

      if (paymentError) {
        throw new Error(paymentError.message);
      }

      const paymentRow = payment as LinkedPaymentRow | null;
      const marker = `Payment request ${requestId} recorded by accounting.`;
      const canRevertLinkedPayment =
        paymentRow &&
        String(paymentRow.payment_status ?? "").toLowerCase() === "paid" &&
        String(paymentRow.note ?? "").includes(marker);

      if (canRevertLinkedPayment) {
        const oldPaymentValues = {
          amount: paymentRow.amount,
          amountThb: paymentRow.amount_thb,
          currency: paymentRow.currency,
          exchangeRate: paymentRow.exchange_rate,
          note: paymentRow.note,
          paidBy: paymentRow.paid_by ?? null,
          paymentDate: paymentRow.payment_date,
          paymentStatus: paymentRow.payment_status,
          reference: paymentRow.reference,
        };
        const newNote = [
          paymentRow.note,
          `Voided payment request ${requestId}: ${reason}`,
        ].filter(Boolean).join("\n");

        const { error: paymentUpdateError } = await supabase
          .from("po_payments")
          .update({
            note: newNote,
            paid_by: null,
            payment_date: null,
            payment_status: "planned",
            reference: null,
          })
          .eq("id", requestRow.payment_line_id)
          .eq("po_id", requestRow.po_id);

        if (paymentUpdateError) {
          throw new Error(paymentUpdateError.message);
        }

        const { error: revertAuditError } = await supabase
          .from("payment_request_audit_logs")
          .insert({
            action_type: "linked_payment_reverted",
            changed_at: changedAt,
            changed_by: profile.authUserId,
            new_status: "planned",
            new_values: {
              note: newNote,
              paidBy: null,
              paymentDate: null,
              paymentStatus: "planned",
              reference: null,
            },
            old_status: String(paymentRow.payment_status ?? ""),
            old_values: oldPaymentValues,
            payment_request_id: requestId,
            reason,
          });

        if (revertAuditError) {
          throw new Error(revertAuditError.message);
        }
      }
    }

    refreshPaymentRequestPaths(poId || requestRow.po_id);
    return success("Payment request voided.");
  } catch (error) {
    return initialError(
      error instanceof Error ? error.message : "Void payment request failed.",
    );
  }
}

async function actOnPaymentStep(action: "approve" | "reject", formData: FormData) {
  try {
    const profile = await activeProfile();
    assertCanApprovePayments(profile.email);
    const supabase = getSupabaseServiceClient();

    if (!supabase) {
      throw new Error("Supabase service credentials are required.");
    }

    const requestId = text(formData, "requestId");
    const stepId = text(formData, "stepId");
    const poId = text(formData, "poId");
    const note = optionalText(formData, "note");
    const evidenceUrl = optionalText(formData, "evidenceUrl");
    const manualExternal = text(formData, "manualExternal") === "yes";
    const evidenceType = optionalText(formData, "evidenceType");

    if (!requestId || !stepId) {
      throw new Error("Approval step is required.");
    }

    const { data: request, error: requestError } = await supabase
      .from("payment_requests")
      .select("id,po_id,request_status")
      .eq("id", requestId)
      .maybeSingle();

    if (requestError) {
      throw new Error(requestError.message);
    }
    if (!request) {
      throw new Error("Payment request was not found.");
    }

    const { data: stepsData, error: stepsError } = await supabase
      .from("payment_approval_steps")
      .select("id,step_order,step_type,assigned_user_id,is_required,status")
      .eq("payment_request_id", requestId)
      .order("step_order", { ascending: true });

    if (stepsError) {
      throw new Error(stepsError.message);
    }

    const steps = (stepsData ?? []) as StepRow[];
    const step = steps.find((candidate) => candidate.id === stepId);

    if (!step) {
      throw new Error("Approval step was not found.");
    }
    if (step.status !== "active") {
      throw new Error("Only the active approval step can be actioned.");
    }
    if (profile.role !== "super_admin" && step.assigned_user_id !== profile.authUserId) {
      throw new Error("Only the assigned approver can action this step.");
    }
    if (manualExternal && profile.role !== "super_admin") {
      throw new Error("Only super_admin can record external approval evidence.");
    }
    if (manualExternal && action === "approve" && !evidenceUrl) {
      throw new Error("Evidence URL is required for manual external approval.");
    }

    const previousRequiredOpen = steps.some(
      (candidate) =>
        (candidate.is_required ?? true) &&
        candidate.step_order < step.step_order &&
        candidate.status !== "approved",
    );

    if (previousRequiredOpen) {
      throw new Error("Previous required approval steps must be approved first.");
    }

    const actionAt = new Date().toISOString();
    const noteWithMethod = [
      manualExternal ? `Manual external approval (${evidenceType || "other"})` : "",
      note ?? "",
    ].filter(Boolean).join(": ");

    const { error: updateStepError } = await supabase
      .from("payment_approval_steps")
      .update({
        action_at: actionAt,
        action_by: profile.authUserId,
        evidence_required: manualExternal,
        evidence_url: evidenceUrl,
        note: noteWithMethod || null,
        status: action === "approve" ? "approved" : "rejected",
      })
      .eq("id", stepId)
      .eq("status", "active");

    if (updateStepError) {
      throw new Error(updateStepError.message);
    }

    if (action === "reject") {
      const laterStepIds = steps
        .filter((candidate) => candidate.step_order > step.step_order)
        .map((candidate) => candidate.id);

      if (laterStepIds.length > 0) {
        const { error: cancelError } = await supabase
          .from("payment_approval_steps")
          .update({ status: "cancelled" })
          .in("id", laterStepIds);

        if (cancelError) {
          throw new Error(cancelError.message);
        }
      }

      const { error: requestUpdateError } = await supabase
        .from("payment_requests")
        .update({
          rejected_at: actionAt,
          request_status: "rejected",
        })
        .eq("id", requestId);

      if (requestUpdateError) {
        throw new Error(requestUpdateError.message);
      }

      refreshPaymentRequestPaths(poId || request.po_id);
      return success("Payment request rejected.");
    }

    const nextStep = steps.find(
      (candidate) =>
        (candidate.is_required ?? true) &&
        candidate.step_order > step.step_order &&
        candidate.status === "pending",
    );

    if (nextStep) {
      const { error: nextStepError } = await supabase
        .from("payment_approval_steps")
        .update({
          active_at: actionAt,
          status: "active",
        })
        .eq("id", nextStep.id)
        .eq("status", "pending");

      if (nextStepError) {
        throw new Error(nextStepError.message);
      }

      const nextStatus =
        nextStep.step_type === "final_approval" ||
        nextStep.step_type === "preliminary_approval"
          ? "pending_approval"
          : "pending_review";

      const { error: requestStatusError } = await supabase
        .from("payment_requests")
        .update({ request_status: nextStatus })
        .eq("id", requestId);

      if (requestStatusError) {
        throw new Error(requestStatusError.message);
      }
    } else {
      const { error: finalError } = await supabase
        .from("payment_requests")
        .update({
          approved_at: actionAt,
          request_status: "approved",
        })
        .eq("id", requestId);

      if (finalError) {
        throw new Error(finalError.message);
      }
    }

    refreshPaymentRequestPaths(poId || request.po_id);
    return success("Approval step approved.");
  } catch (error) {
    return initialError(error instanceof Error ? error.message : "Approval action failed.");
  }
}
