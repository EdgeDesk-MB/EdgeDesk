/**
 * Vitest stand-in for the `server-only` guard package, which throws when
 * imported outside a React Server Component build. Tests run in plain Node,
 * so the guard must be a no-op here (aliased in vitest.config.ts).
 */
export {};
