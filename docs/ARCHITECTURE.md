# HumanizeIt — Architecture

## Stack

| Layer         | Technology                     |
| ------------- | ------------------------------ |
| Framework     | Next.js 14 (App Router)        |
| Language      | TypeScript (strict mode)       |
| Styling       | Tailwind CSS + shadcn/ui       |
| Auth          | Clerk                          |
| Payments      | Stripe (Checkout + Webhooks)   |
| Database      | PostgreSQL via Neon (serverless)|
| ORM           | Prisma                         |
| AI Rewrite    | OpenAI GPT-4o-mini             |
| Hosting       | Vercel                         |

## High-Level Architecture

```
┌─────────────────────────────────────────────────────┐
│                    VERCEL (Edge)                     │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │              Next.js App Router                │  │
│  │                                               │  │
│  │  ┌──────────┐  ┌──────────┐  ┌────────────┐  │  │
│  │  │  Pages   │  │   API    │  │ Middleware  │  │  │
│  │  │ (React)  │  │  Routes  │  │  (Clerk)   │  │  │
│  │  └────┬─────┘  └────┬─────┘  └────────────┘  │  │
│  │       │              │                        │  │
│  │       ▼              ▼                        │  │
│  │  ┌──────────────────────────────────────┐     │  │
│  │  │         Server Actions / API         │     │  │
│  │  │                                      │     │  │
│  │  │  ┌────────────┐  ┌───────────────┐   │     │  │
│  │  │  │  Analysis   │  │   Rewrite     │   │     │  │
│  │  │  │  Engine     │  │   Engine      │   │     │  │
│  │  │  │ (local)     │  │ (GPT-4o-mini) │   │     │  │
│  │  │  └────────────┘  └───────────────┘   │     │  │
│  │  └──────────────────────────────────────┘     │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
└────────────┬──────────────────┬─────────────────────┘
             │                  │
             ▼                  ▼
     ┌──────────────┐   ┌──────────────┐
     │  Neon (DB)   │   │   Stripe     │
     │  PostgreSQL  │   │  Payments    │
     └──────────────┘   └──────────────┘
```

## Request Flow

1. User lands on the app → Clerk middleware checks auth state
2. Authenticated user submits text via the dashboard
3. **Analysis** runs locally (no API call) — pattern matching + scoring
4. If user requests **rewrite**, text is sent to GPT-4o-mini via API route
5. Results (score + rewritten text) are saved to the `Document` table
6. Stripe webhooks update the `Subscription` table on payment events

## Key Directories

```
/
├── app/                  # Next.js App Router pages & API routes
│   ├── (auth)/           # Clerk sign-in / sign-up pages
│   ├── (dashboard)/      # Protected dashboard pages
│   ├── api/              # API routes (analyze, rewrite, webhooks)
│   └── layout.tsx        # Root layout with ClerkProvider
├── components/           # Shared React components (shadcn/ui based)
├── lib/                  # Shared utilities
│   ├── algorithms/       # Analysis engine (patterns, scoring, stats)
│   ├── db.ts             # Prisma client singleton
│   ├── openai.ts         # OpenAI client
│   └── stripe.ts         # Stripe client + helpers
├── prisma/               # Prisma schema & migrations
├── docs/                 # Project documentation
└── public/               # Static assets
```

## Environment Variables

All secrets are stored in `.env.local` (never committed). See `.env.local.example` for the full list.

## Deployment

- **Vercel**: Auto-deploy from `main` branch
- **Neon**: Serverless PostgreSQL, connection pooling via `?pgbouncer=true`
- **Clerk**: Dashboard at clerk.com for user management
- **Stripe**: Dashboard + webhook endpoint at `/api/webhooks/stripe`
