import React, { useState } from 'react'
import { useEtablissementData } from './hooks/useEtablissementData'
import { searchEtablissementsByName } from './services/mapping'
import Tabs from './components/Tabs'
import CompanyHeader from './components/CompanyHeader'
import Identity from './components/Identity'
import Directors from './components/Directors'
import FinancialData from './components/FinancialData'
import LabelsCertifications from './components/LabelsCertifications'
import Various from './components/Various'

const tabLabels = [
  'Identité',
  'Dirigeants',
  'Données financières',
  'Annonces',
  'Labels & cert.',
  'Divers'
]

export default function App() {
  // input libre (SIREN/SIRET ou raison sociale)
  const [input, setInput] = useState('')
  // siren sélectionné pour lookup
  const [selectedSiren, setSelectedSiren] = useState('')
  // suggestions issues de la recherche par nom
  const [suggestions, setSuggestions] = useState<
    Array<{ siren: string; nom_complet: string; nom_raison_sociale?: string }>
  >([])

  // hook pour charger les données d'établissement
  const { data, loading, error } = useEtablissementData(selectedSiren)

  // gérer la recherche au clic
  async function onSearch() {
    setSuggestions([])
    setSelectedSiren('')
    if (/^\d{9,14}$/.test(input)) {
      // lookup direct SIREN ou SIRET
      // on passe le code complet => le hook découpe le siren
      setSelectedSiren(input)
    } else if (input.trim().length > 0) {
      try {
        const res = await searchEtablissementsByName(input.trim(), 1, 5)
        setSuggestions(res)
      } catch (err) {
        console.error('Erreur recherche par nom:', err)
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      <header className="bg-white shadow p-4 flex items-center">
        <h1 className="text-2xl font-semibold flex-1">Annuaire Widget</h1>
        <input
          type="text"
          placeholder="SIREN/SIRET ou raison sociale"
          value={input}
          onChange={e => setInput(e.target.value)}
          className="border px-2 py-1 rounded mr-2 flex-1"
        />
        <button
          onClick={onSearch}
          className="bg-blue-600 text-white px-4 py-1 rounded"
        >
          Rechercher
        </button>
      </header>

      <main className="p-4">
        {/* suggestions si recherche par nom */}
        {suggestions.length > 0 && (
          <ul className="border rounded p-2 bg-white space-y-1">
            {suggestions.map(s => (
              <li
                key={s.siren}
                className="cursor-pointer hover:bg-gray-100 p-2"
                onClick={() => {
                  setSelectedSiren(s.siren)
                  setSuggestions([])
                }}
              >
                {s.nom_raison_sociale || s.nom_complet} ({s.siren})
              </li>
            ))}
          </ul>
        )}

        {loading && <p>Chargement…</p>}
        {error && <p className="text-red-600">{error}</p>}

        {data && (
          <>
            <CompanyHeader {...data} />
            <Tabs labels={tabLabels} current={0} onChange={() => {}} />
            <section className="mt-6 space-y-6">
              <Identity data={data} />
              <Directors data={data} />
              <FinancialData data={data} />
              <Various data={data} />
              <LabelsCertifications data={data} />
            </section>
          </>
        )}
      </main>
    </div>
  )
}
