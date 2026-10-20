-- Pro Scan V2 initial schema
-- Keep this project independent from the existing PRO_SCAN Supabase project.

create extension if not exists pgcrypto;

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  role text not null default 'operator'
    check (role in ('admin', 'planner', 'supervisor', 'operator', 'viewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.production_lines (
  id uuid primary key default gen_random_uuid(),
  line_code text not null unique,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.production_shifts (
  id uuid primary key default gen_random_uuid(),
  shift_code text not null unique,
  name text not null,
  start_time time not null,
  end_time time not null,
  break_minutes integer not null default 0 check (break_minutes >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.monthly_production_plans (
  id uuid primary key default gen_random_uuid(),
  plan_code text not null unique,
  brand text not null,
  product_name text not null,
  model_code text,
  mrp numeric(12,2) not null check (mrp >= 0),
  planned_month date not null check (extract(day from planned_month) = 1),
  status text not null default 'draft'
    check (status in ('draft', 'importing', 'ready', 'in_progress', 'completed', 'cancelled')),
  created_by uuid references auth.users(id) on delete set null,
  finalized_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists monthly_production_plans_month_idx
  on public.monthly_production_plans (planned_month, status);

create table if not exists public.serial_import_batches (
  id uuid primary key default gen_random_uuid(),
  monthly_plan_id uuid not null references public.monthly_production_plans(id) on delete cascade,
  file_name text not null,
  storage_path text,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'completed_with_errors', 'failed')),
  extracted_count integer not null default 0 check (extracted_count >= 0),
  accepted_count integer not null default 0 check (accepted_count >= 0),
  duplicate_count integer not null default 0 check (duplicate_count >= 0),
  invalid_count integer not null default 0 check (invalid_count >= 0),
  unreadable_pages integer not null default 0 check (unreadable_pages >= 0),
  error_summary jsonb not null default '[]'::jsonb,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists serial_import_batches_plan_idx
  on public.serial_import_batches (monthly_plan_id, created_at desc);

-- Serial values are stored as text so prefixes and leading zeroes are preserved.
-- normalized_serial is the exact normalized barcode/QR payload used for matching.
create table if not exists public.serial_registry (
  id uuid primary key default gen_random_uuid(),
  monthly_plan_id uuid not null references public.monthly_production_plans(id) on delete cascade,
  import_batch_id uuid references public.serial_import_batches(id) on delete set null,
  serial_number text not null,
  normalized_serial text not null unique,
  source_page integer,
  registered_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  constraint serial_number_not_blank check (length(btrim(serial_number)) > 0),
  constraint normalized_serial_not_blank check (length(btrim(normalized_serial)) > 0)
);

create index if not exists serial_registry_plan_idx
  on public.serial_registry (monthly_plan_id, normalized_serial);

create table if not exists public.daily_production_plans (
  id uuid primary key default gen_random_uuid(),
  plan_code text not null unique,
  monthly_plan_id uuid not null references public.monthly_production_plans(id) on delete restrict,
  production_date date not null,
  production_line_id uuid not null references public.production_lines(id) on delete restrict,
  shift_id uuid not null references public.production_shifts(id) on delete restrict,
  shift_start time not null,
  shift_end time not null,
  break_minutes integer not null default 0 check (break_minutes >= 0),
  planned_quantity integer not null check (planned_quantity > 0),
  target_per_hour integer not null check (target_per_hour > 0),
  manpower_count integer not null default 0 check (manpower_count >= 0),
  status text not null default 'scheduled'
    check (status in ('draft', 'scheduled', 'running', 'paused', 'completed', 'cancelled')),
  created_by uuid references auth.users(id) on delete set null,
  started_at timestamptz,
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists daily_production_plans_date_idx
  on public.daily_production_plans (production_date, status);
create index if not exists daily_production_plans_line_idx
  on public.daily_production_plans (production_line_id, production_date, shift_id);

create table if not exists public.daily_plan_hour_targets (
  id uuid primary key default gen_random_uuid(),
  daily_plan_id uuid not null references public.daily_production_plans(id) on delete cascade,
  hour_index integer not null check (hour_index >= 1),
  hour_start time not null,
  hour_end time not null,
  planned_quantity integer not null default 0 check (planned_quantity >= 0),
  is_break boolean not null default false,
  created_at timestamptz not null default now(),
  unique (daily_plan_id, hour_index),
  check (is_break = false or planned_quantity = 0)
);

create table if not exists public.daily_plan_serials (
  id uuid primary key default gen_random_uuid(),
  daily_plan_id uuid not null references public.daily_production_plans(id) on delete cascade,
  serial_registry_id uuid not null references public.serial_registry(id) on delete restrict,
  allocated_at timestamptz not null default now(),
  allocated_by uuid references auth.users(id) on delete set null,
  produced_at timestamptz,
  released_at timestamptz,
  status text not null default 'allocated'
    check (status in ('allocated', 'produced', 'released')),
  check ((status <> 'produced') or produced_at is not null)
);

-- A serial may have allocation history, but only one active allocation at a time.
create unique index if not exists daily_plan_serials_one_active_allocation_idx
  on public.daily_plan_serials (serial_registry_id)
  where status in ('allocated', 'produced');

create index if not exists daily_plan_serials_plan_status_idx
  on public.daily_plan_serials (daily_plan_id, status);

-- Append-only audit log: repeat scans and invalid scans are recorded instead of discarded.
create table if not exists public.scan_events (
  id uuid primary key default gen_random_uuid(),
  raw_value text not null,
  normalized_value text not null,
  serial_registry_id uuid references public.serial_registry(id) on delete set null,
  monthly_plan_id uuid references public.monthly_production_plans(id) on delete set null,
  daily_plan_id uuid references public.daily_production_plans(id) on delete set null,
  production_line_id uuid references public.production_lines(id) on delete set null,
  shift_id uuid references public.production_shifts(id) on delete set null,
  operator_id uuid references auth.users(id) on delete set null default auth.uid(),
  device_id text,
  classification text not null
    check (classification in ('valid_first_scan', 'duplicate', 'invalid', 'unallocated')),
  counted_as_production boolean not null default false,
  message text,
  scanned_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check ((classification = 'valid_first_scan') = counted_as_production)
);

-- This index is the final concurrency guard: a serial can increase actual production once only.
create unique index if not exists scan_events_one_counted_scan_per_serial_idx
  on public.scan_events (serial_registry_id)
  where counted_as_production = true and serial_registry_id is not null;

create index if not exists scan_events_scanned_at_idx
  on public.scan_events (scanned_at desc);
create index if not exists scan_events_plan_time_idx
  on public.scan_events (daily_plan_id, scanned_at desc);
create index if not exists scan_events_classification_idx
  on public.scan_events (classification, scanned_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists monthly_production_plans_set_updated_at on public.monthly_production_plans;
create trigger monthly_production_plans_set_updated_at
before update on public.monthly_production_plans
for each row execute function public.set_updated_at();

drop trigger if exists daily_production_plans_set_updated_at on public.daily_production_plans;
create trigger daily_production_plans_set_updated_at
before update on public.daily_production_plans
for each row execute function public.set_updated_at();

-- RLS is enabled on every public table. This is a single-factory authenticated workspace baseline;
-- role-specific permissions can be tightened after the sign-in/role-management flow is implemented.
alter table public.user_profiles enable row level security;
alter table public.production_lines enable row level security;
alter table public.production_shifts enable row level security;
alter table public.monthly_production_plans enable row level security;
alter table public.serial_import_batches enable row level security;
alter table public.serial_registry enable row level security;
alter table public.daily_production_plans enable row level security;
alter table public.daily_plan_hour_targets enable row level security;
alter table public.daily_plan_serials enable row level security;
alter table public.scan_events enable row level security;

drop policy if exists "profile_select_self" on public.user_profiles;
create policy "profile_select_self" on public.user_profiles
for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "profile_insert_self_as_operator" on public.user_profiles;
create policy "profile_insert_self_as_operator" on public.user_profiles
for insert to authenticated
with check (user_id = (select auth.uid()) and role = 'operator');

-- Shared factory workspace: all signed-in users can work with shared planning data.
-- Unauthenticated/anon access is not granted by these policies.
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'production_lines',
    'production_shifts',
    'monthly_production_plans',
    'serial_import_batches',
    'serial_registry',
    'daily_production_plans',
    'daily_plan_hour_targets',
    'daily_plan_serials'
  ]
  loop
    execute format('drop policy if exists "authenticated_factory_access" on public.%I', tbl);
    execute format(
      'create policy "authenticated_factory_access" on public.%I for all to authenticated using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null)',
      tbl
    );
  end loop;
end;
$$;

drop policy if exists "scan_events_select_authenticated" on public.scan_events;
create policy "scan_events_select_authenticated" on public.scan_events
for select to authenticated using ((select auth.uid()) is not null);

drop policy if exists "scan_events_insert_authenticated" on public.scan_events;
create policy "scan_events_insert_authenticated" on public.scan_events
for insert to authenticated with check ((select auth.uid()) is not null);

grant select, insert, update, delete on
  public.production_lines,
  public.production_shifts,
  public.monthly_production_plans,
  public.serial_import_batches,
  public.serial_registry,
  public.daily_production_plans,
  public.daily_plan_hour_targets,
  public.daily_plan_serials
to authenticated;

grant select, insert on public.scan_events to authenticated;
grant select, insert on public.user_profiles to authenticated;

-- Atomic scan RPC. Uses invoker permissions/RLS and database uniqueness, not client-only checks.
create or replace function public.record_production_scan(
  p_raw_value text,
  p_daily_plan_id uuid,
  p_device_id text default null
)
returns public.scan_events
language plpgsql
set search_path = ''
as $$
declare
  v_normalized text;
  v_plan public.daily_production_plans%rowtype;
  v_serial public.serial_registry%rowtype;
  v_event public.scan_events%rowtype;
  v_allocation public.daily_plan_serials%rowtype;
begin
  v_normalized := upper(regexp_replace(btrim(coalesce(p_raw_value, '')), '\s+', '', 'g'));

  select * into v_plan
  from public.daily_production_plans
  where id = p_daily_plan_id;

  if not found then
    insert into public.scan_events (
      raw_value, normalized_value, classification, counted_as_production,
      device_id, message
    ) values (
      coalesce(p_raw_value, ''), v_normalized, 'invalid', false, p_device_id,
      'Daily production plan not found'
    ) returning * into v_event;
    return v_event;
  end if;

  if v_normalized = '' then
    insert into public.scan_events (
      raw_value, normalized_value, monthly_plan_id, daily_plan_id,
      production_line_id, shift_id, classification, counted_as_production,
      device_id, message
    ) values (
      coalesce(p_raw_value, ''), '', v_plan.monthly_plan_id, v_plan.id,
      v_plan.production_line_id, v_plan.shift_id, 'invalid', false,
      p_device_id, 'Empty scan value'
    ) returning * into v_event;
    return v_event;
  end if;

  select * into v_serial
  from public.serial_registry
  where normalized_serial = v_normalized;

  if not found then
    insert into public.scan_events (
      raw_value, normalized_value, monthly_plan_id, daily_plan_id,
      production_line_id, shift_id, classification, counted_as_production,
      device_id, message
    ) values (
      p_raw_value, v_normalized, v_plan.monthly_plan_id, v_plan.id,
      v_plan.production_line_id, v_plan.shift_id, 'invalid', false,
      p_device_id, 'Serial not found in the registered monthly serial pool'
    ) returning * into v_event;
    return v_event;
  end if;

  select * into v_allocation
  from public.daily_plan_serials
  where serial_registry_id = v_serial.id
    and daily_plan_id = v_plan.id
    and status in ('allocated', 'produced');

  if not found then
    insert into public.scan_events (
      raw_value, normalized_value, serial_registry_id, monthly_plan_id,
      daily_plan_id, production_line_id, shift_id, classification,
      counted_as_production, device_id, message
    ) values (
      p_raw_value, v_normalized, v_serial.id, v_serial.monthly_plan_id,
      v_plan.id, v_plan.production_line_id, v_plan.shift_id, 'unallocated',
      false, p_device_id, 'Serial is not allocated to this daily plan'
    ) returning * into v_event;
    return v_event;
  end if;

  begin
    insert into public.scan_events (
      raw_value, normalized_value, serial_registry_id, monthly_plan_id,
      daily_plan_id, production_line_id, shift_id, classification,
      counted_as_production, device_id, message
    ) values (
      p_raw_value, v_normalized, v_serial.id, v_serial.monthly_plan_id,
      v_plan.id, v_plan.production_line_id, v_plan.shift_id, 'valid_first_scan',
      true, p_device_id, 'First valid scan'
    ) returning * into v_event;

    update public.daily_plan_serials
    set status = 'produced', produced_at = v_event.scanned_at
    where id = v_allocation.id;

    return v_event;
  exception when unique_violation then
    insert into public.scan_events (
      raw_value, normalized_value, serial_registry_id, monthly_plan_id,
      daily_plan_id, production_line_id, shift_id, classification,
      counted_as_production, device_id, message
    ) values (
      p_raw_value, v_normalized, v_serial.id, v_serial.monthly_plan_id,
      v_plan.id, v_plan.production_line_id, v_plan.shift_id, 'duplicate',
      false, p_device_id, 'This serial has already counted toward production'
    ) returning * into v_event;
    return v_event;
  end;
end;
$$;

grant execute on function public.record_production_scan(text, uuid, text) to authenticated;
