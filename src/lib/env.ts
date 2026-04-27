export function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function envStatus() {
  return {
    supabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    shopifyShopDomain: Boolean(process.env.SHOPIFY_SHOP_DOMAIN),
    shopifyAdminAccessToken: Boolean(process.env.SHOPIFY_ADMIN_ACCESS_TOKEN),
    syncSecret: Boolean(process.env.SYNC_SECRET),
    cronSecret: Boolean(process.env.CRON_SECRET),
  };
}
