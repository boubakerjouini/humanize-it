# HumanizeIt — UI/UX Specification

> v1.1 · Fév 2026 — Mis à jour avec heatmap, before/after score, et pricing corrigé ($9/$29)

---

## Philosophie UX

**Le moment "wow" :** L'utilisateur colle son texte, voit un score de 78/100 avec des phrases surlignées en rouge, clique "Humanize", et voit le score descendre à 12/100. Ce moment doit être **< 5 secondes** et **visuellement spectaculaire**.

**Transparence :** Chaque pattern détecté doit être explicable. Pas de score magique — l'utilisateur comprend *pourquoi*.

**Friction minimale :** Zero signup pour tester (demo publique), signup Clerk en 1 clic, premier résultat en < 30 secondes.

---

## Pages

### 1. Landing Page (`/`)

Public. Objectif : convertir les visiteurs en signups.

```
┌──────────────────────────────────────────────────────┐
│  Logo                Features  Pricing  [Sign In]    │
├──────────────────────────────────────────────────────┤
│                                                      │
│     "Is your text obviously AI?"                     │
│     Detect & humanize in seconds.                    │
│                                                      │
│     [Try Free — No signup required]                  │
│                                                      │
│     ─── Interactive Demo (sans signup) ───           │
│                                                      │
│  ┌────────────────────────────┐                      │
│  │ Paste your text here...    │  Score: [████░] 67   │
│  │                            │                      │
│  │ "In today's rapidly        │  🔴 AI Vocab Tier 1  │
│  │ evolving landscape,        │  🟡 Filler Phrases   │
│  │ it is important to         │  🟠 Generic Ending   │
│  │ note that..."              │                      │
│  │                            │  [Humanize →]        │
│  └────────────────────────────┘                      │
│                                                      │
│     ─── How it works ───                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │ 📋 Paste │  │ 📊 Score │  │ ✏️ Fix   │           │
│  │ your     │  │ 24 AI    │  │ One-click │           │
│  │ text     │  │ patterns │  │ rewrite  │           │
│  └──────────┘  └──────────┘  └──────────┘           │
│                                                      │
│     ─── Before / After ───                           │
│   Score: 78 ████████░░ → 12 ██░░░░░░░░ Score: 12    │
│                                                      │
│     ─── Pricing ───                                  │
│  [Free $0]  [⭐ Pro $9/mo]  [Team $29/mo]           │
│                                                      │
│  Footer: links, legal, © 2026                        │
└──────────────────────────────────────────────────────┘
```

**Note importante :** La demo interactive est publique (sans auth) avec une limite de ~200 mots pour encourager le signup.

---

### 2. Sign In / Sign Up (`/sign-in`, `/sign-up`)

Clerk-hosted UI. Supports email + Google OAuth.  
Après signup → redirect vers `/dashboard/editor`.

---

### 3. Dashboard — Éditeur (`/dashboard/editor`)

Page principale. Interface core du produit.

