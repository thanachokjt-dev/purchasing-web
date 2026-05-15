import { requireEnv } from "@/lib/env";

export type ShopifyGraphqlResponse<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
  extensions?: {
    cost?: {
      requestedQueryCost?: number;
      actualQueryCost?: number;
      throttleStatus?: {
        maximumAvailable: number;
        currentlyAvailable: number;
        restoreRate: number;
      };
    };
  };
};

export type ShopifyGraphqlResult<T> = ShopifyGraphqlResponse<T> & { data: T };

export type ShopifyVariantNode = {
  id: string;
  sku: string | null;
  barcode: string | null;
  title: string;
  price: string | null;
  compareAtPrice: string | null;
  image: {
    url: string;
  } | null;
  inventoryItem: {
    id: string;
    tracked: boolean;
    inventoryLevels: {
      pageInfo: {
        hasNextPage: boolean;
        endCursor: string | null;
      };
      nodes: Array<{
        location: {
          id: string;
          name: string;
        };
        quantities: Array<{
          name: string;
          quantity: number;
        }>;
      }>;
    };
  } | null;
  product: {
    id: string;
    title: string;
    productType: string | null;
    vendor: string | null;
    tags: string[];
    status: string;
    itemStatus: {
      value: string;
    } | null;
    featuredMedia: {
      preview: {
        image: {
          url: string;
        } | null;
      } | null;
    } | null;
  };
  selectedOptions: Array<{
    name: string;
    value: string;
  }>;
};

export type ShopifyInventoryLevelNode = NonNullable<
  ShopifyVariantNode["inventoryItem"]
>["inventoryLevels"]["nodes"][number];

export type ProductVariantsPayload = {
  productVariants: {
    pageInfo: {
      hasNextPage: boolean;
      endCursor: string | null;
    };
    nodes: ShopifyVariantNode[];
  };
};

export type InventoryLevelsPayload = {
  inventoryItem: {
    inventoryLevels: {
      pageInfo: {
        hasNextPage: boolean;
        endCursor: string | null;
      };
      nodes: ShopifyInventoryLevelNode[];
    };
  } | null;
};

export type ShopifyOrderNode = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  processedAt: string | null;
  cancelledAt: string | null;
  displayFinancialStatus: string | null;
  displayFulfillmentStatus: string | null;
  currencyCode: string;
  lineItems: {
    pageInfo: {
      hasNextPage: boolean;
      endCursor: string | null;
    };
    nodes: Array<{
      id: string;
      title: string;
      sku: string | null;
      quantity: number;
      currentQuantity: number | null;
      variantTitle: string | null;
      originalUnitPriceSet: {
        shopMoney: {
          amount: string;
          currencyCode: string;
        };
      };
      discountedTotalSet: {
        shopMoney: {
          amount: string;
          currencyCode: string;
        };
      };
      product: {
        id: string;
      } | null;
      variant: {
        id: string;
      } | null;
    }>;
  };
};

export type OrdersPayload = {
  orders: {
    pageInfo: {
      hasNextPage: boolean;
      endCursor: string | null;
    };
    nodes: ShopifyOrderNode[];
  };
};

export async function shopifyGraphql<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<ShopifyGraphqlResult<T>> {
  const shopDomain = requireEnv("SHOPIFY_SHOP_DOMAIN");
  const token = requireEnv("SHOPIFY_ADMIN_ACCESS_TOKEN");

  const response = await fetch(
    `https://${shopDomain}/admin/api/2026-04/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": token,
      },
      body: JSON.stringify({ query, variables }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(`Shopify API failed with HTTP ${response.status}`);
  }

  const payload = (await response.json()) as ShopifyGraphqlResponse<T>;
  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join("; "));
  }

  if (!payload.data) {
    throw new Error("Shopify API returned no data");
  }

  return payload as ShopifyGraphqlResult<T>;
}

export const PRODUCT_VARIANTS_QUERY = `
  query ProductVariants($cursor: String, $query: String) {
    productVariants(first: 100, after: $cursor, query: $query) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        sku
        barcode
        title
        price
        compareAtPrice
        image {
          url
        }
        inventoryItem {
          id
          tracked
          inventoryLevels(first: 20) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              location {
                id
                name
              }
              quantities(names: ["available", "on_hand", "committed", "incoming", "reserved", "safety_stock"]) {
                name
                quantity
              }
            }
          }
        }
        product {
          id
          title
          productType
          vendor
          tags
          status
          itemStatus: metafield(namespace: "items", key: "status") {
            value
          }
          featuredMedia {
            preview {
              image {
                url
              }
            }
          }
        }
        selectedOptions {
          name
          value
        }
      }
    }
  }
`;

export const INVENTORY_LEVELS_QUERY = `
  query InventoryLevels($id: ID!, $cursor: String) {
    inventoryItem(id: $id) {
      inventoryLevels(first: 100, after: $cursor) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          location {
            id
            name
          }
          quantities(names: ["available", "on_hand", "committed", "incoming", "reserved", "safety_stock"]) {
            name
            quantity
          }
        }
      }
    }
  }
`;

export const ORDERS_QUERY = `
  query Orders($cursor: String, $query: String!, $sortKey: OrderSortKeys!) {
    orders(first: 100, after: $cursor, query: $query, sortKey: $sortKey) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        name
        createdAt
        updatedAt
        processedAt
        cancelledAt
        displayFinancialStatus
        displayFulfillmentStatus
        currencyCode
        lineItems(first: 100) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            id
            title
            sku
            quantity
            currentQuantity
            variantTitle
            originalUnitPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            discountedTotalSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            product {
              id
            }
            variant {
              id
            }
          }
        }
      }
    }
  }
`;
