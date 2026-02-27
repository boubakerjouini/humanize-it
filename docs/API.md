# HumanizeIt — API Reference

## Base URL

```
https://humanizeit.app/api
```

All API routes are Next.js Route Handlers under `app/api/`.

## Authentication

All endpoints (except webhooks) require a valid Clerk session.
The middleware at `middleware.ts` protects routes automatically.

---

## Endpoints

### POST /api/analyze

Analyze text for AI-generated patterns. **No AI API call** — runs locally.

**Request:**
```json
{
  "text": "string (1–10,000 characters)"
}
```

**Response (200):**
```json
{
  "score": 78.5,
  "patterns": [
    {
      "id": "ai-vocab-t1",
      "label": "AI Vocabulary (Tier 1)",
      "hits": 3,
      "examples": ["delve", "moreover", "comprehensive"],
      "severity": "high",
      "weight": 8
    }
  ],
  "stats": {
    "burstiness": 0.12,
    "typeTokenRatio": 0.45,
    "avgSentenceLength": 22.3,
    "fleschReadingEase": 55.2
  },
  "wordCount": 245,
  "documentId": "clxyz..."
}
```

**Errors:**
- `400` — Text too short or too long
- `401` — Not authenticated
- `429` — Monthly analysis quota exceeded

---

### POST /api/rewrite

Rewrite text to sound more human using GPT-4o-mini.

**Request:**
```json
{
  "documentId": "string",
  "text": "string (1–10,000 characters)",
  "tone": "casual" | "professional" | "academic"
}
```

**Response (200):**
```json
{
  "rewrittenText": "string",
  "model": "gpt-4o-mini",
  "tokensUsed": 512,
  "documentId": "clxyz..."
}
```

**Errors:**
- `400` — Invalid input
- `401` — Not authenticated
- `402` — Rewrite quota exceeded (upgrade required)
- `429` — Rate limited
- `500` — OpenAI API error

---

### GET /api/documents

List user's documents with pagination.

**Query params:**
- `page` (int, default 1)
- `limit` (int, default 10, max 50)

**Response (200):**
```json
{
  "documents": [
    {
      "id": "clxyz...",
      "originalText": "string (truncated to 200 chars)",
      "overallScore": 78.5,
      "wordCount": 245,
      "rewrittenText": null,
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 42,
    "totalPages": 5
  }
}
```

---

### GET /api/documents/[id]

Get a single document with full details.

**Response (200):**
```json
{
  "id": "clxyz...",
  "originalText": "string",
  "analysisResult": { "...full JSON..." },
  "overallScore": 78.5,
  "rewrittenText": "string | null",
  "rewriteModel": "gpt-4o-mini | null",
  "wordCount": 245,
  "createdAt": "2024-01-15T10:30:00Z"
}
```

**Errors:**
- `404` — Document not found or does not belong to user

---

### GET /api/usage

Get current billing period usage stats.

**Response (200):**
```json
{
  "plan": "FREE",
  "analysisCount": 7,
  "analysisLimit": 10,
  "rewriteCount": 2,
  "rewriteLimit": 3,
  "billingCycleStart": "2024-01-01T00:00:00Z",
  "billingCycleEnd": "2024-02-01T00:00:00Z"
}
```

---

### POST /api/webhooks/stripe

Stripe webhook endpoint. Verifies signature via `stripe.webhooks.constructEvent`.

**Handled events:**
- `checkout.session.completed` — Create/update subscription
- `customer.subscription.updated` — Update plan & period
- `customer.subscription.deleted` — Downgrade to FREE
- `invoice.payment_succeeded` — Reset usage counters

**Response:** `200` (always, to acknowledge receipt)

---

### POST /api/webhooks/clerk

Clerk webhook endpoint for user sync.

**Handled events:**
- `user.created` — Create User record
- `user.updated` — Update User email/name
- `user.deleted` — Soft-delete or cleanup

**Response:** `200`

---

## Rate Limiting

Rate limiting is applied per-user based on plan:

| Plan       | Analyses/mo | Rewrites/mo | Rate limit    |
| ---------- | ----------- | ----------- | ------------- |
| FREE       | 10          | 3           | 5 req/min     |
| PRO        | 100         | 50          | 20 req/min    |
| ENTERPRISE | Unlimited   | Unlimited   | 60 req/min    |

## Error Format

All errors follow this shape:

```json
{
  "error": {
    "code": "QUOTA_EXCEEDED",
    "message": "You have reached your monthly analysis limit. Upgrade to Pro for more."
  }
}
```
