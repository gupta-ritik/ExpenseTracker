# Verification

## Neon

| Command                                                                          | Result                                                                                                                                  |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `npm i -g neon@latest`                                                           | The sandbox denied access to the npm registry with `EACCES`.                                                                            |
| `npx neon@latest --version`                                                      | Returned `9.9.9` after network access was approved.                                                                                     |
| `neon init -y --org-id … --project-id … --branch production --services postgres` | Linked to the requested project and created `neon.ts`. The nested offline package install failed with `ENOTCACHED`.                     |
| `npm install @neon/config @neon/env`                                             | Installed the Neon packages and unblocked deploy.                                                                                       |
| `neon deploy`                                                                    | Production matched the policy. The CLI wrote the production connection settings to `.env.local`.                                        |
| `neon checkout test --create --no-env-pull`                                      | Created a distinct `test` branch.                                                                                                       |
| `neon env pull --branch test --file .env.test`                                   | Saved the test connection strings separately. The pooled and direct hostnames matched within each branch and differed between branches. |
| `neon checkout production --no-env-pull`                                         | Restored the CLI production checkout.                                                                                                   |
| Test-branch `SELECT 1`                                                           | Returned `1`.                                                                                                                           |
| `npm run db:generate`                                                            | Recognized ten tables and returned “No schema changes, nothing to migrate.”                                                             |
| `npm run db:test:migrate`                                                        | Applied the migration to the isolated test branch after regenerating it with all enum definitions.                                      |
| `npm run db:migrate`                                                             | “migrations applied successfully” using the production direct endpoint.                                                                 |
| `neon config plan`                                                               | “No changes — branch production already matches the policy.”                                                                            |
| `npm run db:seed`                                                                | Created the demo account and inserted 39 transactions.                                                                                  |

Production was used for the requested deployment checks and seeded demo login. Automated database and Playwright tests used the separate `test` branch.

```text
$ curl --fail --silent --show-error http://localhost:3200/api/health
{"db":"ok"}
```

Port 3000 was already occupied, so the production demo ran on port 3200. The demo dashboard showed a total balance of ₹1,42,038.00, November spending of ₹25,164.00, income of ₹72,500.00, and net income of ₹47,336.00.

A direct production query returned 39 rows for the demo profile. Five of the newest entries follow.

| Date       | Entry              | Type    | Amount in paise |
| ---------- | ------------------ | ------- | --------------: |
| 2026-11-25 | Cinema tickets     | Expense |          68,200 |
| 2026-11-22 | Monthly essentials | Expense |         215,200 |
| 2026-11-19 | Pharmacy           | Expense |          62,700 |
| 2026-11-15 | Kitchen supplies   | Expense |         128,200 |
| 2026-11-11 | Home broadband     | Expense |          82,600 |

## Local verification

- `npm run lint` and `npm run typecheck` exited 0.
- `npm test` passed 11 tests across three files, including all five CSV presets and two-user isolation on Neon test.
- `npm run build` completed on Next.js 15.5.29 and emitted all requested app routes.
- A clean lockfile install dry run succeeded after aligning the Radix Dialog peer dependencies with React 19.
- The legacy-reference scan returned no matches outside the README history section.

## Git history and deployment

The cleanup commit stopped tracking `.env`. The previous local file is preserved as ignored `.env.legacy.local`. The credential file still exists in historical commits. To rewrite local history after coordinating with anyone who uses the repository, install `git-filter-repo` and run the following from this repository:

```sh
git filter-repo --force --sensitive-data-removal --no-fetch --path .env --invert-paths
```

Rewriting changes historical commit IDs. A hosted copy also needs its affected refs replaced by the repository owner. Rotate the old credentials regardless of the history cleanup.

The Vercel CLI returned `Logged out`. No Vercel deployment was created in this run.

## Automatic capture baseline

The branch started from `68554b9` on `main`.

| Check               | Result                                                                           |
| ------------------- | -------------------------------------------------------------------------------- |
| `npm run lint`      | Passed.                                                                          |
| `npm run typecheck` | Passed.                                                                          |
| `npm test`          | 11 tests passed across three files, including isolation on the Neon test branch. |
| `npm run build`     | Passed on Next.js 15.5.29.                                                       |

1. Next.js App Router serves the ledger and API routes.
2. Better Auth handles sessions, and Node middleware protects named web routes.
3. Drizzle manages schema and migrations, and the app uses a pooled Neon connection with certificate verification.
4. The test loader compares Neon endpoints before running database tests.
5. Ledger queries and writes scope records to the authenticated user.
6. Transactions use integer paise and owner-scoped account and category constraints.
7. CSV import parses bank layouts, previews duplicates, then inserts eligible rows in a transaction.
8. Recurring entries, balances, budgets, and reports use the same ledger.
9. The shared ledger components define the existing visual and interaction patterns.
10. Vitest checks parser logic and isolation, Playwright covers browser flows, and CI runs the baseline checks.

### Vercel and secret-history checkpoint

