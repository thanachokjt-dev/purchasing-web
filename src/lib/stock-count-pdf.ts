import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PageSizes, PDFDocument, PDFFont, PDFPage, rgb } from "pdf-lib";
import { matrixSectionLabel, sortMatrixSizes, type MatrixFamily } from "@/lib/po-size-matrix";
import type { StockCountLine, StockCountLocation } from "@/lib/stock-counts";

type PdfProductRow = {
  key: string;
  productName: string;
  linesBySize: Map<string, StockCountLine>;
};

type PdfSection = {
  key: string;
  label: string;
  sectionName: string;
  family: MatrixFamily;
  sizes: string[];
  rows: PdfProductRow[];
};

const PAGE_WIDTH = PageSizes.A4[1];
const PAGE_HEIGHT = PageSizes.A4[0];
const MARGIN = 24;
const TABLE_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FOOTER_HEIGHT = 22;
const ROW_HEIGHT = 34;
const HEADER_HEIGHT = 24;
const SECTION_HEIGHT = 21;

const ink = rgb(0.09, 0.13, 0.16);
const muted = rgb(0.37, 0.43, 0.5);
const border = rgb(0.78, 0.82, 0.86);
const headerFill = rgb(0.93, 0.95, 0.97);
const sectionFill = rgb(0.97, 0.98, 0.99);
const unavailableFill = rgb(0.91, 0.92, 0.94);

function compareText(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function familyRank(family: MatrixFamily) {
  return ["glove", "protective", "apparel", "child-code", "child-numeric", "one-size", "unknown"].indexOf(family);
}

function buildSections(lines: StockCountLine[]) {
  const groups = new Map<string, { family: MatrixFamily; sectionName: string; lines: StockCountLine[] }>();
  for (const line of lines) {
    const key = `${line.sectionName}\u0000${line.family}`;
    const group = groups.get(key) ?? { family: line.family, sectionName: line.sectionName, lines: [] };
    group.lines.push(line);
    groups.set(key, group);
  }

  return Array.from(groups, ([key, group]) => {
    const products = new Map<string, PdfProductRow>();
    for (const line of group.lines) {
      const product = products.get(line.productGroupKey) ?? {
        key: line.productGroupKey,
        productName: line.productName,
        linesBySize: new Map(),
      };
      product.linesBySize.set(line.size, line);
      products.set(line.productGroupKey, product);
    }
    return {
      key,
      label: matrixSectionLabel(group.sectionName, group.family).toUpperCase(),
      sectionName: group.sectionName,
      family: group.family,
      sizes: sortMatrixSizes(group.lines.map((line) => line.size), group.family),
      rows: Array.from(products.values()).sort((a, b) =>
        compareText(a.productName, b.productName) || compareText(a.key, b.key),
      ),
    } satisfies PdfSection;
  }).sort((a, b) =>
    compareText(a.sectionName, b.sectionName) || familyRank(a.family) - familyRank(b.family),
  );
}

function supportedText(font: PDFFont, value: string) {
  const characters = new Set(font.getCharacterSet());
  return Array.from(value, (character) => characters.has(character.codePointAt(0) ?? 0) ? character : "?").join("");
}

function fitText(font: PDFFont, value: string, size: number, maxWidth: number) {
  const clean = supportedText(font, value);
  if (font.widthOfTextAtSize(clean, size) <= maxWidth) return clean;
  const suffix = "...";
  let result = clean;
  while (result && font.widthOfTextAtSize(`${result}${suffix}`, size) > maxWidth) result = result.slice(0, -1);
  return `${result}${suffix}`;
}

function drawCell(
  page: PDFPage,
  x: number,
  top: number,
  width: number,
  height: number,
  fill = rgb(1, 1, 1),
) {
  page.drawRectangle({ x, y: top - height, width, height, color: fill, borderColor: border, borderWidth: 0.6 });
}

function drawCenteredText(page: PDFPage, font: PDFFont, value: string, size: number, x: number, y: number, width: number) {
  const text = fitText(font, value, size, width - 6);
  const textWidth = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: x + Math.max(3, (width - textWidth) / 2), y, size, font, color: ink });
}

