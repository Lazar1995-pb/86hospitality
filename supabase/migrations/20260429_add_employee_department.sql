alter table public.employees
add column if not exists department text;

update public.employees
set department = 'kitchen'
where department is null;

alter table public.employees
alter column department set not null;

alter table public.employees
drop constraint if exists employees_department_check;

alter table public.employees
add constraint employees_department_check
check (department in ('kitchen', 'bar'));

create index if not exists employees_restaurant_department_idx
on public.employees (restaurant_id, department);
