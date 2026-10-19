-- Server-only idempotency receipts and a short lease for the existing daily cron.
-- This does not change subscribers or their subscription preferences.
create table if not exists public.digest_delivery_receipts (
  key text primary key,
  status text not null check (status in ('pending', 'sent')),
  lease_until timestamptz not null default now(),
  sent_at timestamptz
);
alter table public.digest_delivery_receipts enable row level security;
revoke all on public.digest_delivery_receipts from anon, authenticated;
grant all on public.digest_delivery_receipts to service_role;

create or replace function public.claim_digest_delivery(p_key text, p_lease_seconds integer default 300)
returns boolean language plpgsql security definer set search_path = '' as $$
declare claimed text;
begin
  insert into public.digest_delivery_receipts (key,status,lease_until)
  values (p_key,'pending',now() + make_interval(secs => least(greatest(p_lease_seconds,60),900)))
  on conflict (key) do update set lease_until = excluded.lease_until
    where digest_delivery_receipts.status = 'pending'
      and digest_delivery_receipts.lease_until <= now()
  returning key into claimed;
  return claimed is not null;
end;
$$;
revoke all on function public.claim_digest_delivery(text,integer) from public, anon, authenticated;
grant execute on function public.claim_digest_delivery(text,integer) to service_role;
notify pgrst, 'reload schema';
