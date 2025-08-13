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

// Fallback robuste pour toutes les formes d'entreprise (EI/personne morale)
function fallbackDisplayName(obj: any, parentName?: string): string {
  if (obj.nom_complet) return obj.nom_complet;
  if (obj.nom_raison_sociale) return obj.nom_raison_sociale;
  if (obj.denomination) return obj.denomination;
  if (obj.prenom && obj.nom) return [obj.prenom, obj.nom].filter(Boolean).join(" ").trim();
  if (
    obj.descriptionPersonne &&
    (obj.descriptionPersonne.prenoms || obj.descriptionPersonne.nom)
  ) {
    return [
      Array.isArray(obj.descriptionPersonne.prenoms)
        ? obj.descriptionPersonne.prenoms.join(" ")
        : obj.descriptionPersonne.prenoms,
      obj.descriptionPersonne.nom,
    ]
      .filter(Boolean)
      .join(" ")
      .trim();
  }
  if (
    obj.personne_physique &&
    obj.personne_physique.identite &&
    obj.personne_physique.identite.entrepreneur &&
    obj.personne_physique.identite.entrepreneur.descriptionPersonne
  ) {
    const desc = obj.personne_physique.identite.entrepreneur.descriptionPersonne;
    const prenoms = Array.isArray(desc.prenoms) ? desc.prenoms.join(" ") : desc.prenoms;
    return [prenoms, desc.nom].filter(Boolean).join(" ").trim();
  }
  return (
    obj.displayName ||
    obj.raison_sociale ||
    obj.nom ||
    obj.nom_commercial ||
    obj.siegeRaisonSociale ||
    ((obj.nom_usage || obj.nom)
      ? [obj.prenom, obj.nom_usage || obj.nom].filter(Boolean).join(" ")
      : null) ||
    parentName ||
    "(Établissement sans nom)"
  );
}

// Helper pour obtenir l'adresse d'un établissement
function getEtablissementAdresse(etab: any): string {
  if (etab.adresse) return etab.adresse;
  if (etab.adresseEtablissement) {
    const a = etab.adresseEtablissement;
    return [
      a.numeroVoieEtablissement,
      a.typeVoieEtablissement,
      a.libelleVoieEtablissement,
      a.codePostalEtablissement,
      a.libelleCommuneEtablissement,
    ]
      .filter(Boolean)
      .join(" ");
  }
  return (
    etab.libelle_commune ||
    etab.code_postal ||
    etab.codePostalEtablissement ||
    etab.ville ||
    ""
  );
}

