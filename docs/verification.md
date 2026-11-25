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
