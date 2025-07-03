import React, { useState } from "react";
import { useEtablissementData } from "./hooks/useEtablissementData";
import Tabs from "./components/Tabs";
import CompanyHeader from "./components/CompanyHeader";
import Identity from "./components/Identity";
import EtablissementsSelector from "./components/EtablissementsSelector";
import Dirigeants from "./components/Dirigeants";
import Finances from "./components/Finances";
import Labels from "./components/LabelsCertifications";
import Divers from "./components/Various";

const tabLabels = [
  "Identité",
  "Établissements",
  "Dirigeants",
  "Finances",
  "Labels",
  "Divers",
];

const isNonEmptyArray = arr => Array.isArray(arr) && arr.length > 0;

function App() {
  const [search, setSearch] = useState("");
  const [selectedSiret, setSelectedSiret] = useState("");
  const [tabIndex, setTabIndex] = useState(0);

  // Utilise le SIRET sélectionné si dispo, sinon la recherche globale
  const { data, loading, error } = useEtablissementData(selectedSiret || search);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!search || search.trim().length < 3) return;
    setSelectedSiret("");
    setTabIndex(0);
  };

  return (
    <div className="max-w-5xl mx-auto mt-5 p-4">
      <h1 className="text-2xl font-bold mb-6">Annuaire Widget</h1>
      <form
        className="flex items-center gap-3 mb-7"
        onSubmit={handleSearch}
        autoComplete="off"
      >
        <input
          type="text"
          placeholder="Recherche par SIREN/SIRET ou raison sociale"
          className="border p-2 rounded flex-1"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          disabled={!search || search.trim().length < 3}
        >
          Rechercher
        </button>
      </form>

      {error && <div className="text-red-600 mb-4">Erreur : {error.toString()}</div>}
      {loading && <div className="mb-4">Chargement...</div>}

      {data && (
        <div>
          <CompanyHeader {...data} />

          {/* Sélecteur d'établissements si plusieurs */}
          {isNonEmptyArray(data.etablissements) && (
            <EtablissementsSelector
              etablissements={data.etablissements}
              selected={selectedSiret}
              onSelect={setSelectedSiret}
            />
          )}

          <Tabs labels={tabLabels} current={tabIndex} onChange={setTabIndex} />

          <div className="mt-4">
            {tabIndex === 0 && <Identity data={data} />}
            {tabIndex === 1 && (
              <EtablissementsSelector
                etablissements={data.etablissements || []}
                selected={selectedSiret}
                onSelect={setSelectedSiret}
              />
            )}
            {tabIndex === 2 && (
              <Dirigeants dirigeants={data.dirigeants || []} />
            )}
            {tabIndex === 3 && (
              <Finances data={data} />
            )}
            {tabIndex === 4 && (
              <Labels data={data} />
            )}
            {tabIndex === 5 && <Divers data={data} />}
          </div>

          {/* Affichage du JSON brut INPI pour debug */}
          {data.inpiRaw && (
            <details
              className="mt-10 bg-gray-100 p-4 rounded text-xs overflow-auto"
              style={{ maxHeight: 400 }}
            >
              <summary className="font-semibold cursor-pointer">
                Détail brut de la requête INPI (JSON)
              </summary>
              <pre>{JSON.stringify(data.inpiRaw, null, 2)}</pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
