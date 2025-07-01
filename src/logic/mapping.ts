import axios from "axios";

const API_SIRENE = import.meta.env.REACT_APP_API_SIRENE;
const SIRENE_API_KEY = import.meta.env.REACT_APP_SIRENE_API_KEY;
const API_VIES = import.meta.env.REACT_APP_API_VIES;
const API_INPI = import.meta.env.REACT_APP_API_INPI;


function formatAdresseINPI(adresse: any) {
  if (!adresse) return "";
  return [
    adresse.numVoie,
    adresse.voie,
    adresse.codePostal,
    adresse.commune,
    adresse.pays
  ].filter(Boolean).join(" ");
}

/**
 * Récupère les infos via SIRENE, VIES (TVA), et INPI (dirigeants)
 * @param siretOrSiren string SIRET (14 chiffres) ou SIREN (9 chiffres)
 */
export async function fetchEtablissementData(siretOrSiren: string) {
  // SUPPRESSION des erreurs bloquantes sur les variables d'environnement

  let etab: any = null;
  let uniteLegale: any = null;
  let geo: any = null;
  let siret = "", siren = "";
  let numeroTVA = null;
  let tvaValidity = null;

  // 1. Recherche SIRENE (établissement ou unité légale)
  if (/^\d{14}$/.test(siretOrSiren)) {
    siret = siretOrSiren;
    const { data } = await axios.get(
      `${API_SIRENE}/siret/${siret}`,
      SIRENE_API_KEY ? { headers: { "X-INSEE-Api-Key-Integration": SIRENE_API_KEY } } : {}
    );
    etab = data.etablissement;
    siren = etab.siren;
    uniteLegale = etab.uniteLegale ?? null;
    geo = {
      lat: etab.latitude,
      lon: etab.longitude
    };
    numeroTVA = etab.numeroTvaIntracommunautaire || null;
  } else if (/^\d{9}$/.test(siretOrSiren)) {
    siren = siretOrSiren;
    const { data } = await axios.get(
      `${API_SIRENE}/siren/${siren}`,
      SIRENE_API_KEY ? { headers: { "X-INSEE-Api-Key-Integration": SIRENE_API_KEY } } : {}
    );
    uniteLegale = data.uniteLegale;
    numeroTVA = uniteLegale.numeroTvaIntracommunautaire || null;
  } else {
    throw new Error("Merci de fournir un SIRET (14 chiffres) ou SIREN (9 chiffres) valide.");
  }

  // 2. Vérification TVA intracommunautaire via VIES si présente
  if (numeroTVA && API_VIES) {
    try {
      const { data } = await axios.get(
        `${API_VIES}/vies/${numeroTVA.replace(/\s/g, "")}`
      );
      tvaValidity = data.valid ? true : false;
    } catch (e) {
      tvaValidity = null;
    }
  }

  // 3. Récupération INPI pour dirigeants, etc.
  let representants: any[] = [];
  if (API_INPI && siren) {
    try {
      const { data: inpiData } = await axios.get(`${API_INPI}${siren}`);
      const pm = inpiData.content?.personneMorale || {};
      const reps = Array.isArray(pm.composition)
        ? pm.composition.map((r: any) => ({
            nom: r.nom,
            prenom: r.prenom,
            qualite: r.qualite,
            dateNaissance: r.naissance?.date || null,
            lieuNaissance: r.naissance?.lieu || null,
            dateNomination: r.mandat?.dateDebut || null,
            dateFinMandat: r.mandat?.dateFin || null,
          }))
        : [];
      representants = reps;
    } catch (e) {
      representants = [];
    }
  }

  // 4. Adresse (SIRENE puis fallback INPI possible)
  let adresse = [
    etab?.numeroVoieEtablissement || uniteLegale?.numeroVoieUniteLegale,
    etab?.typeVoieEtablissement || uniteLegale?.typeVoieUniteLegale,
    etab?.libelleVoieEtablissement || uniteLegale?.libelleVoieUniteLegale,
    etab?.complementAdresseEtablissement || uniteLegale?.complementAdresseUniteLegale,
    etab?.codePostalEtablissement || uniteLegale?.codePostalUniteLegale,
    etab?.libelleCommuneEtablissement || uniteLegale?.libelleCommuneUniteLegale
  ].filter(Boolean).join(" ");
  if ((!adresse || adresse.trim() === "") && API_INPI && siren) {
    // Optionnel : fallback adresse INPI si rien côté SIRENE (à adapter selon structure INPI)
    try {
      const { data: inpiData } = await axios.get(`${API_INPI}${siren}`);
      const pm = inpiData.content?.personneMorale || {};
      const etabINPI = pm.etablissementPrincipal || {};
      const adresseINPI = etabINPI.adresse || pm.adresseEntreprise || {};
      adresse = formatAdresseINPI(adresseINPI);
    } catch {}
  }

  return {
    siren,
    siret,
    etab,
    uniteLegale,
    geo,
    adresse,
    numeroTVA,
    tvaValidity,
    representants,
  };
}
