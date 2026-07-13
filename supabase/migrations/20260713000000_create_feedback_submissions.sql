create table if not exists public.feedback_submissions (
  id uuid primary key default gen_random_uuid(),
  rating smallint not null,
  comment text null,
  app_version text not null,
  platform text not null,
  language text not null,
  created_at timestamptz not null default now(),
  constraint feedback_submissions_rating_range
    check (rating between 1 and 5),
  constraint feedback_submissions_comment_length
    check (comment is null or char_length(comment) <= 2000),
  constraint feedback_submissions_app_version_length
    check (char_length(app_version) between 1 and 64),
  constraint feedback_submissions_platform_length
    check (char_length(platform) between 1 and 32),
  constraint feedback_submissions_language_length
    check (char_length(language) between 1 and 64)
);

alter table public.feedback_submissions enable row level security;

revoke all on table public.feedback_submissions from public;
revoke all on table public.feedback_submissions from anon;
revoke all on table public.feedback_submissions from authenticated;
grant insert on table public.feedback_submissions to anon, authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'feedback_submissions'
      and policyname = 'feedback_submissions_insert_safe'
  ) then
    create policy feedback_submissions_insert_safe
    on public.feedback_submissions
    for insert
    to anon, authenticated
    with check (
      rating between 1 and 5
      and (comment is null or char_length(comment) <= 2000)
      and char_length(app_version) between 1 and 64
      and char_length(platform) between 1 and 32
      and char_length(language) between 1 and 64
    );
  end if;
end;
$$;
