"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { stockCountValuesFromCsv } from "@/lib/stock-count-csv";
import {
  completeStockCountSession,
  createStockCountSession,
  getStockCountSession,
  saveStockCountValues,
  type StockCountLocation,
} from "@/lib/stock-counts";

function locationValue(value: FormDataEntryValue | null): StockCountLocation {
  if (value === "warehouse" || value === "retail") return value;
  throw new Error("Invalid stock count location.");
}

async function requiredSession(sessionId: string) {
  const data = await getStockCountSession(sessionId);
  if (!data) throw new Error("Stock count session not found.");
  return data;
}

export async function createStockCountSessionAction(formData: FormData) {
  const profile = await requireUser("/stock-count");
  const location = locationValue(formData.get("location"));
  const weekStart = String(formData.get("weekStart") ?? "");
  const sessionId = await createStockCountSession(profile, weekStart, location);
  redirect(`/stock-count?session=${encodeURIComponent(sessionId)}`);
}

export async function saveStockCountValuesAction(
  sessionId: string,
  values: Array<{ lineId: string; countedQty: number | null }>,
) {
  const profile = await requireUser(`/stock-count?session=${encodeURIComponent(sessionId)}`);
  const data = await requiredSession(sessionId);
  await saveStockCountValues(profile, data.session, values);
  revalidatePath("/stock-count");
  return { saved: values.length };
}

export async function importStockCountCsvAction(sessionId: string, csv: string) {
  const profile = await requireUser(`/stock-count?session=${encodeURIComponent(sessionId)}`);
  const data = await requiredSession(sessionId);
  const values = stockCountValuesFromCsv(csv, data.lines);
  await saveStockCountValues(profile, data.session, values);
  revalidatePath("/stock-count");
  return { saved: values.length, values };
}

export async function completeStockCountSessionAction(sessionId: string) {
  const profile = await requireUser(`/stock-count?session=${encodeURIComponent(sessionId)}`);
  const data = await requiredSession(sessionId);
  await completeStockCountSession(profile, data.session);
  revalidatePath("/stock-count");
}
