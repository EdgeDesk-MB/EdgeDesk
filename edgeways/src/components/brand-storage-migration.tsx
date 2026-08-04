"use client";

/**
 * One-time browser-storage adoption for the EdgeDesk → Edgeways rename
 * (2026-08). Every persisted key kept its shape and only swapped prefix
 * ("edgedesk:*" → "edgeways:*", same for -, _ and . separators), so alert
 * dedupe, onboarding state and view preferences carry over instead of
 * re-firing. Runs at module load, before any component reads storage.
 */
function migrateStore(store: Storage): void {
  const renames: Array<[string, string]> = [];
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i);
    if (key && key.startsWith("edgedesk")) {
      renames.push([key, `edgeways${key.slice("edgedesk".length)}`]);
    }
  }
  for (const [oldKey, newKey] of renames) {
    if (store.getItem(newKey) == null) {
      const value = store.getItem(oldKey);
      if (value != null) store.setItem(newKey, value);
    }
    store.removeItem(oldKey);
  }
}

if (typeof window !== "undefined") {
  try {
    migrateStore(window.localStorage);
    migrateStore(window.sessionStorage);
  } catch {
    // Storage unavailable (private mode / blocked) - nothing to migrate.
  }
}

export function BrandStorageMigration() {
  return null;
}
