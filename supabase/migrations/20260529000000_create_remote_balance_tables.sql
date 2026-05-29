create table if not exists public.remote_balance_types (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  name text not null,
  is_default boolean not null default false,
  is_archived boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz null,
  schema_version integer not null default 1,
  source_device_id text null,
  primary key (user_id, id)
);

create table if not exists public.remote_balance_entries (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  amount double precision not null,
  type_id text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz null,
  schema_version integer not null default 1,
  source_device_id text null,
  primary key (user_id, id)
);

create index if not exists remote_balance_types_user_sort_order_idx
on public.remote_balance_types (user_id, sort_order asc, updated_at desc);

create index if not exists remote_balance_entries_user_updated_at_idx
on public.remote_balance_entries (user_id, updated_at desc);

alter table public.remote_balance_types enable row level security;
alter table public.remote_balance_entries enable row level security;

revoke all on table public.remote_balance_types from public;
revoke all on table public.remote_balance_types from anon;
grant select, insert, update, delete on table public.remote_balance_types to authenticated;

revoke all on table public.remote_balance_entries from public;
revoke all on table public.remote_balance_entries from anon;
grant select, insert, update, delete on table public.remote_balance_entries to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'remote_balance_types'
      and policyname = 'remote_balance_types_select_own'
  ) then
    create policy remote_balance_types_select_own
    on public.remote_balance_types
    for select
    to authenticated
    using ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'remote_balance_types'
      and policyname = 'remote_balance_types_insert_own'
  ) then
    create policy remote_balance_types_insert_own
    on public.remote_balance_types
    for insert
    to authenticated
    with check ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'remote_balance_types'
      and policyname = 'remote_balance_types_update_own'
  ) then
    create policy remote_balance_types_update_own
    on public.remote_balance_types
    for update
    to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'remote_balance_types'
      and policyname = 'remote_balance_types_delete_own'
  ) then
    create policy remote_balance_types_delete_own
    on public.remote_balance_types
    for delete
    to authenticated
    using ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'remote_balance_entries'
      and policyname = 'remote_balance_entries_select_own'
  ) then
    create policy remote_balance_entries_select_own
    on public.remote_balance_entries
    for select
    to authenticated
    using ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'remote_balance_entries'
      and policyname = 'remote_balance_entries_insert_own'
  ) then
    create policy remote_balance_entries_insert_own
    on public.remote_balance_entries
    for insert
    to authenticated
    with check ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'remote_balance_entries'
      and policyname = 'remote_balance_entries_update_own'
  ) then
    create policy remote_balance_entries_update_own
    on public.remote_balance_entries
    for update
    to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'remote_balance_entries'
      and policyname = 'remote_balance_entries_delete_own'
  ) then
    create policy remote_balance_entries_delete_own
    on public.remote_balance_entries
    for delete
    to authenticated
    using ((select auth.uid()) = user_id);
  end if;
end;
$$;
