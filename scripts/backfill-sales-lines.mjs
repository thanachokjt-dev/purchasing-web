import { readFileSync } from "node:fs";

const DEFAULT_BASE_URL = "http://localhost:3000";
const DEFAULT_SINCE = "2025-01-01";
const DEFAULT_UNTIL = "2025-02-01";
const DEFAULT_MAX_PAGES = 10;

function loadLocalEnv() {
  const env = {};

  try {
    const contents = readFileSync(".env.local", "utf8");
    for (const line of contents.split(/\r?\n/)) {
      const match = line.match(/^\s*([^#][^=]+)=(.*)$/);
      if (match) {
        env[match[1].trim()] = match[2].trim();
      }
    }
  } catch {
    // Fall back to process.env below.
  }

  return { ...env, ...process.env };
}

function option(name, fallback) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((item) => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : fallback;
}

async function main() {
  const env = loadLocalEnv();
  const secret = env.SYNC_SECRET;
  const baseUrl = option("base-url", DEFAULT_BASE_URL);
  const since = option("since", DEFAULT_SINCE);
  const until = option("until", DEFAULT_UNTIL);
  const maxPages = Number(option("max-pages", String(DEFAULT_MAX_PAGES)));

  if (!secret) {
    throw new Error("SYNC_SECRET is required in .env.local or process.env");
  }
  if (!Number.isInteger(maxPages) || maxPages < 1) {
    throw new Error("--max-pages must be a positive integer");
  }

  let cursor = option("cursor", "");
  let totalOrders = 0;
  let totalSalesLines = 0;
  let totalPages = 0;
  let call = 0;

  do {
    call += 1;
    const url = new URL("/api/sync/sales-lines", baseUrl);
    url.searchParams.set("since", since);
    url.searchParams.set("until", until);
    url.searchParams.set("maxPages", String(maxPages));
    if (cursor) {
      url.searchParams.set("cursor", cursor);
    }

    const response = await fetch(url, {
      method: "POST",
      headers: { "x-sync-secret": secret },
    });
    const payload = await response.json();

    if (!response.ok || !payload.ok) {
      throw new Error(payload.error ?? `Backfill failed with HTTP ${response.status}`);
    }

    const stats = payload.salesLines;
    totalOrders += stats.ordersSeen;
    totalSalesLines += stats.salesLinesSeen;
    totalPages += stats.pagesSeen;

    console.log(
      [
        `call=${call}`,
        `orders=${stats.ordersSeen}`,
        `salesLines=${stats.salesLinesSeen}`,
        `pages=${stats.pagesSeen}`,
        `capped=${stats.capped}`,
      ].join(" "),
    );

    cursor = stats.capped ? stats.lastCursor : "";
  } while (cursor);

  console.log(
    [
      "done",
      `since=${since}`,
      `until=${until}`,
      `orders=${totalOrders}`,
      `salesLines=${totalSalesLines}`,
      `pages=${totalPages}`,
    ].join(" "),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
