import { useState } from "react";
import { useEtablissementData } from "./hooks/useEtablissementData";
import CompanyHeader from "./components/CompanyHeader";
import Tabs from "./components/Tabs";
import Identity from "./components/Identity";
import EtablissementsSelector from "./components/EtablissementsSelector";
import Dirigeants from "./components/Dirigeants";
import Finances from "./components/Finances";
import Divers from "./components/Divers";
import { formatDateFR } from "./services/mapping";
import "leaflet/dist/leaflet.css";
import EtablissementsListPaginee from "./components/EtablissementsListPaginee"; // <-- AJOUT

function App() {
  const [search, setSearch] = useState("");
  const [selectedCode, setSelectedCode] = useState("");
  const [tabIndex, setTabIndex] = useState(0);

  const { data, loading, error, results } = useEtablissementData(
    search,
    selectedCode
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSelectedCode("");
  };

  // Gère la navigation SIRET depuis la liste paginée
  const handleSelectEtablissement = (siret: string) => {
    setSearch(siret);
    setSelectedCode(siret);
    setTabIndex(0); // Revenir à l’onglet Identité
  };

  const tabLabels = [
    "Identité",
    "Établissements",
    "Dirigeants",
    "Finances",
    "Divers",
  ];

  if (!selectedCode && results && results.length > 0) {
    return (
      <div className="max-w-5xl mx-auto mt-5 p-4">
        <h1 className="text-2xl font-bold mb-6">Recherche d'entreprises</h1>
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

        {error && (
          <div className="text-red-600 mb-4">Erreur : {error.toString()}</div>
        )}
        {loading && <div className="mb-4">Chargement...</div>}

        <div>
          <ul>
            {results.map((r, idx) => (
              <li key={idx} className="mb-2 flex items-center">
                <span>
                  {r.displayName || "(Sans nom)"} — SIREN: {r.siren}
                </span>
                <span
                  className="ml-2 px-2 py-1 rounded text-xs"
                  style={{
                    background: r.statut === "ferme" ? "#fde8ea" : "#e6faea",
                    color: r.statut === "ferme" ? "#b71c1c" : "#208b42",
                    fontWeight: 600,
                  }}
                  title={r.statut === "ferme" ? "Établissement fermé" : "Établissement actif"}
                >
                  {r.statut === "ferme" ? "Fermé" : "Actif"}
                  {r.statut === "ferme" && r.date_fermeture && (
                    <span className="ml-1 text-xs text-gray-500">
                      (le {formatDateFR(r.date_fermeture)})
                    </span>
                  )}
                </span>
                <button
                  className="ml-4 bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 text-sm"
                  onClick={() => setSelectedCode(r.siren)}
                >
                  Voir la fiche
                </button>
                {Array.isArray(r.matching_etablissements) &&
                  r.matching_etablissements.length > 0 && (
                    <ul className="ml-8 mt-1">
                      {r.matching_etablissements.map((etab: any, eidx: number) => (
                        <li key={eidx}>
                          <span>
                            {etab.displayName ||
                              etab.denomination ||
                              etab.nom_raison_sociale ||
                              etab.name ||
                              etab.raison_sociale ||
                              etab.nom_commercial ||
                              "(\u00c9tablissement sans nom)"}{" "}
                            — SIRET: {etab.siret}
                            <span
                              className="ml-2 px-2 py-1 rounded text-xs"
                              style={{
                                background: etab.statut === "ferme" ? "#fde8ea" : "#e6faea",
                                color: etab.statut === "ferme" ? "#b71c1c" : "#208b42",
                                fontWeight: 600,
                              }}
                              title={
                                etab.statut === "ferme"
                                  ? "Établissement fermé"
                                  : "Établissement actif"
                              }
                            >
                              {etab.statut === "ferme" ? "Fermé" : "Actif"}
                              {etab.statut === "ferme" && etab.date_fermeture && (
                                <span className="ml-1 text-xs text-gray-500">
                                  (le {formatDateFR(etab.date_fermeture)})
                                </span>
                              )}
                            </span>
                          </span>
                          <button
                            className="ml-2 bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 text-xs"
                            onClick={() => setSelectedCode(etab.siret)}
                          >
                            Voir établissement
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto mt-5 p-4">
      <h1 className="text-2xl font-bold mb-6">Recherche entreprises</h1>
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
          {/* Affichage de l'indicateur actif/fermé dans l'en-tête */}
          <div className="mb-4">
            <span
              className="px-2 py-1 rounded text-xs"
              style={{
                background: data.statut === "ferme" ? "#fde8ea" : "#e6faea",
                color: data.statut === "ferme" ? "#b71c1c" : "#208b42",
                fontWeight: 700,
                marginLeft: "0.5rem",
              }}
              title={data.statut === "ferme" ? "Établissement fermé" : "Établissement actif"}
            >
              {data.statut === "ferme" ? "Fermé" : "Actif"}
              {data.statut === "ferme" && data.date_fermeture && (
                <span className="ml-1 text-xs text-gray-500">
                  (le {formatDateFR(data.date_fermeture)})
                </span>
              )}
            </span>
          </div>

          <Tabs labels={tabLabels} current={tabIndex} onChange={setTabIndex} />

          <div className="mt-4">
            {tabIndex === 0 && <Identity data={data} />}
            {tabIndex === 1 && (
              <>
                <EtablissementsSelector
                  etablissements={data.etablissements || []}
                  selected={selectedCode}
                  onSelect={setSelectedCode}
                />
                {/* ===== AJOUT DE LA LISTE PAGINÉE ===== */}
                {data.siren && (
                  <EtablissementsListPaginee
                    siren={data.siren}
                    onSelectEtablissement={handleSelectEtablissement}
                  />
                )}
              </>
            )}
            {tabIndex === 2 && <Dirigeants dirigeants={data.dirigeants || []} />}
            {tabIndex === 3 && <Finances data={data} />}
            {tabIndex === 4 && <Divers data={data} />}
          </div>

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
