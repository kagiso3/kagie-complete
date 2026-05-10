import { useCallback, useRef, useState } from "react";

export function useActionLock() {
  const locksRef = useRef(new Set<string>());
  const [busyMap, setBusyMap] = useState<Record<string, boolean>>({});

  const run = useCallback(async <T,>(key: string, task: () => Promise<T>) => {
    if (locksRef.current.has(key)) return undefined;
    locksRef.current.add(key);
    setBusyMap((current) => ({ ...current, [key]: true }));
    try {
      return await task();
    } finally {
      locksRef.current.delete(key);
      setBusyMap((current) => {
        if (!current[key]) return current;
        const next = { ...current };
        delete next[key];
        return next;
      });
    }
  }, []);

  const isBusy = useCallback((key: string) => Boolean(busyMap[key]), [busyMap]);

  return {
    run,
    isBusy,
    busyMap
  };
}
