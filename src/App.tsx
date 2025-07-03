import React, { useState, useEffect } from 'react'
import { useEtablissementData } from './hooks/useEtablissementData'
import { searchEtablissementsByName } from './services/mapping'
import Tabs from './components/Tabs'
import CompanyHeader from './components/CompanyHeader'
import Identity from './components/Identity'
import Directors from './components/Directors'
import FinancialData from './components/FinancialData'
import Announcements from './components/Announcements'
import LabelsCertifications from './components/LabelsCertifications'
import Various from './components/Various'
import Etablissements from './components/Etablissements'
import EtablissementsSelector from './components/EtablissementsSelector'

export default function App() {
  const [input, setInput] = useState('')
  const [selected, setSelected] = useState('')
  const [suggestions, setSuggestions] = useState<
    { siren: string; nom_complet: string; nom_raison_sociale?: string }[]
  >([])
  const [tab, setTab] = useState(0)
  const [selectedEtabSiret, setSelectedEtabSiret] = useState('')

  const { data, loading, error } = useEtablissementData(selected)

  async function onSearch() {
    setSuggestions([])
    setSelected('')
    setSelectedEtabSiret('')
    if (/^\d{9,14}$/.test(input)) {
      setSelected(input)
    } else if (input.trim()) {
      try {
        const res = await searchEtablissementsByName(input.trim(), 1, 5)
        setSuggestions(res)
      } catch (e) {
        console.error(e)
      }
    }
  }

  // Quand une suggestion est cliquée, on recherche par SIREN
  function handleSuggestion(siren: string) {
    setSelected(siren)
    setSuggestions([])
    setSelectedEtabSiret('')
  }

  // Établissements du résultat (si dispo)
  const etablissements = data?.etablissements || []
  const selectedEtab =
    etablissements.find(e => e.siret === selectedEtabSiret) ||
    etablissements[0] ||
    {}

  // Si aucun établissement n'est sélectionné, sélectionner le premier automatiquement
  useEffect(() => {
    if (etablissements.length && !selectedEtabSiret) {
      setSelectedEtabSiret(etablissements[0].siret)
    }
  }, [etablissements, selectedEtabSiret])

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
        <button onClick={onSearch} className="bg-blue-600 text-white px-4 py-1 rounded">
          Rechercher
        </button>
      </header>
      <main className="p-4">
        {suggestions.length > 0 && (
          <ul className="bg-white border rounded p-2 space-y-1 mb-4">
            {suggestions.map(s => (
              <li
                key={s.siren}
                onClick={() => handleSuggestion(s.siren)}
                className="cursor-pointer hover:bg-gray-100 p-2"
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
            <CompanyHeader
              denomination={data.denomination}
              siren={data.siren}
              siret={selectedEtab?.siret || data.siret}
              tva={data.tva}
              code_ape={data.code_ape}
              capital_social={data.capital_social}
            />
            {etablissements.length > 1 && (
              <EtablissementsSelector
                etablissements={etablissements.map(e => ({
                  siret: e.siret,
                  adresse: e.adresse
                }))}
                selected={selectedEtabSiret}
                onSelect={setSelectedEtabSiret}
              />
            )}
            <Tabs
              labels={[
                'Identité',
                'Établissements',
                'Dirigeants',
                'Finances',
                'Annonces',
                'Labels',
                'Divers'
              ]}
              current={tab}
              onChange={setTab}
            />
            <section className="mt-6 space-y-6">
              {tab === 0 && <Identity data={{ ...data, ...selectedEtab }} />}
              {tab === 1 && <Etablissements etablissements={etablissements} />}
              {tab === 2 && <Directors dirigeants={data.dirigeants} />}
              {tab === 3 && <FinancialData data={data} />}
              {tab === 4 && <Announcements data={data} />}
              {tab === 5 && <LabelsCertifications data={data} />}
              {tab === 6 && <Various data={data} />}
            </section>
          </>
        )}
      </main>
    </div>
  )
}
