// Stub for the `server-only` package under Vitest. Vitest/Vite resolves
// packages using the "browser" export condition even in `environment:
// "node"` tests, which would make every import of `server-only` throw its
// client-component guard error. Aliased in vitest.config.mts. Next.js's own
// bundler (webpack/Turbopack) does NOT go through this stub — it uses the
// real package, so the guard still works in the actual app.
export {};
