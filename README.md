# Crystal Clear Estimator

Internal AI-powered estimating tool for Crystal Clear Cleaning & Contracting. Generates professional PDF estimates through a conversational chat interface. Prices are sourced exclusively from past estimate history — never invented.

## Features

- Conversational AI estimate builder (Claude claude-sonnet-4-20250514)
- Pricing strictly from past reference estimates — no hallucinated prices
- Per-line-item price source tracking (Exact Match / Similar Job / Manual)
- Voice-to-text input via Web Speech API
- PDF generation matching the Crystal Clear estimate format exactly
- Email estimates to customers via Resend
- Reference estimate library (upload PDFs or text files)
- Seeded with all 10 existing estimates on first run
- Full estimate history
- Password-protected internal tool
- Mobile-first responsive design

---

## Local Setup

### Prerequisites

- Node.js 18+
- PostgreSQL database (local or cloud)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```
ANTHROPIC_API_KEY=sk-ant-...          # Your Anthropic API key
DATABASE_URL=postgresql://user:pass@localhost:5432/crystalclear
RESEND_API_KEY=re_...                  # Resend API key (for email)
FROM_EMAIL=noreply@crystalclearcontractors.com
APP_PASSWORD=yourpassword              # Shared password for login
SESSION_SECRET=32-char-random-string   # At least 32 chars, random
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Generate a SESSION_SECRET:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Set up the database

```bash
# Push schema and generate Prisma client
npm run db:push

# Seed with the 10 reference estimates
npm run db:seed
```

### 4. Run locally

```bash
npm run dev
```

Open http://localhost:3000 and log in with your `APP_PASSWORD`.

---

## Railway Deployment

### 1. Create a Railway project

1. Go to [railway.app](https://railway.app) and create a new project
2. Add a **PostgreSQL** plugin/service
3. Connect your GitHub repo as a new service

### 2. Environment variables (Railway service → Variables)

| Variable | Value |
|---|---|
| `ANTHROPIC_API_KEY` | Your Anthropic API key |
| `DATABASE_URL` | Use `${{Postgres.DATABASE_URL}}` (Railway auto-wires this) |
| `RESEND_API_KEY` | Your Resend API key |
| `FROM_EMAIL` | Verified sender email in Resend |
| `APP_PASSWORD` | Shared login password |
| `SESSION_SECRET` | 32+ char random string |
| `NEXT_PUBLIC_APP_URL` | Your Railway domain (e.g. `https://crystal-clear.up.railway.app`) |

### 3. Add a `railway.toml` in the project root

```toml
[build]
builder = "nixpacks"
buildCommand = "npm install && npx prisma generate && npx prisma db push && npm run db:seed && npm run build"

[deploy]
startCommand = "npm start"
healthcheckPath = "/login"
```

Railway auto-deploys on push to your connected branch.

---

## Architecture

```
app/
  api/
    chat/              POST — conversational AI + estimate generation
    pdf/               POST — PDF generation from estimate JSON
    email/             POST — email PDF via Resend
    login/             POST (login) / GET (logout)
    references/        GET list / DELETE by ID
    upload-reference/  POST — parse and store uploaded estimate file
    history/           GET — past generated estimates
  chat/
    page.tsx           Create new conversation, redirect to /chat/[id]
    [id]/page.tsx      Chat UI with estimate preview
  login/page.tsx
  history/page.tsx
  references/page.tsx

components/
  ChatInterface.tsx     Mobile-first chat with voice input
  EstimatePreview.tsx   Estimate card with price-source badges
  EmailModal.tsx        Send PDF to customer

lib/
  auth.ts    HMAC-SHA256 session cookies (Node crypto)
  claude.ts  Anthropic API wrapper
  pdf.ts     pdf-lib PDF generation matching Crystal Clear format
  prisma.ts  Singleton Prisma client

prisma/
  schema.prisma  Conversation + ReferenceEstimate models
  seed.ts        All 10 historical estimates as reference data
```

## Adding Reference Estimates

Go to **References** in the nav. Upload a PDF or text file of a past estimate. Claude extracts and structures the pricing data automatically. This data is then used to price future estimates.
