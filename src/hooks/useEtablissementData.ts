import { useState, useEffect } from 'react'
import { fetchEtablissementByCode, searchEtablissementsByName } from '../services/mapping'

export function useEtablissementData(query: string, selectedCode: string = '') {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<any[]>([])

  useEffect(() => {
    setError(null)
    setData(null)
    setResults([])
    if (!query || query.length < 3) return
    setLoading(true)
    console.log("[useEtablissementData] Recherche lancée, query:", query)
    const isSiret = /^\d{14}$/.test(query)
    const isSiren = /^\d{9}$/.test(query)
    if (isSiret || isSiren) {
      fetchEtablissementByCode(query)
        .then(res => {
          console.log("[useEtablissementData] Résultat fetchEtablissementByCode:", res)
          setData(res)
        })
        .catch(err => {
          console.error("[useEtablissementData] Erreur fetchEtablissementByCode:", err)
          setError(err.message)
        })
        .finally(() => setLoading(false))
    } else {
      searchEtablissementsByName(query)
        .then(list => {
          console.log("[useEtablissementData] Résultat searchEtablissementsByName:", list)
          setResults(list)
          setLoading(false)
        })
        .catch(err => {
          console.error("[useEtablissementData] Erreur searchEtablissementsByName:", err)
          setError(err.message)
          setLoading(false)
        })
    }
  }, [query])

  useEffect(() => {
    if (selectedCode && (selectedCode.length === 9 || selectedCode.length === 14)) {
      setLoading(true)
      setError(null)
      setData(null)
      console.log("[useEtablissementData] Recherche détaillée, selectedCode:", selectedCode)
      fetchEtablissementByCode(selectedCode)
        .then(res => {
          console.log("[useEtablissementData] Résultat fetchEtablissementByCode (selectedCode):", res)
          setData(res)
        })
        .catch(err => {
          console.error("[useEtablissementData] Erreur fetchEtablissementByCode (selectedCode):", err)
          setError(err.message)
        })
        .finally(() => setLoading(false))
    }
  }, [selectedCode])

  return { data, loading, error, results }
}
