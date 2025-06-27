import * as React from "react";
import { useState } from "react";
import "./styles.css";

import nafNomenclatureRaw from './naf.json';
import formeJuridiqueRaw from './formeJuridique.json';

const API_KEY = "4f8742f4-0882-466c-8742-f40882466c6c";
const nafNomenclature: Record<string, string> = nafNomenclatureRaw;
const formeJuridique: Record<string, string> = formeJuridiqueRaw;

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

// Fallback INPI sur les champs manquants
async function fetchInpiFallback(siren: string, infos: any): Promise<any> {
  try {
    const champsFallback = [
      ["nom", "denomination"],
      ["formeJuridique", "formeJuridique"],
      ["activitePrincipale", "activitePrincipale"],
      ["codeApe", "codeApe"],
      ["adresseSiege", "adresse"],
    ];
    const incomplets = champsFallback.filter(([champ]) => !infos[champ] || infos[champ] === "Non renseigné");
    if (incomplets.length === 0) return infos;

    const resp = await fetch(`/inpi/entreprise/${siren}`);
    if (!resp.ok) return infos;
    const inpi = await resp.json();

    const infosCompletes = { ...infos };
    for (const [champFront, champInpi] of champsFallback) {
      if (!infosCompletes[champFront] || infosCompletes[champFront] === "Non renseigné") {
        if (inpi[champInpi]) infosCompletes[champFront] = inpi[champInpi];
      }
    }
    return infosCompletes;
  } catch {
    return infos;
  }
}

