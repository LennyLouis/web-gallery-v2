import { useEffect, useRef } from 'react';

export function useDebounce(callback: () => void, delay: number, deps: any[] = []) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Nettoyer le timeout précédent
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Créer un nouveau timeout
    timeoutRef.current = setTimeout(callback, delay);

    // Cleanup
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, deps);

  // Cleanup au démontage
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
}

export function useWindowFocus(callback: () => void, debounceMs = 1000) {
  const lastFocusRef = useRef(0);

  useEffect(() => {
    const handleFocus = () => {
      const now = Date.now();
      if (now - lastFocusRef.current > debounceMs) {
        lastFocusRef.current = now;
        callback();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [callback, debounceMs]);
}