create table if not exists public.po_new_product_plans (
  id uuid primary key default gen_random_uuid(),
  plan_number text unique not null,
  plan_name text not null,
  supplier_code text references public.po_suppliers(supplier_code),
  supplier_name_snapshot text,
  category text,
  planned_launch_date date,
  target_coverage_days integer not null default 30,
  sales_history_start date,
  sales_history_end date,
  channel_filter text,
  season_factor numeric not null default 1,
  confidence_factor numeric not null default 1,
  risk_factor numeric not null default 1,
  risk_reason text,
  budget_cap_thb numeric,
  status text not null default 'draft',
  created_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  po_id text references public.po_orders(po_id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint po_new_product_plans_status_check check (
    status in (
      'draft',
      'review',
      'approved',
      'po_created',
      'cancelled',
      'launched',
      'closed'
    )
  ),
  constraint po_new_product_plans_target_coverage_check check (target_coverage_days > 0),
  constraint po_new_product_plans_factors_check check (
    season_factor > 0 and confidence_factor > 0 and risk_factor > 0
  ),
  constraint po_new_product_plans_budget_check check (
    budget_cap_thb is null or budget_cap_thb > 0
  )
);

create table if not exists public.po_new_product_plan_comparables (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.po_new_product_plans(id) on delete cascade,
  comparable_product_id uuid references public.products(id) on delete set null,
  comparable_sku text,
  comparable_title_snapshot text,
  weight numeric not null default 1,
  note text,
  created_at timestamptz not null default now(),
  constraint po_new_product_plan_comparables_weight_check check (weight > 0)
);

create table if not exists public.po_new_product_plan_lines (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.po_new_product_plans(id) on delete cascade,
  planned_sku text,
  product_name text,
  variant_title text,
  size_value text,
  color_value text,
  image_url text,
  demand_index_estimate numeric,
  suggested_opening_qty numeric,
  manual_qty numeric,
  final_qty numeric,
  locked_qty boolean not null default false,
  variant_note text,
  unit_cost numeric,
  estimated_cost numeric,
  estimated_thb numeric,
  estimated_margin numeric,
  order_multiple integer not null default 10,
  supplier_moq integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint po_new_product_plan_lines_order_multiple_check check (order_multiple > 0),
  constraint po_new_product_plan_lines_supplier_moq_check check (
    supplier_moq is null or supplier_moq >= 0
  )
);

create table if not exists public.po_new_product_plan_scenarios (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.po_new_product_plans(id) on delete cascade,
  scenario_name text not null,
  scenario_type text not null,
  season_factor numeric not null default 1,
  confidence_factor numeric not null default 1,
  risk_factor numeric not null default 1,
  target_coverage_days integer,
  budget_cap_thb numeric,
  total_suggested_qty numeric,
  total_final_qty numeric,
  total_estimated_thb numeric,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  constraint po_new_product_plan_scenarios_type_check check (
    scenario_type in ('conservative', 'base', 'aggressive', 'custom')
  ),
  constraint po_new_product_plan_scenarios_factors_check check (
    season_factor > 0 and confidence_factor > 0 and risk_factor > 0
  ),
  constraint po_new_product_plan_scenarios_coverage_check check (
    target_coverage_days is null or target_coverage_days > 0
  ),
  constraint po_new_product_plan_scenarios_budget_check check (
    budget_cap_thb is null or budget_cap_thb > 0
  )
);

create table if not exists public.po_new_product_plan_audit_logs (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references public.po_new_product_plans(id) on delete cascade,
  action_type text not null,
  old_values jsonb,
  new_values jsonb,
  note text,
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now()
);

create index if not exists idx_po_new_product_plans_status
  on public.po_new_product_plans (status);

create index if not exists idx_po_new_product_plans_supplier_code
  on public.po_new_product_plans (supplier_code);

create index if not exists idx_po_new_product_plans_created_at
  on public.po_new_product_plans (created_at desc);

create index if not exists idx_po_new_product_plan_comparables_plan_id
  on public.po_new_product_plan_comparables (plan_id);

create index if not exists idx_po_new_product_plan_lines_plan_id
  on public.po_new_product_plan_lines (plan_id);

create index if not exists idx_po_new_product_plan_scenarios_plan_id
  on public.po_new_product_plan_scenarios (plan_id);

create index if not exists idx_po_new_product_plan_audit_logs_plan_id
  on public.po_new_product_plan_audit_logs (plan_id, changed_at desc);

create or replace function public.set_po_new_product_plans_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_po_new_product_plans_updated_at on public.po_new_product_plans;
create trigger set_po_new_product_plans_updated_at
before update on public.po_new_product_plans
for each row
execute function public.set_po_new_product_plans_updated_at();

create or replace function public.set_po_new_product_plan_lines_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_po_new_product_plan_lines_updated_at on public.po_new_product_plan_lines;
create trigger set_po_new_product_plan_lines_updated_at
before update on public.po_new_product_plan_lines
for each row
execute function public.set_po_new_product_plan_lines_updated_at();
