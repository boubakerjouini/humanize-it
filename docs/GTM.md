# HumanizeIt — Go-To-Market Strategy

> v1.1 · Fév 2026 — Remplace version générée par agent (pricing corrigé)

---

## Pricing & Plans

### Free — $0/mois

- 500 mots/jour (reset quotidien)
- Score IA basique (0-100)
- 1 réécriture/jour
- Pas d'historique
- Watermark sur export

### ⭐ Pro — $9/mois (ou $79/an — économise 27%)

- 50 000 mots/mois
- Score détaillé + stats complètes (burstiness, TTR, Flesch)
- Rewrites illimitées
- 3 modes de style (Formal / Casual / Academic)
- Historique 30 jours
- Export propre (sans watermark)

### Team — $29/mois (jusqu'à 5 users)

- 200 000 mots/mois
- Tout le plan Pro
- Dashboard équipe
- API access (bêta)
- Support prioritaire

---

## Quotas par Plan

| Feature | Free | Pro | Team |
|---|---|---|---|
| Mots / jour (Free) ou mois | 500/j | 50 000/mois | 200 000/mois |
| Rewrites | 1/jour | Illimitées | Illimitées |
| Modes de style | 1 (Standard) | 3 | 3 |
| Historique | Non | 30 jours | Illimité |
| API access | Non | Non | Oui (bêta) |
| Export watermark | Oui | Non | Non |
| Rate limit (req/min) | 5 | 20 | 60 |
| Max longueur texte | 5 000 chars | 10 000 chars | 10 000 chars |

---

## Stripe Configuration

### Products & Price IDs

| Plan | Env var | Interval |
|---|---|---|
| Pro mensuel | `STRIPE_PRO_PRICE_ID` | Monthly |
| Pro annuel | `STRIPE_PRO_ANNUAL_PRICE_ID` | Yearly |
| Team mensuel | `STRIPE_TEAM_PRICE_ID` | Monthly |

### Webhook Events à gérer

| Event | Action |
|---|---|
| `checkout.session.completed` | Activer la subscription, mettre à jour le plan |
| `customer.subscription.updated` | Sync changement de plan |
| `customer.subscription.deleted` | Downgrade vers Free |
| `invoice.payment_succeeded` | Reset compteurs mensuels |
| `invoice.payment_failed` | Envoyer email de relance |

---

## ICPs — Profils Cibles (par priorité)

| Segment | Pain Level | Budget | Volume | Canal |
|---|---|---|---|---|
| 🎓 Étudiants universitaires | Critique (Turnitin) | $5-9/mois | Très élevé | TikTok, Reddit |
| ✍️ Freelance writers / Ghostwriters | Élevé (réputation) | $15-29/mois | Élevé | Twitter, LinkedIn |
| 📢 Marketeurs / Content managers | Moyen (SEO penalty) | $29-49/mois | Moyen | LinkedIn, ProductHunt |
| 💼 Job seekers (CV, cover letters) | Moyen-élevé | $9-15/mois | Cyclique | Reddit, LinkedIn |
| 🏢 Petites agences | Moyen | $49-99/mois | Faible | Cold outreach |

**Focus MVP : Étudiants + Freelances.**  
Pain maximal, adoption rapide, CAC faible via canaux organiques.  
Le bouche-à-oreille naturel dans ces communautés peut générer des milliers d'utilisateurs sans budget marketing.

---

## Messaging par Segment

### 🎓 Étudiants
> **"Your AI essay. Undetectable in 30 seconds."**  
> HumanizeIt removes the 24 patterns that Turnitin and GPTZero catch every time.

### ✍️ Freelances / Ghostwriters
> **"AI speed. Human quality. Client never knows."**  
> Score your content, fix AI patterns, deliver work that sounds like you wrote every word.

### 📢 Marketeurs
> **"Scale your content. Keep the human touch."**  
> AI content gets penalized. Humanized content ranks. We make the difference in one click.

### 💼 Job seekers
> **"Your cover letter. Your voice. Not GPT's."**  
> Recruiters spot AI-written applications instantly. Don't let that cost you the interview.

---

## SEO — Mots-clés à Fort Potentiel

