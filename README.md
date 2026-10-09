# MoneyFlowTracker

MoneyFlowTracker is a React and Vite personal finance tracker. It supports email/password and Google sign-in, transaction entry (including a local rule-based natural-language parser), income and expense categories, monthly reports, and lent/borrowed ledgers. Supabase Auth and Postgres provide cloud authentication and persistence.

## Requirements

- Node.js 22 or later
- npm
- A Supabase project configured for the app

## Local development

1. Install the locked dependencies:

   ```sh
   npm ci
   ```

2. Copy `.env.example` to `.env.local` and set:

   ```dotenv
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
   ```

   The publishable key (or legacy `anon` key) is intended for browser use. Never put a Supabase `service_role` or secret key in a `VITE_` variable, source file, or client bundle.

3. In Supabase Auth, configure the site URL and allowed redirect URLs for the local app (normally `http://localhost:5173`) and each deployed app origin. Configure Google as an Auth provider and add the OAuth callback URL shown by Supabase to the Google OAuth client.

4. Start the development server:

   ```sh
   npm run dev
   ```

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start Vite's local development server |
| `npm test` | Run deterministic tests with Node's built-in test runner |
| `npm run lint` | Lint application source and tests with Oxlint |
| `npm run build` | Create the production bundle in `dist/` |
| `npm run preview` | Serve the production bundle locally |

## Supabase schema and access control

The frontend references two user-owned Postgres tables:

- `transactions`: `user_id` plus transaction fields including `id`, `type`, `amount`, `category`, `description`, `person`, `transaction_date`, `payment_method`, `status`, `created_at`, `updated_at`, and `related_transaction_id`.
- `categories`: `user_id`, `name`, and `kind` (`expense` or `income`).

The repository contains no SQL migrations or schema definitions. Do not run schema changes against a hosted project until its actual schema and current policies have been reviewed. In the Supabase Dashboard SQL Editor, first inspect that both tables exist, have the expected `user_id` column (compatible with `auth.uid()`), and have RLS enabled:

```sql
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('transactions', 'categories')
  and c.relkind = 'r'
order by c.relname;
```

Inspect the policies and their commands, roles, `USING`, and `WITH CHECK` expressions:

```sql
select tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('transactions', 'categories')
order by tablename, policyname;
```

For each table, authenticated users need policies whose predicates enforce ownership. PostgreSQL combines permissive policies with `OR`, so a pre-existing broad policy can bypass a new owner-scoped policy; review every listed policy and safely revise any unsafe one only after understanding its consumers. If a command policy is missing, and after confirming the table/column names and existing policy behavior, add the corresponding policy below. These statements do not drop or replace policies; do not blindly re-run a `CREATE POLICY` statement that already exists.

```sql
alter table public.transactions enable row level security;
create policy transactions_select_own on public.transactions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy transactions_insert_own on public.transactions
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy transactions_update_own on public.transactions
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy transactions_delete_own on public.transactions
  for delete to authenticated using ((select auth.uid()) = user_id);

alter table public.categories enable row level security;
create policy categories_select_own on public.categories
  for select to authenticated using ((select auth.uid()) = user_id);
create policy categories_insert_own on public.categories
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy categories_update_own on public.categories
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy categories_delete_own on public.categories
  for delete to authenticated using ((select auth.uid()) = user_id);
```

Verify that grants allow the intended `authenticated` operations, then test with two separate authenticated accounts: each must be able to read/change only its own rows, and attempts to insert a row with the other account's `user_id` must be rejected. A query run as the database owner in the SQL Editor does not demonstrate client-side RLS isolation. This repository has not inspected or tested the hosted database; its RLS status is unverified until these checks are performed there.

The app checks a person's current lent/borrowed balance before allowing a return or repayment. That check is a client-side read followed by a write, so two concurrent sessions can still pass validation and over-return/over-repay. The repository has no database schema/migration to safely add an atomic database operation. For multi-session guarantees, implement and test a database transaction (for example, an authenticated RPC or trigger using transaction-level serialization) after reviewing the real schema; client validation alone is not a database concurrency guarantee.

## Password recovery

Recovery emails redirect to the app origin. Add the local and deployed origins to Supabase Auth's allowed redirect URLs and configure the appropriate email template/provider settings in the Supabase Dashboard.

## Deployment

Build with `npm run build`, then deploy the generated `dist/` directory to a static host configured to serve `index.html` for app routes. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the host's build environment. These values are embedded in the browser bundle; use only the public publishable/anon key and enforce data ownership in Postgres RLS.

GitHub Actions runs `npm ci`, tests, lint, and build for pushes and pull requests.

## Dependency audit note

The current lockfile has no reported production dependency vulnerabilities (`npm audit --omit=dev`). A full `npm audit` reports seven development-toolchain advisories through Tailwind CSS 3.4.19 and its transitive dependencies (five high, two moderate); npm only offers a Tailwind CSS 4 upgrade, which is a major toolchain change and may affect styling/build behavior. Review and test that migration separately rather than applying an unverified forced upgrade.
