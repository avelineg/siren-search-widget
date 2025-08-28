import { useState, useEffect } from "react";
import {
  searchEtablissementsByName,
  fetchEtablissementByCode,
} from "../services/mapping";

/**
 * Hook : recherche par nom = API rapide, fiche détaillée = mapping complet.
 */
export function useEtablissementData(query: string, selectedCode: string = "") {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<any[]>([]);

  useEffect(() => {
    setError(null);
    setData(null);
    setResults([]);
    if (!query || query.length < 3) return;
    setLoading(true);

    const isSiret = /^\d{14}$/.test(query);
    const isSiren = /^\d{9}$/.test(query);

    if (isSiret || isSiren) {
      fetchEtablissementByCode(query)
        .then(res => {
          setData(res);
          setResults([]);
        })
        .catch(err => setError(err.message))
        .finally(() => setLoading(false));
    } else {
      searchEtablissementsByName(query)
        .then(list => {
          setResults(list || []);
          setData(null);
        })
        .catch(err => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [query]);

  useEffect(() => {
    if (selectedCode && (selectedCode.length === 9 || selectedCode.length === 14)) {
      setLoading(true);
      setError(null);
      setData(null);
      fetchEtablissementByCode(selectedCode)
        .then(res => setData(res))
        .catch(err => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [selectedCode]);

  return { data, loading, error, results };
}
