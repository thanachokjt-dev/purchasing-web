import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test, expect } from "@playwright/test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

// Exercise the real print template without authenticating or mutating a live PO.
async function declarations(path, names) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  return file.statements.filter((node) => {
    if (ts.isFunctionDeclaration(node)) return names.includes(node.name?.text);
    return ts.isVariableStatement(node) && node.declarationList.declarations.some(
      (declaration) => names.includes(declaration.name.getText(file)),
    );
  }).map((node) => node.getText(file).replace(/^export /, "")).join("\n");
}

function javascript(source) {
  return ts.transpileModule(source, {
    compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 },
  }).outputText;
}

const templateSource = await declarations("../src/app/po/[poId]/page.tsx", [
  "PrintMatrixDocument", "qtyHeatStyle", "companyLines",
]);
const { PrintMatrixDocument } = new Function("React", `${javascript(templateSource)}; return { PrintMatrixDocument };`)(React);
const controlsSource = javascript(await declarations("../src/app/po/po-forms.tsx", [
  "PrintDocumentButton", "buildPrintFilename", "waitForPrintImages",
]));
const css = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");
const documentHtml = renderToStaticMarkup(React.createElement(PrintMatrixDocument, {
  type: "receiving",
  title: "Goods Receiving Note",
  expectedReceivingNote: "",
  order: { poId: "PO-20260528012110353", supplierName: "Test Supplier", poDate: "2026-05-28" },
  matrix: { groups: [] },
  receivingMatrix: {
    groups: [{
      label: "MMA SHORTS · APPAREL", sizes: ["S", "M", "L"], maxQty: 731,
      rows: [{ productName: "Test Shorts - Black", imageUrl: null, lines: [
        { label: "Ordered", isManual: false, values: new Map([["S", 731], ["M", 268]]) },
        { label: "Receive round 1", isManual: false, values: new Map([["S", 17], ["M", 23]]) },
        { label: "Receive round 2", isManual: true, values: new Map() },
      ] }],
    }],
  },
}));

test.beforeEach(async ({ page }) => {
  await page.setContent(`<html data-print-mode="receiving"><head><style>${css}</style></head><body>${documentHtml}</body></html>`);
  await page.emulateMedia({ media: "print" });
});

test("hidden quantities keep the same worksheet, with no ordered values or heat colours", async ({ page }) => {
  const ordered = page.locator('[data-receipt-line="ordered"] .print-receipt-qty');
  await expect(ordered).toHaveText(["731", "268", "", "999"]);
  const before = await page.locator("table").boundingBox();
  await page.evaluate(() => { document.documentElement.dataset.printHideOrderedQty = "true"; });
  for (const cell of await ordered.all()) await expect(cell).toBeHidden();
  const visibleText = await page.locator("table").innerText();
  for (const value of ["731", "268", "999"]) expect(visibleText).not.toContain(value);
  expect(visibleText).toContain("Test Shorts - Black");
  expect(visibleText).toContain("Receive round 2");
  await expect(page.locator("thead th")).toHaveText(["Product", "Image", "Round", "S", "M", "L", "Total"]);
  for (const cell of await page.locator(".print-receipt-active-size").all()) {
    await expect(cell).toHaveCSS("background-color", "rgb(255, 255, 255)");
  }
  await expect(page.locator('[data-receipt-line="received"]').first().locator(".print-receipt-qty"))
    .toHaveText(["17", "23", "", "40"]);
  await expect(page.locator('[data-receipt-line="received"]').last().locator(".print-receipt-qty"))
    .toHaveText(["", "", "", ""]);
  expect(await page.locator("table").boundingBox()).toEqual(before);
  if (process.env.PO_PRINT_QA_DIR) {
    await page.pdf({ path: join(process.env.PO_PRINT_QA_DIR, "goods-receipt-hidden-qty.pdf"), preferCSSPageSize: true, printBackground: true });
  }
  await page.evaluate(() => { delete document.documentElement.dataset.printHideOrderedQty; });
  await expect(ordered.first()).toBeVisible();
  expect(await page.locator("table").innerText()).toContain("731");
  await expect(page.locator(".print-receipt-active-size").first()).not.toHaveCSS("background-color", "rgb(255, 255, 255)");
});

test("the print button isolates hidden mode, filenames and cleanup from the normal receipt", async ({ page }) => {
  const results = await page.evaluate(async (source) => {
    delete document.documentElement.dataset.printMode;
    document.title = "PO detail";
    const controls = new Function("React", "useState", "LoadingLabel", "printIntentEvent",
      `${source}; return { PrintDocumentButton, buildPrintFilename };`)(
      { createElement: (type, props) => ({ type, props }) },
      () => [false, () => {}], () => null, "test-print-intent",
    );
    const snapshots = [];
    window.print = () => snapshots.push({
      title: document.title,
      mode: document.documentElement.dataset.printMode,
      hidden: document.documentElement.dataset.printHideOrderedQty,
    });
    const props = { label: "Receipt", mode: "receiving", supplierName: "Test Supplier", poId: "PO-0353" };
    for (const hideOrderedQty of [true, false]) {
      await controls.PrintDocumentButton({ ...props, hideOrderedQty }).props.onClick();
      window.dispatchEvent(new Event("afterprint"));
      snapshots.push({ title: document.title, dataset: { ...document.documentElement.dataset } });
    }
    return { snapshots, quote: controls.buildPrintFilename("quote", "Test Supplier", "PO-0353", true) };
  }, controlsSource);
  expect(results.snapshots).toEqual([
    { title: "GR-Test-Supplier-0353-Hidden-Qty.pdf", mode: "receiving", hidden: "true" },
    { title: "PO detail", dataset: {} },
    { title: "GR-Test-Supplier-0353.pdf", mode: "receiving", hidden: "false" },
    { title: "PO detail", dataset: {} },
  ]);
  expect(results.quote).toBe("PQ-Test-Supplier-0353.pdf");
});
