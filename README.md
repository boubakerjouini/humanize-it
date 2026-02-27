# HumanizeIt

> L'outil qui rend le texte IA vraiment humain.

**Score ton texte → détecte les 24 patterns IA → réécrit en un clic.**

---

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript strict |
| Auth | Clerk |
| Payments | Stripe |
| Database | Neon PostgreSQL (serverless) |
| ORM | Prisma |
| AI Rewrite | OpenAI GPT-4o-mini |
| UI | shadcn/ui + Tailwind |
| Hosting | Vercel |

## Docs

| Fichier | Contenu |
|---|---|
| [`docs/VISION.md`](docs/VISION.md) | Vision produit, ICPs, positioning, roadmap |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Stack, infra, diagramme archi, request flow |
| [`docs/DATABASE.md`](docs/DATABASE.md) | Schéma Prisma, modèles, indexes |
| [`docs/API.md`](docs/API.md) | Endpoints, payloads, formats de réponse |
| [`docs/ALGORITHM.md`](docs/ALGORITHM.md) | 24 patterns, formule de scoring, burstiness/TTR |
| [`docs/UI-UX.md`](docs/UI-UX.md) | Pages, composants, flows utilisateur, heatmap |
| [`docs/GTM.md`](docs/GTM.md) | Pricing ($9/$29), ICPs, SEO, launch strategy |

## Plan Dev — 7 Jours

| Jour | Tâche |
|---|---|
| J1 | Setup (Next.js + Clerk + Prisma + Neon + Stripe) |
| J2 | Core algo : `analyzeText()` (24 patterns + stats) |
| J3 | Intégration OpenAI : `humanizeText()` |
| J4 | UI : éditeur, score live, heatmap |
| J5 | Paywall + Stripe webhook + quotas |
| J6 | Landing page + SEO + meta tags |
| J7 | Tests, bug fixes, deploy prod 🚀 |

## Getting Started

```bash
# Install deps
npm install

# Setup env
cp .env.local.example .env.local
# Fill in your keys (Clerk, Stripe, OpenAI, Neon)

# Setup DB
npx prisma generate
npx prisma db push

# Dev
npm run dev
```

## Pricing

| Plan | Prix | Mots/mois |
|---|---|---|
| Free | $0 | 500/jour |
| Pro | $9/mois | 50 000 |
| Team | $29/mois | 200 000 |

---

*Fondateur : Boubaker Seddik Jouini · Fév 2026*
