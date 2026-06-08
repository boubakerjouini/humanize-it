# Database migrations

The production build now runs `prisma migrate deploy` (see `package.json` → `build`)
instead of `prisma db push --accept-data-loss`. Schema changes are versioned,
reviewable, and never silently drop columns or tables.

## One-time cutover for the EXISTING production database

The current production database was created with `prisma db push`, so its tables
already exist but it has **no `_prisma_migrations` history table**. Running
`migrate deploy` against it as-is would try to re-create existing tables and fail.

Baseline it **once** (against the production `DATABASE_URL`) so Prisma records
`0_init` as already applied without re-running it:

```bash
# point at the prod DB for this one command
DATABASE_URL="<prod-connection-string>" npm run db:baseline
```

This is equivalent to `prisma migrate resolve --applied 0_init`. After it succeeds,
every deploy will apply only *new* migrations.

> Before the first cutover, enable and rehearse a Neon point-in-time restore so a
> bad migration is recoverable. Take a snapshot/branch immediately before baselining.

## Day-to-day workflow

1. Edit `prisma/schema.prisma`.
2. Create a migration locally: `npm run db:migrate -- --name <change>`
   (this runs `prisma migrate dev`, which generates SQL and applies it to your dev DB).
3. Review the generated SQL under `prisma/migrations/<timestamp>_<change>/`.
4. Commit the migration folder. Vercel applies it on deploy via `migrate deploy`.

Never run `prisma db push` against production again.
