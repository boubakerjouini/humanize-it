# Database migrations

A versioned baseline migration (`0_init`) is committed here so the project can
move off `prisma db push` onto a reviewable migration history. The cutover is a
deliberate, supervised one-time step against production — see below.

## Current state (important)

`package.json` → `build` currently runs **`prisma db push`** (NOT `migrate deploy`),
and crucially WITHOUT `--accept-data-loss` — so it only applies additive,
non-destructive schema changes and **errors instead of dropping data**. This is
safe and is what unblocks Vercel deploys today.

Why not `migrate deploy` yet: production was originally created with `db push`,
so it has no `_prisma_migrations` history. Running `migrate deploy` there makes
`0_init` try to `CREATE TABLE` objects that already exist → build fails. You must
**baseline** production first.

## One-time cutover to migrations (do this when ready)

1. **Snapshot first.** Enable and rehearse a Neon point-in-time restore / create a
   branch. Do not skip this.
2. **Make prod match `0_init`.** Deploy once on the current `db push` build so the
   new objects (`RateLimit`, `WebhookEvent`, `User.planExpiresAt`,
   `DiscountCode.grantDays`) exist in production. (This is already the case after a
   successful `db push` deploy.)
3. **Baseline.** Mark `0_init` as already applied without re-running it, against the
   production connection string:
   ```bash
   DATABASE_URL="<prod-connection-string>" npm run db:baseline
   ```
   (= `prisma migrate resolve --applied 0_init`.)
4. **Flip the build.** In `package.json`, set `build` to the value of `build:migrate`
   (`prisma generate && prisma migrate deploy && next build`). From now on, only NEW
   migrations are applied on deploy.

## Day-to-day workflow (once on migrations)

1. Edit `prisma/schema.prisma`.
2. `npm run db:migrate -- --name <change>` (generates + applies SQL locally).
3. Review the generated `prisma/migrations/<timestamp>_<change>/migration.sql`.
4. Commit the migration folder. Deploy applies it via `migrate deploy`.

Never run `prisma db push` against production once you are on migrations, and never
add `--accept-data-loss` to any production build command.
