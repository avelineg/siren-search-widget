import { useState, useEffect } from 'react'
import { fetchEtablissementData } from '../services/api'

export function useEtablissementData(siretOrSirename: string) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!siretOrSirename) return
    setLoading(true)
    setError(null)
    fetchEtablissementData(siretOrSirename)
      .then(res => setData(res))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [siretOrSirename])

  return { data, loading, error }
}
