-- Already applied live via MCP apply_migration on 2026-09-10. Recorded here
-- for repo history; this project has no local CLI-managed migration chain
-- (see the header on 20260910070133_add_id_transcription_fields_to_passenger_discounts.sql).

-- PSO User Management's roster "Last sign-in" column (FR-6.3, wireframe
-- screen 9). auth.users isn't exposed to PostgREST, and the existing
-- admin_list_user_sessions RPC is scoped to one user at a time, not the
-- whole roster -- so this reads Supabase Auth's own last_sign_in_at for
-- every PSO-portal account in one call, same SECURITY DEFINER /
-- is_admin()-gated pattern as admin_list_user_sessions.

create or replace function public.admin_list_pso_last_sign_in()
returns table (
  user_id uuid,
  last_sign_in_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'Only an Administrator may view sign-in data';
  end if;

  return query
    select u.id as user_id, au.last_sign_in_at
    from public.users u
    join auth.users au on au.id = u.id
    where u.role in ('pso_staff', 'pso_supervisor', 'admin');
end;
$$;

revoke execute on function public.admin_list_pso_last_sign_in() from public;
revoke execute on function public.admin_list_pso_last_sign_in() from anon;
grant execute on function public.admin_list_pso_last_sign_in() to authenticated;