| Mot-clé | Volume/mois | Difficulté | Intent |
|---|---|---|---|
| humanize ai text | 40 000 | Faible | Transactionnel |
| make chatgpt text undetectable | 27 000 | Moyen | Transactionnel |
| ai text humanizer | 22 000 | Faible | Transactionnel |
| bypass ai detection | 18 000 | Moyen | Transactionnel |
| remove ai writing patterns | 8 000 | Très faible | Informatif |
| ai text detector bypass | 12 000 | Moyen | Transactionnel |
| how to make ai text sound human | 9 500 | Faible | Informatif |
| undetectable ai writer | 15 000 | Moyen | Transactionnel |
| chatgpt text humanizer | 11 000 | Faible | Transactionnel |
| turnitin ai detection bypass | 6 000 | Faible | Transactionnel |

**Stratégie :** Cibler d'abord les mots à volume élevé + difficulté faible.  
Pages à créer : landing page principale + blog posts sur chaque intent informatif.

---

## Launch Strategy

### Phase 1 — Launch (Semaine 1-2)

**ProductHunt**
- Viser Top 5 du jour
- Assets : GIF demo 60s, screenshots avant/après score, description courte
- Timing : mardi ou mercredi, 12h01 AM Pacific Time

**Reddit** (organic, pas de spam)
- r/ChatGPT — "I built a tool that shows you exactly why your AI text gets detected"
- r/studentlife — post authentique, témoignage
- r/freelancewriting — focus sur le workflow des ghostwriters
- r/artificial — approche technique (comment ça marche)

**Twitter/X**
- Thread : before/after GIF avec score qui passe de 78 à 12
- Format : "I analyzed 10 000 AI texts and found 24 patterns that always get caught. Here's what I found [thread]"

**Hacker News**
- "Show HN: I built a tool that detects AI writing patterns — here's the algo"
- Focus technique, pas marketing

### Phase 2 — Grow (Mois 2-3)

**SEO**
- Article : "The 24 Patterns That Make Your Writing Sound Like ChatGPT (And How to Fix Them)"
- Article : "Why Turnitin Catches AI Text — The Technical Breakdown"
- Landing pages par segment : /for-students, /for-freelancers, /for-marketers

**TikTok / YouTube Shorts**
- Démonstrations visuelles avant/après
- Format : "Watch this AI essay go from 78% detected to 12% in 30 seconds"
- Cible : étudiants, 18-25 ans

**Programme Affiliés**
- Commission : 30% récurrente
- Cibles : YouTubers étude/productivity, newsletters étudiantes

### Phase 3 — Scale (Mois 3+)

- Extension Chrome : analyser n'importe quelle page web
- Partenariats avec créateurs de contenu
- Outreach agences de contenu (plan Team)
- Multi-langues : FR, ES, DE (marché international)

---

## Launch Day Checklist

### ✅ Avant le Launch
- [ ] Landing page live avec demo interactive
- [ ] Demo video (60s, format vertical pour TikTok)
- [ ] ProductHunt assets (logo, banner, GIF)
- [ ] 5 early users beta (pour les premières reviews)
- [ ] Stripe configuré et testé end-to-end
- [ ] Domaine configuré (humanize-it.com ou humanizethis.io)

### 🚀 Jour J
- [ ] ProductHunt soumission à minuit PT
- [ ] Tweet thread live
- [ ] Posts Reddit × 4 (espacés dans la journée)
- [ ] Show HN soumission
- [ ] Notification à la liste d'attente

### 📊 Post-Launch (72h)
- [ ] Répondre à chaque commentaire ProductHunt
- [ ] Monitor signups en temps réel
- [ ] Collecter les feedbacks (quoi manque, quoi confuse)
- [ ] Itérer en 48h sur les bugs critiques
- [ ] Célébrer 🎉

---

## Métriques Cibles

| Métrique | M1 | M2 | M3 |
|---|---|---|---|
| Signups | 500 | 2 000 | 5 000 |
| Conversion Free→Pro | 5% | 6% | 7% |
| MRR | $225 | $1 080 | $3 150 |
| Churn mensuel | < 15% | < 10% | < 8% |

**Objectif M3 : $5K MRR** (scénario optimiste avec ProductHunt + Reddit viral)

---

## Compétition

| Produit | Prix | Notre avantage |
|---|---|---|
| Quillbot | $10/mois | On explique chaque pattern, eux non |
| Undetectable.ai | $30/mois | 3× moins cher, plus transparent |
| Humanize.pro | $19/mois | 2× moins cher |
| GPTZero Humanizer | $16/mois | Moins cher, algo indépendant |
| ChatGPT (prompts) | $20/mois | Résultat fiable vs aléatoire |

---

*Jarvis · OpenClaw — Fév 2026 · v1.1*
