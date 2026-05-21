import { getSupabaseServiceClient } from "@/lib/supabase/server";

const BANGKOK_TIME_ZONE = "Asia/Bangkok";

type QueryWarning = {
  label: string;
  message: string;
};

type CountResult = {
  count: number;
  warning?: QueryWarning;
};

type SyncRunRow = {
  duration_seconds?: number | string | null;
  error_message: string | null;
  finished_at: string | null;
  inventory_rows_seen: number | string | null;
  orders_seen?: number | string | null;
  products_seen: number | string | null;
  rows_upserted?: number | string | null;
  sales_lines_seen?: number | string | null;
  source: string | null;
  started_at: string | null;
  status: string | null;
  variants_seen: number | string | null;
};

type PoMetricsRow = {
  active_incoming_total: number | string | null;
  item_count: number | string | null;
  open_paid_amount_thb: number | string | null;
  ordered_total: number | string | null;
  pending_approval_total: number | string | null;
  planned_amount_thb: number | string | null;
  po_count: number | string | null;
  received_total: number | string | null;
  supplier_count: number | string | null;
};

type PoValueRow = {
  active_line_count?: number | string | null;
  pending_line_count?: number | string | null;
  po_amount_thb: number | string | null;
};

type ReceiptDateRow = {
  actual_received_date: string | null;
  received_at: string | null;
};

type EtaDateRow = {
  eta_date: string | null;
};

export type DashboardCardTone = "blue" | "green" | "gray" | "red" | "yellow";

export type DashboardActionItem = {
  detail: string;
  href?: string;
  label: string;
  tone: DashboardCardTone;
};

export type PoDashboardData = {
  generatedAt: string;
  incomingEta: {
    arrivingSoon: number;
    lateEta: number;
    nextExpectedArrival: string | null;
    noEta: number;
  };
  payments: {
    dueNext30Days: number;
    dueThisWeek: number;
    missingFxCount: number;
    overduePayments: number;
    paidTotalThb: number;
    plannedTotalThb: number;
    xeroDraftCount: number;
    xeroPendingCount: number;
    xeroUploadedCount: number;
  };
  poOverview: {
    inProduction: number;
    inTransit: number;
    openPoCount: number;
    openPoValueThb: number | null;
    outstandingQty: number;
    readyToShip: number;
    receivingPending: number;
  };
  receiving: {
    lastGoodsReceiptDate: string | null;
    linesWithOutstandingQty: number;
    outstandingReceivingQty: number;
    posWaitingToReceive: number;
    recentlyReceivedCount: number;
  };
  sync: {
    dataFreshness: "failed" | "fresh" | "stale" | "unknown";
    durationSeconds: number | null;
    errorMessage: string | null;
    inventoryRowsSynced: number | null;
    lastStatus: "failed" | "running" | "success" | "unknown";
    lastSuccessfulSyncTime: string | null;
    lastSyncTime: string | null;
    ordersSynced: number | null;
    productsSynced: number | null;
    source: string | null;
    syncLogFound: boolean;
    variantsSynced: number | null;
  };
  attentionItems: DashboardActionItem[];
  warnings: QueryWarning[];
};

