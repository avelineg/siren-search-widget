import axios from "axios";

const API_SIRENE = "https://api.insee.fr/api-sirene/3.11"; // https://api.insee.fr/api-sirene/3.11
const SIRENE_API_KEY = "35130283-462e-4f28-991c-ddc18f739e2a";
const API_VIES = "https://check-vat-backend.onrender.com"; // https://check-vat-backend.onrender.com
const API_INPI = "https://hubshare-cmexpert.fr"; // Ton endpoint INPI ou proxy

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

export async function fetchEtablissementData(siretOrSiren: string) {
  if (!API_SIRENE) throw new Error("REACT_APP_API_SIRENE n'est pas définie");
  if (!SIRENE_API_KEY) throw new Error("REACT_APP_SIRENE_API_KEY n'est pas définie");
  if (!API_INPI) throw new Error("REACT_APP_API_INPI n'est pas définie");

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
      { headers: { "X-INSEE-Api-Key-Integration": SIRENE_API_KEY } }
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
      { headers: { "X-INSEE-Api-Key-Integration": SIRENE_API_KEY } }
    );
    uniteLegale = data.uniteLegale;
    numeroTVA = uniteLegale.numeroTvaIntracommunautaire || null;
  } else {
    throw new Error("Merci de fournir un SIRET (14 chiffres) ou SIREN (9 chiffres) valide.");
  }

  // 2. Vérification TVA intracommunautaire via VIES si présent
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

  // 4. Adresse (SIRENE puis fallback INPI possible)
  let adresse = [
    etab?.numeroVoieEtablissement || uniteLegale?.numeroVoieUniteLegale,
    etab?.typeVoieEtablissement || uniteLegale?.typeVoieUniteLegale,
    etab?.libelleVoieEtablissement || uniteLegale?.libelleVoieUniteLegale,
    etab?.complementAdresseEtablissement || uniteLegale?.complementAdresseUniteLegale,
    etab?.codePostalEtablissement || uniteLegale?.codePostalUniteLegale,
    etab?.libelleCommuneEtablissement || uniteLegale?.libelleCommuneUniteLegale
  ].filter(Boolean).join(" ");
  if (!adresse || adresse.trim() === "") {
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
