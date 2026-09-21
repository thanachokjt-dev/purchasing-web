import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import ts from "typescript";

async function moduleFromTypeScript(path, replacements = []) {
  let source = await readFile(new URL(path, import.meta.url), "utf8");
  for (const [from, to] of replacements) source = source.replaceAll(from, to);
  const javascript = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return `data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`;
}

const sizeMatrixUrl = await moduleFromTypeScript("./po-size-matrix.ts");
const pdfUrl = await moduleFromTypeScript("./stock-count-pdf.ts", [
  ['"@pdf-lib/fontkit"', JSON.stringify(import.meta.resolve("@pdf-lib/fontkit"))],
  ['"@/lib/po-size-matrix"', JSON.stringify(sizeMatrixUrl)],
  ['"pdf-lib"', JSON.stringify(import.meta.resolve("pdf-lib"))],
]);
const { createStockCountPdf } = await import(pdfUrl);

test("stock count PDF is landscape A4 and supports Thai product names", async () => {
  const bytes = await createStockCountPdf({
    locationType: "warehouse",
    weekStart: "2026-09-21",
    lines: [{
      id: "line-1",
      sku: "THAI-S",
      productGroupKey: "shorts::apparel::thai",
      sectionName: "MMA SHORTS",
      family: "apparel",
      productName: "กางเกงมวยไทย รุ่นทดสอบ - สีดำ",
      size: "S",
      tags: ["MMA Shorts"],
      countedQty: null,
      sortOrder: 0,
    }],
  });
  assert.equal(Buffer.from(bytes).subarray(0, 4).toString(), "%PDF");
  const document = await PDFDocument.load(bytes);
  assert.equal(document.getPageCount(), 1);
  const { width, height } = document.getPage(0).getSize();
  assert.ok(width > height);
  assert.ok(Math.abs(width - 841.89) < 0.1);
  assert.ok(Math.abs(height - 595.28) < 0.1);
});
