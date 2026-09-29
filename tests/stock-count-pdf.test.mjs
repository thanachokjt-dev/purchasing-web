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
const { createStockCountPdf } = loadTs("src/lib/stock-count-pdf.ts", {
  "@/lib/po-size-matrix": matrix,
  "pdf-lib": { ...pdfLib, PDFDocument: { create: async () => {
    const document = await PDFDocument.create();
    const addPage = document.addPage.bind(document);
    document.addPage = (...args) => {
      const page = addPage(...args);
      const drawText = page.drawText.bind(page);
      page.drawText = (text, options) => { drawCalls.push({ text, color: options.color }); return drawText(text, options); };
      return page;
    };
    return document;
  } } },
});
const lines = ["S", "M", "L"].map(size => ({
  sku: `TEST-${size}`, size, productName: "Test product", productGroupKey: "test",
  sectionName: "Test", family: "protective",
}));

async function render(systemQuantities) {
  const calls = [];
  drawCalls = calls;
  try {
    const pdf = await createStockCountPdf({ lines, locationType: "warehouse", weekStart: "2026-09-28", systemQuantities });
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
  let hasAccess = true, inventoryCalls = 0, pdfInput;
  const quantities = { "TEST-S": 37 };
  const { GET } = loadTs("src/app/api/stock-count/[sessionId]/export-pdf/route.ts", {
    "@/lib/auth": { getCurrentUserProfile: async () => ({ isActive: true }) },
    "@/lib/stock-counts": {
      canAccessStockCounts: () => true, getStockCountSession: async () => data,
      canEditStockCountLocation: () => hasAccess,
      getStockCountSystemQty: async () => { inventoryCalls++; return { quantities }; },
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
  hasAccess = false;
  assert.equal((await call("?showQty=1")).status, 403);
  assert.equal(inventoryCalls, 1);
});
