-- FR-6.3 follow-up: an Administrator can disable a PSO account or force a
-- password reset, but neither of those invalidates a session the account is
-- already logged into -- Supabase's access/refresh tokens stay valid
-- independent of password changes. Deleting the row from auth.sessions is
-- exactly how Supabase Auth itself terminates a session on sign-out (per
-- its own docs), so that's what admin_revoke_user_session does here,
-- server-side via SECURITY DEFINER since auth.sessions isn't exposed to
-- PostgREST and RLS on it would block a direct client delete anyway.

create or replace function public.admin_list_user_sessions(p_user_id uuid)
returns table (
  id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  user_agent text,
  ip inet
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'Only an Administrator may view session data';
  end if;

  return query
    select s.id, s.created_at, s.updated_at, s.user_agent, s.ip
    from auth.sessions s
    where s.user_id = p_user_id
    order by s.updated_at desc;
end;
$$;

revoke execute on function public.admin_list_user_sessions(uuid) from public;
revoke execute on function public.admin_list_user_sessions(uuid) from anon;
grant execute on function public.admin_list_user_sessions(uuid) to authenticated;

create or replace function public.admin_revoke_user_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'Only an Administrator may revoke a session';
  end if;

  delete from auth.sessions where id = p_session_id;
end;
$$;

revoke execute on function public.admin_revoke_user_session(uuid) from public;
revoke execute on function public.admin_revoke_user_session(uuid) from anon;
grant execute on function public.admin_revoke_user_session(uuid) to authenticated;
