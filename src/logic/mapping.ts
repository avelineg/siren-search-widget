import axios from "axios";
import formeJuridique from "../formeJuridique.json";
import naf from "../naf.json";

const API_SIRENE = "https://api.insee.fr/api-sirene/3.11";
const API_GEO = "https://api-adresse.data.gouv.fr/search/";
const API_INPI = import.meta.env.VITE_API_URL + "/inpi/entreprise/";
const API_ACTES = import.meta.env.VITE_API_URL + "/inpi/actes/"; // adapte si besoin
const API_VIES = import.meta.env.VITE_VAT_API_URL + "/check-vat";
const SIRENE_API_KEY = import.meta.env.VITE_SIRENE_API_KEY;

// Décodage des codes
function decodeFormeJuridique(code: string) {
  return formeJuridique[code] || code;
}
function decodeNaf(code: string) {
  return naf[code] || code;
}

// Formatage de l'adresse INPI
function formatAdresseINPI(adresse: any) {
  if (!adresse) return "";
  return [
    adresse.numVoie,
    adresse.typeVoie,
    adresse.voie,
    adresse.codePostal,
    adresse.commune
  ].filter(Boolean).join(" ");
}

// Calcul du numéro de TVA intracommunautaire (FR)
function computeTva(siren: string) {
  if (!/^\d{9}$/.test(siren)) return "";
  // Algorithme officiel pour la France (ISO 3166-1 alpha-2 : FR)
  const sirenNum = parseInt(siren, 10);
  const cle = (12 + 3 * (sirenNum % 97)) % 97;
  return `FR${cle < 10 ? "0" : ""}${cle}${siren}`;
}

export async function fetchEtablissementData(siretOrSiren: string) {
  let etab: any = null, uniteLegale: any = null, geo = null, tvaInfo = null, inpiInfo: any = {};
  let siret = "", siren = "";

  // 1. SIRENE (établissement ou unité légale)
  if (/^\d{14}$/.test(siretOrSiren)) {
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

  // 2. INPI : pour fallback et onglets
  let inpiData: any = {};
  if (siren) {
    try {
      const { data } = await axios.get(`${API_INPI}${siren}`);
      inpiData = data;
    } catch (e) {
      inpiData = {};
    }
  }
  // Racourcis INPI
  const pm = inpiData.content?.personneMorale || {};
  const etabINPI = pm.etablissementPrincipal || {};
  const adresseINPI = etabINPI.adresse || pm.adresseEntreprise || {};

  // 3. Adresse (SIRENE puis fallback INPI)
  let adresse = [
    etab?.numeroVoieEtablissement || uniteLegale?.numeroVoieUniteLegale,
    etab?.typeVoieEtablissement || uniteLegale?.typeVoieUniteLegale,
    etab?.libelleVoieEtablissement || uniteLegale?.libelleVoieUniteLegale,
    etab?.complementAdresseEtablissement || uniteLegale?.complementAdresseUniteLegale,
    etab?.codePostalEtablissement || uniteLegale?.codePostalUniteLegale,
    etab?.libelleCommuneEtablissement || uniteLegale?.libelleCommuneUniteLegale
  ].filter(Boolean).join(" ");
  if (!adresse) adresse = formatAdresseINPI(adresseINPI);

  // 4. Géolocalisation
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

  // 5. Champs identité avec fallback INPI
  const forme_juridique =
    decodeFormeJuridique(
      uniteLegale?.categorieJuridiqueUniteLegale ||
      etab?.categorieJuridiqueUniteLegale ||
      inpiData.formeJuridique ||
      inpiData.formeJuridiqueInsee ||
      pm.formeJuridique ||
      ""
    );
  const denomination =
    uniteLegale?.denominationUniteLegale ||
    pm.enseigne ||
    pm.nomCommercial ||
    pm.denomination ||
    "";
  const code_ape =
    etab?.activitePrincipaleEtablissement ||
    uniteLegale?.activitePrincipaleUniteLegale ||
    etabINPI.codeApe ||
    "";
  const libelle_ape = decodeNaf(code_ape);
  const siretF =
    etab?.siret ||
    etabINPI.siret ||
    "";
  const date_creation =
    etab?.dateCreationEtablissement ||
    uniteLegale?.dateCreationUniteLegale ||
    inpiData.dateCreation ||
    "";
  const capital_social =
    uniteLegale?.capitalSocial ||
    pm.montantCapital ||
    null;
  const objet_social =
    pm.description?.objet || "";

  // 6. Numéro TVA + vérification VIES
  let tvaValue = "";
  if ((inpiData.siren || siren) && /^\d{9}$/.test(inpiData.siren || siren)) {
    tvaValue = computeTva(inpiData.siren || siren);
  }

  let tvaInfoRes: null | { numero: string; valide: boolean|null } = null;
  if (tvaValue) {
    try {
      const { data } = await axios.get(API_VIES, { params: { countryCode: "FR", vatNumber: tvaValue.slice(2) } });
      tvaInfoRes = { numero: tvaValue, valide: !!data.isValid };
    } catch (e) {
      tvaInfoRes = { numero: tvaValue, valide: null };
    }
  }

  // 7. Données secondaires (onglets)
  const representants = pm.composition || [];
  // Doc INPI actes : pour la liste des actes avec lien de téléchargement
  let documents: any[] = [];
  try {
    if (siren) {
      const { data: actes } = await axios.get(`${API_ACTES}${siren}`);
      documents = (actes || []).map((a: any) => ({
        titre: a.titre || a.typeDocument,
        dateDepot: a.dateDepot,
        url: a.urlPdf || a.url, // selon la clé fournie par l’API actes
      }));
    }
  } catch (e) {
    documents = [];
  }
  const annonces = pm.publicationLegale ? [pm.publicationLegale] : [];
  const finances = pm.montantCapital ? [{ montant: pm.montantCapital, devise: pm.deviseCapital }] : [];
  const labels = inpiData.labels || [];
  const divers = inpiData.divers || [];

  return {
    denomination,
    siren: inpiData.siren || uniteLegale?.siren || etab?.siren || "",
    siret: siretF,
    adresse,
    geo: geo ? { lat: geo[1], lon: geo[0] } : null,
    code_ape,
    libelle_ape,
    forme_juridique,
    date_creation,
    capital_social,
    objet_social,
    tva: tvaInfoRes,
    representants,
    documents,
    annonces,
    finances,
    labels,
    divers,
  };
}