export default function App() {
  const [input, setInput] = useState("");
  const [infos, setInfos] = useState<any | null>(null);
  const [etabs, setEtabs] = useState<any[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verification, setVerification] = useState<string | null>(null);

  const getType = (val: string) => {
    if (/^\d{9}$/.test(val)) return "siren";
    if (/^\d{14}$/.test(val)) return "siret";
    return "raison";
  };

  const calculateTvaKey = (siren: string): string => {
    if (!siren || siren.length !== 9) return "";
    const sirenStr = String(siren).padStart(9, "0");
    const key = (12 + 3 * (Number(sirenStr) % 97)) % 97;
    return `FR${key.toString().padStart(2, "0")}${sirenStr}`;
  };

  const handleSearch = async () => {
    setInfos(null);
    setEtabs([]);
    setErreur(null);
    setVerification(null);
    setLoading(true);

    const type = getType(input.trim());
    try {
      let siren = "";
      let infosToSet: any = {};
      let adresseSiege = "";
      let etablissements: any[] = [];
      let codeApe = "";
      let libelleApe = "";
      let codeFormeJuridique = "";
      let libelleFormeJuridique = "";

      if (type === "siren") {
        const resp = await fetch(
          `https://api.insee.fr/api-sirene/3.11/siren/${input}`,
          { headers: { "X-INSEE-Api-Key-Integration": API_KEY } }
        );
        if (!resp.ok) throw new Error("SIREN non trouvé");
        const data = await resp.json();
        const uniteLegale = data.uniteLegale;
        const period = uniteLegale.periodesUniteLegale?.[0] || {};
        siren = uniteLegale.siren;
        adresseSiege = formatAdresse(uniteLegale.adresseEtablissementSiege);

        codeApe = period.activitePrincipaleUniteLegale || "";
        libelleApe = getApeLabel(codeApe);

        codeFormeJuridique = period.categorieJuridiqueUniteLegale || "";
        libelleFormeJuridique = getFormeJuridiqueLabel(codeFormeJuridique);

        infosToSet = {
          nom: period.denominationUniteLegale || period.nomUniteLegale || "",
          siren,
          formeJuridique: libelleFormeJuridique,
          natureJuridique: period.natureJuridiqueUniteLegale || "",
          activitePrincipale: libelleApe,
          codeApe: codeApe,
          categorieEntreprise: period.categorieEntreprise || "",
          dateCreation: period.dateCreationUniteLegale || "",
          capital: period.capitalSocialUniteLegale || "",
          statut: period.etatAdministratifUniteLegale === "A" ? "Active" : "Inconnue",
          adresseSiege,
          sigle: period.sigleUniteLegale || "",
          anneeEffectif: period.anneeEffectifsUniteLegale || "",
          trancheEffectif: period.trancheEffectifsUniteLegale || "",
        };
      } else if (type === "siret") {
        const resp = await fetch(
          `https://api.insee.fr/api-sirene/3.11/siret/${input}`,
          { headers: { "X-INSEE-Api-Key-Integration": API_KEY } }
        );
        if (!resp.ok) throw new Error("SIRET non trouvé");
        const data = await resp.json();
        const etab = data.etablissement;
        const uniteLegale = etab.uniteLegale;
        const period = uniteLegale?.periodesUniteLegale?.[0] || {};

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
          codeApe: codeApe,
          categorieEntreprise: period.categorieEntreprise || "",
          dateCreation: period.dateCreationUniteLegale || "",
          capital: period.capitalSocialUniteLegale || "",
          statut: period.etatAdministratifUniteLegale === "A" ? "Active" : "Inconnue",
          adresseSiege,
          sigle: period.sigleUniteLegale || "",
          anneeEffectif: period.anneeEffectifsUniteLegale || "",
          trancheEffectif: period.trancheEffectifsUniteLegale || "",
        };
      } else {
        const resp = await fetch(
          `https://api.insee.fr/api-sirene/3.11/etablissements?denominationUniteLegale=${encodeURIComponent(
            input
          )}&nombre=1&tri=desc`,
          { headers: { "X-INSEE-Api-Key-Integration": API_KEY } }
        );
        if (!resp.ok) throw new Error("Aucun résultat");
        const data = await resp.json();
        if (!data.etablissements?.[0]) throw new Error("Aucun résultat");
        const etab = data.etablissements[0];
        const uniteLegale = etab.uniteLegale;
        const period = uniteLegale?.periodesUniteLegale?.[0] || {};
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
          codeApe: codeApe,
          categorieEntreprise: period.categorieEntreprise || "",
          dateCreation: period.dateCreationUniteLegale || "",
          capital: period.capitalSocialUniteLegale || "",
          statut: period.etatAdministratifUniteLegale === "A" ? "Active" : "Inconnue",
          adresseSiege,
          sigle: period.sigleUniteLegale || "",
          anneeEffectif: period.anneeEffectifsUniteLegale || "",
          trancheEffectif: period.trancheEffectifsUniteLegale || "",
        };
      }

      // Complétion INPI
      if (siren) {
        infosToSet = await fetchInpiFallback(siren, infosToSet);

        const respEtabs = await fetch(
          `https://api.insee.fr/api-sirene/3.11/etablissements?siren=${siren}&nombre=100`,
          { headers: { "X-INSEE-Api-Key-Integration": API_KEY } }
        );
        if (respEtabs.ok) {
          const dataEtabs = await respEtabs.json();
          setEtabs(dataEtabs.etablissements || []);
        }
      }

      setInfos(infosToSet);
    } catch (e: any) {
      setErreur(e.message || "Erreur lors de la récupération des données");
      setInfos(null);
      setEtabs([]);
    }
    setLoading(false);
  };

  const handleVerifyTva = async () => {
    setVerification(null);
    if (!infos?.siren) {
      setVerification("Aucun SIREN trouvé pour vérification TVA.");
      return;
    }
    const tvaNumber = calculateTvaKey(infos.siren);
    if (!tvaNumber) {
      setVerification("Numéro SIREN non valide pour calcul TVA.");
      return;
    }
    const countryCode = tvaNumber.slice(0, 2);
    const vatNumber = tvaNumber.slice(2);
    try {
      const resp = await fetch(
        `https://check-vat-backend.onrender.com/check-vat?countryCode=${countryCode}&vatNumber=${vatNumber}`
      );
      if (!resp.ok) throw new Error("Erreur API");
      const json = await resp.json();
      if (json && typeof json === "object" && "valid" in json) {
        if (json.valid) {
          setVerification(
            `✅ TVA valide : ${json.name || "Nom inconnu"} • ${json.address || "Adresse inconnue"}`
          );
        } else {
          if (json.error && json.error.includes("VIES service down")) {
            setVerification("⚠️ Le service VIES est actuellement indisponible. Veuillez réessayer plus tard.");
          } else {
            setVerification("❌ TVA invalide");
          }
        }
      } else {
        setVerification("❌ Réponse invalide de l'API VIES");
      }
    } catch (e) {
      setVerification("⚠️ Le service VIES est actuellement indisponible. Veuillez réessayer plus tard.");
    }
  };

  return (
    <div className="container">
      <h2 className="titre">🔍 Recherche entreprise (SIREN, SIRET ou Raison sociale)</h2>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="SIREN (9 chiffres), SIRET (14 chiffres) ou Nom"
        className="input"
      />
      <button onClick={handleSearch} className="btn" disabled={loading}>
        Rechercher
      </button>

      <ul className="resultat">
        {erreur && <li className="warning">⚠️ {erreur}</li>}
        {infos && (
          <>
            <li><b>Nom :</b> {infos.nom}</li>
            <li><b>SIREN :</b> {infos.siren}</li>
            {infos.siret && <li><b>SIRET :</b> {infos.siret}</li>}
            <li><b>Sigle :</b> {infos.sigle || "Non renseigné"}</li>
            <li><b>Forme juridique :</b> {infos.formeJuridique}</li>
            <li><b>Nature juridique :</b> {infos.natureJuridique}</li>
            <li><b>Activité principale :</b> {infos.activitePrincipale || "Non renseigné"}</li>
            <li><b>Code APE :</b> {infos.codeApe || "Non renseigné"}</li>
            <li><b>Catégorie entreprise :</b> {infos.categorieEntreprise || "Non renseigné"}</li>
            <li><b>Date de création :</b> {infos.dateCreation || "Non renseignée"}</li>
            <li><b>Capital :</b> {infos.capital || "Non renseigné"}</li>
            <li><b>Tranche d'effectif :</b> {infos.trancheEffectif || "Non renseigné"}{infos.anneeEffectif && ` (${infos.anneeEffectif})`}</li>
            <li><b>Adresse du siège :</b> {infos.adresseSiege}</li>
            <li><b>Statut :</b> {infos.statut}</li>
            <li>
              <b>TVA intracom :</b> {calculateTvaKey(infos.siren)}{" "}
              <button onClick={handleVerifyTva} className="btn" style={{ marginLeft: "8px" }}>
                Vérifier
              </button>
            </li>
          </>
        )}
        {verification && <li>{verification}</li>}
      </ul>

      {etabs.length > 0 && (
        <div>
          <h3>Établissements (max 100)</h3>
          <table className="etabs-table">
            <thead>
              <tr>
                <th>SIRET</th>
                <th>Statut</th>
                <th>Ouverture</th>
                <th>Fermeture</th>
                <th>Adresse</th>
                <th>Principal</th>
              </tr>
            </thead>
            <tbody>
              {etabs.map((e) => (
                <tr key={e.siret}>
                  <td>{e.siret}</td>
                  <td>{e.etatAdministratifEtablissement === "A" ? "Actif" : "Fermé"}</td>
                  <td>{e.dateDebut}</td>
                  <td>{e.dateFin || ""}</td>
                  <td>{formatAdresse(e.adresseEtablissement)}</td>
                  <td>{e.etablissementSiege ? "Siège" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
