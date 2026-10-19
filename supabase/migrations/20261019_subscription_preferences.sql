-- Optional preferences remain server-only. Existing subscribers continue to
-- receive every category for all proposals until they explicitly opt otherwise.
alter table public.email_subscribers
  add column if not exists preferences jsonb not null default '{"version":1,"categories":["new","progress","discussion-ended","vote-started","vote-ended"],"scope":"all","proposalIds":[]}'::jsonb,
  add column if not exists preferences_updated_at timestamptz,
  add column if not exists confirmation_sent_at timestamptz,
  add column if not exists management_sent_at timestamptz;

-- Tokens and preference data must never be readable through the public API key.
alter table public.email_subscribers enable row level security;
revoke all on public.email_subscribers from anon, authenticated;
grant all on public.email_subscribers to service_role;
notify pgrst, 'reload schema';
