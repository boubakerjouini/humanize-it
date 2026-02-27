# HumanizeIt — Database Schema

## Overview

PostgreSQL hosted on **Neon** (serverless), accessed via **Prisma ORM**.

Connection string format:
```
postgresql://user:password@host.neon.tech/dbname?sslmode=require
```

## Models

### User

Synced from Clerk via webhook. Stores usage tracking and plan info.

| Field            | Type     | Description                                    |
| ---------------- | -------- | ---------------------------------------------- |
| id               | String   | Primary key (cuid)                             |
| clerkId          | String   | Unique Clerk user ID                           |
| email            | String   | User email from Clerk                          |
| name             | String?  | Display name (optional)                        |
| plan             | Enum     | FREE / PRO / ENTERPRISE                        |
| analysisCount    | Int      | Number of analyses used this billing period     |
| rewriteCount     | Int      | Number of rewrites used this billing period     |
| billingCycleStart| DateTime | Start of current billing cycle                 |
| createdAt        | DateTime | Account creation timestamp                     |
| updatedAt        | DateTime | Last update timestamp                          |

**Relations**: has many `Document`, has one `Subscription`.

### Document

Stores each analysis/rewrite performed by a user.

| Field           | Type     | Description                                    |
| --------------- | -------- | ---------------------------------------------- |
| id              | String   | Primary key (cuid)                             |
| userId          | String   | Foreign key → User                             |
| originalText    | String   | The original AI-generated text                 |
| analysisResult  | Json     | Full scoring breakdown (JSON)                  |
| overallScore    | Float    | 0-100 AI detection probability score           |
| rewrittenText   | String?  | Humanized text (null if not rewritten)         |
| rewriteModel    | String?  | Model used for rewrite (e.g. "gpt-4o-mini")   |
| wordCount       | Int      | Word count of original text                    |
| createdAt       | DateTime | Document creation timestamp                    |

**Relations**: belongs to `User`.

### Subscription

Tracks Stripe subscription state per user.

| Field                | Type     | Description                               |
| -------------------- | -------- | ----------------------------------------- |
| id                   | String   | Primary key (cuid)                        |
| userId               | String   | Unique foreign key → User                 |
| stripeCustomerId     | String   | Stripe customer ID                        |
| stripeSubscriptionId | String?  | Stripe subscription ID                    |
| stripePriceId        | String?  | Stripe price ID                           |
| stripeCurrentPeriodEnd| DateTime?| Current period end date                  |
| status               | String   | Stripe subscription status                |
| createdAt            | DateTime | Record creation timestamp                 |
| updatedAt            | DateTime | Last update timestamp                     |

**Relations**: belongs to `User` (one-to-one).

## Enums

### Plan

```prisma
enum Plan {
  FREE
  PRO
  ENTERPRISE
}
```

## Indexes

- `User.clerkId` — unique index (fast lookup from Clerk webhook)
- `User.email` — unique index
- `Document.userId` — index (fast document listing)
- `Subscription.userId` — unique index (one subscription per user)
- `Subscription.stripeCustomerId` — unique index

## Notes

- `analysisResult` is stored as JSON to allow flexible schema evolution
  without migrations. Example shape:
  ```json
  {
    "patterns": [
      { "id": "ai-vocab-t1", "label": "AI Vocabulary Tier 1", "hits": 3, "severity": "high" }
    ],
    "stats": {
      "burstiness": 0.12,
      "typeTokenRatio": 0.45,
      "avgSentenceLength": 22.3,
      "fleschReadingEase": 55.2
    },
    "score": 78.5
  }
  ```
- `billingCycleStart` on User resets monthly via Stripe webhook to track quotas
- All timestamps use UTC
