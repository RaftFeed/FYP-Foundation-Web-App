import { useEffect, useState } from 'react';

interface CachedEntry<T> {
  savedAt: number;
  value: T;
}

const memoryCache = new Map<string, CachedEntry<unknown>>();

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readStorage<T>(key: string): T | null {
  if (!canUseStorage()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeStorage<T>(key: string, value: T) {
  if (!canUseStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota and serialization errors.
  }
}

export function usePersistentState<T>(key: string | null, fallback: T) {
  const [value, setValue] = useState<T>(() => {
    if (!key) {
      return fallback;
    }

    const stored = readStorage<T>(key);
    return stored ?? fallback;
  });

  useEffect(() => {
    if (!key) {
      setValue(fallback);
      return;
    }

    const stored = readStorage<T>(key);
    setValue(stored ?? fallback);
  }, [fallback, key]);

  useEffect(() => {
    if (!key) {
      return;
    }

    writeStorage(key, value);
  }, [key, value]);

  return [value, setValue] as const;
}

export function readLocalCache<T>(key: string, maxAgeMs = 15 * 60 * 1000) {
  const memoryEntry = memoryCache.get(key) as CachedEntry<T> | undefined;
  if (memoryEntry && Date.now() - memoryEntry.savedAt <= maxAgeMs) {
    return memoryEntry.value;
  }

  const stored = readStorage<CachedEntry<T>>(`cache:${key}`);
  if (!stored) {
    return null;
  }

  if (Date.now() - stored.savedAt > maxAgeMs) {
    return null;
  }

  memoryCache.set(key, stored);
  return stored.value;
}

export function writeLocalCache<T>(key: string, value: T) {
  const entry: CachedEntry<T> = {
    savedAt: Date.now(),
    value,
  };

  memoryCache.set(key, entry);
  writeStorage(`cache:${key}`, entry);
}
