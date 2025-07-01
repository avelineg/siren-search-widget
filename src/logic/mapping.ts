import axios from "axios";
import { decodeFormeJuridique, decodeNaf } from "./decode";

const API_SIRENE = "https://api.insee.fr/api-sirene/3.11";
const API_GEO = "https://api-adresse.data.gouv.fr/search/";
const API_INPI_ENTREPRISE = import.meta.env.VITE_API_URL + "/inpi/entreprise";
const API_VIES = import.meta.env.VITE_VAT_API_URL + "/check-vat";
const SIRENE_API_KEY = import.meta.env.VITE_SIRENE_API_KEY;

// Format adresse INPI robuste
function formatAdresseINPI(ad: any) {
  if (!ad) return "";
  return [
    ad.numVoie,
    ad.typeVoie,
    ad.voie,
    ad.codePostal,
    ad.commune,
    ad.pays
  ].filter(Boolean).join(" ");
}

// Calcul TVA intracommunautaire
function computeTva(siren: string) {
  const valid = /^\d{9}$/.test(siren) ? siren : "";
  if (!valid) return "";
  const sirenNum = parseInt(siren, 10);
  const cle = (12 + 3 * (sirenNum % 97)) % 97;
  return `FR${cle < 10 ? "0" : ""}${cle}${siren}`;
}

export async function fetchEtablissementData(siretOrSiren: string) {
  let etab: any = null;
  let uniteLegale: any = null;
  let siren = "";
  let inpiData: any = {};
  let geo: [number, number] | null = null;

  // 1) SIRENE
  if (/^\d{14}$/.test(siretOrSiren)) {
    const { data } = await axios.get(`${API_SIRENE}/siret/${siretOrSiren}`, {
      headers: { "X-INSEE-Api-Key-Integration": SIRENE_API_KEY }
    });
    etab = data.etablissement;
    siren = etab.siren;
    uniteLegale = etab.uniteLegale;
  } else {
    siren = siretOrSiren;
    const { data } = await axios.get(`${API_SIRENE}/siren/${siren}`, {
      headers: { "X-INSEE-Api-Key-Integration": SIRENE_API_KEY }
    });
    uniteLegale = data.uniteLegale;
  }

  // 2) INPI fallback
  try {
    const { data } = await axios.get(`${API_INPI_ENTREPRISE}/${siren}`);
    inpiData = data;
  } catch {
    inpiData = {};
  }
  const pm = inpiData.content?.personneMorale ?? {};
  const etabINPI = pm.etablissementPrincipal ?? {};
  const adresseINPI = etabINPI.adresse ?? pm.adresseEntreprise ?? {};

  // 3) Adresse (SIRENE puis INPI)
  let adresse = [
    etab?.numeroVoieEtablissement,
    etab?.typeVoieEtablissement,
    etab?.libelleVoieEtablissement,
    etab?.complementAdresseEtablissement,
    etab?.codePostalEtablissement,
    etab?.libelleCommuneEtablissement
  ].filter(Boolean).join(" ");
  if (!adresse.trim()) {
    adresse = formatAdresseINPI(adresseINPI);
  }

  // 4) Géoloc (uniquement si adresse non vide)
  if (adresse.trim()) {
    try {
      const { data } = await axios.get(API_GEO, {
        params: { q: adresse, limit: 1 }
      });
      const coords = data.features?.[0]?.geometry?.coordinates;
      if (coords) geo = coords;
    } catch {}
  }

  // 5) Identité
  const forme_juridique = decodeFormeJuridique(
    uniteLegale?.categorieJuridiqueUniteLegale ||
      etab?.categorieJuridiqueUniteLegale ||
      inpiData.formeJuridique ||
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
  const siretF = etab?.siret || etabINPI.siret || "";
  const date_creation =
    etab?.dateCreationEtablissement ||
    uniteLegale?.dateCreationUniteLegale ||
    inpiData.dateCreation ||
    "";
  const capital_social = uniteLegale?.capitalSocial ?? pm.montantCapital ?? 0;
  const objet_social = pm.description?.objet ?? "";

  // 6) TVA
  const tvaNum = computeTva(siren);
  let tvaRes = null;
  if (tvaNum) {
    try {
      const { data } = await axios.get(API_VIES, {
        params: { countryCode: "FR", vatNumber: tvaNum.slice(2) }
      });
      tvaRes = { numero: tvaNum, valide: !!data.isValid };
    } catch {
      tvaRes = { numero: tvaNum, valide: null };
    }
  }

  // 7) Actes INPI (v3.0)
  let documents: any[] = [];
  try {
    const { data: actes } = await axios.get(
      `${API_INPI_ENTREPRISE}/${siren}/actes`,
      { params: { page: 0, size: 50 } }
    );
    const content = actes.content || [];
    documents = content.map((a: any) => ({
      titre: a.titre || a.typeDocument,
      dateDepot: a.dateDepot,
      url: a.urlPdf || a.url
    }));
  } catch {
    // pas de documents
  }

  // 8) Autres onglets
  const representants = Array.isArray(pm.composition) ? pm.composition : [];
  const annonces = pm.publicationLegale ? [pm.publicationLegale] : [];
  const finances = capital_social ? [{ montant: capital_social, devise: pm.deviseCapital }] : [];
  const labels = inpiData.labels || [];
  const divers = inpiData.divers || [];

  return {
    denomination,
    siren,
    siret: siretF,
    adresse,
    geo,
    code_ape,
    libelle_ape,
    forme_juridique,
    date_creation,
    capital_social,
    objet_social,
    tva: tvaRes,
    representants,
    documents,
    annonces,
    finances,
    labels,
    divers
  };
}
