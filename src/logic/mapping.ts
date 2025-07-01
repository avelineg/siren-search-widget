import axios from "axios";

// Indique tes URLs / clés dans un fichier config ou via process.env
const API_SIRENE = process.env.REACT_APP_API_SIRENE!;
const SIRENE_API_KEY = process.env.REACT_APP_SIRENE_API_KEY!;
const API_INPI = process.env.REACT_APP_API_INPI!;

function formatAdresseINPI(adresse: any) {
  if (!adresse) return "";
  return [
    adresse.numVoie,
    adresse.typeVoie,
    adresse.voie,
    adresse.codePostal,
    adresse.commune,
    adresse.pays
  ].filter(Boolean).join(" ");
}

export async function fetchEtablissementData(siretOrSiren: string) {
  let etab: any = null;
  let uniteLegale: any = null;
  let geo: any = null;
  let tvaInfo: any = null;
  let inpiData: any = {};
  let siret = "", siren = "";

  // 1. SIRENE (établissement ou unité légale)
  if (/^\d{14}$/.test(siretOrSiren)) {
    siret = siretOrSiren;
    const { data } = await axios.get(
      `${API_SIRENE}/siret/${siret}`,
      { headers: { "X-INSEE-Api-Key-Integration": SIRENE_API_KEY } }
    );
    etab = data.etablissement;
    siren = etab.siren;
    uniteLegale = etab.uniteLegale ?? null;
    geo = {
      lat: etab.geo_adresse?.latitude,
      lon: etab.geo_adresse?.longitude
    };
    tvaInfo = etab.tva ?? null;
  } else if (/^\d{9}$/.test(siretOrSiren)) {
    siren = siretOrSiren;
    const { data } = await axios.get(
      `${API_SIRENE}/siren/${siren}`,
      { headers: { "X-INSEE-Api-Key-Integration": SIRENE_API_KEY } }
    );
    uniteLegale = data.uniteLegale;
  } else {
    throw new Error("Merci de fournir un SIRET (14 chiffres) ou SIREN (9 chiffres) valide.");
  }

  // 2. INPI : pour fallback et onglets
  if (siren) {
    try {
      const { data } = await axios.get(`${API_INPI}${siren}`);
      inpiData = data;
    } catch {
      inpiData = {};
    }
  }
  const pm = inpiData.content?.personneMorale || {};
  const etabINPI = pm.etablissementPrincipal || {};
  const adresseINPI = etabINPI.adresse || pm.adresseEntreprise || {};

  // 3. Adresse (SIRENE puis fallback INPI)
  let adresse = [
    etab?.numeroVoieEtablissement || uniteLegale?.numeroVoieUniteLegale,
    etab?.typeVoieEtablissement   || uniteLegale?.typeVoieUniteLegale,
    etab?.libelleVoieEtablissement|| uniteLegale?.libelleVoieUniteLegale,
    etab?.complementAdresseEtablissement || uniteLegale?.complementAdresseUniteLegale,
    etab?.codePostalEtablissement || uniteLegale?.codePostalUniteLegale,
    etab?.libelleCommuneEtablissement || uniteLegale?.libelleCommuneUniteLegale
  ].filter(Boolean).join(" ");
  if (!adresse || adresse.trim() === "") {
    adresse = formatAdresseINPI(adresseINPI);
  }

  // ... (tu peux ajouter ici les documents, finances, annonces, etc. comme avant)

  // 7. Données secondaires (Dirigeants)
  const representants = Array.isArray(pm.composition)
    ? pm.composition.map((r: any) => ({
        nom:             r.nom,
        prenom:          r.prenom,
        qualite:         r.qualite,
        dateNaissance:   r.naissance?.date      || null,
        lieuNaissance:   r.naissance?.lieu      || null,
        dateNomination:  r.mandat?.dateDebut    || null,
        dateFinMandat:   r.mandat?.dateFin      || null,
      }))
    : [];

  return {
    // fusionne ici toutes les données que tu renvoyais avant
    siren,
    siret,
    etab,
    uniteLegale,
    geo,
    tva: tvaInfo,
    adresse,
    // ... autres champs (documents, finances, annonces, ...)
    representants,
    // ... labels, divers, etc.
  };
}
