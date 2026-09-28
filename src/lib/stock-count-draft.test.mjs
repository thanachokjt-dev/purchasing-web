import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("./stock-counts.ts", import.meta.url), "utf8");
let javascript = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
javascript = javascript.replace('import "server-only";', "")
  .replace(/import .* from "@\/lib\/access-control";/, 'const getProfileAccessRole = profile => profile.accessRole ?? profile.role;')
  .replace(/import .* from "@\/lib\/stock-count-catalog";/, 'const buildStockCountCatalogSnapshot = () => [];')
  .replace(/import .* from "@\/lib\/stock-count-inventory";/, 'const stockCountLocationIds = {}; const summarizeStockCountInventory = () => ({});')
  .replace(/import .* from "@\/lib\/supabase\/server";/, 'let client; const getSupabaseServiceClient = () => client; export const setTestClient = value => { client = value; };');
const { deleteStockCountDraft, setTestClient } = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`);

const draft = { id: "test-draft", locationType: "warehouse", status: "draft" };
const admin = { role: "super_admin" };

test("draft delete filters exact ID, location, and draft status atomically", async () => {
  const calls = [];
  const query = {
    delete() { calls.push(["delete"]); return this; },
    eq(...args) { calls.push(["eq", ...args]); return this; },
    select(value) { calls.push(["select", value]); return Promise.resolve({ data: [{ id: draft.id }], error: null }); },
  };
  setTestClient({ from(table) { calls.push(["from", table]); return query; } });
  await deleteStockCountDraft(admin, draft);
  assert.deepEqual(calls, [["from", "weekly_stock_count_sessions"], ["delete"], ["eq", "id", "test-draft"], ["eq", "status", "draft"], ["eq", "location_type", "warehouse"], ["select", "id"]]);
});

test("completed counts and other-location staff cannot reach the delete query", async () => {
  setTestClient({ from() { throw new Error("Query must not execute"); } });
  await assert.rejects(deleteStockCountDraft(admin, { ...draft, status: "completed" }), /cannot be deleted/);
  await assert.rejects(deleteStockCountDraft({ role: "retail_manager" }, draft), /cannot delete/);
  await assert.rejects(deleteStockCountDraft({ role: "staff", accessRole: "warehouse_staff" }, { ...draft, locationType: "retail" }), /cannot delete/);
});

test("concurrent completion or missing draft does not report successful deletion", async () => {
  const query = { delete() { return this; }, eq() { return this; }, select() { return Promise.resolve({ data: [], error: null }); } };
  setTestClient({ from: () => query });
  await assert.rejects(deleteStockCountDraft(admin, draft), /no longer exists or has already been completed/);
});
