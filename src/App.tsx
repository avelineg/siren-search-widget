import React, { useState } from "react";
import { useEtablissementData } from "./hooks/useEtablissementData";
import Tabs from "./components/Tabs";
import CompanyHeader from "./components/CompanyHeader";
import Identity from "./components/Identity";
import EtablissementsSelector from "./components/EtablissementsSelector";
import Dirigeants from "./components/Dirigeants";
import Finances from "./components/Finances";
import Annonces from "./components/Annonces";
import Labels from "./components/Labels";
import Divers from "./components/Divers";

function App() {
  const [search, setSearch] = useState("");
  const [selectedSiret, setSelectedSiret] = useState("");
  const [activeTab, setActiveTab] = useState("Identité");
  const { data, loading, error } = useEtablissementData(search, selectedSiret);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSelectedSiret("");
    setActiveTab("Identité");
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
        >
          Rechercher
        </button>
      </form>

      {error && (
        <div className="text-red-600 mb-4">Erreur : {error.toString()}</div>
      )}
      {loading && <div className="mb-4">Chargement...</div>}

      {data && (
        <div>
          <CompanyHeader data={data} />

          {/* Sélecteur d'établissements si plusieurs */}
          {data.etablissements && data.etablissements.length > 1 && (
            <EtablissementsSelector
              etablissements={data.etablissements}
              selected={selectedSiret}
              onSelect={setSelectedSiret}
            />
          )}

          <Tabs
            tabs={[
              "Identité",
              "Établissements",
              "Dirigeants",
              "Finances",
              "Annonces",
              "Labels",
              "Divers",
            ]}
            activeTab={activeTab}
            onTabClick={setActiveTab}
          />

          <div className="mt-4">
            {activeTab === "Identité" && <Identity data={data} />}
            {activeTab === "Établissements" && (
              <EtablissementsSelector
                etablissements={data.etablissements}
                selected={selectedSiret}
                onSelect={setSelectedSiret}
              />
            )}
            {activeTab === "Dirigeants" && (
              <Dirigeants dirigeants={data.dirigeants} />
            )}
            {activeTab === "Finances" && <Finances finances={data.finances} />}
            {activeTab === "Annonces" && <Annonces annonces={data.annonces} />}
            {activeTab === "Labels" && <Labels labels={data.labels} />}
            {activeTab === "Divers" && <Divers data={data} />}
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