```
┌──────────────────────────────────────────────────────┐
│  🤖 HumanizeIt    Editor  History  Settings  [User]  │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ┌─────────────────────────┐  ┌─────────────────┐   │
│  │ ORIGINAL TEXT           │  │ SCORE           │   │
│  │                         │  │                 │   │
│  │ Paste or type your      │  │   78 /100       │   │
│  │ text here...            │  │  ████████░░     │   │
│  │                         │  │  "Very likely   │   │
│  │ Words: 245 / 10 000     │  │   AI-generated" │   │
│  └─────────────────────────┘  └─────────────────┘   │
│                                                      │
│  [Analyze Text]  [Clear]                             │
│                                                      │
│  ─── Patterns Detected ────────────────────────────  │
│                                                      │
│  🔴 AI Vocabulary Tier 1 (3 hits)                   │
│     Examples: "delve", "nuanced", "pivotal"          │
│     → These words are almost exclusively used by AI  │
│                                                      │
│  🟠 Filler Phrases (2 hits)                         │
│     Examples: "it's important to note that", ...     │
│     → Padding phrases that add length without value  │
│                                                      │
│  🟡 Generic Conclusion (1 hit)                       │
│     Examples: "in conclusion"                        │
│     → AI always ends with a formulaic conclusion     │
│                                                      │
│  ─── Statistics ───────────────────────────────────  │
│                                                      │
│  Burstiness: 0.12  ⚠ Low (AI-typical < 0.20)        │
│  TTR: 0.45         ⚠ Low (AI-typical < 0.40)        │
│  Avg sentence: 22.3 words                            │
│  Flesch score: 52.1 (College level)                  │
│                                                      │
│  ─── Heatmap ──────────────────────────────────────  │
│                                                      │
│  In today's [rapidly evolving] landscape, it is      │
│  [important to note that] the [paradigm] has         │
│  shifted [significantly]. This [comprehensive]       │
│  approach [underscores] the [pivotal] role of...     │
│  [In conclusion], these [nuanced] insights...        │
│                                                      │
│  (rouge = Tier 1 · orange = pattern phrase · jaune = Tier 2)
│                                                      │
│  [Humanize Text →]   Tone: [Standard ▼]             │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**Après clic "Humanize" :**

```
┌──────────────────────────────────────────────────────┐
│  ┌──────────────────────┐  ┌───────────────────────┐ │
│  │ ORIGINAL      78/100 │  │ HUMANIZED      12/100 │ │
│  │                      │  │                       │ │
│  │ In today's rapidly   │  │ The field has changed  │ │
│  │ evolving landscape,  │  │ fast. What used to     │ │
│  │ it is important to   │  │ take months now takes  │ │
│  │ note that the        │  │ days — and that's      │ │
│  │ paradigm has         │  │ shifting how teams     │ │
│  │ shifted...           │  │ operate...             │ │
│  └──────────────────────┘  └───────────────────────┘ │
│                                                      │
│  Score: 78 ────────────────────────────→ 12          │
│          ████████░░                      ██░░░░░░░░  │
│                                                      │
│  [Copy Humanized Text]  [Re-analyze]  [Save]        │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**C'est le moment "wow" du produit.** La descente de score visible doit être animée.

---

### 4. History (`/dashboard/history`)

Liste paginée des analyses précédentes.

```
┌──────────────────────────────────────────────────────┐
│  Document History                        [New Doc +] │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ┌────┬────────────────────┬───────┬──────────────┐  │
│  │ #  │ Preview            │ Score │ Date         │  │
│  ├────┼────────────────────┼───────┼──────────────┤  │
│  │  1 │ "In today's..."    │  78   │ 15 Jan 2026  │  │
│  │  2 │ "The concept of..."│  45   │ 14 Jan 2026  │  │
│  │  3 │ "My weekend trip.."│  12   │ 13 Jan 2026  │  │
│  └────┴────────────────────┴───────┴──────────────┘  │
│                                                      │
│  [← Prev]  Page 1 of 5  [Next →]                    │
└──────────────────────────────────────────────────────┘
```

Plan Free → message : "History available on Pro — $9/mo [Upgrade]"

---

### 5. Settings / Billing (`/dashboard/settings`)

