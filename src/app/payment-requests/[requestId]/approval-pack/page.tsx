import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PrintApprovalPackButton } from "@/app/payment-requests/[requestId]/approval-pack/print-button";
import { requireUser } from "@/lib/auth";
import {
  canPrintPaymentPack,
  canViewPaymentRequest,
  getPaymentRequestById,
  type PaymentApprovalRequest,
} from "@/lib/payment-approvals";
import { getPoPortalDetailData } from "@/lib/po-portal";

export const dynamic = "force-dynamic";

function label(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeZone: "Asia/Bangkok",
  }).format(new Date(`${value.slice(0, 10)}T00:00:00`));
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    currency: currency || "THB",
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function person(user?: { displayName: string; email: string }, fallback = "-") {
  return user?.displayName || user?.email || fallback;
}

function stepActionBy(request: PaymentApprovalRequest, actionBy: string) {
  if (!actionBy) {
    return "-";
  }
  const users = [
    request.requestedByProfile,
    request.paidByProfile,
    request.accountingRecordedByProfile,
    request.paymentSlipUploadedByProfile,
    ...request.steps.map((step) => step.assignedUser),
    ...request.documents.map((document) => document.createdByProfile),
  ].filter(Boolean) as Array<{ authUserId: string; displayName: string; email: string }>;
  const user = users.find((candidate) => candidate.authUserId === actionBy);
  return person(user, actionBy);
}