| Check                                                     | Result                                                                                                                                                                                            |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vercel link`                                             | The non-interactive CLI requested confirmation. Linking by project ID and team succeeded without signing in again. The command wrote to `.env.local`, and the prior local contents were restored. |
| `vercel project inspect` and `vercel inspect`             | Confirmed the repository, production branch, and alias `https://expense-tracker-stmh.vercel.app`. The live deployment is a legacy build on Node.js 20.x.                                          |
| `curl https://expense-tracker-stmh.vercel.app/api/health` | Returned HTTP 500. The linked project has no production environment variables.                                                                                                                    |
| Groq model list                                           | HTTP 200. Both `openai/gpt-oss-20b` and `openai/gpt-oss-120b` are active.                                                                                                                         |

Run the history rewrite yourself from a fresh mirror clone with `git-filter-repo` 2.47 or later. Coordinate with collaborators and rotate the exposed credentials first. The rewrite changes commit IDs and the force-push replaces remote refs. Re-clone or rebase unpublished work onto the rewritten history before pushing it.

```sh
git clone --mirror https://github.com/gupta-ritik/ExpenseTracker.git ExpenseTracker-scrub.git
cd ExpenseTracker-scrub.git
git filter-repo --sensitive-data-removal --path .env --invert-paths
git log --all -- .env
# Check that the previous command reports no commits before pushing.
git push --force --mirror https://github.com/gupta-ritik/ExpenseTracker.git
```

Protected branches can block the push, and GitHub-owned pull request refs may remain. See [GitHub's sensitive-data removal guidance](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository).

## Part A: automatic capture (feat/auto-capture)

Run on 2026-11-25 on Windows with Node.js 26.9.0 against the Neon `test` branch. Vitest must run from an upper-case `C:\` working directory on this machine; from `c:\` every suite fails with "Vitest failed to find the current suite".

| Check                            | Result                                                                                                                                                                                                                                                                                                                                   |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run lint`                   | Passed with zero warnings.                                                                                                                                                                                                                                                                                                               |
| `npm run typecheck`              | Passed.                                                                                                                                                                                                                                                                                                                                  |
| `npm test`                       | 145 tests passed across 8 files: alert fixtures (45), masking, normalization, categorization, dedupe, encryption, mocked Groq (valid, invalid JSON, 429 retry, timeout), PDF statements, CAS, XIRR, capture integration and every `/api/v1` route.                                                                                       |
| `npm run build`                  | Passed on Next.js 15.5.29, including `/review`, `/investments`, `/api/ingest/sms`, `/api/cron/*` and `/api/v1/*`.                                                                                                                                                                                                                        |
| `npx playwright test`            | 3 passed: the existing ledger and design flows, and the capture flow (paste 3 SMS with 2 parsed and the OTP ignored, review with "Always use this", password-protected HDFC PDF that reconciles, re-upload with 0 new rows, a failing reconciliation that imports nothing, CAS upload, investments, net worth, token create and revoke). |
| `npm run test:groq`              | Passed. `ai_usage` recorded `{"feature":"alert","model":"openai/gpt-oss-120b","inputTokens":333,"outputTokens":264,"ok":true}` and the row was saved as ₹640.00, `needs_review`, confidence 70. The local `.env.local` sets `GROQ_MODEL` to the large model.                                                                             |
| `npm run db:test:migrate`        | Applied `0001_automatic_capture` to the test branch.                                                                                                                                                                                                                                                                                     |
| `npm run db:migrate`             | Applied `0001_automatic_capture` to production.                                                                                                                                                                                                                                                                                          |
| `npm run db:backfill-categories` | Default categories checked for 1 production user.                                                                                                                                                                                                                                                                                        |
| `npm run db:generate`            | No schema changes after the migration.                                                                                                                                                                                                                                                                                                   |
| `neon config plan`               | No changes. The production branch already matches the policy.                                                                                                                                                                                                                                                                            |
| Cross-source dedupe              | One HDFC UPI payment sent by SMS, then email, then the HDFC PDF, then CSV produced one row. A different amount produced a second row.                                                                                                                                                                                                    |
| Raw text                         | No sentinel from SMS, email, PDF or CAS fixtures appeared in any capture table.                                                                                                                                                                                                                                                          |

### Migration summary

`0001_automatic_capture` adds `email`, `sms`, `pdf` and `cas` to `entry_source` and `wallet` to `account_type`; `bankName` and a four-digit `last4` on accounts; `merchant`, `refNo`, `confidence` (0–100) and `status` on transactions with `(userId, status)` and `(userId, refNo)` indexes; `smsSenders` on `user_preferences`; and the `merchant_rules`, `ingest_tokens`, `mail_connections`, `import_jobs`, `holdings`, `investment_txns`, `nav_prices`, `ai_usage` and `rate_limits` tables with owner-scoped foreign keys. The `smsSenders` column was generated as a separate diff and folded into `0001` before production ran it, so production received one migration. The test branch, which already had the earlier `0001`, received the same column through a one-off `ALTER TABLE`.

### Pending: needs the owner

| Check                                      | Status                                                                                                                                                    |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vercel environment variables               | Not set. The automated session was not permitted to upload production secrets. The project currently has no variables, so `/api/health` returns HTTP 500. |
| Production deploy and `/api/health`        | Waiting for the variables.                                                                                                                                |
| Live SMS webhook, cron 401/200 and NAV run | Waiting for the deploy.                                                                                                                                   |
| Gmail sync                                 | Waiting for an app password entered by the owner in Settings.                                                                                             |
| GitHub secrets for CI and `sync.yml`       | Not set. CI on `main` fails at `next build` because `BETTER_AUTH_SECRET` is missing.                                                                      |
