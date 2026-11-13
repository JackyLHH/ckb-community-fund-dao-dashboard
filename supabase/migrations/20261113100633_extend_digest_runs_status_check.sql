-- Apply only after the production constraint has been inspected and approved.
-- Preserve the existing expression (including any legacy allowed statuses).
-- Production inspection also found partial missing; the app uses it for delivery failures.
-- No delivery action, row update, or subscriber change is performed.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

do $$
declare existing_expression text;
begin
  select pg_get_expr(conbin, conrelid) into strict existing_expression
  from pg_constraint
  where conrelid = 'public.digest_runs'::regclass
    and conname = 'digest_runs_status_check' and contype = 'c';

  execute format(
    'alter table public.digest_runs add constraint digest_runs_status_check_next check ((%s) or status in (%L, %L)) not valid',
    existing_expression, 'no_changes', 'partial'
  );
  alter table public.digest_runs validate constraint digest_runs_status_check_next;
  alter table public.digest_runs drop constraint digest_runs_status_check;
  alter table public.digest_runs rename constraint digest_runs_status_check_next to digest_runs_status_check;
end;
$$;
commit;
