import * as React from "react";
import { useState } from "react";
import "./styles.css";

import nafNomenclatureRaw from './naf.json';
import formeJuridiqueRaw from './formeJuridique.json';

const nafNomenclature: Record<string, string> = nafNomenclatureRaw;
const formeJuridique: Record<string, string> = formeJuridiqueRaw;

// Variables exposées par Vite via import.meta.env
const BACKEND_URL = import.meta.env.VITE_API_URL as string;
const INSEE_KEY = import.meta.env.VITE_INSEE_API_KEY as string;
const VAT_API_URL = import.meta.env.VITE_VAT_API_URL as string;

function getApeLabel(code: string) {
  return nafNomenclature[code] || "";
}
function getFormeJuridiqueLabel(code: string) {
  return formeJuridique[code] || code || "Non renseigné";
}
function formatAdresse(adresse: any) {
  if (!adresse) return "Adresse non renseignée";
  const champs = [
    "numeroVoieEtablissement",
    "indiceRepetitionEtablissement",
    "typeVoieEtablissement",
    "libelleVoieEtablissement",
    "complementAdresseEtablissement",
    "distributionSpecialeEtablissement",
    "codePostalEtablissement",
    "libelleCommuneEtablissement",
    "libellePaysEtrangerEtablissement"
  ];
  return champs
    .map((champ) => adresse[champ])
    .filter((v) => v && String(v).trim())
    .join(" ");
}

// Fallback INPI si champs manquants
async function fetchInpiFallback(
  siren: string,
  infos: any
): Promise<{ infosCompletes: any; inpiRaw: any }> {
  const url = `${BACKEND_URL}/inpi/entreprise/${siren}`;
  console.log("[LOG] Vérification connexion INPI :", url);
  try {
    const resp = await fetch(url);
    console.log(`[LOG] API INPI statut : ${resp.status} (${resp.ok})`);
    if (!resp.ok) return { infosCompletes: infos, inpiRaw: undefined };
    const inpi = await resp.json();
    const champsFallback: [keyof typeof infos, keyof typeof inpi][] = [
      ["nom", "denomination"],
      ["formeJuridique", "formeJuridique"],
      ["activitePrincipale", "activitePrincipale"],
      ["codeApe", "codeApe"],
      ["adresseSiege", "adresse"]
    ];
    const infosCompletes = { ...infos };
    for (const [front, back] of champsFallback) {
      if (
        !infosCompletes[front] ||
        infosCompletes[front] === "Non renseigné"
      ) {
        if (inpi[back]) infosCompletes[front] = inpi[back];
      }
    }
    return { infosCompletes, inpiRaw: inpi };
  } catch (e) {
    console.error("[LOG] Erreur connexion INPI :", e);
    return { infosCompletes: infos, inpiRaw: undefined };
  }
}

function prettifyKey(key: string) {
  return key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}
function formatValue(value: any) {
  if (value === null || value === undefined || value === "") return "Non renseigné";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return value;
}

// Calcul de la clé TVA à partir du SIREN
const calculateTvaKey = (siren: string): string => {
  if (!siren || siren.length !== 9) return "";
  const key = (12 + 3 * (Number(siren) % 97)) % 97;
  return `FR${key.toString().padStart(2, "0")}${siren}`;
};

