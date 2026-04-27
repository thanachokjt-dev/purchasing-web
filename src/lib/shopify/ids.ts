export function extractShopifyNumericId(gid: string) {
  const value = gid.split("/").pop();
  if (!value) {
    throw new Error(`Invalid Shopify gid: ${gid}`);
  }
  return value;
}

export function optionValue(
  options: Array<{ name: string; value: string }>,
  index: number,
) {
  return options[index]?.value ?? null;
}

export function optionName(
  options: Array<{ name: string; value: string }>,
  index: number,
) {
  return options[index]?.name ?? null;
}

export function optionPick(options: Array<{ name: string; value: string }>) {
  const sizeOption = options.find((option) =>
    option.name.toLowerCase().includes("size"),
  );
  return sizeOption?.value ?? options[1]?.value ?? options[0]?.value ?? null;
}

export function numericOrNull(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