```
┌──────────────────────────────────────────────────────┐
│  Account Settings                                    │
├──────────────────────────────────────────────────────┤
│  Current Plan: FREE                                  │
│                                                      │
│  Words used today: 350 / 500 ████████░░              │
│  Rewrites today:   0 / 1                             │
│                                                      │
│  ┌──────────────────────────────────────────────┐    │
│  │ ⭐ Upgrade to Pro — $9/month                 │    │
│  │ 50 000 words/month · Unlimited rewrites      │    │
│  │ 3 rewrite modes · 30-day history             │    │
│  │                           [Upgrade Now →]    │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
│  [Manage Billing →] (Stripe Customer Portal)         │
│                                                      │
│  Profile                                             │
│  Email: bouba@example.com  [Edit via Clerk →]        │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## Components

### Core Components

| Component | Description | Notes |
|---|---|---|
| `TextEditor` | Textarea avec compteur de mots, limite visible | Real-time word count |
| `ScoreGauge` | Gauge circulaire 0-100 avec couleur dynamique | Rouge > 60, Jaune 30-60, Vert < 30 |
| `ScoreBar` | Barre de progression horizontale pour before/after | Animée |
| `Heatmap` | Texte avec mots/phrases surlignés par sévérité | Rouge/Orange/Jaune/Vert |
| `PatternList` | Liste des patterns détectés, collapsible | Avec explication pédagogique |
| `PatternBadge` | Badge coloré par sévérité | critical/high/medium/low |
| `StatsPanel` | Grille de métriques statistiques | Burstiness, TTR, ASL, Flesch |
| `BeforeAfterPanel` | Side-by-side original vs réécrit | Avec animation de score |
| `DocumentCard` | Item de l'historique | Preview 100 chars + score |
| `UsageMeter` | Barre de progression quota | Avec warning quand > 80% |
| `PricingCard` | Carte plan avec features + CTA | Free / Pro / Team |
| `UpgradeDialog` | Modal upgrade quand quota atteint | Avec comparaison plans |
| `ToneSelector` | Dropdown : Standard / Formal / Casual / Academic | Pro only pour Formal/Academic |

### Layout Components

| Component | Description |
|---|---|
| `Navbar` | Top nav : logo, liens, UserButton Clerk |
| `Sidebar` | Dashboard sidebar : Editor, History, Settings |
| `PageHeader` | Titre + description de page |

---

## User Flows

### Flow 1 : Premier contact (sans signup)

1. Visite landing page
2. Demo interactive visible immédiatement (pas besoin de s'inscrire)
3. L'utilisateur colle un texte, voit le score et les patterns
4. Clique "Humanize" → modal de signup Clerk
5. Après signup → dashboard avec le texte déjà chargé

### Flow 2 : Analyse standard

1. Utilisateur colle texte dans `TextEditor`
2. Clique "Analyze Text"
3. Loading spinner (< 500ms — calcul local)
4. Score + patterns + heatmap apparaissent
5. CTA : "Humanize Text →" + sélecteur de ton

### Flow 3 : Humanisation

1. Après analyse, clic "Humanize Text"
2. Si quota dispo → spinner (1-3s, appel GPT-4o-mini)
3. `BeforeAfterPanel` apparaît : original vs réécrit côte à côte
4. Animation : score descend de X à Y (le moment "wow")
5. CTA : "Copy Humanized Text" + "Re-analyze"
6. Si quota dépassé → `UpgradeDialog` avec plans

### Flow 4 : Upgrade

1. Utilisateur heurte la limite (mots ou rewrites)
2. `UpgradeDialog` apparaît avec comparaison des plans
3. Clic "Upgrade to Pro — $9/mo"
4. Redirect vers Stripe Checkout
5. Succès → redirect vers `/dashboard/editor`
6. Stripe webhook met à jour le plan + reset les compteurs

---

## Design Tokens

| Token | Valeur |
|---|---|
| Font | Inter (system stack fallback) |
| Color palette | Zinc (shadcn default) |
| Accent | Indigo-500 (#6366f1) pour CTAs |
| Critical severity | red-500 |
| High severity | orange-500 |
| Medium severity | yellow-500 |
| Low severity | green-500 |
| Score: high (> 60) | red-500 |
| Score: medium (30-60) | yellow-500 |
| Score: low (< 30) | green-500 |
| Border radius | 0.5rem (shadcn) |
| Spacing grid | 4px (Tailwind) |

---

## Responsive

| Breakpoint | Layout |
|---|---|
| Desktop > 1024px | Sidebar + main content côte à côte |
| Tablet 768-1024px | Sidebar collapsible (hamburger) |
| Mobile < 768px | Bottom nav, layout en stack, éditeur plein écran |

---

## Microcopy — Textes importants

- **Score 0-30 :** "Looks human 🟢"
- **Score 31-60 :** "Possibly AI-generated 🟡"
- **Score 61-80 :** "Likely AI-generated 🟠"
- **Score 81-100 :** "Very likely AI-generated 🔴"
- **Quota atteint :** "You've used your daily limit. Upgrade to Pro for 50 000 words/month — less than a coffee a week."
- **Après humanisation :** "Score dropped from {before} to {after}. Your text now reads as human. ✅"

---

*Jarvis · OpenClaw — Fév 2026 · v1.1*
