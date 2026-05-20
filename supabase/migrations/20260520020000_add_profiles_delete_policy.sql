grant delete on table public.profiles to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'profiles_delete_own'
  ) then
    create policy profiles_delete_own
    on public.profiles
    for delete
    to authenticated
    using ((select auth.uid()) = id);
  end if;
end;
$$;
