import { useState, useEffect } from 'react'
import { fetchEtablissementData } from '../services/api'

export function useEtablissementData(siret: string) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!siret) return
    setLoading(true)
    fetchEtablissementData(siret)
      .then(res => setData(res))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [siret])

  return { data, loading, error }
}
