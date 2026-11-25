# ExpenseTracker

A personal expense tracker for India. Log expenses and income, keep a running balance for cash, banks, UPI and cards, and move money between your own accounts in the ledger. Set monthly spending limits, review trends, and import or export CSV.

![ExpenseTracker dashboard showing the seeded INR ledger](docs/dashboard.png)

The app stores money as integer paise and displays INR with Indian grouping by default. Transfers are bookkeeping entries. Email and password are sufficient to use the app. Google sign-in appears only when both optional credentials are configured.

## Stack

Next.js 15 App Router, React 19, strict TypeScript, Tailwind CSS 4, Radix Dialog, Lucide, React Hook Form, Zod, Recharts, date-fns, and Papa Parse. Neon Postgres stores the ledger and self-hosted Better Auth records, with Drizzle ORM and migrations.

## Removed old services

| Previous integration           | Replacement                                     |
| ------------------------------ | ----------------------------------------------- |
| Appwrite                       | Neon Postgres and Better Auth                   |
| MongoDB and JWT sessions       | Drizzle ORM and Better Auth sessions            |
| NextAuth and third-party OAuth | Email and password with optional Google sign-in |
| Plaid bank linking             | Manual entry and bank CSV import                |
| Dwolla payments                | Transfers between your own ledger accounts      |
| Sentry                         | Error boundary and server logs                  |

## Local setup

Use Node.js 22.12 or later. Install and authenticate the Neon CLI, then link the project you want to use.

```sh
npm install -g neon@latest
neon login
neon init -y --org-id YOUR_ORG_ID --project-id YOUR_PROJECT_ID --branch production --services postgres --package-manager npm
neon deploy
npm install
```

Keep the pooled and direct database URLs in `.env.local`. Generate a secret with `openssl rand -base64 32` and set `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL=http://localhost:3000`. See [the environment template](.env.example).

```sh
npm run db:migrate
npm run db:seed
npm run dev
```

Open [localhost:3000](http://localhost:3000). Seeding adds `demo@expense.local` with password `demo1234` and three months of sample data. Run the seed only when you intend to enable that demo login.

Set up a separate Neon test branch before integration or browser checks. Store its pooled URL, direct URL, separate auth secret, and local auth origin in `.env.test`. Use an unused port, such as `http://127.0.0.1:3317`.

```sh
neon checkout test --create --no-env-pull
neon env pull --branch test --file .env.test -e DATABASE_URL -e DATABASE_URL_UNPOOLED
neon checkout production --no-env-pull
npm run db:test:migrate
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

The browser suite starts the built app through `npm start` and requires Chrome. The database isolation check runs when `.env.test` is present. Repository CI secrets used for integration checks must point to the test branch.

## Import a bank statement

Choose **Import bank CSV**, select the bank preset and destination account, then upload your CSV. Preview the rows before confirming. The importer flags existing entries using date, signed amount and normalized description. For an unfamiliar layout, choose **Generic CSV** and map the date, description, and amount columns.

- **SBI.** In OnlineSBI open **My Accounts & Profile → Account Statement**, choose the account and dates, then download the spreadsheet. [SBI statement guide](https://sbi.bank.in/documents/21077/35799534/02022026_SBI%2B-%2BGlobal%2BConnect_NRI%2BJanuary_final%2Bversion.pdf/d36001c3-b719-6a24-2db1-c37b2dc6f4f5?t=1770024717525)
- **HDFC Bank.** In NetBanking open **Account Statements → Get Statement**, choose the account and date range, then download the available spreadsheet export. [HDFC statement guide](https://www.hdfc.bank.in/blogs/digital-banking/download-account-statement-via-netbanking)
- **ICICI Bank.** In Net Banking open **Bank Accounts → e-Statements → View Detailed Statement**, select the date range and download CSV or Excel. [ICICI statement guide](https://www.icici.bank.in/personal-banking/accounts/savings-account/statements) · [Supported formats](https://www.icici.bank.in/personal-banking/ways-to-bank/net-banking/online-services)

If the portal gives you an Excel workbook, open the transaction sheet in a spreadsheet app and save it as UTF-8 CSV. Keep the header row and debit and credit columns. PDF files need to be converted before import. Axis and Kotak presets are also available.

## Deploy to Vercel Hobby

Import the repository as a Next.js project, choose Node 22 or later, and set these variables in the Vercel project. Set the production variables to the production branch and keep test credentials in the test environment.

| Variable                | Value                                     |
| ----------------------- | ----------------------------------------- |
| `DATABASE_URL`          | Pooled Neon connection URL                |
| `DATABASE_URL_UNPOOLED` | Direct Neon connection URL for migrations |
| `BETTER_AUTH_SECRET`    | Random secret of at least 32 characters   |
| `BETTER_AUTH_URL`       | Full HTTPS URL of the application         |
| `GOOGLE_CLIENT_ID`      | Optional Google OAuth client ID           |
| `GOOGLE_CLIENT_SECRET`  | Optional Google OAuth secret              |

Run `npm run db:migrate` against the direct URL before serving production traffic. After deploying, check `GET /api/health`.

## Automatic capture configuration

| Variable           | Purpose                                                                    |
| ------------------ | -------------------------------------------------------------------------- |
| `GROQ_API_KEY`     | Optional server-side key for AI parsing. Without it, AI parsing is off.    |
| `GROQ_MODEL`       | Alert model. Defaults to `openai/gpt-oss-20b`.                             |
| `GROQ_MODEL_LARGE` | Statement and CAS model. Defaults to `openai/gpt-oss-120b`.                |
| `CRON_SECRET`      | Optional bearer secret for scheduled jobs, at least 32 characters.         |
| `ENCRYPTION_KEY`   | Optional 32-byte base64 key for encrypting saved mail and PDF credentials. |

Generate the cron secret and encryption key independently, for example by running `openssl rand -base64 32` twice. Keep production and test databases separate. Store capture secrets in the hosting environment or in ignored local environment files.

## Roadmap

- Password reset through a free email provider
- PWA and offline entry
- Optional local categorization through Ollama

See [verification results](docs/verification.md), [Contributing](CONTRIBUTING.md), and the [Code of Conduct](Code_of_conduct.md).
