create table if not exists public.remote_settings (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value text not null,
  updated_at timestamptz not null,
  schema_version integer not null default 1,
  source_device_id text null,
  primary key (user_id, key),
  constraint remote_settings_allowed_key
    check (key in ('currency', 'language'))
);

create index if not exists remote_settings_user_updated_at_idx
on public.remote_settings (user_id, updated_at desc);

alter table public.remote_settings enable row level security;

revoke all on table public.remote_settings from public;
revoke all on table public.remote_settings from anon;
grant select, insert, update, delete on table public.remote_settings to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'remote_settings'
      and policyname = 'remote_settings_select_own'
  ) then
    create policy remote_settings_select_own
    on public.remote_settings
    for select
    to authenticated
    using ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'remote_settings'
      and policyname = 'remote_settings_insert_own'
  ) then
    create policy remote_settings_insert_own
    on public.remote_settings
    for insert
    to authenticated
    with check ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'remote_settings'
      and policyname = 'remote_settings_update_own'
  ) then
    create policy remote_settings_update_own
    on public.remote_settings
    for update
    to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'remote_settings'
      and policyname = 'remote_settings_delete_own'
  ) then
    create policy remote_settings_delete_own
    on public.remote_settings
    for delete
    to authenticated
    using ((select auth.uid()) = user_id);
  end if;
end;
$$;