function App() {
  const [search, setSearch] = useState("");
  const [selectedCode, setSelectedCode] = useState("");
  const [tabIndex, setTabIndex] = useState(0);
  const [openEtabs, setOpenEtabs] = useState<{ [siren: string]: boolean }>({});

  const { data, loading, error, results } = useEtablissementData(
    search,
    selectedCode
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSelectedCode("");
  };

  const handleSelectEtablissement = (siret: string) => {
    setSearch(siret);
    setSelectedCode(siret);
    setTabIndex(0);
  };

  const tabLabels = [
    "Identité",
    "Établissements",
    "Dirigeants",
    "Finances",
    "Divers",
  ];

  // Application du fallback sur les résultats et leurs établissements enfants
  const safeResults = Array.isArray(results)
    ? results.map((r) => {
        const legalName = fallbackDisplayName(r);
        return {
          ...r,
          displayName: legalName,
          matching_etablissements: Array.isArray(r.matching_etablissements)
            ? r.matching_etablissements.map((etab: any) => ({
                ...etab,
                displayName: fallbackDisplayName(etab, legalName),
              }))
            : [],
        };
      })
    : [];

  // Le SIRET à utiliser pour l'avis de situation SIRENE est celui de l'établissement affiché (ou sélectionné)
  const siretAffiche = data?.siret || selectedCode || data?.etablissements?.[0]?.siret;

  // Clé unique pour la recherche courante (SIREN principal)
  const searchKey = data?.siren || "";

  // Vue liste de résultats lorsqu'aucun établissement n'est sélectionné
  if (!selectedCode && safeResults.length > 0) {
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
            {safeResults.map((r: any, idx: number) => (
              <li key={idx} className="mb-6 flex flex-col gap-1 bg-white border rounded p-3 shadow-sm">
                <span style={{ fontWeight: "bold", fontSize: "1.1em" }}>
                  {r.displayName} — SIREN: {r.siren}
                  <span
                    className="ml-2 px-2 py-1 rounded text-xs"
                    style={{
                      background: r.statut === "ferme" ? "#fde8ea" : "#e6faea",
                      color: r.statut === "ferme" ? "#b71c1c" : "#208b42",
                      fontWeight: 600,
                      marginLeft: 8,
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
                </span>

                {Array.isArray(r.matching_etablissements) && r.matching_etablissements.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setOpenEtabs((prev) => ({
                        ...prev,
                        [r.siren]: !prev[r.siren],
                      }))
                    }
                    className="mt-2 mb-1 px-3 py-1 rounded border bg-gray-100 hover:bg-gray-200 text-sm self-start"
                  >
                    {openEtabs[r.siren]
                      ? "Cacher les établissements"
                      : `Afficher les établissements (${r.matching_etablissements.length})`}
                  </button>
                )}

                {openEtabs[r.siren] &&
                  Array.isArray(r.matching_etablissements) && (
                    <ul className="ml-4 mt-2 space-y-2">
                      {r.matching_etablissements.map((etab: any, eidx: number) => (
                        <li
                          key={eidx}
                          className="flex flex-wrap items-center gap-2 border-b pb-1"
                          style={{ alignItems: "flex-start" }}
                        >
                          <span style={{ fontWeight: "bold" }}>
                            {etab.displayName}
                          </span>
                          <span style={{ fontWeight: 400 }}>
                            — SIRET: {etab.siret}
                          </span>
                          <span className="text-xs text-gray-600 ml-1">
                            {getEtablissementAdresse(etab)
                              ? `— ${getEtablissementAdresse(etab)}`
                              : ""}
                          </span>
                          <span
                            className="px-2 py-1 rounded text-xs"
                            style={{
                              background:
                                etab.statut === "ferme"
                                  ? "#fde8ea"
                                  : "#e6faea",
                              color:
                                etab.statut === "ferme"
                                  ? "#b71c1c"
                                  : "#208b42",
                              fontWeight: 600,
                            }}
                            title={
                              etab.statut === "ferme"
                                ? "Établissement fermé"
                                : "Établissement actif"
                            }
                          >
                            {etab.statut === "ferme" ? "Fermé" : "Actif"}
                            {etab.statut === "ferme" &&
                              etab.date_fermeture && (
                                <span className="ml-1 text-xs text-gray-500">
                                  (le {formatDateFR(etab.date_fermeture)})
                                </span>
                              )}
                          </span>
                          <button
                            className="ml-2 px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs"
                            style={{ marginTop: 0 }}
                            onClick={() => setSelectedCode(etab.siret)}
                          >
                            Voir établissement
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                <button
                  className="mt-2 bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 text-sm self-start"
                  onClick={() => setSelectedCode(r.siren)}
                >
                  Voir la fiche
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  // Vue fiche entreprise
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

      {data && (
        <div>
          <CompanyHeader {...data} />

          {/* Bouton de téléchargement de l'avis de situation SIRENE */}
          {siretAffiche && (
            <div className="mb-4 mt-2">
              <a
                href={`https://api-avis-situation-sirene.insee.fr/identification/pdf/${siretAffiche}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <button
                  className="bg-gray-800 text-white px-4 py-2 rounded hover:bg-gray-900 flex items-center gap-2"
                  style={{ fontSize: "0.95em" }}
                  type="button"
                  title="Télécharger l'avis de situation INSEE (ouvre un PDF officiel)"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width={18} height={18}>
                    <path fillRule="evenodd" d="M9.25 2.75a.75.75 0 0 1 1.5 0v7.69l2.22-2.22a.75.75 0 1 1 1.06 1.06l-3.5 3.5a.75.75 0 0 1-1.06 0l-3.5-3.5a.75.75 0 1 1 1.06-1.06l2.22 2.22V2.75ZM3.75 15a.75.75 0 0 1 0-1.5h12.5a.75.75 0 0 1 0 1.5H3.75Z" clipRule="evenodd" />
                  </svg>
                  Télécharger l'avis de situation INSEE (PDF)
                </button>
              </a>
            </div>
          )}

          <div className="mb-4">
            <span
              className="px-2 py-1 rounded text-xs"
              style={{
                background: data.statut === "ferme" ? "#fde8ea" : "#e6faea",
                color: data.statut === "ferme" ? "#b71c1c" : "#208b42",
                fontWeight: 700,
                marginLeft: "0.5rem",
              }}
              title={
                data.statut === "ferme"
                  ? "Établissement fermé"
                  : "Établissement actif"
              }
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
              <EtablissementsSelector
                etablissements={data.etablissements || []}
                selected={selectedCode}
                onSelect={handleSelectEtablissement}
                legalUnitName={data.displayName}
                searchKey={searchKey}
              />
            )}
            {tabIndex === 2 && <Dirigeants dirigeants={data.dirigeants || []} />}
            {tabIndex === 3 && <Finances data={data} />}
            {tabIndex === 4 && <Divers data={data} />}
          </div>

          {/* Section JSON brut INPI - désactivée */}
          {/*
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
          */}
        </div>
      )}

      {!loading && !error && !data && (
        <div className="text-center text-gray-500 mt-8">
          Aucun résultat n'a été trouvé.
        </div>
      )}
    </div>
  );
}

export default App;