function getSafeDocumentUrl(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function DocumentLinkAction({ title, url }: { title: string; url: string | null | undefined }) {
  if (!url) {
    return <span className="text-slate-500">No link</span>;
  }

  const safeUrl = getSafeDocumentUrl(url);

  if (!safeUrl) {
    return (
      <div>
        <span className="screen-only text-slate-500">Invalid link</span>
        <div className="print-only">
          <p>{title}</p>
          <p className="url-trace">URL: {url}</p>
        </div>
        <p className="url-trace mt-1 text-xs text-slate-500">{url}</p>
      </div>
    );
  }

  return (
    <div>
      <a
        className="screen-only inline-flex rounded-md border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-800"
        href={safeUrl}
        rel="noopener noreferrer"
        target="_blank"
      >
        Open Link
      </a>
      <div className="print-only">
        <p>{title}</p>
        <p className="url-trace">URL: {safeUrl}</p>
      </div>
    </div>
  );
}

function InfoGrid({ rows }: { rows: Array<[string, string | number]> }) {
  return (
    <dl className="grid grid-cols-2 gap-x-5 gap-y-2 text-sm">
      {rows.map(([key, value]) => (
        <div className="grid grid-cols-[150px_1fr] gap-3" key={key}>
          <dt className="font-semibold text-slate-600">{key}</dt>
          <dd>{value || "-"}</dd>
        </div>
      ))}
    </dl>
  );
}

export default async function PaymentApprovalPackPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  const currentUser = await requireUser(`/payment-requests/${encodeURIComponent(requestId)}/approval-pack`);
  const request = await getPaymentRequestById(requestId);

  if (!request) {
    notFound();
  }
  if (!canViewPaymentRequest(currentUser, request)) {
    redirect("/payment-requests");
  }

  const canPrint = canPrintPaymentPack(currentUser, request);
  const poData = await getPoPortalDetailData(request.poId);

  if (!poData) {
    notFound();
  }

  const order = poData.order;
  const generatedAt = new Date().toISOString();
  const linkedPaymentId = request.paymentLineId;
  const linkedPayment = poData.payments.find((payment) => payment.id === linkedPaymentId);
  const activeDocuments = request.documents.filter((document) => document.isActive);

  return (
    <main className="min-h-screen bg-white px-8 py-6 text-slate-950">
      <style>{`
        .print-only { display: none; }
        .url-trace { overflow-wrap: anywhere; word-break: break-all; }
        @media print {
          .screen-only { display: none !important; }
          .print-only { display: block !important; }
          body { background: white; }
          main { padding: 0; }
          section { break-inside: avoid; }
          a { color: black; text-decoration: none; }
        }
      `}</style>
      <div className="screen-only mb-6 flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
        <Link className="text-sm font-semibold text-slate-700" href="/payment-requests">
          Back to Payment Requests
        </Link>
        {canPrint ? <PrintApprovalPackButton /> : null}
      </div>

      <header className="border-b-2 border-slate-950 pb-4">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-600">
          Purpose: Pre-payment approval document
        </p>
        <h1 className="mt-2 text-3xl font-bold">Payment Approval Pack</h1>
        <InfoGrid
          rows={[
            ["Generated at", formatDateTime(generatedAt)],
            ["Generated by", currentUser.displayName || currentUser.email],
            ["Request ID", request.id],
            ["PO reference", request.poId],
            ["Status", label(request.requestStatus)],
          ]}
        />
      </header>

      <section className="mt-6">
        <h2 className="border-b border-slate-300 pb-1 text-lg font-bold">PO Summary</h2>
        <div className="mt-3">
          <InfoGrid
            rows={[
              ["PO reference", order.poId],
              ["Supplier", order.supplierName],
              ["Supplier code", order.supplierCode],
              ["Owner", order.owner],
              ["Requester", order.requester],
              ["PO date", formatDate(order.poDate)],
              ["PO status", label(order.workStatus || "unknown")],
              ["Purpose / tag", order.headerPurpose],
              ["Quotation", order.quotationReference],
              ["Supplier invoice", order.supplierInvoiceNo],
              ["Estimated delivery", formatDate(order.estimatedDeliveryDate)],
              ["Estimated arrived", formatDate(order.estimatedArrivedDate)],
              ["Date received", formatDate(order.actualReceivedDate)],
              ["Total amount", formatCurrency(order.poAmountForeign, order.currency)],
              ["THB total", formatCurrency(order.poAmountThb, "THB")],
            ]}
          />
        </div>
      </section>

      <section className="mt-6">
        <h2 className="border-b border-slate-300 pb-1 text-lg font-bold">Payment Request Summary</h2>
        <div className="mt-3">
          <InfoGrid
            rows={[
              ["Payment type", request.paymentType],
              ["Requested amount", formatCurrency(request.requestedAmount, request.requestedCurrency)],
              ["Currency", request.requestedCurrency],
              ["FX rate", request.requestedFxRate || "-"],
              ["Requested THB", formatCurrency(request.requestedThbAmount, "THB")],
              ["Due date", formatDate(request.dueDate)],
              ["Requested by", person(request.requestedByProfile, request.requestedBy)],
              ["Requested at", formatDateTime(request.requestedAt)],
              ["Request note", request.requestNote],
            ]}
          />
        </div>
      </section>

      <section className="mt-6">
        <h2 className="border-b border-slate-300 pb-1 text-lg font-bold">Approval Trail</h2>
        <table className="mt-3 w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-300">
              <th className="py-2">#</th>
              <th>Step</th>
              <th>Assigned</th>
              <th>Status</th>
              <th>Action by</th>
              <th>Action at</th>
              <th>Evidence / note</th>
            </tr>
          </thead>
          <tbody>
            {request.steps.map((step) => (
              <tr className="border-b border-slate-200 align-top" key={step.id}>
                <td className="py-2">{step.stepOrder}</td>
                <td>{label(step.stepType)}</td>
                <td>{person(step.assignedUser, step.assignedUserId || step.assignedRole)}</td>
                <td>{label(step.status)}</td>
                <td>{stepActionBy(request, step.actionBy)}</td>
                <td>{formatDateTime(step.actionAt)}</td>
                <td>
                  {step.evidenceRequired ? <p>Manual external approval recorded.</p> : null}
                  {step.evidenceUrl ? <p>Evidence: {step.evidenceUrl}</p> : null}
                  {step.note ? <p>{step.note}</p> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-6">
        <h2 className="border-b border-slate-300 pb-1 text-lg font-bold">Approved Amount</h2>
        <div className="mt-3">
          <InfoGrid
            rows={[
              ["Payment type", request.paymentType],
              ["Approved amount", formatCurrency(request.requestedAmount, request.requestedCurrency)],
              ["Approved THB", formatCurrency(request.requestedThbAmount, "THB")],
              ["Currency", request.requestedCurrency],
              ["FX", request.requestedFxRate || "-"],
              ["Linked payment row", linkedPayment?.id ?? "-"],
            ]}
          />
        </div>
      </section>

      <section className="mt-6">
        <h2 className="border-b border-slate-300 pb-1 text-lg font-bold">Supporting Documents</h2>
        {activeDocuments.length > 0 || request.steps.some((step) => step.evidenceUrl) ? (
          <table className="mt-3 w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-300">
                <th className="py-2">Type</th>
                <th>Title</th>
                <th>Action</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {activeDocuments.map((document) => (
                <tr className="border-b border-slate-200 align-top" key={document.id}>
                  <td className="py-2">{label(document.documentType)}</td>
                  <td>{document.documentTitle}</td>
                  <td>
                    <DocumentLinkAction title={document.documentTitle} url={document.documentUrl} />
                  </td>
                  <td>{document.note || "-"}</td>
                </tr>
              ))}
              {request.steps
                .filter((step) => step.evidenceUrl)
                .map((step) => (
                  <tr className="border-b border-slate-200 align-top" key={`evidence-${step.id}`}>
                    <td className="py-2">Approval Evidence</td>
                    <td>{label(step.stepType)}</td>
                    <td>
                      <DocumentLinkAction title={label(step.stepType)} url={step.evidenceUrl} />
                    </td>
                    <td>{step.note || "-"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        ) : (
          <p className="mt-3 text-sm text-slate-600">No supporting document links attached.</p>
        )}
      </section>

      <section className="mt-6">
        <h2 className="border-b border-slate-300 pb-1 text-lg font-bold">Previous Payment History</h2>
        {poData.payments.length > 0 ? (
          <table className="mt-3 w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-300">
                <th className="py-2">#</th>
                <th>Status</th>
                <th>Paid date</th>
                <th>Type</th>
                <th>Amount</th>
                <th>THB</th>
                <th>Reference</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {poData.payments.map((payment, index) => (
                <tr className="border-b border-slate-200 align-top" key={payment.id}>
                  <td className="py-2">{index + 1}</td>
                  <td>{payment.payment_status ?? "paid"}</td>
                  <td>{formatDate(payment.payment_date)}</td>
                  <td>{payment.payment_type ?? "-"}</td>
                  <td>{formatCurrency(Number(payment.amount ?? 0), payment.currency ?? order.currency)}</td>
                  <td>{formatCurrency(Number(payment.amount_thb ?? 0), "THB")}</td>
                  <td>{payment.reference ?? "-"}</td>
                  <td>{payment.note ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="mt-3 text-sm text-slate-600">No previous payment rows found.</p>
        )}
      </section>

      {request.documentAuditLogs.length > 0 ? (
        <section className="mt-6">
          <h2 className="border-b border-slate-300 pb-1 text-lg font-bold">Document Change History</h2>
          <table className="mt-3 w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-300">
                <th className="py-2">Action</th>
                <th>Changed by</th>
                <th>Changed at</th>
                <th>Reason</th>
                <th>Old</th>
                <th>New</th>
              </tr>
            </thead>
            <tbody>
              {request.documentAuditLogs.map((log) => (
                <tr className="border-b border-slate-200 align-top" key={log.id}>
                  <td className="py-2">{label(log.actionType)}</td>
                  <td>{person(log.changedByProfile, log.changedBy)}</td>
                  <td>{formatDateTime(log.changedAt)}</td>
                  <td>{log.reason || "-"}</td>
                  <td className="url-trace">
                    {[log.oldTitle, log.oldUrl].filter(Boolean).join(" | ") || "-"}
                  </td>
                  <td className="url-trace">
                    {[log.newTitle, log.newUrl].filter(Boolean).join(" | ") || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      <section className="mt-6">
        <h2 className="border-b border-slate-300 pb-1 text-lg font-bold">Payment Recording Status</h2>
        {request.requestStatus === "paid" ? (
          <div className="mt-3 grid gap-3">
            <InfoGrid
              rows={[
                ["Paid amount", formatCurrency(request.accountingPaidAmount, request.accountingCurrency)],
                ["Paid THB", formatCurrency(request.accountingThbAmount, "THB")],
                ["Paid at", formatDateTime(request.paidAt)],
                ["Paid by", person(request.paidByProfile, request.paidBy)],
                ["Recorded at", formatDateTime(request.accountingRecordedAt)],
                ["Recorded by", person(request.accountingRecordedByProfile, request.accountingRecordedBy)],
                ["Payment reference", request.paymentReference],
              ]}
            />
            {request.paymentSlipStoragePath || request.paymentSlipUrl ? (
              <div className="rounded-md border border-slate-300 p-3 text-sm">
                <p className="font-bold">Payment Slip Proof</p>
                {request.paymentSlipStoragePath ? (
                  <div className="mt-2">
                    <p>Uploaded Slip: {request.paymentSlipFileName || "Payment proof"}</p>
                    <p>Uploaded at: {formatDateTime(request.paymentSlipUploadedAt)}</p>
                    <p>Uploaded by: {person(request.paymentSlipUploadedByProfile, request.paymentSlipUploadedBy)}</p>
                    <p className="url-trace print-only">Storage path: {request.paymentSlipStoragePath}</p>
                    {request.paymentSlipSignedUrl ? (
                      <a
                        className="screen-only mt-2 inline-flex rounded-md border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-800"
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
                  <div className="mt-2">
                    <DocumentLinkAction title="External payment slip URL" url={request.paymentSlipUrl} />
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-slate-600">No payment slip proof attached.</p>
            )}
            {request.proofAuditLogs.length > 0 ? (
              <div className="rounded-md border border-slate-300 p-3 text-sm">
                <p className="font-bold">Payment Proof Correction History</p>
                <table className="mt-2 w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-300">
                      <th className="py-2">Action</th>
                      <th>Changed by</th>
                      <th>Changed at</th>
                      <th>Reason</th>
                      <th>Old</th>
                      <th>New</th>
                    </tr>
                  </thead>
                  <tbody>
                    {request.proofAuditLogs.map((log) => (
                      <tr className="border-b border-slate-200 align-top" key={log.id}>
                        <td className="py-2">{label(log.actionType)}</td>
                        <td>{person(log.changedByProfile, log.changedBy)}</td>
                        <td>{formatDateTime(log.changedAt)}</td>
                        <td>{log.reason}</td>
                        <td className="url-trace">
                          {log.oldFileName || log.oldExternalUrl || log.oldStoragePath || "-"}
                        </td>
                        <td className="url-trace">
                          {log.newFileName || log.newExternalUrl || log.newStoragePath || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="mt-3 text-sm font-semibold text-slate-700">Payment not yet recorded.</p>
        )}
      </section>

      <section className="mt-6">
        <h2 className="border-b border-slate-300 pb-1 text-lg font-bold">Accounting Checklist</h2>
        <div className="mt-3 grid gap-2 text-sm">
          {[
            "Approved by final approver",
            "Retail Manager reviewed",
            "Supporting invoice/quote attached",
            "Amount checked",
            "Bank/payment reference prepared",
            "Slip to be attached after payment",
          ].map((item) => (
            <p key={item}>[ ] {item}</p>
          ))}
        </div>
        <div className="mt-8 grid grid-cols-4 gap-6 text-sm">
          {["Prepared by", "Checked by", "Paid by", "Date"].map((item) => (
            <div className="border-t border-slate-500 pt-2" key={item}>
              {item}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
