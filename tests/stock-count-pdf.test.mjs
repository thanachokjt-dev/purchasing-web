import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const pdfLib = require("pdf-lib");
const { PDFDocument } = pdfLib;
function loadTs(filename, dependencies = {}) {
  const source = fs.readFileSync(filename, "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const evaluatedModule = { exports: {} };
  new Function("require", "module", "exports", code)(name => name in dependencies ? dependencies[name] : require(name), evaluatedModule, evaluatedModule.exports);
  return evaluatedModule.exports;
}
const matrix = loadTs("src/lib/po-size-matrix.ts");
let drawCalls;
let imageDraws = 0;
const { createStockCountPdf } = loadTs("src/lib/stock-count-pdf.ts", {
  "@/lib/po-size-matrix": matrix,
  "pdf-lib": { ...pdfLib, PDFDocument: { create: async () => {
    const document = await PDFDocument.create();
    const addPage = document.addPage.bind(document);
    document.addPage = (...args) => {
      const page = addPage(...args);
      const drawText = page.drawText.bind(page);
      page.drawText = (text, options) => { drawCalls.push({ text, color: options.color }); return drawText(text, options); };
      const drawImage = page.drawImage.bind(page);
      page.drawImage = (...args) => { imageDraws++; return drawImage(...args); };
      return page;
    };
    return document;
  } } },
});
const lines = ["S", "M", "L"].map(size => ({
  sku: `TEST-${size}`, size, productName: "Test product", productGroupKey: "test",
  sectionName: "Test", family: "protective",
}));

async function render(systemQuantities, options = {}) {
  const calls = [];
  drawCalls = calls;
  imageDraws = 0;
  try {
    const pdf = await createStockCountPdf({ lines, locationType: "warehouse", weekStart: "2026-09-28", systemQuantities, ...options });
    assert.equal((await PDFDocument.load(pdf)).getPageCount(), 1);
    return calls;
  } finally {
    drawCalls = null;
  }
}
const isRed = call => call.color?.red === 0.8 && call.color?.green === 0.08 && call.color?.blue === 0.08;

test("Show Qty draws current SKU quantity, zero and unavailable marker in red", async () => {
  const calls = await render({ "TEST-S": 37, "TEST-M": 0, "TEST-L": null });
  assert.deepEqual(calls.filter(isRed).map(c => c.text), ["37", "0", "—"]);
  assert.ok(calls.some(c => c.text.includes("Current system qty in red")));
});

test("hidden quantities retain the blank counting PDF", async () => {
  const calls = await render(undefined);
  assert.equal(calls.filter(isRed).length, 0);
  assert.ok(calls.some(c => c.text === "Write counted quantity in the matching size cell"));
});

test("PDF endpoint forwards Show Qty inventory and enforces location access", async () => {
  const data = { lines, session: { locationType: "warehouse", weekStart: "2026-09-28" } };
  let hasAccess = true, inventoryCalls = 0, pdfInput, requestedScope;
  const quantities = { "TEST-S": 37 };
  const { GET } = loadTs("src/app/api/stock-count/[sessionId]/export-pdf/route.ts", {
    "@/lib/auth": { getCurrentUserProfile: async () => ({ isActive: true }) },
    "@/lib/stock-counts": {
      canAccessStockCounts: () => true, getStockCountSession: async () => data,
      canEditStockCountLocation: () => hasAccess,
      getStockCountSystemQty: async (_profile, _session, scope) => { inventoryCalls++; requestedScope = scope; return { quantities }; },
    },
    "@/lib/stock-count-pdf": { createStockCountPdf: async input => { pdfInput = input; return new Uint8Array(); } },
  });
  const call = query => GET(new Request(`https://example.test/export-pdf${query}`), { params: Promise.resolve({ sessionId: "test" }) });
  assert.equal((await call("?showQty=1")).status, 200);
  assert.deepEqual(pdfInput.systemQuantities, quantities);
  assert.equal(inventoryCalls, 1);
  assert.equal((await call("")).status, 200);
  assert.equal(pdfInput.systemQuantities, undefined);
  assert.equal(inventoryCalls, 1);
  const combined = await call("?qtyScope=all");
  assert.equal(combined.status, 200);
  assert.equal(requestedScope, "all");
  assert.equal(pdfInput.quantityScope, "all");
  assert.deepEqual(pdfInput.systemQuantities, quantities);
  assert.match(combined.headers.get("content-disposition"), /total-on-hand/);
  assert.equal(inventoryCalls, 2);
  hasAccess = false;
  assert.equal((await call("?showQty=1")).status, 403);
  assert.equal(inventoryCalls, 2);
});

test("combined on-hand PDF is clearly labelled and keeps red numbers", async () => {
  const calls = await render({ "TEST-S": 12 }, { quantityScope: "all" });
  assert.ok(calls.some(c => c.text.includes("ON-HAND: WAREHOUSE + RETAIL")));
  assert.ok(calls.some(c => isRed(c) && c.text === "12"));
});

test("combined on-hand sums known quantities without treating missing stock as zero", () => {
  const { combinedStockCountInventory } = loadTs("src/lib/stock-count-inventory.ts");
  const quantities = combinedStockCountInventory({ A: 5, B: 0, C: null, D: 1 }, { A: 7, B: 0, C: 3 });
  assert.deepEqual({ ...quantities }, { A: 12, B: 0, C: null, D: null });
});

test("PDF embeds Shopify product thumbnails once for repeated size lines", async () => {
  const sharp = require("sharp");
  const png = await sharp({ create: { width: 10, height: 10, channels: 3, background: "red" } }).png().toBuffer();
  const originalFetch = globalThis.fetch;
  let fetches = 0;
  globalThis.fetch = async () => { fetches++; return new Response(png); };
  try {
    await render(undefined, { lines: lines.map(line => ({ ...line, imageUrl: "https://cdn.shopify.com/test.png" })) });
    assert.equal(fetches, 1);
    assert.equal(imageDraws, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
