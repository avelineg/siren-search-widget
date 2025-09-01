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

/* ===== Helpers d’affichage ===== */
function fallbackDisplayName(obj: any, parentName?: string): string {
  if (obj.nom_complet) return obj.nom_complet;
  if (obj.nom_raison_sociale) return obj.nom_raison_sociale;
  if (obj.denomination) return obj.denomination;
  if (obj.prenom && obj.nom) return [obj.prenom, obj.nom].filter(Boolean).join(" ").trim();
  if (obj.descriptionPersonne && (obj.descriptionPersonne.prenoms || obj.descriptionPersonne.nom)) {
    return [
      Array.isArray(obj.descriptionPersonne.prenoms) ? obj.descriptionPersonne.prenoms.join(" ") : obj.descriptionPersonne.prenoms,
      obj.descriptionPersonne.nom,
    ].filter(Boolean).join(" ").trim();
  }
  if (obj.personne_physique?.identite?.entrepreneur?.descriptionPersonne) {
    const desc = obj.personne_physique.identite.entrepreneur.descriptionPersonne;
    const prenoms = Array.isArray(desc.prenoms) ? desc.prenoms.join(" ") : desc.prenoms;
    return [prenoms, desc.nom].filter(Boolean).join(" ").trim();
  }
  return (
    obj.displayName ||
    obj.raison_sociale || obj.nom || obj.nom_commercial || obj.siegeRaisonSociale ||
    ((obj.nom_usage || obj.nom) ? [obj.prenom, obj.nom_usage || obj.nom].filter(Boolean).join(" ") : null) ||
    parentName || "(Établissement sans nom)"
  );
}

function getEtablissementAdresse(etab: any): string {
  if (etab.adresse) return etab.adresse;
  if (etab.adresseEtablissement) {
    const a = etab.adresseEtablissement;
    return [a.numeroVoieEtablissement, a.typeVoieEtablissement, a.libelleVoieEtablissement, a.codePostalEtablissement, a.libelleCommuneEtablissement]
      .filter(Boolean).join(" ");
  }
  return etab.libelle_commune || etab.code_postal || etab.codePostalEtablissement || etab.ville || "";
}

