import dotenv from "dotenv";
import { defineConfig, env } from "@prisma/config";

// Local CLI runs (db push, studio, migrate) must hit the dev database, never
// production: .env.development.local (dev Neon branch) is loaded first, and
// dotenv never overrides a value that is already set, so .env.local (pulled
// from Vercel, production values) only fills what the dev file lacks. On
// Vercel neither file exists and DATABASE_URL comes from the environment.
dotenv.config({ path: ".env.development.local", quiet: true });
dotenv.config({ path: ".env.local", quiet: true });

export default defineConfig({
  datasource: {
    url: env("DATABASE_URL"),
  },
  schema: "./prisma/schema.prisma",
});
