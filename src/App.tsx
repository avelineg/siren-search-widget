import React, { useState } from 'react'
import { useEtablissementData } from './hooks/useEtablissementData'
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
  const [siret, setSiret] = useState('')
  const [current, setCurrent] = useState(0)
  const { data, loading, error } = useEtablissementData(siret)

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      <header className="bg-white shadow p-4 flex items-center">
        <h1 className="text-2xl font-semibold flex-1">Annuaire Widget</h1>
        <input
          type="text"
          placeholder="SIREN ou SIRET"
          value={siret}
          onChange={e => setSiret(e.target.value)}
          className="border px-2 py-1 rounded mr-2"
        />
        <button
          onClick={() => setSiret(siret)}
          className="bg-blue-600 text-white px-4 py-1 rounded"
        >
          Rechercher
        </button>
      </header>
      <main className="p-4">
        {loading && <p>Chargement…</p>}
        {error && <p className="text-red-600">{error}</p>}
        {data && (
          <>
            <CompanyHeader {...data} />
            <Tabs labels={tabLabels} current={current} onChange={setCurrent} />
            <section className="mt-6 space-y-6">
              {current === 0 && <Identity data={data} />}
              {current === 1 && <Directors data={data} />}
              {current === 2 && <FinancialData data={data} />}
              {current === 3 && <Announcements data={data} />}
              {current === 4 && <LabelsCertifications data={data} />}
              {current === 5 && <Various data={data} />}
            </section>
          </>
        )}
      </main>
    </div>
  )
}
