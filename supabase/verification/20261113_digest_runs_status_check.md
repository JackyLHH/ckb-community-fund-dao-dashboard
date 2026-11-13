# Production digest run status constraint verification

- Project: CKB Community Fund DAO Dashboard (`koltjnfrqfsbshxdzjuj`), ACTIVE_HEALTHY.
- Authorization: user explicitly approved extending only this constraint.
- Applied migration: `20261113100633`, `extend_digest_runs_status_check`.
- Applied at: 2026-11-13 10:06:33 UTC / 18:06:33 Beijing.
- Before: validated CHECK allowing `running`, `completed`, `failed`, `seeded`.
- After: the identical old expression OR `status IN ('no_changes', 'partial')`, validated. `partial` is also used by the existing application and was missing.
- Read-only evaluation of the actual PostgreSQL constraint accepted all six application states and rejected `unknown_status`; no rows were inserted to test it.
- `digest_runs`: 49 rows before and after; 23 failed, 1 seeded, 25 completed.
- Full-row checksum before and after: `efefee44b29e3dbc31581516db529547`.
- The 2026-11-13 16:22 pre-migration failure remains unchanged. No history was relabeled as sent/successful.
- No production digest endpoint invoked, no email/Telegram test messages, no subscriber changes, and no unrelated database permission changes. Supabase migration history records the authorized DDL.

The application no-change paths were previously tested offline: HTTP 200, `no_changes`, zero email/Telegram sends. The next regular 16:00 Beijing run remains to be observed, not manually triggered. The existing `dao-dashboard` 17:00 health review targets the dedicated review chat and checks only post-migration runs (`started_at > 2026-11-13T10:06:33Z`). It must distinguish valid completed/partial/no_changes outcomes and preserve the no-test-send restriction.

Pre-change Supabase advisories: health/performance had no notices. Security reported existing RLS-without-policy informational notices on server-only tables and existing EXECUTE warnings for `public.rls_auto_enable()`. Those permissions were outside this authorization and were not changed or independently investigated. References: [RLS informational notice](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [anon EXECUTE warning](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [authenticated EXECUTE warning](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
