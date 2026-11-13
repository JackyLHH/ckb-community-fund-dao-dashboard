-- Read-only preflight. Run before approving/applying the migration.
select current_database() as database_name, n.nspname as schema_name,
       t.relname as table_name, c.conname, c.convalidated,
       pg_get_constraintdef(c.oid) as constraint_definition,
       pg_get_expr(c.conbin, c.conrelid) as constraint_expression
from pg_constraint c
join pg_class t on t.oid = c.conrelid
join pg_namespace n on n.oid = t.relnamespace
where c.conrelid = 'public.digest_runs'::regclass
  and c.conname = 'digest_runs_status_check' and c.contype = 'c';

select status, count(*) as run_count from public.digest_runs group by status order by status;
