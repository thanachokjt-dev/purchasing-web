import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";

function loadSnapshot(imports) {
  const code = ts.transpileModule(
    fs.readFileSync(
      new URL("../src/lib/top-seller-snapshot.ts", import.meta.url),
      "utf8",
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  const exports = {};
  new Function("require", "exports", code)((name) => {
    if (!(name in imports)) throw Error(`Unmocked import ${name}`);
    return imports[name];
  }, exports);
  return exports;
}

test("snapshot expands every size while SKU sums reconcile to design totals", async () => {
  const variants = [
    {
      sku: "GLOVE-BLK-S",
      variant_title: "Black / S",
      option1_name: "Size",
      option1_value: "S",
      option2_name: "Color",
      option2_value: "Black",
    },
    {
      sku: "GLOVE-BLK-M",
      variant_title: "Black / M",
      option1_name: "Size",
      option1_value: "M",
      option2_name: "Color",
      option2_value: "Black",
    },
    {
      sku: "GLOVE-BLK-L",
      variant_title: "Black / L",
      option1_name: "Size",
      option1_value: "L",
      option2_name: "Color",
      option2_value: "Black",
    },
  ];
  const demand = [
    {
      sku: "GLOVE-BLK-S",
      sold_30: 1,
      sold_90: 3,
      total_sale: 10,
      avg_daily_30: 0.1,
      avg_daily_90: 0.2,
      demand_index_hm: 0.3,
    },
    {
      sku: "GLOVE-BLK-M",
      sold_30: 2,
      sold_90: 4,
      total_sale: 20,
      avg_daily_30: 0.2,
      avg_daily_90: 0.3,
      demand_index_hm: 0.4,
    },
    {
      sku: "GLOVE-BLK-L",
      sold_30: 0,
      sold_90: 0,
      total_sale: 0,
      avg_daily_30: 0,
      avg_daily_90: 0,
      demand_index_hm: 0,
    },
  ];
  const lines = variants.map((variant) => ({
    sku: variant.sku,
    mainName: "Training Gloves - Black",
    productName: "Training Gloves - Black",
    tags: ["Gloves"],
    itemStatus: "Available",
    hidden: false,
    supplier: "Factory",
    imageUrl: null,
  }));
  let saved = [];
  const client = {
    from(table) {
      if (table === "product_variants" || table === "demand_index_current")
        return {
          select() {
            return this;
          },
          order() {
            return this;
          },
          range: async () => ({
            data: table === "product_variants" ? variants : demand,
            error: null,
          }),
        };
      if (table === "top_seller_product_design_snapshot")
        return {
          upsert: async (rows) => {
            saved = rows;
            return { error: null };
          },
          delete() {
            return this;
          },
          neq: async () => ({ error: null }),
        };
      throw Error(table);
    },
  };
  const snapshot = loadSnapshot({
    "server-only": {},
    "node:crypto": { randomUUID: () => "00000000-0000-4000-8000-000000000001" },
    "@/lib/purchasing-decision-data": {
      getPurchasingDecisionData: async () => ({ mode: "supabase", lines }),
    },
    "@/lib/purchasing-setup": {
      getPurchasingSetupData: async () => ({ tags: [] }),
    },
    "@/lib/supabase/server": { getSupabaseServiceClient: () => client },
  });
  const result = await snapshot.refreshTopSellerProductDesignSnapshot(client);
  assert.equal(result.groupCount, 1);
  assert.equal(saved.length, 1);
  const row = saved[0];
  assert.deepEqual(
    row.sku_details.map((detail) => detail.size),
    ["S", "M", "L"],
  );
  assert.equal(row.sku_count, 3);
  assert.equal(row.sku_details.at(0).sku, "GLOVE-BLK-S");
  assert.equal(row.sku_details.find((detail) => detail.size === "L").sold90, 0);
  const sum = snapshot.summarizeTopSellerSkuDetails(row.sku_details);
  assert.equal(sum.sold30, row.sold_30);
  assert.equal(sum.sold90, row.sold_90);
  assert.equal(sum.totalSale, row.total_sale);
  assert.ok(Math.abs(sum.demandIndex30 - row.demand_index_30) < 1e-9);
  assert.ok(Math.abs(sum.demandIndex90 - row.demand_index_90) < 1e-9);
  assert.ok(
    Math.abs(sum.demandIndexLifetime - row.demand_index_lifetime) < 1e-9,
  );
});

test("snapshot migration adds an empty JSON array without replacing existing design rows", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      "create table public.top_seller_product_design_snapshot (group_key text primary key); insert into public.top_seller_product_design_snapshot values ('gloves');",
    );
    await db.exec(
      fs.readFileSync(
        new URL(
          "../supabase/migrations/20260930005854_top_seller_sku_details.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    assert.deepEqual(
      (
        await db.query(
          "select group_key,sku_details from public.top_seller_product_design_snapshot",
        )
      ).rows,
      [{ group_key: "gloves", sku_details: [] }],
    );
    await assert.rejects(
      db.exec(
        "update public.top_seller_product_design_snapshot set sku_details = '{}'::jsonb",
      ),
    );
  } finally {
    await db.close();
  }
});

test("design row starts collapsed with its original totals and a per-row expand control", () => {
  const source = fs.readFileSync(
    new URL(
      "../src/app/dashboard/top-seller-product-design-table.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const exports = {};
  new Function("require", "exports", code)((name) => {
    if (name === "react") return React;
    if (name === "react/jsx-runtime") return jsxRuntime;
    throw Error(name);
  }, exports);
  const detail = {
    sku: "GLOVE-BLK-S",
    size: "S",
    sold30: 1,
    sold90: 3,
    totalSale: 10,
    demandIndex30: 0.1,
    demandIndex90: 0.2,
    demandIndexLifetime: 0.3,
  };
  const row = {
    groupKey: "gloves::black",
    category: "Gloves",
    designName: "Training Gloves",
    color: "Black",
    suppliers: ["Factory"],
    tags: ["Gloves"],
    itemStatuses: ["Available"],
    visibilities: ["active"],
    imageUrl: null,
    skuCount: 1,
    skuDetails: [detail],
    ...detail,
  };
  const html = renderToStaticMarkup(
    createElement(exports.TopSellerProductDesignTable, {
      data: {
        refreshedAt: null,
        rows: [row],
        warnings: [],
        source: "top_seller_product_design_snapshot",
      },
    }),
  );
  assert.match(html, /Top Seller Product by Design/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /\+ Show SKUs/);
  assert.match(html, /Training Gloves/);
  assert.doesNotMatch(html, /Total Sold \(All time\)/);
});
