import { useCallback, useSyncExternalStore } from "react";

/**
 * User preferences that are not theme/language (those live in `settings.tsx`
 * because the whole document depends on them).
 *
 * The store is intentionally tiny and dependency-free: a single localStorage
 * record, an immutable snapshot and a subscriber list consumed through
 * `useSyncExternalStore`, so every surface (settings center, notifications,
 * assistant) reads exactly the same values and updates instantly.
 */

export interface Preferences {
  /** Notification routing preferences — which classes of alert reach me. */
  notifyCritical: boolean;
  notifyOps: boolean;
  notifyDocs: boolean;
  notifyDigest: boolean;
  /** Assistant behaviour. */
  assistantContext: boolean;
  assistantSuggestions: boolean;
  assistantAudit: boolean;
  /** Time & date display (§5) — never in the header, configured in settings. */
  timeFormat: "24" | "12";
  dateFormat: "iso" | "arabic";
  /** Last settings tab the user opened, restored on next visit. */
  lastSettingsTab: string;
}

export const DEFAULT_PREFERENCES: Preferences = {
  notifyCritical: true,
  notifyOps: true,
  notifyDocs: true,
  notifyDigest: false,
  assistantContext: true,
  assistantSuggestions: true,
  assistantAudit: true,
  timeFormat: "24",
  dateFormat: "iso",
  lastSettingsTab: "account",
};

const KEY = "ejaz-preferences";
const listeners = new Set<() => void>();
let snapshot: Preferences = load();

function load(): Preferences {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_PREFERENCES };
    const parsed = JSON.parse(raw) as Partial<Preferences>;
    return { ...DEFAULT_PREFERENCES, ...parsed };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

function emit() {
  listeners.forEach((l) => l());
}

export function getPreferences(): Preferences {
  return snapshot;
}

export function setPreference<K extends keyof Preferences>(key: K, value: Preferences[K]) {
  snapshot = { ...snapshot, [key]: value };
  try {
    localStorage.setItem(KEY, JSON.stringify(snapshot));
  } catch {
    /* ignore */
  }
  emit();
}

export function resetPreferences() {
  snapshot = { ...DEFAULT_PREFERENCES };
  try {
    localStorage.setItem(KEY, JSON.stringify(snapshot));
  } catch {
    /* ignore */
  }
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePreferences() {
  const prefs = useSyncExternalStore(subscribe, getPreferences, getPreferences);
  const set = useCallback(<K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    setPreference(key, value);
  }, []);
  const reset = useCallback(() => resetPreferences(), []);
  return { prefs, set, reset };
}
