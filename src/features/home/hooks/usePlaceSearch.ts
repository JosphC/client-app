import { useEffect, useState } from 'react';
import { searchAllPlaces, searchLocalPlaces, type LocationPlace } from '../../map';

/**
 * Autocomplete stații + locuri: rezultate locale imediat (≥2 caractere), apoi
 * căutarea completă cu debounce de 350 ms (≥3 caractere), anulată la tastare.
 */
export function usePlaceSearch(query: string): LocationPlace[] {
  const [results, setResults] = useState<LocationPlace[]>([]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setResults(searchLocalPlaces(q));
    if (q.length < 3) return;

    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      void searchAllPlaces(q, ctrl.signal).then((all) => {
        if (!ctrl.signal.aborted && all.length > 0) setResults(all);
      });
    }, 350);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query]);

  return results;
}
