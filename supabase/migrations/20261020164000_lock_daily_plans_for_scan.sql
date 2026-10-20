-- Lock daily plans once they are submitted to Scan Station.
alter table public.daily_production_plans
  add column if not exists break_minutes integer not null default 0 check (break_minutes >= 0),
  add column if not exists submitted_to_scan boolean not null default false,
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by uuid references auth.users(id) on delete set null;

alter table public.daily_plan_manpower
  add column if not exists actual_count integer not null default 0 check (actual_count >= 0);

create or replace function public.prevent_locked_daily_plan_edit()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.submitted_to_scan then
    raise exception 'Daily production plan is locked because it has been submitted to Scan Station';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_locked_daily_plan_update on public.daily_production_plans;
create trigger prevent_locked_daily_plan_update
before update on public.daily_production_plans
for each row execute function public.prevent_locked_daily_plan_edit();

create or replace function public.prevent_locked_daily_plan_delete()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.submitted_to_scan then
    raise exception 'Daily production plan is locked because it has been submitted to Scan Station';
  end if;
  return old;
end;
$$;

drop trigger if exists prevent_locked_daily_plan_delete on public.daily_production_plans;
create trigger prevent_locked_daily_plan_delete
before delete on public.daily_production_plans
for each row execute function public.prevent_locked_daily_plan_delete();

create or replace function public.prevent_locked_daily_child_change()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  locked boolean;
  v_plan_id uuid;
begin
  v_plan_id := case when tg_op = 'DELETE' then old.daily_plan_id else new.daily_plan_id end;
  select submitted_to_scan into locked
  from public.daily_production_plans
  where id = v_plan_id;

  if coalesce(locked, false) then
    raise exception 'Daily production plan is locked because it has been submitted to Scan Station';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists prevent_locked_hour_target_change on public.daily_plan_hour_targets;
create trigger prevent_locked_hour_target_change
before insert or update or delete on public.daily_plan_hour_targets
for each row execute function public.prevent_locked_daily_child_change();

drop trigger if exists prevent_locked_manpower_change on public.daily_plan_manpower;
create trigger prevent_locked_manpower_change
before insert or update or delete on public.daily_plan_manpower
for each row execute function public.prevent_locked_daily_child_change();
