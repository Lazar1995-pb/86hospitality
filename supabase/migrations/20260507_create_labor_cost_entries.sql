alter table public.employees
drop constraint if exists employees_department_check;

alter table public.employees
add constraint employees_department_check
check (department in ('kitchen', 'bar', 'front'));

create table if not exists public.labor_cost_entries (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete set null,
  department text not null check (department in ('kitchen', 'bar', 'front')),
  period_start date not null,
  period_end date not null,
  hourly_rate numeric default 0,
  worked_hours numeric default 0,
  overtime_hours numeric default 0,
  overtime_rate numeric default 0,
  fixed_salary numeric default 0,
  bonus numeric default 0,
  deductions numeric default 0,
  total_labor_cost numeric generated always as (
    coalesce(fixed_salary, 0)
    + coalesce(hourly_rate, 0) * coalesce(worked_hours, 0)
    + coalesce(overtime_rate, 0) * coalesce(overtime_hours, 0)
    + coalesce(bonus, 0)
    - coalesce(deductions, 0)
  ) stored,
  notes text,
  created_at timestamptz default now()
);

create index if not exists labor_cost_entries_restaurant_period_idx
on public.labor_cost_entries (restaurant_id, period_start, period_end);

create index if not exists labor_cost_entries_restaurant_department_idx
on public.labor_cost_entries (restaurant_id, department);

alter table public.labor_cost_entries enable row level security;

drop policy if exists "Users can view their restaurant labor costs"
on public.labor_cost_entries;

create policy "Users can view their restaurant labor costs"
on public.labor_cost_entries
for select
using (
  exists (
    select 1
    from public.users_profiles
    where users_profiles.auth_user_id = auth.uid()
      and users_profiles.restaurant_id = labor_cost_entries.restaurant_id
  )
);

drop policy if exists "Users can insert their restaurant labor costs"
on public.labor_cost_entries;

create policy "Users can insert their restaurant labor costs"
on public.labor_cost_entries
for insert
with check (
  exists (
    select 1
    from public.users_profiles
    where users_profiles.auth_user_id = auth.uid()
      and users_profiles.restaurant_id = labor_cost_entries.restaurant_id
  )
);

drop policy if exists "Users can update their restaurant labor costs"
on public.labor_cost_entries;

create policy "Users can update their restaurant labor costs"
on public.labor_cost_entries
for update
using (
  exists (
    select 1
    from public.users_profiles
    where users_profiles.auth_user_id = auth.uid()
      and users_profiles.restaurant_id = labor_cost_entries.restaurant_id
  )
)
with check (
  exists (
    select 1
    from public.users_profiles
    where users_profiles.auth_user_id = auth.uid()
      and users_profiles.restaurant_id = labor_cost_entries.restaurant_id
  )
);

drop policy if exists "Users can delete their restaurant labor costs"
on public.labor_cost_entries;

create policy "Users can delete their restaurant labor costs"
on public.labor_cost_entries
for delete
using (
  exists (
    select 1
    from public.users_profiles
    where users_profiles.auth_user_id = auth.uid()
      and users_profiles.restaurant_id = labor_cost_entries.restaurant_id
  )
);
