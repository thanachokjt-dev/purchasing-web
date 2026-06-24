export type PoDurationPayment = {
  created_at?: string | null;
  id: string;
  payment_date: string | null;
};

export function bangkokDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Bangkok",
    year: "numeric",
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function normalizeDateOnly(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return null;
  }

  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const slashMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const day = slashMatch[1].padStart(2, "0");
    const month = slashMatch[2].padStart(2, "0");
    return `${slashMatch[3]}-${month}-${day}`;
  }

  return null;
}

export const formatPoDurationDate = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00Z`));

function dateOnlyTime(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }

  return Date.UTC(year, month - 1, day);
}

export function durationDaysBetween(startDate: string, endDate: string) {
  const startTime = dateOnlyTime(startDate);
  const endTime = dateOnlyTime(endDate);
  if (startTime === null || endTime === null || endTime < startTime) {
    return null;
  }

  return Math.round((endTime - startTime) / 86_400_000);
}

export function poDurationFromDates({
  payment1PaidDate,
  receivedDate,
  today = bangkokDateString(),
}: {
  payment1PaidDate: string | null | undefined;
  receivedDate: string | null | undefined;
  today?: string;
}) {
  const paidDate = normalizeDateOnly(payment1PaidDate);
  if (!paidDate) {
    return {
      detail: "Waiting for Payment 1 paid date",
      helper: "Waiting for Payment 1 paid date",
      value: "Pending",
    };
  }

  const actualReceivedDate = normalizeDateOnly(receivedDate);
  const endDate = actualReceivedDate ?? normalizeDateOnly(today);
  if (!endDate) {
    return {
      detail: "Today could not be resolved",
      helper: "Invalid date",
      value: "Invalid date",
    };
  }

  const endLabel = actualReceivedDate ? "Received" : "Today";
  const durationDays = durationDaysBetween(paidDate, endDate);
  if (durationDays === null) {
    return {
      detail: `Paid 1: ${formatPoDurationDate(paidDate)} -> ${endLabel}: ${formatPoDurationDate(endDate)}`,
      helper: "End date is earlier than Payment 1 paid date",
      value: "Invalid date",
    };
  }

  return {
    detail: `Paid 1: ${formatPoDurationDate(paidDate)} -> ${endLabel}: ${formatPoDurationDate(endDate)}`,
    helper: actualReceivedDate ? "Completed" : "In progress",
    value: `${durationDays} days`,
  };
}

export function firstPaymentByStableSequence<T extends PoDurationPayment>(payments: T[]) {
  return [...payments].sort((a, b) => {
    const aCreatedAt = a.created_at || "9999-12-31T23:59:59.999Z";
    const bCreatedAt = b.created_at || "9999-12-31T23:59:59.999Z";
    const createdCompare = aCreatedAt.localeCompare(bCreatedAt);
    if (createdCompare !== 0) {
      return createdCompare;
    }

    return String(a.id ?? "").localeCompare(String(b.id ?? ""));
  })[0];
}
