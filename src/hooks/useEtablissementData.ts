import { useState, useEffect } from 'react'
import { fetchEtablissementByCode, searchEtablissementsByName } from '../services/mapping'

export function useEtablissementData(query: string, selectedSiret: string = '') {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<any[]>([])

  useEffect(() => {
    if (!query || query.length < 3) return
    setLoading(true)
    setError(null)
    setData(null)
    setResults([])
    const isSiret = /^\d{14}$/.test(query)
    const isSiren = /^\d{9}$/.test(query)
    if (isSiret || isSiren) {
      fetchEtablissementByCode(query)
        .then(res => setData(res))
        .catch(err => setError(err.message))
        .finally(() => setLoading(false))
    } else {
      // Recherche par nom
      searchEtablissementsByName(query)
        .then(list => {
          setResults(list)
          setLoading(false)
        })
        .catch(err => {
          setError(err.message)
          setLoading(false)
        })
    }
  }, [query])

  useEffect(() => {
    if (selectedSiret) {
      setLoading(true)
      setError(null)
      setData(null)
      fetchEtablissementByCode(selectedSiret)
        .then(res => setData(res))
        .catch(err => setError(err.message))
        .finally(() => setLoading(false))
    }
  }, [selectedSiret])

  return { data, loading, error, results }
}
