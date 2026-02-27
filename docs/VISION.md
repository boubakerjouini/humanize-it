# HumanizeIt — Vision & Stratégie Produit

> Document fondateur · v1.0 · Fév 2026  
> Fondateur : Boubaker Seddik Jouini

---

## Pourquoi ce produit existe

En 2026, des centaines de millions de personnes utilisent ChatGPT, Claude ou Gemini pour rédiger des emails, des articles, des lettres de motivation, des posts LinkedIn.

Le résultat : un internet rempli de texte robotique, reconnaissable au premier coup d'œil.

Les outils de détection d'IA (GPTZero, Turnitin, Originality.ai) sont devenus standards :
- Les profs détectent les devoirs
- Les recruteurs détectent les CVs
- Les éditeurs détectent les articles
- Google pénalise le contenu IA non modifié

**Le contenu IA pénalise son auteur.** Et personne n'a encore résolu ça proprement.

Ce que les gens font aujourd'hui :
1. Réécrire manuellement (long, douloureux)
2. Utiliser des prompts complexes (pas fiable)
3. Payer des services douteux à $30+/mois

Aucune solution simple, abordable, et surtout **transparente**.

---

## La Vision

> **HumanizeIt : le Grammarly du post-IA.**

Devenir l'outil de référence pour quiconque veut écrire avec de l'IA sans que ça se voie.

Pas un correcteur orthographique.  
Pas un simple paraphraseur.

Un éditeur de style qui connaît exactement les **24 patterns** qui trahissent une IA, et les élimine un par un — en l'expliquant à l'utilisateur.

### Les 3 pilliers produit

| Pilier | Ce qu'on fait | Ce que les concurrents font |
|--------|--------------|----------------------------|
| **Score** | Score 0-100 basé sur 24 patterns + statistiques | Score vague, black box |
| **Transparence** | On explique chaque problème détecté | Résultat opaque, aucune explication |
| **Réécriture** | Humanisation ciblée, ton préservé | Paraphrasage aveugle |

---

## Marché & Opportunité

### Taille du marché

| Indicateur | Valeur |
|---|---|
| Utilisateurs IA actifs (2025) | 800M+ (ChatGPT + Claude + Gemini) |
| Marché AI writing tools | $2.8B, croissance 25%/an |
| Étudiants utilisant l'IA (US) | 65% — Turnitin détecte 70%+ des textes non modifiés |
| Segment "humanization" | Encore sous-exploité, premier mover advantage |

### Pourquoi maintenant

- Les détecteurs d'IA se démocratisent (Turnitin intégré dans la plupart des LMS)
- Le contenu IA est massif mais la qualité perçue baisse
- Aucun outil à $9/mois avec ce niveau de transparence n'existe encore

---

## ICPs — Profils Cibles

### Priorité 1 : Étudiants universitaires 🎓

**Pain :** Critique. Turnitin détecte leur travail, note en risque.  
**Budget :** $5-9/mois — moins d'un café par semaine.  
**Comportement :** Cherchent une solution d'urgence avant une deadline.  
**Canaux :** TikTok, Reddit (r/ChatGPT, r/studentlife, r/college), YouTube Shorts.  
**Message clé :** *"Your AI essay. Undetectable in 30 seconds."*

### Priorité 2 : Freelance writers / Ghostwriters ✍️

**Pain :** Élevé. Leur réputation et leurs revenus dépendent de la qualité perçue.  
**Budget :** $15-29/mois facilement si ça économise 2h/semaine.  
**Comportement :** Cherchent un outil à intégrer dans leur workflow, pas un fix ponctuel.  
**Canaux :** Twitter/X, LinkedIn, communautés Notion/Substack.  
**Message clé :** *"AI speed. Human quality. Client never knows."*

### Priorité 3 : Marketeurs / Content managers 📢

**Pain :** Moyen. SEO penalty Google sur le contenu IA non retravaillé.  
**Budget :** $29-49/mois sur budget marketing.  
**Comportement :** Évaluent ROI, veulent un outil équipe.  
**Canaux :** LinkedIn, ProductHunt, newsletters marketing.  
**Message clé :** *"Scale your content. Keep the human touch."*

### Priorité 4 : Job seekers (CV, cover letters) 💼

**Pain :** Moyen-élevé. Les recruteurs détectent les CVs IA, ça nuit à la candidature.  
**Budget :** $9-15/mois — cyclique (peak à la saison des candidatures).  
**Canaux :** Reddit (r/jobs, r/cscareerquestions), LinkedIn.  
**Message clé :** *"Your cover letter. Your voice. Not GPT's."*

---

