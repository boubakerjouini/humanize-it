# HumanizeIt — UI/UX Specification

## Pages

### 1. Landing Page (`/`)

Public page. Converts visitors to sign-ups.

```
┌──────────────────────────────────────────────┐
│  Logo          Features  Pricing  [Sign In]  │
├──────────────────────────────────────────────┤
│                                              │
│     "Is your text obviously AI?"             │
│     Detect & humanize in seconds.            │
│                                              │
│     [Try Free →]     [See Pricing]           │
│                                              │
├──────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Paste    │  │ Instant  │  │ One-click│   │
│  │ your text│  │ AI score │  │ rewrite  │   │
│  └──────────┘  └──────────┘  └──────────┘   │
├──────────────────────────────────────────────┤
│  Interactive demo (analyze sample text)      │
├──────────────────────────────────────────────┤
│  Pricing cards (Free / Pro / Enterprise)     │
├──────────────────────────────────────────────┤
│  Footer: links, legal, © 2024               │
└──────────────────────────────────────────────┘
```

### 2. Sign In / Sign Up (`/sign-in`, `/sign-up`)

Clerk-hosted UI components. Supports email + Google OAuth.

### 3. Dashboard (`/dashboard`)

Main workspace. Protected route.

```
┌──────────────────────────────────────────────┐
│  Logo    Dashboard  History  Settings  [User]│
├──────────┬───────────────────────────────────┤
│          │                                   │
│ Sidebar  │   ┌─────────────────────────┐     │
│          │   │  Paste or type your     │     │
│ • Analyze│   │  text here...           │     │
│ • History│   │                         │     │
│ • Usage  │   │                         │     │
│ • Plan   │   │  [500 words]            │     │
│          │   └─────────────────────────┘     │
│          │                                   │
│          │   [Analyze Text]                  │
│          │                                   │
│          │   ── Results ──────────────────   │
│          │                                   │
│          │   Score: ████████░░ 78/100         │
│          │                                   │
│          │   Patterns Found:                 │
│          │   🔴 AI Vocab Tier 1 (3 hits)     │
│          │   🟡 Filler Phrases (2 hits)      │
│          │   🟢 Transition Overuse (1 hit)   │
│          │                                   │
│          │   Stats:                          │
│          │   Burstiness: 0.12 (Low ⚠)        │
│          │   TTR: 0.45                       │
│          │                                   │
│          │   [Humanize Text →]               │
│          │                                   │
└──────────┴───────────────────────────────────┘
```

### 4. History (`/dashboard/history`)

Paginated list of past analyses.

```
┌──────────────────────────────────────────────┐
│  Document History                            │
├──────────────────────────────────────────────┤
│  ┌────┬────────────────┬───────┬──────────┐  │
│  │ #  │ Preview        │ Score │ Date     │  │
│  ├────┼────────────────┼───────┼──────────┤  │
│  │ 1  │ "In today's..."│ 78   │ Jan 15   │  │
│  │ 2  │ "The concept.."│ 45   │ Jan 14   │  │
│  │ 3  │ "My weekend.." │ 12   │ Jan 13   │  │
│  └────┴────────────────┴───────┴──────────┘  │
│                                              │
│  [← Prev]  Page 1 of 5  [Next →]            │
└──────────────────────────────────────────────┘
```

### 5. Settings / Billing (`/dashboard/settings`)

Plan management and Stripe portal link.

```
┌──────────────────────────────────────────────┐
│  Settings                                    │
├──────────────────────────────────────────────┤
│                                              │
│  Current Plan: FREE                          │
│  Analyses: 7 / 10 this month                 │
│  Rewrites: 2 / 3 this month                  │
│                                              │
│  [Upgrade to Pro — $19/mo]                   │
│                                              │
│  [Manage Billing →] (Stripe Customer Portal) │
│                                              │
└──────────────────────────────────────────────┘
```

## Components

### Core Components

| Component          | Description                                    |
| ------------------ | ---------------------------------------------- |
| `TextInput`        | Textarea with word count, char limit indicator  |
| `ScoreGauge`       | Circular or bar gauge showing 0–100 score      |
| `PatternList`      | Collapsible list of detected patterns           |
| `PatternBadge`     | Severity-colored badge (critical/high/med/low) |
| `StatsPanel`       | Grid of statistical metrics                    |
| `RewritePanel`     | Side-by-side original vs. rewritten text       |
| `DocumentCard`     | History list item with preview + score         |
| `UsageMeter`       | Progress bar for quota usage                   |
| `PricingCard`      | Plan card with features + CTA                  |
| `UpgradeDialog`    | Modal prompting upgrade when limit is reached  |

### Layout Components

| Component          | Description                                    |
| ------------------ | ---------------------------------------------- |
| `Navbar`           | Top nav with logo, links, user button          |
| `Sidebar`          | Dashboard sidebar navigation                   |
| `PageHeader`       | Page title + description                       |

## User Flows

### Flow 1: First-Time Analysis

1. User signs up via Clerk
2. Redirected to `/dashboard`
3. Pastes text into `TextInput`
4. Clicks "Analyze Text"
5. Loading spinner (< 500ms, local computation)
6. Results appear: score gauge + patterns + stats
7. CTA: "Humanize Text →" button

### Flow 2: Rewrite (Humanize)

1. After analysis, user clicks "Humanize Text"
2. If quota available → loading spinner (1–3s, GPT-4o-mini call)
3. `RewritePanel` shows original vs. rewritten side-by-side
4. User can copy rewritten text
5. If quota exceeded → `UpgradeDialog` appears

### Flow 3: Upgrade

1. User hits quota limit
2. `UpgradeDialog` shows plan comparison
3. User clicks "Upgrade to Pro"
4. Redirected to Stripe Checkout
5. On success → redirected back to `/dashboard`
6. Stripe webhook updates subscription + resets counters

## Design Tokens

- **Font**: Inter (system fallback stack)
- **Colors**: Zinc palette (shadcn default)
- **Accent**: Primary blue for CTAs
- **Severity colors**:
  - Critical: `red-500`
  - High: `orange-500`
  - Medium: `yellow-500`
  - Low: `green-500`
- **Border radius**: `0.5rem` (shadcn default)
- **Spacing**: 4px grid (Tailwind default)

## Responsive Behavior

- **Desktop** (>1024px): Sidebar + main content
- **Tablet** (768–1024px): Collapsible sidebar
- **Mobile** (<768px): Bottom nav, stacked layout