function toNumber(value: number | string | null | undefined) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function nullableNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function toDateInput(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: BANGKOK_TIME_ZONE,
    year: "numeric",
  }).formatToParts(date);
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? "01";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function addDays(dateInput: string, days: number) {
  const [year, month, day] = dateInput.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function freshnessFor(latestRun: SyncRunRow | null, latestSuccess: SyncRunRow | null) {
  if (!latestRun && !latestSuccess) {
    return "unknown" as const;
  }
  if (latestRun?.status === "failed") {
    return "failed" as const;
  }
  const successTime = latestSuccess?.finished_at ?? latestSuccess?.started_at;
  if (!successTime) {
    return "unknown" as const;
  }
  const ageMs = Date.now() - new Date(successTime).getTime();
  if (!Number.isFinite(ageMs)) {
    return "unknown" as const;
  }
  return ageMs <= 24 * 60 * 60 * 1000 ? ("fresh" as const) : ("stale" as const);
}

function statusFor(latestRun: SyncRunRow | null) {
  if (!latestRun?.status) {
    return "unknown" as const;
  }
  if (latestRun.status === "completed") {
    return "success" as const;
  }
  if (latestRun.status === "failed") {
    return "failed" as const;
  }
  if (latestRun.status === "running") {
    return "running" as const;
  }
  return "unknown" as const;
}

async function countRows(
  label: string,
  run: () => PromiseLike<{ count: number | null; error: { message: string } | null }>,
): Promise<CountResult> {
  const { count, error } = await run();
  if (error) {
    return { count: 0, warning: { label, message: error.message } };
  }
  return { count: count ?? 0 };
}

export async function getPoDashboardData(): Promise<PoDashboardData> {
  const generatedAt = new Date().toISOString();
  const supabase = getSupabaseServiceClient();
  const warnings: QueryWarning[] = [];
  const today = toDateInput(new Date());
  const next7 = addDays(today, 7);
  const next30 = addDays(today, 30);
  const sevenDaysAgo = addDays(today, -7);

  if (!supabase) {
    return {
      generatedAt,
      incomingEta: { arrivingSoon: 0, lateEta: 0, nextExpectedArrival: null, noEta: 0 },
      payments: {
        dueNext30Days: 0,
        dueThisWeek: 0,
        missingFxCount: 0,
        overduePayments: 0,
        paidTotalThb: 0,
        plannedTotalThb: 0,
        xeroDraftCount: 0,
        xeroPendingCount: 0,
        xeroUploadedCount: 0,
      },
      poOverview: {
        inProduction: 0,
        inTransit: 0,
        openPoCount: 0,
        openPoValueThb: null,
        outstandingQty: 0,
        readyToShip: 0,
        receivingPending: 0,
      },
      receiving: {
        lastGoodsReceiptDate: null,
        linesWithOutstandingQty: 0,
        outstandingReceivingQty: 0,
        posWaitingToReceive: 0,
        recentlyReceivedCount: 0,
      },
      sync: {
        dataFreshness: "unknown",
        durationSeconds: null,
        errorMessage: "Supabase service client is not configured.",
        inventoryRowsSynced: null,
        lastStatus: "unknown",
        lastSuccessfulSyncTime: null,
        lastSyncTime: null,
        ordersSynced: null,
        productsSynced: null,
        source: null,
        syncLogFound: false,
        variantsSynced: null,
      },
      attentionItems: [
        {
          detail: "Dashboard data is unavailable until Supabase service credentials are configured.",
          label: "Database connection missing",
          tone: "gray",
        },
      ],
      warnings,
    };
  }

  const [
    latestSyncResult,
    latestSuccessResult,
    metricsResult,
    openPoCount,
    inProductionCount,
    readyToShipCount,
    inTransitCount,
    receivingPendingCount,
    openPoValueResult,
    overduePaymentCount,
    dueThisWeekCount,
    dueNext30DaysCount,
    missingFxCount,
    xeroPendingCount,
    xeroDraftCount,
    xeroUploadedCount,
    recentReceiptsCount,
    latestReceiptResult,
    arrivingSoonCount,
    lateEtaCount,
    noEtaCount,
    nextEtaResult,
  ] = await Promise.all([
    supabase
      .from("sync_runs")
      .select(
        "source,status,started_at,finished_at,products_seen,variants_seen,inventory_rows_seen,orders_seen,sales_lines_seen,rows_upserted,error_message",
      )
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("sync_runs")
      .select(
        "source,status,started_at,finished_at,products_seen,variants_seen,inventory_rows_seen,orders_seen,sales_lines_seen,rows_upserted,error_message",
      )
      .eq("status", "completed")
      .order("finished_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("po_portal_metrics").select("*").limit(1).maybeSingle(),
    countRows("Open POs", () =>
      supabase
        .from("po_order_summary")
        .select("*", { count: "exact", head: true })
        .is("closed_at", null)
        .is("cancelled_at", null)
        .not("work_status", "in", "(closed,cancelled,canceled)"),
    ),
    countRows("In Production POs", () =>
      supabase
        .from("po_order_summary")
        .select("*", { count: "exact", head: true })
        .eq("work_status", "inpro")
        .is("closed_at", null)
        .is("cancelled_at", null),
    ),
    countRows("Ready to Ship POs", () =>
      supabase
        .from("po_order_summary")
        .select("*", { count: "exact", head: true })
        .eq("work_status", "final_payment")
        .is("closed_at", null)
        .is("cancelled_at", null),
    ),
    countRows("In Transit POs", () =>
      supabase
        .from("po_order_summary")
        .select("*", { count: "exact", head: true })
        .eq("work_status", "delivery")
        .is("closed_at", null)
        .is("cancelled_at", null),
    ),
    countRows("Receiving Pending POs", () =>
      supabase
        .from("po_order_summary")
        .select("*", { count: "exact", head: true })
        .gt("total_outstanding_qty", 0)
        .is("closed_at", null)
        .is("cancelled_at", null),
    ),
    supabase
      .from("po_order_summary")
      .select("po_amount_thb,active_line_count,pending_line_count")
      .is("closed_at", null)
      .is("cancelled_at", null)
      .not("work_status", "in", "(closed,cancelled,canceled)")
      .limit(2000),
    countRows("Overdue Payments", () =>
      supabase
        .from("po_payments")
        .select("*", { count: "exact", head: true })
        .ilike("payment_status", "planned")
        .lt("due_date", today),
    ),
    countRows("Payments Due This Week", () =>
      supabase
        .from("po_payments")
        .select("*", { count: "exact", head: true })
        .ilike("payment_status", "planned")
        .gte("due_date", today)
        .lte("due_date", next7),
    ),
    countRows("Payments Due Next 30 Days", () =>
      supabase
        .from("po_payments")
        .select("*", { count: "exact", head: true })
        .ilike("payment_status", "planned")
        .gte("due_date", today)
        .lte("due_date", next30),
    ),
    countRows("Missing FX Payments", () =>
      supabase
        .from("po_payments")
        .select("*", { count: "exact", head: true })
        .neq("currency", "THB")
        .lte("exchange_rate", 1),
    ),
    countRows("Xero Pending Payments", () =>
      supabase
        .from("po_payments")
        .select("*", { count: "exact", head: true })
        .eq("xero_status", "pending"),
    ),
    countRows("Xero Draft Payments", () =>
      supabase
        .from("po_payments")
        .select("*", { count: "exact", head: true })
        .eq("xero_status", "draft"),
    ),
    countRows("Xero Uploaded Payments", () =>
      supabase
        .from("po_payments")
        .select("*", { count: "exact", head: true })
        .eq("xero_status", "uploaded"),
    ),
    countRows("Recent Goods Receipts", () =>
      supabase
        .from("po_receipts")
        .select("*", { count: "exact", head: true })
        .gte("received_at", `${sevenDaysAgo}T00:00:00+07:00`),
    ),
    supabase
      .from("po_receipts")
      .select("actual_received_date,received_at")
      .order("received_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
    countRows("Arriving Soon ETA", () =>
      supabase
        .from("po_incoming_eta_events")
        .select("*", { count: "exact", head: true })
        .gte("eta_date", today)
        .lte("eta_date", next7),
    ),
    countRows("Late ETA", () =>
      supabase
        .from("po_incoming_eta_events")
        .select("*", { count: "exact", head: true })
        .lt("eta_date", today),
    ),
    countRows("No ETA", () =>
      supabase
        .from("po_incoming_eta_unscheduled_events")
        .select("*", { count: "exact", head: true }),
    ),
    supabase
      .from("po_incoming_eta_events")
      .select("eta_date")
      .gte("eta_date", today)
      .order("eta_date", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  const collectWarning = (warning?: QueryWarning) => {
    if (warning) {
      warnings.push(warning);
    }
  };

  [
    openPoCount,
    inProductionCount,
    readyToShipCount,
    inTransitCount,
    receivingPendingCount,
    overduePaymentCount,
    dueThisWeekCount,
    dueNext30DaysCount,
    missingFxCount,
    xeroPendingCount,
    xeroDraftCount,
    xeroUploadedCount,
    recentReceiptsCount,
    arrivingSoonCount,
    lateEtaCount,
    noEtaCount,
  ].forEach((result) => collectWarning(result.warning));

  if (latestSyncResult.error) {
    warnings.push({ label: "Last Shopify Sync", message: latestSyncResult.error.message });
  }
  if (latestSuccessResult.error) {
    warnings.push({ label: "Last Successful Shopify Sync", message: latestSuccessResult.error.message });
  }
  if (metricsResult.error) {
    warnings.push({ label: "PO Portal Metrics", message: metricsResult.error.message });
  }
  if (openPoValueResult.error) {
    warnings.push({ label: "Open PO Value", message: openPoValueResult.error.message });
  }
  if (latestReceiptResult.error) {
    warnings.push({ label: "Latest Goods Receipt", message: latestReceiptResult.error.message });
  }
  if (nextEtaResult.error) {
    warnings.push({ label: "Next Expected Arrival", message: nextEtaResult.error.message });
  }

  const latestRun = (latestSyncResult.data ?? null) as SyncRunRow | null;
  const latestSuccess = (latestSuccessResult.data ?? null) as SyncRunRow | null;
  const metrics = (metricsResult.data ?? null) as PoMetricsRow | null;
  const poValueRows = (openPoValueResult.data ?? []) as PoValueRow[];
  const latestReceipt = (latestReceiptResult.data ?? null) as ReceiptDateRow | null;
  const nextEta = (nextEtaResult.data ?? null) as EtaDateRow | null;
  const openPoValueThb =
    openPoValueResult.error || poValueRows.length === 2000
      ? null
      : poValueRows.reduce((sum, row) => sum + toNumber(row.po_amount_thb), 0);

  if (poValueRows.length === 2000) {
    warnings.push({
      label: "Open PO Value",
      message: "Open PO value was not summed because more than 2,000 open rows may exist.",
    });
  }

  const outstandingQty =
    toNumber(metrics?.active_incoming_total) + toNumber(metrics?.pending_approval_total);
  const linesWithOutstandingQty = poValueRows.reduce(
    (sum, row) => sum + toNumber(row.active_line_count) + toNumber(row.pending_line_count),
    0,
  );
  const syncStatus = statusFor(latestRun);
  const syncFreshness = freshnessFor(latestRun, latestSuccess);

  const data: PoDashboardData = {
    generatedAt,
    incomingEta: {
      arrivingSoon: arrivingSoonCount.count,
      lateEta: lateEtaCount.count,
      nextExpectedArrival: nextEta?.eta_date ?? null,
      noEta: noEtaCount.count,
    },
    payments: {
      dueNext30Days: dueNext30DaysCount.count,
      dueThisWeek: dueThisWeekCount.count,
      missingFxCount: missingFxCount.count,
      overduePayments: overduePaymentCount.count,
      paidTotalThb: toNumber(metrics?.open_paid_amount_thb),
      plannedTotalThb: toNumber(metrics?.planned_amount_thb),
      xeroDraftCount: xeroDraftCount.count,
      xeroPendingCount: xeroPendingCount.count,
      xeroUploadedCount: xeroUploadedCount.count,
    },
    poOverview: {
      inProduction: inProductionCount.count,
      inTransit: inTransitCount.count,
      openPoCount: openPoCount.count,
      openPoValueThb,
      outstandingQty,
      readyToShip: readyToShipCount.count,
      receivingPending: receivingPendingCount.count,
    },
    receiving: {
      lastGoodsReceiptDate: latestReceipt?.actual_received_date ?? latestReceipt?.received_at ?? null,
      linesWithOutstandingQty,
      outstandingReceivingQty: outstandingQty,
      posWaitingToReceive: receivingPendingCount.count,
      recentlyReceivedCount: recentReceiptsCount.count,
    },
    sync: {
      dataFreshness: syncFreshness,
      durationSeconds:
        nullableNumber(latestRun?.duration_seconds) ??
        (latestRun?.started_at && latestRun?.finished_at
          ? Math.round((new Date(latestRun.finished_at).getTime() - new Date(latestRun.started_at).getTime()) / 1000)
          : null),
      errorMessage: latestRun?.error_message ?? null,
      inventoryRowsSynced: nullableNumber(latestRun?.inventory_rows_seen),
      lastStatus: syncStatus,
      lastSuccessfulSyncTime: latestSuccess?.finished_at ?? latestSuccess?.started_at ?? null,
      lastSyncTime: latestRun?.finished_at ?? latestRun?.started_at ?? null,
      ordersSynced: nullableNumber(latestRun?.orders_seen) ?? nullableNumber(latestRun?.sales_lines_seen),
      productsSynced: nullableNumber(latestRun?.products_seen),
      source: latestRun?.source ?? null,
      syncLogFound: Boolean(latestRun || latestSuccess),
      variantsSynced: nullableNumber(latestRun?.variants_seen),
    },
    attentionItems: [],
    warnings,
  };

  data.attentionItems = [
    ...(data.sync.dataFreshness === "failed"
      ? [
          {
            detail: data.sync.errorMessage ?? "Latest sync run failed.",
            label: "Last Shopify sync failed",
            tone: "red" as const,
          },
        ]
      : []),
    ...(data.sync.dataFreshness === "stale"
      ? [
          {
            detail: "Latest successful sync is older than 24 hours.",
            label: "Shopify sync is stale",
            tone: "yellow" as const,
          },
        ]
      : []),
    ...(data.payments.overduePayments > 0
      ? [
          {
            detail: `${data.payments.overduePayments} planned payment(s) are past due.`,
            href: "/po",
            label: "Overdue payments",
            tone: "red" as const,
          },
        ]
      : []),
    ...(data.payments.missingFxCount > 0
      ? [
          {
            detail: `${data.payments.missingFxCount} foreign currency payment row(s) need FX.`,
            href: "/po",
            label: "Missing FX",
            tone: "yellow" as const,
          },
        ]
      : []),
    ...(data.payments.xeroPendingCount + data.payments.xeroDraftCount > 0
      ? [
          {
            detail: `${data.payments.xeroPendingCount} pending and ${data.payments.xeroDraftCount} draft row(s).`,
            href: "/po",
            label: "Xero tracking open",
            tone: "blue" as const,
          },
        ]
      : []),
    ...(data.incomingEta.lateEta > 0
      ? [
          {
            detail: `${data.incomingEta.lateEta} incoming ETA line(s) are late.`,
            href: "/po",
            label: "Late incoming ETA",
            tone: "red" as const,
          },
        ]
      : []),
    ...(data.incomingEta.noEta > 0
      ? [
          {
            detail: `${data.incomingEta.noEta} incoming line(s) do not have an ETA.`,
            href: "/po",
            label: "Missing ETA",
            tone: "yellow" as const,
          },
        ]
      : []),
    ...(data.receiving.posWaitingToReceive > 0
      ? [
          {
            detail: `${data.receiving.posWaitingToReceive} PO(s) still have outstanding receiving.`,
            href: "/po",
            label: "Receiving pending",
            tone: "blue" as const,
          },
        ]
      : []),
    ...(data.payments.dueThisWeek > 0
      ? [
          {
            detail: `${data.payments.dueThisWeek} planned payment(s) are due in the next 7 days.`,
            href: "/po",
            label: "Payments due this week",
            tone: "yellow" as const,
          },
        ]
      : []),
  ].slice(0, 10);

  if (!data.sync.syncLogFound) {
    data.attentionItems.unshift({
      detail: "No durable sync run was found in sync_runs.",
      label: "Shopify sync log unavailable",
      tone: "gray",
    });
  }

  if (data.attentionItems.length === 0) {
    data.attentionItems.push({
      detail: "No urgent PO, payment, sync, or ETA issues were found in the lightweight checks.",
      label: "No immediate attention items",
      tone: "green",
    });
  }

  return data;
}