export default function App() {
  const [input, setInput] = useState("");
  const [infos, setInfos] = useState<any | null>(null);
  const [etabs, setEtabs] = useState<any[]>([]);
  const [inpiRaw, setInpiRaw] = useState<any>();
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verification, setVerification] = useState<string | null>(null);

  // Détecte SIREN (9), SIRET (14) ou texte
  const getType = (val: string) => {
    if (/^\d{9}$/.test(val)) return "siren";
    if (/^\d{14}$/.test(val)) return "siret";
    return "texte";
  };

  const handleSearch = async (preset?: string) => {
    const searchInput = preset || input.trim();
    console.log("[LOG] Démarrage de la recherche pour :", searchInput);
    setInput(searchInput);
    setInfos(null);
    setEtabs([]);
    setInpiRaw(undefined);
    setSuggestions([]);
    setShowSuggestions(false);
    setErreur(null);
    setVerification(null);
    setLoading(true);

    try {
      if (!searchInput) throw new Error("Merci de saisir un SIREN, un SIRET ou un texte.");
      const type = getType(searchInput);
      let siren = "";
      let infosToSet: any = {};
      let adresseSiege = "";
      let codeApe = "";
      let libelleApe = "";
      let codeFormeJuridique = "";
      let libelleFormeJuridique = "";

      // 1) Appel SIRENE pour SIREN
      if (type === "siren") {
        const urlSirene = `https://api.insee.fr/api-sirene/3.11/unites_legales/${searchInput}`;
        console.log("[LOG] Appel API SIRENE :", urlSirene);
        const resp = await fetch(urlSirene, {
          headers: { "X-INSEE-Api-Key-Integration": INSEE_KEY }
        });
        console.log(`[LOG] API SIRENE statut : ${resp.status} (${resp.ok})`);
        if (!resp.ok) throw new Error("SIREN non trouvé");
        const data = await resp.json();
        const ul = data.uniteLegale;
        const period = ul.periodesUniteLegale?.[0] || {};
        siren = ul.siren;
        adresseSiege = formatAdresse(ul.adresseEtablissementSiege);
        codeApe = period.activitePrincipaleUniteLegale || "";
        libelleApe = getApeLabel(codeApe);
        codeFormeJuridique = period.categorieJuridiqueUniteLegale || "";
        libelleFormeJuridique = getFormeJuridiqueLabel(codeFormeJuridique);
        infosToSet = {
          nom: period.denominationUniteLegale || period.nomUniteLegale || "",
          siren,
          siret: "",
          formeJuridique: libelleFormeJuridique,
          natureJuridique: period.natureJuridiqueUniteLegale || "",
          activitePrincipale: libelleApe,
          codeApe,
          categorieEntreprise: period.categorieEntreprise || "",
          dateCreation: period.dateCreationUniteLegale || "",
          capital: period.capitalSocialUniteLegale || "",
          statut: period.etatAdministratifUniteLegale === "A" ? "Active" : "Inconnue",
          adresseSiege,
          sigle: period.sigleUniteLegale || "",
          anneeEffectif: period.anneeEffectifsUniteLegale || "",
          trancheEffectif: period.trancheEffectifsUniteLegale || ""
        };
      }
      // 2) Appel SIRENE pour SIRET
      else if (type === "siret") {
        const urlSiret = `https://api.insee.fr/api-sirene/3.11/siret/${searchInput}`;
        console.log("[LOG] Appel API SIRET :", urlSiret);
        const resp = await fetch(urlSiret, {
          headers: { "X-INSEE-Api-Key-Integration": INSEE_KEY }
        });
        console.log(`[LOG] API SIRET statut : ${resp.status} (${resp.ok})`);
        if (!resp.ok) throw new Error("SIRET non trouvé");
        const data = await resp.json();
        const etab = data.etablissement;
        const ul = etab.uniteLegale;
        const period = ul.periodesUniteLegale?.[0] || {};
        siren = etab.siren;
        adresseSiege = formatAdresse(etab.adresseEtablissement);
        codeApe = period.activitePrincipaleUniteLegale || "";
        libelleApe = getApeLabel(codeApe);
        codeFormeJuridique = period.categorieJuridiqueUniteLegale || "";
        libelleFormeJuridique = getFormeJuridiqueLabel(codeFormeJuridique);
        infosToSet = {
          nom: period.denominationUniteLegale || period.nomUniteLegale || "",
          siren,
          siret: etab.siret,
          formeJuridique: libelleFormeJuridique,
          natureJuridique: period.natureJuridiqueUniteLegale || "",
          activitePrincipale: libelleApe,
          codeApe,
          categorieEntreprise: period.categorieEntreprise || "",
          dateCreation: period.dateCreationUniteLegale || "",
          capital: period.capitalSocialUniteLegale || "",
          statut: period.etatAdministratifUniteLegale === "A" ? "Active" : "Inconnue",
          adresseSiege,
          sigle: period.sigleUniteLegale || "",
          anneeEffectif: period.anneeEffectifsUniteLegale || "",
          trancheEffectif: period.trancheEffectifsUniteLegale || ""
        };
      }
      // 3) Recherche floue INPI (raison sociale)
      else {
        const urlInpiSearch = `${BACKEND_URL}/inpi/entreprises?raisonSociale=${encodeURIComponent(
          searchInput
        )}`;
        console.log("[LOG] Appel API INPI (recherche) :", urlInpiSearch);
        const resp = await fetch(urlInpiSearch);
        console.log(`[LOG] API INPI statut : ${resp.status} (${resp.ok})`);
        if (!resp.ok) throw new Error("Aucun résultat INPI");
        const entreprises = await resp.json();
        if (!entreprises.length) throw new Error("Aucun résultat");
        setSuggestions(entreprises);
        setShowSuggestions(true);
        setLoading(false);
        return;
      }

      // Injection INPI fallback + établissements
      if (siren) {
        const { infosCompletes, inpiRaw } = await fetchInpiFallback(
          siren,
          infosToSet
        );
        setInfos(infosCompletes);
        setInpiRaw(inpiRaw);

        const urlEtabs = `https://api.insee.fr/api-sirene/3.11/etablissements?siren=${siren}&nombre=100`;
        console.log("[LOG] Appel API SIRENE établissements :", urlEtabs);
        const respEtabs = await fetch(urlEtabs, {
          headers: { "X-INSEE-Api-Key-Integration": INSEE_KEY }
        });
        console.log(`[LOG] API Etabs statut : ${respEtabs.status} (${respEtabs.ok})`);
        if (respEtabs.ok) {
          const dataEtabs = await respEtabs.json();
          setEtabs(dataEtabs.etablissements || []);
        }
      }
    } catch (err: any) {
      console.error("[LOG] Erreur handleSearch :", err);
      setErreur(err.message || "Erreur de recherche");
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestionClick = (siren: string) => {
    setShowSuggestions(false);
    handleSearch(siren);
  };

  const handleVerifyTva = async () => {
    setVerification(null);
    if (!infos?.siren) {
      setVerification("Aucun SIREN pour vérifier la TVA");
      return;
    }
    const tva = calculateTvaKey(infos.siren);
    if (!tva) {
      setVerification("SIREN invalide pour TVA");
      return;
    }
    const country = tva.slice(0, 2);
    const number = tva.slice(2);
    const urlVies = `${VAT_API_URL}/check-vat?countryCode=${country}&vatNumber=${number}`;
    console.log("[LOG] Appel API VIES :", urlVies);
    try {
      const resp = await fetch(urlVies);
      console.log(`[LOG] API VIES statut : ${resp.status} (${resp.ok})`);
      const json = await resp.json();
      if (json.valid) {
        setVerification(
          `✅ TVA valide : ${json.name || "Nom inconnu"} • ${json.address || "Adresse inconnue"}`
        );
      } else {
        setVerification("❌ TVA invalide");
      }
    } catch (e) {
      console.error("[LOG] Erreur connexion VIES :", e);
      setVerification("⚠️ Service TVA indisponible");
    }
  };

  return (
    <div className="container">
      <h2>🔍 Recherche (SIREN, SIRET ou raison sociale)</h2>
      <div className="controls">
        <input
          placeholder="Entrez SIREN/SIRET/texte"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button onClick={() => handleSearch()} disabled={loading}>
          {loading ? "..." : "Rechercher"}
        </button>
        <button onClick={handleVerifyTva} disabled={!infos}>
          Vérifier TVA
        </button>
        {erreur && <p className="error">{erreur}</p>}
      </div>

      {showSuggestions && (
        <ul className="suggestions">
          {suggestions.map((ent: any) => (
            <li key={ent.siren} onClick={() => handleSuggestionClick(ent.siren)}>
              {ent.denomination}
            </li>
          ))}
        </ul>
      )}

      {infos && (
        <div className="results">
          <h3>Fiche entreprise</h3>
          <table>
            <tbody>
              {Object.entries(infos).map(([k, v]) => (
                <tr key={k}>
                  <td>{prettifyKey(k)}</td>
                  <td>{formatValue(v)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {inpiRaw && (
            <>
              <h4>Compléments INPI</h4>
              <table>
                <tbody>
                  {Object.entries(inpiRaw)
                    .filter(
                      ([k, v]) =>
                        !Object.keys(infos || {}).includes(k) &&
                        v != null &&
                        !(Array.isArray(v) && v.length === 0)
                    )
                    .map(([k, v]) => (
                      <tr key={k}>
                        <td>{prettifyKey(k)}</td>
                        <td>{formatValue(v)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </>
          )}

          {etabs.length > 0 && (
            <>
              <h4>Établissements</h4>
              <ul>
                {etabs.map((e) => (
                  <li key={e.siret}>
                    {e.siret} – {formatAdresse(e.adresseEtablissement)}
                  </li>
                ))}
              </ul>
            </>
          )}

          {verification && <p className="vat">{verification}</p>}
        </div>
      )}
    </div>
  );
}
