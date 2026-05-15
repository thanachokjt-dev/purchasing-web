-- Supabase Data API explicit grants.
--
-- Supabase no longer automatically exposes new public-schema objects to the
-- Data API. These objects are internal purchasing, warehouse, payment,
-- approval, supplier-cost, and sync tables, so anon is intentionally omitted.
--
-- TODO: Add narrow authenticated RLS policies when a browser/client-side
-- authenticated Supabase client is introduced. The current app accesses these
-- objects through server-side service_role clients.

grant usage on schema public to authenticated, service_role;

do $$
declare
  table_name text;
  table_names text[] := array[
    'shopify_locations',
    'products',
    'product_variants',
    'inventory_snapshots',
    'sync_runs',
    'sales_lines',
    'manual_supplier_mappings',
    'po_suppliers',
    'po_orders',
    'po_items',
    'po_receipts',
    'po_status_events',
    'purchasing_decision_controls',
    'po_payments',
    'po_supplier_contacts',
    'purchasing_tag_catalog',
    'sync_locks',
    'sales_by_sku_day',
    'demand_index_current',
    'user_profiles',
    'payment_requests',
    'payment_approval_steps',
    'payment_request_documents',
    'payment_proof_audit_logs',
    'payment_request_document_audit_logs',
    'payment_request_audit_logs',
    'po_new_product_plans',
    'po_new_product_plan_comparables',
    'po_new_product_plan_lines',
    'po_new_product_plan_scenarios',
    'po_new_product_plan_audit_logs'
  ];
begin
  foreach table_name in array table_names loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('alter table public.%I enable row level security', table_name);
      execute format('grant select, insert, update, delete on table public.%I to authenticated', table_name);
      execute format('grant select, insert, update, delete on table public.%I to service_role', table_name);
      execute format(
        'comment on table public.%I is %L',
        table_name,
        'Internal operational table. RLS is enabled with no broad authenticated policies; add narrow policies before client-side access.'
      );
    end if;
  end loop;
end $$;

do $$
declare
  view_name text;
  view_names text[] := array[
    'po_item_receipt_totals',
    'po_incoming_by_sku',
    'purchasing_sales_by_sku',
    'current_inventory_by_sku',
    'po_order_summary',
    'po_portal_metrics',
    'po_supplier_pipeline_summary',
    'po_catalog_search',
    'po_payment_timeline_events',
    'po_payment_timeline_daily',
    'po_incoming_eta_events',
    'po_incoming_eta_daily',
    'po_incoming_pipeline_events',
    'po_incoming_eta_unscheduled_events',
    'po_incoming_eta_reconciliation',
    'po_incoming_eta_supplier_reconciliation'
  ];
begin
  foreach view_name in array view_names loop
    if to_regclass(format('public.%I', view_name)) is not null then
      execute format('grant select on table public.%I to service_role', view_name);
      execute format(
        'comment on view public.%I is %L',
        view_name,
        'Internal read model for server-side service_role access. Do not grant anon; add security_invoker and narrow authenticated access only if exposed to client-side users.'
      );
    end if;
  end loop;
end $$;

do $$
declare
  function_signature text;
  function_signatures text[] := array[
    'public.try_acquire_sync_lock(text, uuid, integer)',
    'public.release_sync_lock(text, uuid)',
    'public.refresh_sales_by_sku_day_for_dates(date[])',
    'public.refresh_sales_by_sku_day_between(date, date)',
    'public.refresh_demand_index_current_for_skus(text[])',
    'public.refresh_demand_index_current()',
    'public.backfill_sales_by_sku_day()',
    'public.backfill_sales_summary_and_demand()',
    'public.is_po_line_active_incoming(text, text, timestamptz, timestamptz, numeric)',
    'public.po_portal_status_key(text)',
    'public.is_po_order_active_for_portal(text, timestamptz, timestamptz)',
    'public.is_po_line_physically_expected_for_portal(text)',
    'public.po_portal_date_spine(date, date)',
    'public.is_po_pipeline_incoming_for_portal(text, text, timestamptz, timestamptz, numeric)',
    'public.set_user_profiles_updated_at()',
    'public.set_payment_requests_updated_at()',
    'public.set_payment_approval_steps_updated_at()',
    'public.set_po_new_product_plans_updated_at()',
    'public.set_po_new_product_plan_lines_updated_at()',
    'public.guard_po_receipt_over_receive()'
  ];
begin
  foreach function_signature in array function_signatures loop
    if to_regprocedure(function_signature) is not null then
      execute format('revoke all on function %s from public, anon, authenticated', function_signature);
      execute format('grant execute on function %s to service_role', function_signature);
    end if;
  end loop;
end $$;

do $$
declare
  sequence_record record;
begin
  for sequence_record in
    select quote_ident(sequence_schema) || '.' || quote_ident(sequence_name) as sequence_name
    from information_schema.sequences
    where sequence_schema = 'public'
  loop
    execute format('grant usage, select on sequence %s to authenticated', sequence_record.sequence_name);
    execute format('grant usage, select on sequence %s to service_role', sequence_record.sequence_name);
  end loop;
end $$;
