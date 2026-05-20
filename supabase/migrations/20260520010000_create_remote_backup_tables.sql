create table if not exists public.remote_transactions (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  amount double precision not null,
  category_id text not null,
  is_leak boolean not null,
  leak_reason text null,
  note text null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz null,
  schema_version integer not null default 1,
  source_device_id text null,
  primary key (user_id, id)
);

create table if not exists public.remote_categories (
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

create index if not exists remote_transactions_user_updated_at_idx
on public.remote_transactions (user_id, updated_at desc);

create index if not exists remote_categories_user_sort_order_idx
on public.remote_categories (user_id, sort_order asc, updated_at desc);

alter table public.remote_transactions enable row level security;
alter table public.remote_categories enable row level security;

revoke all on table public.remote_transactions from public;
revoke all on table public.remote_transactions from anon;
grant select, insert, update, delete on table public.remote_transactions to authenticated;

revoke all on table public.remote_categories from public;
revoke all on table public.remote_categories from anon;
grant select, insert, update, delete on table public.remote_categories to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'remote_transactions'
      and policyname = 'remote_transactions_select_own'
  ) then
    create policy remote_transactions_select_own
    on public.remote_transactions
    for select
    to authenticated
    using ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'remote_transactions'
      and policyname = 'remote_transactions_insert_own'
  ) then
    create policy remote_transactions_insert_own
    on public.remote_transactions
    for insert
    to authenticated
    with check ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'remote_transactions'
      and policyname = 'remote_transactions_update_own'
  ) then
    create policy remote_transactions_update_own
    on public.remote_transactions
    for update
    to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'remote_transactions'
      and policyname = 'remote_transactions_delete_own'
  ) then
    create policy remote_transactions_delete_own
    on public.remote_transactions
    for delete
    to authenticated
    using ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'remote_categories'
      and policyname = 'remote_categories_select_own'
  ) then
    create policy remote_categories_select_own
    on public.remote_categories
    for select
    to authenticated
    using ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'remote_categories'
      and policyname = 'remote_categories_insert_own'
  ) then
    create policy remote_categories_insert_own
    on public.remote_categories
    for insert
    to authenticated
    with check ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'remote_categories'
      and policyname = 'remote_categories_update_own'
  ) then
    create policy remote_categories_update_own
    on public.remote_categories
    for update
    to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'remote_categories'
      and policyname = 'remote_categories_delete_own'
  ) then
    create policy remote_categories_delete_own
    on public.remote_categories
    for delete
    to authenticated
    using ((select auth.uid()) = user_id);
  end if;
end;
$$;
