import React, { useState } from 'react'
import Tabs from './components/Tabs'

const tabLabels = [
  'Identité',
  'Dirigeants',
  'Données financières',
  'Annonces',
  'Labels & certificats',
  'Divers'
]

function App() {
  const [current, setCurrent] = useState(0)
  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      <header className="bg-white shadow p-4">
        <h1 className="text-2xl font-semibold">
          Recherche (SIREN ou SIRET)
        </h1>
      </header>
      <main className="p-4">
        <Tabs
          labels={tabLabels}
          current={current}
          onChange={setCurrent}
        />
        <section className="mt-6">
          {/* TODO: injecter ici le contenu des données selon l'onglet */}
          <p>Contenu de l’onglet : <strong>{tabLabels[current]}</strong></p>
        </section>
      </main>
    </div>
  )
}

export default App
