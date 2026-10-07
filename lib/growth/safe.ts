// ===========================================================
// lib/growth/safe.ts — Guard rails for growth side effects on product paths.
//
// A growth write (contact sync, event, email) must never slow down or break a
// product request: feature previews run against a database that may not have
// the growth tables yet, and the engine is new. runAfter() defers the work
// until the response is sent and swallows every error. Logs carry the label
// and err.message only: never an email, a name or user text.
// ===========================================================

import { after } from "next/server";

export function logGrowthError(label: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[growth:${label}] ${message}`);
}

/**
 * Run `fn` after the response via next/server after(). Outside a request scope
 * (scripts, durable workflow steps) after() throws, so `fn` is started
 * immediately instead, fire-and-forget. Never throws.
 */
export function runAfter(label: string, fn: () => unknown): void {
  const task = async () => {
    try {
      await fn();
    } catch (err) {
      logGrowthError(label, err);
    }
  };
  try {
    after(task);
  } catch {
    void task();
  }
}

/** Await `fn`, returning `fallback` (and logging) instead of throwing. */
export async function safely<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    logGrowthError(label, err);
    return fallback;
  }
}

/** Prisma error code (P2002 unique violation, P2003 FK, P2021 missing table…), if any. */
export function prismaErrorCode(err: unknown): string | undefined {
  if (err && typeof err === "object" && "code" in err) {
    const code = (err as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

export function isUniqueViolation(err: unknown): boolean {
  return prismaErrorCode(err) === "P2002";
}
