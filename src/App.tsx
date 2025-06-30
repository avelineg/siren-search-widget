import * as React from "react";
import { useState } from "react";
import "./styles.css";

import nafNomenclatureRaw from './naf.json';
import formeJuridiqueRaw from './formeJuridique.json';

const nafNomenclature: Record<string, string> = nafNomenclatureRaw;
const formeJuridique: Record<string, string> = formeJuridiqueRaw;

// Vite‐exposées dans .env* (préfixe VITE_)
const BACKEND_URL   = import.meta.env.VITE_API_URL as string;
const VIES_API_URL = import.meta.env.VITE_VAT_API_URL as string;

// Helpers pour formater les données
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
    .map(champ => adresse[champ])
    .filter(v => v && String(v).trim())
    .join(" ");
}

function prettifyKey(key: string) {
  return key.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
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
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verification, setVerification] = useState<string | null>(null);

  // Détecte SIREN (9), SIRET (14) ou texte libre
  const getType = (val: string) => {
    if (/^\d{9}$/.test(val))  return "siren";
    if (/^\d{14}$/.test(val)) return "siret";
    return "texte";
  };

  // Recherche principale : on enlève les appels à l'API SIRENE
  const handleSearch = async (preset?: string) => {
    const searchInput = (preset || input).trim();
    console.log("[LOG] Recherche pour :", searchInput);
    setInput(searchInput);
    setInfos(null);
    setSuggestions([]);
    setShowSuggestions(false);
    setErreur(null);
    setVerification(null);
    setLoading(true);

    try {
      if (!searchInput) {
        throw new Error("Merci de saisir un SIREN, un SIRET ou un texte.");
      }
      const type = getType(searchInput);

      // 1) SIREN ou SIRET → on interroge directement l'API INPI backend
      if (type === "siren" || type === "siret") {
        const url = `${BACKEND_URL}/inpi/entreprise/${searchInput}`;
        console.log("[LOG] Appel API INPI directe →", url);
        const resp = await fetch(url);
        console.log(`[LOG] API INPI directe statut : ${resp.status} (${resp.ok})`);
        if (!resp.ok) throw new Error("Entreprise non trouvée via INPI");
        const data = await resp.json();
        // On s'attend ici à recevoir un objet complet d'entreprise
        setInfos(data);
        setLoading(false);
        return;
      }

      // 2) Texte libre → recherche floue via INPI backend
      const urlFuzzy = `${BACKEND_URL}/inpi/entreprises?raisonSociale=${encodeURIComponent(searchInput)}`;
      console.log("[LOG] Appel API INPI (fuzzy) →", urlFuzzy);
      const respFuzzy = await fetch(urlFuzzy);
      console.log(`[LOG] API INPI fuzzy statut : ${respFuzzy.status} (${respFuzzy.ok})`);
      if (!respFuzzy.ok) throw new Error("Aucun résultat INPI");
      const entreprises = await respFuzzy.json();
      if (!entreprises.length) throw new Error("Aucun résultat INPI");
      setSuggestions(entreprises);
      setShowSuggestions(true);

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
    const url = `${VIES_API_URL}/check-vat?countryCode=${country}&vatNumber=${number}`;
    console.log("[LOG] Appel API VIES →", url);

    try {
      const resp = await fetch(url);
      console.log(`[LOG] API VIES statut : ${resp.status} (${resp.ok})`);
      const json = await resp.json();
      setVerification(
        json.valid
          ? `✅ TVA valide : ${json.name || "–"} • ${json.address || "–"}`
          : "❌ TVA invalide"
      );
    } catch (e) {
      console.error("[LOG] Erreur API VIES :", e);
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
          onChange={e => setInput(e.target.value)}
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
          {suggestions.map(ent => (
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

          {/* Vérification TVA */}
          {verification && <p className="vat">{verification}</p>}
        </div>
      )}
    </div>
  );
}