/* ===== App principale avec esthétique CMExpert (wrap/frame/btn) ===== */
export default function App() {
  const [search, setSearch] = useState("");
  const [selectedCode, setSelectedCode] = useState("");
  const [tabIndex, setTabIndex] = useState(0);
  const [openEtabs, setOpenEtabs] = useState<{ [siren: string]: boolean }>({});

  const { data, loading, error, results } = useEtablissementData(search, selectedCode);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setSelectedCode(""); };
  const handleSelectEtablissement = (siret: string) => { setSearch(siret); setSelectedCode(siret); setTabIndex(0); };

  const tabLabels = ["Identité", "Établissements", "Dirigeants", "Finances", "Divers"];

  const safeResults = Array.isArray(results)
    ? results.map((r) => {
        const legalName = fallbackDisplayName(r);
        return {
          ...r,
          displayName: legalName,
          matching_etablissements: Array.isArray(r.matching_etablissements)
            ? r.matching_etablissements.map((etab: any) => ({ ...etab, displayName: fallbackDisplayName(etab, legalName) }))
            : [],
        };
      })
    : [];

  const siretAffiche = data?.siret || selectedCode || data?.etablissements?.[0]?.siret;
  const searchKey = data?.siren || "";

  /* ---- Layout ---- */
  return (
    <div className="wrap">
      <section className="frame">
         <h1 className="m-0 mb-4 text-[22px] font-bold text-[var(--cm-accent)]">
           Recherche d'entreprises
        </h1>

        <form className="flex items-center gap-3 mb-5" onSubmit={handleSearch} autoComplete="off">
          <input
            type="text"
            placeholder="Recherche par SIREN/SIRET ou raison sociale"
            className="border p-2 rounded flex-1"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" className="btn" disabled={!search || search.trim().length < 3}>
            Rechercher
          </button>
        </form>

        {error && <div className="text-[#b00020] mb-4">Erreur : {error.toString()}</div>}
        {loading && <div className="mb-4">Chargement...</div>}

        {/* Liste de résultats */}
        {!selectedCode && safeResults.length > 0 && (
          <ul>
            {safeResults.map((r: any, idx: number) => (
              <li key={idx} className="mb-6 flex flex-col gap-2 bg-[var(--cm-soft)] border border-[var(--cm-border)] rounded-lg p-3 shadow-card max-w-card mx-auto">
                <span className="font-bold text-[17px] text-[var(--cm-accent)]">
                  {r.displayName} — SIREN: {r.siren}
                  <span
                    className="ml-2 px-2 py-1 rounded text-xs"
                    style={{
                      background: r.statut === "ferme" ? "#fde8ea" : "#e6faea",
                      color: r.statut === "ferme" ? "#b71c1c" : "#208b42",
                      fontWeight: 600
                    }}
                    title={r.statut === "ferme" ? "Établissement fermé" : "Établissement actif"}
                  >
                    {r.statut === "ferme" ? "Fermé" : "Actif"}
                    {r.statut === "ferme" && r.date_fermeture && (
                      <span className="ml-1 text-xs text-gray-500">(le {formatDateFR(r.date_fermeture)})</span>
                    )}
                  </span>
                </span>

                {Array.isArray(r.matching_etablissements) && r.matching_etablissements.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setOpenEtabs((prev) => ({ ...prev, [r.siren]: !prev[r.siren] }))}
                    className="px-3 py-1 rounded border bg-gray-100 hover:bg-gray-200 text-sm w-max"
                  >
                    {openEtabs[r.siren]
                      ? "Cacher les établissements"
                      : `Afficher les établissements (${r.matching_etablissements.length})`}
                  </button>
                )}

                {openEtabs[r.siren] && Array.isArray(r.matching_etablissements) && (
                  <ul className="ml-1 mt-2 space-y-2">
                    {r.matching_etablissements.map((etab: any, eidx: number) => (
                      <li key={eidx} className="flex flex-wrap items-center gap-2 border-b pb-1">
                        <span className="font-bold text-[var(--cm-accent)]">{etab.displayName}</span>
                        <span>— SIRET: {etab.siret}</span>
                        <span className="text-xs text-gray-600 ml-1">
                          {getEtablissementAdresse(etab) ? `— ${getEtablissementAdresse(etab)}` : ""}
                        </span>
                        <span
                          className="px-2 py-1 rounded text-xs"
                          style={{
                            background: etab.statut === "ferme" ? "#fde8ea" : "#e6faea",
                            color: etab.statut === "ferme" ? "#b71c1c" : "#208b42",
                            fontWeight: 600
                          }}
                          title={etab.statut === "ferme" ? "Établissement fermé" : "Établissement actif"}
                        >
                          {etab.statut === "ferme" ? "Fermé" : "Actif"}
                          {etab.statut === "ferme" && etab.date_fermeture && (
                            <span className="ml-1 text-xs text-gray-500">(le {formatDateFR(etab.date_fermeture)})</span>
                          )}
                        </span>
                        <button className="btn ml-2 text-sm" onClick={() => setSelectedCode(etab.siret)}>
                          Voir établissement
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <button className="btn text-sm w-max" onClick={() => setSelectedCode(r.siren)}>
                  Voir la fiche
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Fiche entreprise */}
        {data && (
          <div className="max-w-none">
            <div className="bg-[var(--cm-soft)] border border-[var(--cm-border)] rounded-lg p-4 shadow-card max-w-none">
              <div className="text-[var(--cm-accent)] font-bold text-xl mb-2">
              {data.displayName}
              </div>
              <CompanyHeader {...data} />
              </div>

            {siretAffiche && (
              <div className="mb-4 mt-3">
                <a
                  href={`https://api-avis-situation-sirene.insee.fr/identification/pdf/${siretAffiche}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn"
                  title="Télécharger l'avis de situation INSEE (ouvre un PDF officiel)"
                >
                  Télécharger l'avis de situation INSEE (PDF)
                </a>
              </div>
            )}

            <div className="mb-3">
              <span
                className="px-2 py-1 rounded text-xs"
                style={{
                  background: data.statut === "ferme" ? "#fde8ea" : "#e6faea",
                  color: data.statut === "ferme" ? "#b71c1c" : "#208b42",
                  fontWeight: 700
                }}
                title={data.statut === "ferme" ? "Établissement fermé" : "Établissement actif"}
              >
                {data.statut === "ferme" ? "Fermé" : "Actif"}
                {data.statut === "ferme" && data.date_fermeture && (
                  <span className="ml-1 text-xs text-gray-500">(le {formatDateFR(data.date_fermeture)})</span>
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
          </div>
        )}

        {!loading && !error && !data && safeResults.length === 0 && (
          <div className="text-center text-gray-500 mt-8">Aucun résultat n'a été trouvé.</div>
        )}
      </section>
    </div>
  );
}
