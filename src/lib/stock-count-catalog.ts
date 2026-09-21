import {
  matrixItemFamily,
  matrixItemSize,
  matrixProductGroupKey,
  matrixProductName,
  matrixSectionName,
  sizeSortRank,
} from "@/lib/po-size-matrix";

type ProductRelation = {
  product_title: string | null;
  product_type: string | null;
  tags: string[] | null;
  status: string | null;
};

export type StockCountCatalogRow = {
  id: string;
  sku: string | null;
  variant_title: string | null;
  effective_status: string | null;
  option1_name: string | null;
  option1_value: string | null;
  option2_name: string | null;
  option2_value: string | null;
  option3_name: string | null;
  option3_value: string | null;
  products: ProductRelation | ProductRelation[] | null;
};

function productRelation(row: StockCountCatalogRow) {
  return Array.isArray(row.products) ? row.products[0] : row.products;
}

function catalogMatrixItem(row: StockCountCatalogRow, product: ProductRelation, sku: string) {
  const options = [
    [row.option1_name, row.option1_value],
    [row.option2_name, row.option2_value],
    [row.option3_name, row.option3_value],
  ] as const;
  const sizeOption = options.find(([name]) => /size/i.test(String(name ?? "")));
  const rawSize = String(sizeOption?.[1] ?? "").trim();
  const size = rawSize
    ? matrixItemSize({
        productName: product.product_title,
        productTitle: product.product_title,
        variantTitle: rawSize,
        sku,
        tags: product.tags ?? [],
      })
    : "OS";
  const descriptors = options.flatMap(([name, value]) => {
    const cleanName = String(name ?? "").trim();
    const cleanValue = String(value ?? "").trim();
    if (!cleanValue || /^default title$/i.test(cleanValue) || /^title$/i.test(cleanName)) return [];
    if (!/size/i.test(cleanName)) return [cleanValue];
    if (!/&|color/i.test(cleanName)) return [];
    const withoutSize = matrixProductName({ productTitle: cleanValue, variantTitle: rawSize });
    return withoutSize && withoutSize !== size ? [withoutSize] : [];
  });
  const uniqueDescriptors = Array.from(new Set(descriptors));
  const baseName = String(product.product_title ?? sku).trim();
  const productName = uniqueDescriptors.length ? `${baseName} - ${uniqueDescriptors.join(" / ")}` : baseName;
  return {
    productTitle: productName,
    productName,
    variantTitle: size,
    sku,
    tags: product.tags ?? [],
  };
}

export function buildStockCountCatalogSnapshot(rows: StockCountCatalogRow[]) {
  const seenGroupSizes = new Set<string>();
  const lines = rows.flatMap((row) => {
    const product = productRelation(row);
    const sku = String(row.sku ?? "").trim();
    if (!product || !sku || String(product.status ?? "").toLowerCase() !== "active") return [];
    if (["inactive", "archived", "deleted"].includes(String(row.effective_status ?? "").toLowerCase())) return [];
    let item = catalogMatrixItem(row, product, sku);
    const size = matrixItemSize(item);
    let productGroupKey = matrixProductGroupKey(item);
    let uniqueKey = `${productGroupKey}\u0000${size}`;
    if (seenGroupSizes.has(uniqueKey)) {
      const disambiguatedName = `${matrixProductName(item)} [${sku}]`;
      item = { ...item, productName: disambiguatedName, productTitle: disambiguatedName };
      productGroupKey = matrixProductGroupKey(item);
      uniqueKey = `${productGroupKey}\u0000${size}`;
    }
    seenGroupSizes.add(uniqueKey);
    const family = matrixItemFamily(item);
    return [{
      variant_id: row.id,
      sku,
      product_group_key: productGroupKey,
      section_name: matrixSectionName(item),
      family,
      product_name: matrixProductName(item),
      size,
      tags: product.tags ?? [],
      sort_order: 0,
    }];
  });

  lines.sort((a, b) =>
    a.section_name.localeCompare(b.section_name)
    || a.family.localeCompare(b.family)
    || a.product_name.localeCompare(b.product_name)
    || sizeSortRank(a.size, a.family) - sizeSortRank(b.size, b.family)
    || a.sku.localeCompare(b.sku),
  );
  return lines.map((line, index) => ({ ...line, sort_order: index }));
}
