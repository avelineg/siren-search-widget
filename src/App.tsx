import React, { useState } from 'react'
import EtablissementOnglets from './components/EtablissementOnglets'
import { fetchEtablissementData } from './logic/mapping'
import { parseApiError } from './utils/error-handler'

export default function App() {
  const [input, setInput] = useState('')
  const [etabData, setEtabData] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setErreur(null)
    setEtabData(null)
    setLoading(true)
    try {
      const data = await fetchEtablissementData(input.trim())
      setEtabData(data)
    } catch (err: unknown) {
      setErreur(parseApiError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container">
      <h2 className="titre">🔍 Recherche (SIRET ou SIREN)</h2>
      <form className="controls" onSubmit={handleSearch}>
        <input
          className="input"
          placeholder="SIREN ou SIRET"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button className="btn" type="submit" disabled={loading || !input.trim()}>
          {loading ? '…' : 'Rechercher'}
        </button>
      </form>

      {loading && <div className="loading">Chargement…</div>}
      {erreur && <div className="error">{erreur}</div>}
      {!loading && etabData && <EtablissementOnglets etab={etabData} />}
    </div>
  )
}
