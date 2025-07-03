import { useState, useEffect } from "react";
import {
  fetchEtablissementByCode,
  searchEtablissementsByName,
} from "../services/mapping";

/**
 * Hook optimisé : pour la recherche par nom (pas SIREN/SIRET), ne fait que searchEtablissementsByName (API rapide).
 * Pour fiche détaillée (SIREN/SIRET), lance le mapping complet (INPI/SIRENE/VIES).
 * N'appelle pas les APIs lentes inutilement lors d'une simple recherche par nom !
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

    // Détection SIREN/SIRET
    const isSiret = /^\d{14}$/.test(query);
    const isSiren = /^\d{9}$/.test(query);

    if (isSiret || isSiren) {
      // Fiche détaillée : mapping complet (INPI/SIRENE/etc.)
      fetchEtablissementByCode(query)
        .then((res) => {
          setData(res);
        })
        .catch((err) => {
          setError(err.message);
        })
        .finally(() => setLoading(false));
    } else {
      // Recherche par nom : UNIQUEMENT searchEtablissementsByName (pas de mapping complexe ici !)
      searchEtablissementsByName(query)
        .then((list) => {
          setResults(list);
        })
        .catch((err) => {
          setError(err.message);
        })
        .finally(() => setLoading(false));
    }
  }, [query]);

  useEffect(() => {
    // Sélection fiche : mapping complet
    if (selectedCode && (selectedCode.length === 9 || selectedCode.length === 14)) {
      setLoading(true);
      setError(null);
      setData(null);
      fetchEtablissementByCode(selectedCode)
        .then((res) => {
          setData(res);
        })
        .catch((err) => {
          setError(err.message);
        })
        .finally(() => setLoading(false));
    }
  }, [selectedCode]);

  return { data, loading, error, results };
}
