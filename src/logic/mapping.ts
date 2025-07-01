import axios from "axios";
import formeJuridique from "../formeJuridique.json";
import naf from "../naf.json";

const API_SIRENE = "https://api.insee.fr/api-sirene/3.11";
const API_GEO = "https://api-adresse.data.gouv.fr/search/";
const API_INPI = import.meta.env.VITE_API_URL + "/inpi/entreprise/";
const API_VIES = import.meta.env.VITE_VAT_API_URL + "/check-vat";

const SIRENE_API_KEY = import.meta.env.VITE_SIRENE_API_KEY;

function decodeFormeJuridique(code: string) {
  return formeJuridique[code] || code;
}
function decodeNaf(code: string) {
  return naf[code] || code;
}

export async function fetchEtablissementData(siretOrSiren: string) {
  let etab: any = null, uniteLegale: any = null, geo = null, tvaInfo = null, inpiInfo: any = {};
  let siret = "", siren = "";

  // --- 1. SIRENE fetch (établissement ou unité légale) ---
  if (/^\d{14}$/.test(siretOrSiren)) {
    // SIRET → fiche établissement
    siret = siretOrSiren;
    try {
      const { data } = await axios.get(
        `${API_SIRENE}/siret/${siret}`,
        { headers: { "X-INSEE-Api-Key-Integration": SIRENE_API_KEY } }
      );
      etab = data.etablissement;
      if (!etab) throw new Error("Aucun établissement trouvé pour ce SIRET.");
      siren = etab.siren;
      uniteLegale = etab.uniteLegale ?? null;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error("Aucun établissement trouvé pour ce SIRET.");
      }
      throw error;
    }
  } else if (/^\d{9}$/.test(siretOrSiren)) {
    // SIREN → fiche unité légale
    siren = siretOrSiren;
    try {
      const { data } = await axios.get(
        `${API_SIRENE}/siren/${siren}`,
        { headers: { "X-INSEE-Api-Key-Integration": SIRENE_API_KEY } }
      );
      uniteLegale = data.uniteLegale;
      if (!uniteLegale) throw new Error("Aucune unité légale trouvée pour ce SIREN.");
      etab = null;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error("Aucune unité légale trouvée pour ce SIREN.");
      }
      throw error;
    }
  } else {
    throw new Error("Merci de fournir un SIRET (14 chiffres) ou SIREN (9 chiffres) valide.");
  }

  // --- 2. Inpi fetch (dirigeants, documents, annonces, finances, labels, divers) ---
  if (siren) {
    try {
      const { data } = await axios.get(`${API_INPI}${siren}`);
      inpiInfo = data;
    } catch (e) {
      inpiInfo = {};
    }
  }

  // --- 3. Adresse (formatée) & géolocalisation ---
  let adresse = [
    etab?.numeroVoieEtablissement || uniteLegale?.numeroVoieUniteLegale,
    etab?.typeVoieEtablissement || uniteLegale?.typeVoieUniteLegale,
    etab?.libelleVoieEtablissement || uniteLegale?.libelleVoieUniteLegale,
    etab?.complementAdresseEtablissement || uniteLegale?.complementAdresseUniteLegale,
    etab?.codePostalEtablissement || uniteLegale?.codePostalUniteLegale,
    etab?.libelleCommuneEtablissement || uniteLegale?.libelleCommuneUniteLegale
  ].filter(Boolean).join(" ").replace(/\s{2,}/g, " ");
  geo = null;
  if (adresse) {
    try {
      const { data: geoData } = await axios.get(API_GEO, { params: { q: adresse, limit: 1 } });
      if (geoData.features?.[0]?.geometry?.coordinates) {
        geo = geoData.features[0].geometry.coordinates;
      }
    } catch (e) {
      geo = null;
    }
  }

  // --- 4. TVA (optionnel) ---
  // (À adapter selon ta logique, ici laissé vide)
  tvaInfo = null;

  // --- 5. Sortie normalisée pour affichage ---
  // Prend les infos de l’établissement si possible, sinon de l’unité légale
  const base = etab || uniteLegale || {};

  return {
    denomination: base.denominationUniteLegale || base.denomination || base.nom || "",
    siren: base.siren || siren,
    siret: base.siret || siret,
    adresse,
    geo: geo ? { lat: geo[1], lon: geo[0] } : null,
    code_ape: base.activitePrincipaleEtablissement || base.activitePrincipaleUniteLegale || "",
    libelle_ape: decodeNaf(base.activitePrincipaleEtablissement || base.activitePrincipaleUniteLegale || ""),
    forme_juridique: decodeFormeJuridique(base.categorieJuridiqueUniteLegale || ""),
    date_creation: base.dateCreationEtablissement || base.dateCreationUniteLegale || "",
    capital_social: base.capitalSocial || inpiInfo.capital || null,
    effectif: base.trancheEffectifsEtablissement || base.trancheEffectifsUniteLegale || inpiInfo.effectif || null,
    tva: tvaInfo,
    // Onglets enrichis via INPI
    representants: inpiInfo.dirigeants || [],
    documents: inpiInfo.documents || [],
    annonces: inpiInfo.annonces || [],
    finances: inpiInfo.finances || [],
    labels: inpiInfo.labels || [],
    divers: inpiInfo.divers || [],
  };
}
