import { useCallback, useEffect, useState } from "react";

/**
 * A two-value preference saved in localStorage. Starts at the first value so server
 * and client render the same markup, then restores the saved value after mount.
 */
export function usePersistedToggle<T extends string>(
  storageKey: string,
  values: readonly [T, T]
): [T, () => void] {
  const [first, second] = values;
  const [value, setValue] = useState<T>(first);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved === first || saved === second) setValue(saved as T);
    } catch (error) {
      console.error(`[LISTENING VIEW] Error reading ${storageKey}:`, error);
    }
  }, [storageKey, first, second]);

  const toggle = useCallback(() => {
    setValue((prev) => {
      const next = prev === first ? second : first;
      try {
        localStorage.setItem(storageKey, next);
      } catch (error) {
        console.error(`[LISTENING VIEW] Error saving ${storageKey}:`, error);
      }
      return next;
    });
  }, [storageKey, first, second]);

  return [value, toggle];
}
