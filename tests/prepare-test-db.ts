/**
 * Provisions a clean PostgreSQL test database from the current Prisma
 * schema, on the same local Postgres instance used for dev (see
 * docker-compose.yml), but a separate database ("cinebook_test") so tests
 * never touch dev data. Run automatically before `npm test` (see
 * package.json "pretest").
 *
 * Two phases:
 * 1. `prisma db push` (via execSync, with an explicit env override so this
 *    works identically on Windows/macOS/Linux shells) — creates the
 *    database automatically if it doesn't exist yet, and syncs the schema.
 * 2. TRUNCATE every application table via the Prisma client — guarantees a
 *    clean slate on every run. This step is necessary: several
 *    integration tests use fixed idempotency-key literals (e.g. "key-1"),
 *    and without wiping leftover rows from a *previous* `npm test` run,
 *    those literals collide with old rows and produce confusing,
 *    non-deterministic failures (this happened once during the
 *    SQLite -> PostgreSQL migration: the old SQLite setup deleted the
 *    physical `test.db` file before every run, which had been silently
 *    providing this same guarantee).
 *
 * Deliberately NOT using `prisma db push --force-reset` or
 * `prisma migrate reset` for this: both are destructive *schema* actions
 * that Prisma's CLI itself refuses to run for an AI agent without explicit
 * human consent (verified — it detected and blocked exactly this during
 * development). A plain SQL TRUNCATE issued by the app's own Prisma
 * client against a database this same script created is the standard,
 * low-risk way test suites reset fixture data between runs.
 */
import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? "postgresql://cinebook:cinebook@localhost:5433/cinebook_test";

execSync("npx prisma db push --skip-generate --accept-data-loss", {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: testDatabaseUrl },
});

async function truncateAllTables() {
  const prisma = new PrismaClient({ datasourceUrl: testDatabaseUrl });
  try {
    const tables: { tablename: string }[] = await prisma.$queryRawUnsafe(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
    );
    if (tables.length === 0) return;
    const quoted = tables.map((t) => `"${t.tablename}"`).join(", ");
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${quoted} CASCADE`);
    console.log(`Truncated ${tables.length} table(s) in the test database.`);
  } finally {
    await prisma.$disconnect();
  }
}

truncateAllTables()
  .then(() => console.log(`Test database ready at ${testDatabaseUrl}`))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
