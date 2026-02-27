# HumanizeIt — Go-To-Market Strategy

## Pricing

### Free Plan — $0/mo

- 10 analyses per month
- 3 rewrites per month
- Basic detection (all 24 patterns)
- History (last 30 days)

### Pro Plan — $19/mo

- 100 analyses per month
- 50 rewrites per month
- Full detection + detailed breakdown
- Unlimited history
- Priority support
- Tone selection (casual / professional / academic)

### Enterprise Plan — $49/mo

- Unlimited analyses
- Unlimited rewrites
- Full detection + API access
- Team management (coming soon)
- Dedicated support
- Custom rewrite instructions

## Quotas by Plan

| Feature              | Free  | Pro   | Enterprise |
| -------------------- | ----- | ----- | ---------- |
| Analyses / month     | 10    | 100   | Unlimited  |
| Rewrites / month     | 3     | 50    | Unlimited  |
| Max text length      | 5,000 | 10,000| 10,000     |
| History retention    | 30d   | ∞     | ∞          |
| API access           | No    | No    | Yes        |
| Tone selection       | No    | Yes   | Yes        |
| Rate limit (req/min) | 5     | 20    | 60         |

## Stripe Configuration

### Products

| Product    | Stripe Price ID (env)            | Interval |
| ---------- | -------------------------------- | -------- |
| Pro        | `STRIPE_PRO_PRICE_ID`            | Monthly  |
| Enterprise | `STRIPE_ENTERPRISE_PRICE_ID`     | Monthly  |

### Webhook Events

- `checkout.session.completed` → Activate subscription
- `customer.subscription.updated` → Sync plan changes
- `customer.subscription.deleted` → Downgrade to free
- `invoice.payment_succeeded` → Reset monthly counters

## Launch Strategy

### Phase 1: MVP (Week 1–2)

- Core analysis engine (24 patterns)
- Basic rewrite with GPT-4o-mini
- Clerk auth (email + Google)
- Stripe integration (Free + Pro)
- Deploy to Vercel

### Phase 2: Growth (Week 3–4)

- Landing page with interactive demo
- SEO: target "AI text detector", "humanize AI text"
- Product Hunt launch
- Reddit posts in r/ChatGPT, r/artificial, r/writing

### Phase 3: Expansion (Month 2+)

- Enterprise plan with API
- Chrome extension
- Batch processing (multiple documents)
- Team/org accounts
- Additional rewrite models

## Target Audience

1. **Students** — Need to ensure essays don't flag as AI
2. **Content creators** — Blog posts, articles, social media
3. **Marketers** — Email copy, landing pages, ad copy
4. **Professionals** — Reports, proposals, business writing
5. **SEO specialists** — Google penalizes AI content

## Key Metrics

| Metric           | Target (Month 1) |
| ---------------- | ----------------- |
| Sign-ups         | 500               |
| Free → Pro conv. | 5% (25 users)     |
| MRR              | $475              |
| Churn             | < 10%             |
| Analyses/user    | 8/month avg       |

## Competitive Differentiation

- **Transparent scoring** — Users see exactly which patterns triggered
- **Fast** — Analysis runs locally, no external API call (< 500ms)
- **Privacy** — Text is not sent to third parties for analysis
- **Integrated rewrite** — Detect + fix in one workflow
- **Affordable** — Undercut GPTZero ($10/mo limited) and Originality.ai ($15/mo)