export async function createStockCountPdf({
  lines,
  locationType,
  weekStart,
}: {
  lines: StockCountLine[];
  locationType: StockCountLocation;
  weekStart: string;
}) {
  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);
  const [regularBytes, boldBytes] = await Promise.all([
    readFile(path.join(process.cwd(), "public", "fonts", "Sarabun-Regular.ttf")),
    readFile(path.join(process.cwd(), "public", "fonts", "Sarabun-Bold.ttf")),
  ]);
  const regular = await document.embedFont(regularBytes, { subset: true });
  const bold = await document.embedFont(boldBytes, { subset: true });
  const sections = buildSections(lines);
  const locationLabel = locationType === "warehouse" ? "WAREHOUSE STOCK" : "RETAIL STOCK";
  let page!: PDFPage;
  let cursorY = 0;

  function addPage() {
    page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    page.drawText(`WEEKLY STOCK COUNT - ${locationLabel}`, {
      x: MARGIN,
      y: PAGE_HEIGHT - 30,
      size: 15,
      font: bold,
      color: ink,
    });
    page.drawText(`WEEK OF ${weekStart}`, { x: MARGIN, y: PAGE_HEIGHT - 47, size: 8, font: bold, color: muted });
    const countLine = "COUNTED BY: ____________________________________    DATE: ____________________";
    const countWidth = regular.widthOfTextAtSize(countLine, 7);
    page.drawText(countLine, { x: PAGE_WIDTH - MARGIN - countWidth, y: PAGE_HEIGHT - 47, size: 7, font: regular, color: muted });
    cursorY = PAGE_HEIGHT - 62;
  }

  function drawTableHeader(section: PdfSection, continued = false) {
    const productWidth = Math.max(170, Math.min(330, TABLE_WIDTH - section.sizes.length * 42));
    const sizeWidth = (TABLE_WIDTH - productWidth) / Math.max(1, section.sizes.length);
    drawCell(page, MARGIN, cursorY, TABLE_WIDTH, SECTION_HEIGHT, sectionFill);
    page.drawText(fitText(bold, `${section.label}${continued ? " (CONTINUED)" : ""}`, 7.5, TABLE_WIDTH - 12), {
      x: MARGIN + 6,
      y: cursorY - 14,
      size: 7.5,
      font: bold,
      color: muted,
    });
    cursorY -= SECTION_HEIGHT;
    drawCell(page, MARGIN, cursorY, productWidth, HEADER_HEIGHT, headerFill);
    page.drawText("PRODUCT", { x: MARGIN + 6, y: cursorY - 16, size: 7, font: bold, color: muted });
    section.sizes.forEach((size, index) => {
      const x = MARGIN + productWidth + sizeWidth * index;
      drawCell(page, x, cursorY, sizeWidth, HEADER_HEIGHT, headerFill);
      drawCenteredText(page, bold, size, Math.max(5.5, Math.min(7, sizeWidth / 7)), x, cursorY - 16, sizeWidth);
    });
    cursorY -= HEADER_HEIGHT;
    return { productWidth, sizeWidth };
  }

  addPage();
  for (const section of sections) {
    if (cursorY - SECTION_HEIGHT - HEADER_HEIGHT - ROW_HEIGHT < FOOTER_HEIGHT) addPage();
    let dimensions = drawTableHeader(section);
    for (const [rowIndex, product] of section.rows.entries()) {
      if (cursorY - ROW_HEIGHT < FOOTER_HEIGHT) {
        addPage();
        dimensions = drawTableHeader(section, true);
      }
      const rowFill = rowIndex % 2 ? rgb(0.99, 0.995, 1) : rgb(1, 1, 1);
      drawCell(page, MARGIN, cursorY, dimensions.productWidth, ROW_HEIGHT, rowFill);
      page.drawText(fitText(bold, product.productName, 7.2, dimensions.productWidth - 12), {
        x: MARGIN + 6,
        y: cursorY - 14,
        size: 7.2,
        font: bold,
        color: ink,
      });
      page.drawText("Write counted quantity in the matching size cell", {
        x: MARGIN + 6,
        y: cursorY - 26,
        size: 5.2,
        font: regular,
        color: muted,
      });
      section.sizes.forEach((size, sizeIndex) => {
        const x = MARGIN + dimensions.productWidth + dimensions.sizeWidth * sizeIndex;
        const line = product.linesBySize.get(size);
        drawCell(page, x, cursorY, dimensions.sizeWidth, ROW_HEIGHT, line ? rowFill : unavailableFill);
        if (line) {
          drawCenteredText(page, regular, line.sku, Math.max(4, Math.min(5.2, dimensions.sizeWidth / 9)), x, cursorY - ROW_HEIGHT + 5, dimensions.sizeWidth);
        } else {
          drawCenteredText(page, regular, "-", 7, x, cursorY - 21, dimensions.sizeWidth);
        }
      });
      cursorY -= ROW_HEIGHT;
    }
    cursorY -= 10;
  }

  const pages = document.getPages();
  pages.forEach((pdfPage, index) => {
    const pageLabel = `PAGE ${index + 1} / ${pages.length}`;
    const labelWidth = regular.widthOfTextAtSize(pageLabel, 6.5);
    pdfPage.drawText(pageLabel, {
      x: PAGE_WIDTH - MARGIN - labelWidth,
      y: 10,
      size: 6.5,
      font: regular,
      color: muted,
    });
  });

  document.setTitle(`Weekly Stock Count - ${locationLabel} - ${weekStart}`);
  document.setCreator("Retail Purchasing");
  return document.save();
}
