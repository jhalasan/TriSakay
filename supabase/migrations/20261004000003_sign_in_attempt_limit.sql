-- Sign in attempt limit. The sign-in edge function records every password
-- attempt here (by lower cased email and by network address) and refuses a
-- sign in when an email has 5 wrong passwords inside 15 minutes, or when one
-- network address sends more than 30 attempts in 10 minutes.
--
-- Only the edge function (service role) reads or writes this table: RLS is on
-- with no policies, and every API role is revoked. Rows are only useful for a
-- few minutes, so a daily job deletes anything older than a day.

create table public.login_attempts (
  id uuid primary key default gen_random_uuid(),
  email_key text not null,
  ip text,
  success boolean not null,
  created_at timestamptz not null default now()
);

create index idx_login_attempts_email on public.login_attempts (email_key, created_at desc);
create index idx_login_attempts_ip on public.login_attempts (ip, created_at desc);

alter table public.login_attempts enable row level security;
revoke all on table public.login_attempts from anon, authenticated, public;

create or replace function public.purge_old_login_attempts()
returns void
language sql
security definer
set search_path to 'public'
as $function$
  delete from public.login_attempts where created_at < now() - interval '1 day';
$function$;

revoke execute on function public.purge_old_login_attempts() from public, anon, authenticated;

select cron.schedule('purge-old-login-attempts', '30 3 * * *', 'select public.purge_old_login_attempts();');