## Positionnement Concurrentiel

### Comparaison directe

| Produit | Prix | Précision | Transparence | Verdict |
|---|---|---|---|---|
| Quillbot | $10/mois | Moyenne (paraphrase simple) | Aucune | Concurrent indirect |
| Undetectable.ai | $30/mois | Variable | Aucune | Concurrent direct, cher |
| Humanize.pro | $19/mois | Correcte | Aucune | Concurrent direct |
| GPTZero Humanizer | $16/mois | Liée au détecteur | Partielle | Concurrent partiel |
| **HumanizeIt** | **$9/mois** | **Haute (24 patterns)** | **Totale** | **Notre position** |

### Nos 3 avantages durables

**1. Transparence = Confiance**  
On ne fait pas du paraphrasage aveugle. On explique chaque problème détecté : *"Ce mot est Tier 1 AI vocabulary"*, *"Cette phrase est trop uniforme"*. L'utilisateur apprend. Les concurrents cachent leur algo.

**2. Prix imbattable**  
$9/mois contre $19-30 pour des concurrents directs. Le segment étudiant est price-sensitive. À $9/mois, la décision d'achat est quasi impulsive — moins cher qu'un café par semaine.

**3. Analyse locale = Vitesse + Confidentialité**  
L'analyse tourne côté serveur sans appel à une API externe. Résultat en < 500ms. Et le texte n'est jamais envoyé à un tiers pour l'analyse — argument fort pour les pros.

---

## Philosophie Produit

### Règles fondamentales

- **YAGNI** — You Ain't Gonna Need It. Rien qui n'a pas été demandé par un utilisateur réel.
- **Ship first, iterate second** — Un MVP qui marche vaut plus qu'un V2 parfait qui ne sort pas.
- **L'algo est notre IP** — Ne jamais externaliser la logique de scoring à un LLM.
- **Transparence non négociable** — Chaque score doit être expliquable à l'utilisateur.
- **Tests sur les algos core only** — Pas de couverture 100%, juste les fonctions critiques.

### Ce qu'on ne fera PAS

- Pas de dark patterns pour forcer l'upgrade
- Pas de vente de données utilisateurs
- Pas de rewriting qui détruit le sens ou le ton original
- Pas de features "IA" gadgets (summarize, translate, etc.) — focus total sur l'humanisation

---

## Roadmap Produit

### MVP — Semaine 1 (J1-J7)
**Objectif : premiers $$ le plus vite possible**

- Landing page + éditeur texte
- Score IA 0-100 en temps réel (local, < 500ms)
- Heatmap des mots/phrases suspects
- Réécriture basique via GPT-4o-mini
- Auth Clerk (email + Google)
- Paywall Stripe (Free + Pro)

### V1 — Semaines 3-4
**Objectif : UX complète, rétention**

- 3 modes de réécriture (Formal / Casual / Academic)
- Historique des documents avec scores
- Dashboard utilisateur avec quotas visuels
- Stats détaillées (burstiness, TTR, Flesch)
- Before/after score visuel (le moment "wow")

### V2 — Mois 2-3
**Objectif : scale, nouvelles audiences**

- Extension Chrome (analyser n'importe quelle page)
- API pour développeurs (plan Team)
- Intégration Google Docs
- Multi-langues (FR, ES, DE)
- Plan Équipe avec dashboard partagé

---

## Métriques de succès

### North Star Metric
**Mots humanisés par jour** — Le proxy le plus direct de valeur délivrée.

### Métriques par phase

| Mois | Signups | Pro users | MRR |
|------|---------|-----------|-----|
| M1 | 500 | 25 (5%) | $225 |
| M2 | 2 000 | 120 (6%) | $1 080 |
| M3 | 5 000 | 350 (7%) | $3 150 |
| M6 | 15 000 | 1 200 (8%) | $10 800 |

**Objectif M3 : $5K MRR** (scénario optimiste avec ProductHunt bump).

### Signaux de product-market fit
- Conversion Free → Pro > 7%
- Churn mensuel < 8%
- Score NPS > 40
- Au moins 3 utilisateurs qui disent *"je ne pourrais plus m'en passer"*

---

## Les 3 premières actions (dès maintenant)

1. Réserver le domaine **humanize-it.com** ou **humanizethis.io**
2. Créer le projet Next.js + configurer Clerk + Stripe (J1)
3. Implémenter `analyzeText()` — c'est le cœur du produit (J2)

---

*Le meilleur moment pour lancer un SaaS était hier. Le second meilleur moment, c'est maintenant.*

---

*Jarvis · OpenClaw — Fév 2026 · v1.0*
