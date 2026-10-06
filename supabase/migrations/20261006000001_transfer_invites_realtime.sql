-- Transfer invites reach the invited driver live.
--
-- The driver app opens a full screen "Transfer request" prompt (TransferInviteGate in
-- apps/driver/app/_layout.tsx) when a row appears in ride_transfers for that driver. It learns about the
-- row through a realtime subscription on ride_transfers (subscribeToTransferInvites). That table was never
-- added to the supabase_realtime publication, so the subscription was never told about a new invite. The
-- only thing that did arrive live was the matching row in notifications, which is why testers saw a
-- "Transfer request" notification and no prompt. The invite then expired after its 30 seconds and the ride
-- went back to the pool.
--
-- Row level security already limits who can read these rows (the sending driver, the invited driver and
-- PSO), and realtime applies the same policy, so nothing else needs to change.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'ride_transfers'
  ) then
    alter publication supabase_realtime add table public.ride_transfers;
  end if;
end
$$;
