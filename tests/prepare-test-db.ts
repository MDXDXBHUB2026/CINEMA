/**
 * Provisions a fresh SQLite test database from the current Prisma schema.
 * Run automatically before `npm test` (see package.json "pretest"). Uses
 * `execSync` with an explicit env override so it works identically on
 * Windows/macOS/Linux shells (no `VAR=value cmd` shell syntax).
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const testDbPath = path.join(__dirname, "test.db");
for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  const file = testDbPath + suffix;
  if (fs.existsSync(file)) fs.rmSync(file);
}

const databaseUrl = `file:${testDbPath}`;

execSync("npx prisma db push --skip-generate --accept-data-loss", {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: databaseUrl },
});

console.log(`Test database ready at ${testDbPath}`);
