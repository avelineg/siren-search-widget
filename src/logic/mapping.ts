import axios from "axios";

const API_SIRENE = "https://api.insee.fr/api-sirene/3.11";
const API_GEO = "https://api-adresse.data.gouv.fr/search/";
const API_INPI = import.meta.env.VITE_API_URL + "/inpi/entreprise/";
const API_VIES = import.meta.env.VITE_VAT_API_URL + "/check-vat";

export async function fetchEtablissementData(siretOrSiren: string) {
  let etab: any = null, uniteLegale: any = null, geo = null, tvaInfo = null, inpiInfo: any = {};
  let siret = "", siren = "";

  const SIRENE_API_KEY = import.meta.env.VITE_SIRENE_API_KEY;

  if (/^\d{14}$/.test(siretOrSiren)) {
    // SIRET => fiche établissement
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
    // SIREN => fiche unité légale
    siren = siretOrSiren;
    try {
      const { data } = await axios.get(
        `${API_SIRENE}/siren/${siren}`,
        { headers: { "X-INSEE-Api-Key-Integration": SIRENE_API_KEY } }
      );
      uniteLegale = data.uniteLegale;
      if (!uniteLegale) throw new Error("Aucune unité légale trouvée pour ce SIREN.");
      // On ne cherche plus d'établissement principal secondaire ici
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

  // Géocodage adresse principale (si possible)
let adresse = [
  etab?.numeroVoieEtablissement,
  etab?.typeVoieEtablissement,
  etab?.libelleVoieEtablissement,
  etab?.complementAdresseEtablissement,
  etab?.codePostalEtablissement,
  etab?.libelleCommuneEtablissement
].filter(Boolean).join(" ").replace(/\s{2,}/g, " ");
  geo = null;
  if (adresse) {
    try {
      const { data: geoData } = await axios.get(API_GEO, { params: { q: adresse, limit: 1 } });
      if (geoData.features?.[0]?.geometry?.coordinates) {
        geo = {
          lon: geoData.features[0].geometry.coordinates[0],
          lat: geoData.features[0].geometry.coordinates[1]
        };
      }
    } catch {}
  }

  // Numéro TVA (VIES)
  tvaInfo = null;
  if (siren) {
    const tvaNum = calculateTvaKey(siren);
    try {
      const { data: vies } = await axios.get(`${API_VIES}?countryCode=FR&vatNumber=${tvaNum.slice(2)}`);
      tvaInfo = { numero: tvaNum, valide: vies.valid };
    } catch {
      tvaInfo = { numero: tvaNum, valide: null };
    }
  }

  // INPI (si proxy backend pour CORS !)
  inpiInfo = {};
  try {
    const { data: inpi } = await axios.get(`${API_INPI}${siren}`);
    inpiInfo = {
      dirigeants: (inpi.representants || []).map((dir: any) => ({
        nom: dir.nom,
        prenom: dir.prenom,
        qualite: dir.qualite
      })),
      formalites: inpi.formalites || [],
      historique: inpi.historique || []
    };
  } catch {
    inpiInfo = { dirigeants: [], formalites: [], historique: [] };
  }

  // Résultat final
  return {
    siret: etab?.siret,
    denomination: etab?.denominationEtablissement || uniteLegale?.denominationUniteLegale,
    adresse,
    code_ape: etab?.activitePrincipaleEtablissement,
    libelle_ape: etab?.libelleActivitePrincipaleEtablissement,
    forme_juridique: uniteLegale?.categorieJuridiqueUniteLegale,
    date_creation: etab?.dateCreationEtablissement,
    unite_legale: uniteLegale
      ? {
          siren: uniteLegale.siren,
          denomination: uniteLegale.denominationUniteLegale,
          forme_juridique: uniteLegale.categorieJuridiqueUniteLegale
        }
      : undefined,
    // Plus d'établissements secondaires ni de /etablissements !
    etablissements_secondaires: [],
    geo,
    tva: tvaInfo,
    representants: inpiInfo.dirigeants || [],
    formalites: inpiInfo.formalites || [],
    historique: inpiInfo.historique || []
  };
}

// Calcul clé TVA à partir du SIREN
function calculateTvaKey(siren: string): string {
  const key = (12 + 3 * (Number(siren) % 97)) % 97;
  return `FR${key.toString().padStart(2, "0")}${siren}`;
}
