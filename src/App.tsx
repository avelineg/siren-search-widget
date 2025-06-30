import * as React from "react";
import { useState } from "react";
import "./styles.css";

import nafNomenclatureRaw from './naf.json';
import formeJuridiqueRaw from './formeJuridique.json';

const nafNomenclature: Record<string, string> = nafNomenclatureRaw;
const formeJuridique: Record<string, string> = formeJuridiqueRaw;

function getApeLabel(code: string) {
  return nafNomenclature[code] || "";
}
function getFormeJuridiqueLabel(code: string) {
  return formeJuridique[code] || code || "Non renseigné";
}

// URL de votre backend INPI (Express) publié sur Render
const BACKEND_URL = process.env.REACT_APP_API_URL || "https://hubshare-cmexpert.fr";
// Votre clé INSEE (pour SIREN/SIRET)
const INSEE_KEY = process.env.REACT_APP_INSEE_API_KEY;
// URL de vérification TVA (intracommunautaire)
const VAT_API_URL =
  process.env.REACT_APP_VAT_API_URL ||
  "https://check-vat-backend.onrender.com";

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

// Complément INPI si champs SIRENE manquants ou vides
async function fetchInpiFallback(
  siren: string,
  infos: any
): Promise<{ infosCompletes: any; inpiRaw: any }> {
  try {
    const resp = await fetch(`${BACKEND_URL}/inpi/entreprise/${siren}`);
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
  } catch {
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

  // Détecte SIREN (9 chiffres), SIRET (14 chiffres) ou raison sociale
  const getType = (val: string) => {
    if (/^\d{9}$/.test(val)) return "siren";
    if (/^\d{14}$/.test(val)) return "siret";
    return "texte";
  };

  // Recherche principale
  const handleSearch = async (preset?: string) => {
    const searchInput = preset || input.trim();
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

      // ------ 1) Appel API INSEE pour SIREN ------
      if (type === "siren") {
        const resp = await fetch(
          `https://api.insee.fr/api-sirene/3.11/unites_legales/${searchInput}`,
          { headers: { "X-INSEE-Api-Key-Integration": INSEE_KEY! } }
        );
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
      // ------ 2) Appel API INSEE pour SIRET ------
      else if (type === "siret") {
        const resp = await fetch(
          `https://api.insee.fr/api-sirene/3.11/siret/${searchInput}`,
          { headers: { "X-INSEE-Api-Key-Integration": INSEE_KEY! } }
        );
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
      // ------ 3) Recherche floue INPI (raison sociale) ------
      else {
        const resp = await fetch(
          `${BACKEND_URL}/inpi/entreprises?raisonSociale=${encodeURIComponent(
            searchInput
          )}`
        );
        if (!resp.ok) throw new Error("Aucun résultat INPI");
        const entreprises = await resp.json();
        if (!entreprises.length) throw new Error("Aucun résultat");
        setSuggestions(entreprises);
        setShowSuggestions(true);
        setLoading(false);
        return;
      }

      // Injection de données INPI pour les champs manquants
      if (siren) {
        const { infosCompletes, inpiRaw } = await fetchInpiFallback(
          siren,
          infosToSet
        );
        setInfos(infosCompletes);
        setInpiRaw(inpiRaw);
        // Récupère aussi les établissements
        const respEtabs = await fetch(
          `https://api.insee.fr/api-sirene/3.11/etablissements?siren=${siren}&nombre=100`,
          { headers: { "X-INSEE-Api-Key-Integration": INSEE_KEY! } }
        );
        if (respEtabs.ok) {
          const dataEtabs = await respEtabs.json();
          setEtabs(dataEtabs.etablissements || []);
        }
      }
    } catch (err: any) {
      setErreur(err.message || "Erreur de recherche");
    } finally {
      setLoading(false);
    }
  };

  // Cliquer sur une suggestion INPI
  const handleSuggestionClick = (siren: string) => {
    setShowSuggestions(false);
    handleSearch(siren);
  };

  // Vérification du numéro TVA intracommunautaire
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
    try {
      const resp = await fetch(
        `${VAT_API_URL}/check-vat?countryCode=${country}&vatNumber=${number}`
      );
      if (!resp.ok) throw new Error("Erreur API TVA");
      const json = await resp.json();
      if (json.valid) {
        setVerification(
          `✅ TVA valide : ${json.name || "Nom inconnu"} • ${json.address || "Adresse inconnue"}`
        );
      } else {
        setVerification("❌ TVA invalide");
      }
    } catch {
      setVerification("⚠️ Service TVA indisponible");
    }
  };

  // Champs déjà affichés pour éviter doublons
  const used = infos ? Object.keys(infos).map((k) => k.toLowerCase()) : [];
  // Compléments INPI non déjà affichés
  const inpiExtras = inpiRaw
    ? Object.entries(inpiRaw).filter(
        ([k, v]) =>
          !used.includes(k.toLowerCase()) &&
          v != null &&
          !(Array.isArray(v) && v.length === 0)
      )
    : [];

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
      </div>

      {erreur && <p className="error">{erreur}</p>}

      {showSuggestions && (
        <ul className="suggestions">
          {suggestions.map((ent: any) => (
            <li
              key={ent.siren}
              onClick={() => handleSuggestionClick(ent.siren)}
            >
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

          {inpiExtras.length > 0 && (
            <>
              <h4>Compléments INPI</h4>
              <table>
                <tbody>
                  {inpiExtras.map(([k, v]) => (
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
