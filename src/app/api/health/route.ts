import { NextResponse } from "next/server";
import { envStatus } from "@/lib/env";

export async function GET() {
  return NextResponse.json({
    ok: true,
    phase: "Phase 1 - Shopify sync + read-only dashboard",
    mode: process.env.NEXT_PUBLIC_SUPABASE_URL ? "supabase" : "baseline",
    env: envStatus(),
    timezone: "Asia/Bangkok",
    dailySyncTarget: "05:00 ICT",
  });
}
