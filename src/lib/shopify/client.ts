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
  inventoryItem: {
    id: string;
    tracked: boolean;
    inventoryLevels: {
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

export type ProductVariantsPayload = {
  productVariants: {
    pageInfo: {
      hasNextPage: boolean;
      endCursor: string | null;
    };
    nodes: ShopifyVariantNode[];
  };
};

export type ShopifyOrderNode = {
  id: string;
  name: string;
  createdAt: string;
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
        inventoryItem {
          id
          tracked
          inventoryLevels(first: 20) {
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

export const ORDERS_QUERY = `
  query Orders($cursor: String, $query: String!) {
    orders(first: 100, after: $cursor, query: $query, sortKey: CREATED_AT) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        name
        createdAt
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
