alter table public.restaurants
add column if not exists currency text default 'EUR';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'restaurants_currency_check'
  ) then
    alter table public.restaurants
    add constraint restaurants_currency_check
    check (currency in ('EUR', 'RSD', 'USD', 'GBP', 'CHF'));
  end if;
end $$;
