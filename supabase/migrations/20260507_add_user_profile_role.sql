alter table public.users_profiles
add column if not exists role text default 'employee';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'users_profiles_role_check'
  ) then
    alter table public.users_profiles
    add constraint users_profiles_role_check
    check (
      role in (
        'owner',
        'admin',
        'general_manager',
        'manager',
        'chef',
        'sous_chef',
        'bar_manager',
        'assistant_bar_manager',
        'front_manager',
        'employee'
      )
    );
  end if;
end $$;
