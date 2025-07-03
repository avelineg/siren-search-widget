import { getEntrepriseBySiren } from './inpiBackend'
import { sirene, recherche } from './api'
import { tvaFRFromSiren } from './tva'
import naf from '../naf.json'
import formesJuridique from '../formeJuridique.json'
import { effectifTrancheLabel } from './effectifs'

/**
 * Recherche par nom de société : NE DOIT PAS interroger INPI, uniquement l'API Recherche Entreprise.
 */
export async function searchEtablissementsByName(name: string) {
  // Appelle uniquement l'API "recherche entreprise" (ex: SIRENE/recherche)
  const results = await recherche
    .get('/search', {
      params: { q: name, page: 1, per_page: 20 }
    })
    .then(r => r.data.results || [])
    .catch(() => []);

  // Ajoute displayName pour affichage
  return Array.isArray(results)
    ? results.map(r => ({
        ...r,
        displayName:
          r.denomination ||
          r.nom_raison_sociale ||
          r.raison_sociale ||
          r.name ||
          r.nom ||
          "-",
      }))
    : [];
}

/**
 * Utilitaire pour extraire une propriété imbriquée dans un objet (type lodash get)
 */
function getInpi(path: string, obj: any) {
  return path.split('.').reduce((acc, key) => (acc && acc[key] != null ? acc[key] : undefined), obj);
}

/**
 * Récupère le libellé détaillé (description) du code APE depuis les activités INPI
 */
function getLibelleApeFromINPI(inpiData: any): string | undefined {
  const activites = getInpi('formality.content.activites', inpiData);
  if (Array.isArray(activites)) {
    const principale = activites.find(act => act.codeApe || act.principale) || activites[0];
    if (principale && principale.descriptionDetaillee) {
      return principale.descriptionDetaillee;
    }
  }
  return undefined;
}

/**
 * Récupère le nom de l'activité à partir du code APE, via naf.json
 */
function getApeLabelFromNAF(codeApe: string): string | undefined {
  if (!codeApe) return undefined;
  // codeApe peut être au format "6920Z"
  return naf[codeApe] || undefined;
}

/**
 * Récupère le nom de la forme juridique à partir du code, via formeJuridique.json
 */
function getFormeJuridiqueLabel(code: string): string | undefined {
  if (!code) return undefined;
  // code peut être sous forme "5710"
  return formesJuridique[code] || undefined;
}

/**
 * Format une adresse SIRENE (objet plat avec numeroVoieEtablissement, typeVoieEtablissement, libelleVoieEtablissement, codePostalEtablissement, libelleCommuneEtablissement)
 */
function formatAdresseSIRENE(adresseObj: any): string {
  if (!adresseObj || typeof adresseObj !== "object") return "-";
  return [
    adresseObj.numeroVoieEtablissement,
    adresseObj.typeVoieEtablissement,
    adresseObj.libelleVoieEtablissement,
    adresseObj.codePostalEtablissement,
    adresseObj.libelleCommuneEtablissement,
  ].filter(Boolean).join(' ');
}

// Mapping principal pour SIREN (fiche détaillée)
export async function fetchEtablissementBySiren(siren: string) {
  const [
    inpiDataRaw,
    rechercheDataRaw,
    sireneULRaw,
    etablissementsRaw
  ] = await Promise.all([
    getEntrepriseBySiren(siren).catch(() => ({})),
    recherche.get('/search', { params: { q: siren, page: 1, per_page: 1 } }).then(r => r.data).catch(() => ({})),
    sirene.get(`/siren/${siren}`).then(r => r.data.uniteLegale).catch(() => ({})),
    sirene.get(`/siren/${siren}/etablissements`).then(r => r.data.etablissements).catch(() => ([])),
  ]);

  const inpiData = inpiDataRaw || {};
  const rechercheData = rechercheDataRaw || {};
  const sireneUL = sireneULRaw || {};

  // Dénomination (INPI prioritaire, sinon fallback)
  const denomination =
    getInpi("formality.content.personneMorale.identite.entreprise.denomination", inpiData) ||
    inpiData.denomination ||
    getInpi("formality.content.personneMorale.identite.entreprise.nom", inpiData) ||
    (rechercheData?.results?.[0]?.denomination) ||
    (rechercheData?.results?.[0]?.nom_raison_sociale) ||
    sireneUL.denominationUniteLegale ||
    "-";

  const nom_commercial =
    getInpi("formality.content.personneMorale.identite.entreprise.nomCommercial", inpiData) ||
    inpiData.tradeName ||
    (rechercheData?.results?.[0]?.nom_commercial) ||
    sireneUL.nomCommercialUniteLegale ||
    "-";

  const forme_juridique_code =
    getInpi("formality.content.personneMorale.identite.entreprise.formeJuridique", inpiData) ||
    inpiData.legalForm ||
    sireneUL.categorieJuridiqueUniteLegale ||
    (rechercheData?.results?.[0]?.categorie_juridique) ||
    "-";
  const forme_juridique =
    getFormeJuridiqueLabel(forme_juridique_code) ||
    sireneUL.libelleCategorieJuridiqueUniteLegale ||
    forme_juridique_code;

  const sigle =
    getInpi("formality.content.personneMorale.identite.entreprise.sigle", inpiData) ||
    inpiData.acronym ||
    (rechercheData?.results?.[0]?.sigle) ||
    sireneUL.sigleUniteLegale ||
    "-";

  const code_ape =
    getInpi("formality.content.personneMorale.identite.entreprise.codeApe", inpiData) ||
    inpiData.ape ||
    sireneUL.activitePrincipaleUniteLegale ||
    (rechercheData?.results?.[0]?.code_ape) ||
    "-";
  const libelle_ape =
    getLibelleApeFromINPI(inpiData) ||
    sireneUL.libelleActivitePrincipaleUniteLegale ||
    getApeLabelFromNAF(code_ape) ||
    (rechercheData?.results?.[0]?.libelle_ape) ||
    "-";

  const capital_social =
    getInpi("formality.content.personneMorale.identite.description.montantCapital", inpiData) ||
    getInpi("formality.content.description.montantCapital", inpiData) ||
    inpiData.shareCapital ||
    sireneUL.capitalSocial ||
    (inpiData.financialStatements?.[0]?.shareCapital) ||
    "-";

  const date_creation =
    getInpi("formality.content.personneMorale.identite.entreprise.dateDebutActiv", inpiData) ||
    getInpi("formality.content.personneMorale.identite.entreprise.dateImmat", inpiData) ||
    inpiData.creationDate ||
    (rechercheData?.results?.[0]?.date_creation) ||
    sireneUL.dateCreationUniteLegale ||
    "-";

  // Adresse principale (siège social)
  const sireneAdresseObj = sireneUL?.adresseEtablissement;
  const sireneAdresse = formatAdresseSIRENE(sireneAdresseObj);

  const rechercheAdresse = (rechercheData?.results?.[0]?.adresse && typeof rechercheData?.results?.[0]?.adresse === "string")
    ? rechercheData?.results?.[0]?.adresse
    : undefined;

  const adresse =
    rechercheAdresse && rechercheAdresse !== "-" ? rechercheAdresse
    : sireneAdresse && sireneAdresse !== "-" ? sireneAdresse
    : "-";

  // Effectifs
  const tranche_effectifs_code =
    getInpi("formality.content.personneMorale.identite.entreprise.trancheEffectifs", inpiData) ||
    inpiData.workforceLabel ||
    (rechercheData?.results?.[0]?.tranche_effectifs) ||
    sireneUL.trancheEffectifsUniteLegale ||
    "-";
  const tranche_effectifs =
    effectifTrancheLabel(tranche_effectifs_code) || tranche_effectifs_code;

  const tranche_effectif_salarie =
    inpiData.workforceRange ||
    (rechercheData?.results?.[0]?.tranche_effectif_salarie) ||
    sireneUL.trancheEffectifsUniteLegale ||
    "-";

  // TVA
  const tvaNum = tvaFRFromSiren(siren);
  let tvaValide: boolean | null = null;

  // Données financières INPI
  const finances = inpiData.financialStatements?.length
    ? inpiData.financialStatements.map((f: any) => ({
        exercice: f.fiscalYear,
        ca: f.turnover,
        resultat_net: f.netResult,
        effectif: f.workforce,
        capital_social: f.shareCapital
      }))
    : [];

  // Etablissements (liste de tous les établissements du SIREN)
  let etablissements = Array.isArray(etablissementsRaw) ? etablissementsRaw.map((etab: any) => ({
    ...etab,
    displayName:
      etab.denomination ||
      etab.nom_raison_sociale ||
      etab.raison_sociale ||
      etab.name ||
      etab.nom_commercial ||
      "-",
    adresse: formatAdresseSIRENE(etab.adresseEtablissement),
  })) : [];

  // Dirigeants
  let dirigeants = [];
  const pouvoirs = getInpi("formality.content.personneMorale.composition.pouvoirs", inpiData);
  if (Array.isArray(pouvoirs)) {
    dirigeants = pouvoirs.map((p: any) => {
      if (p.individu?.descriptionPersonne) {
        return {
          nom: p.individu.descriptionPersonne.nom,
          prenoms: p.individu.descriptionPersonne.prenoms,
          genre: p.individu.descriptionPersonne.genre,
          dateNaissance: p.individu.descriptionPersonne.dateDeNaissance,
          role: p.individu.descriptionPersonne.role
        };
      }
      if (p.entreprise) {
        return {
          nom: p.entreprise.denomination,
          siren: p.entreprise.siren,
          role: p.roleEntreprise
        };
      }
      return p;
    });
  }
  if (!dirigeants.length) {
    if (rechercheData?.results?.length) {
      const match = rechercheData.results.find((r: any) => r.siren === siren)
      if (match) {
        dirigeants = match.dirigeants || [];
      }
    }
  }

  // Divers
  const statut_diffusion =
    inpiData.publicationStatus ||
    (rechercheData?.results?.[0]?.statut_diffusion) ||
    sireneUL.statutDiffusionUniteLegale ||
    "-";

  const caractere_employeur =
    inpiData.employerCharacteristic ||
    (rechercheData?.results?.[0]?.caractere_employeur) ||
    sireneUL.caractereEmployeurUniteLegale ||
    "-";

  const site_web =
    inpiData.website ||
    (rechercheData?.results?.[0]?.site_web) ||
    "-";

  const email =
    inpiData.email ||
    (rechercheData?.results?.[0]?.email) ||
    "-";

  return {
    denomination,
    forme_juridique,
    categorie_juridique: forme_juridique_code,
    sigle,
    nom_commercial,
    siren,
    siret: etablissements.find(e => e.siege) ? etablissements.find(e => e.siege).siret : (etablissements[0]?.siret || "-"),
    tva: { numero: tvaNum || '-', valide: tvaValide },
    code_ape,
    libelle_ape,
    tranche_effectifs,
    tranche_effectif_salarie,
    capital_social: capital_social !== undefined ? capital_social : "-",
    date_creation,
    adresse,
    etablissements,
    dirigeants,
    finances,
    statut_diffusion,
    caractere_employeur,
    site_web,
    email,
    inpiRaw: inpiDataRaw
  };
}

// Mapping principal pour SIRET (fiche détaillée)
export async function fetchEtablissementBySiret(siret: string) {
  const siren = siret.slice(0, 9)
  const [
    inpiDataRaw,
    sireneEtabRaw,
    sireneULRaw,
    etablissementsRaw // <-- pour afficher la liste dans la fiche SIRET également
  ] = await Promise.all([
    getEntrepriseBySiren(siren).catch(() => ({})),
    sirene.get(`/siret/${siret}`).then(r => r.data.etablissement).catch(() => ({})),
    sirene.get(`/siren/${siren}`).then(r => r.data.uniteLegale).catch(() => ({})),
    sirene.get(`/siren/${siren}/etablissements`).then(r => r.data.etablissements).catch(() => ([])),
  ]);

  const inpiData = inpiDataRaw || {};
  const sireneEtab = sireneEtabRaw || {};
  const sireneUL = sireneULRaw || {};

  // Champs principaux
  const denomination =
    getInpi("formality.content.personneMorale.identite.entreprise.denomination", inpiData) ||
    inpiData.denomination ||
    getInpi("formality.content.personneMorale.identite.entreprise.nom", inpiData) ||
    sireneUL.denominationUniteLegale ||
    "-";

  const nom_commercial =
    getInpi("formality.content.personneMorale.identite.entreprise.nomCommercial", inpiData) ||
    inpiData.tradeName ||
    sireneEtab.nomCommercialEtablissement ||
    sireneUL.nomCommercialUniteLegale ||
    "-";

  const forme_juridique_code =
    getInpi("formality.content.personneMorale.identite.entreprise.formeJuridique", inpiData) ||
    inpiData.legalForm ||
    sireneUL.categorieJuridiqueUniteLegale ||
    "-";
  const forme_juridique =
    getFormeJuridiqueLabel(forme_juridique_code) ||
    sireneUL.libelleCategorieJuridiqueUniteLegale ||
    forme_juridique_code;

  const sigle =
    getInpi("formality.content.personneMorale.identite.entreprise.sigle", inpiData) ||
    inpiData.acronym ||
    sireneUL.sigleUniteLegale ||
    "-";

  const code_ape =
    getInpi("formality.content.personneMorale.identite.entreprise.codeApe", inpiData) ||
    sireneEtab.activitePrincipaleEtablissement ||
    inpiData.ape ||
    sireneUL.activitePrincipaleUniteLegale ||
    "-";
  const libelle_ape =
    getLibelleApeFromINPI(inpiData) ||
    sireneUL.libelleActivitePrincipaleUniteLegale ||
    getApeLabelFromNAF(code_ape) ||
    "-";

  const capital_social =
    getInpi("formality.content.personneMorale.identite.description.montantCapital", inpiData) ||
    getInpi("formality.content.description.montantCapital", inpiData) ||
    inpiData.shareCapital ||
    sireneUL.capitalSocial ||
    "-";

  const date_creation =
    getInpi("formality.content.personneMorale.identite.entreprise.dateDebutActiv", inpiData) ||
    getInpi("formality.content.personneMorale.identite.entreprise.dateImmat", inpiData) ||
    sireneEtab.dateCreationEtablissement ||
    inpiData.creationDate ||
    sireneUL.dateCreationUniteLegale ||
    "-";

  // Adresse = ADRESSE DE L'ETABLISSEMENT (jamais celle du siège/SIREN)
  const sireneAdresseObj = sireneEtab?.adresseEtablissement;
  const sireneAdresse = formatAdresseSIRENE(sireneAdresseObj);
  const adresse = sireneAdresse && sireneAdresse !== "-" ? sireneAdresse : "-";

  // Effectifs
  const tranche_effectifs_code =
    getInpi("formality.content.personneMorale.identite.entreprise.trancheEffectifs", inpiData) ||
    inpiData.workforceLabel ||
    sireneUL.trancheEffectifsUniteLegale ||
    "-";
  const tranche_effectifs =
    effectifTrancheLabel(tranche_effectifs_code) || tranche_effectifs_code;

  const tranche_effectif_salarie =
    inpiData.workforceRange ||
    sireneUL.trancheEffectifsUniteLegale ||
    "-";

  // TVA
  const tvaNum = tvaFRFromSiren(siren);
  let tvaValide: boolean | null = null;

  // Données financières INPI
  const finances = inpiData.financialStatements?.length
    ? inpiData.financialStatements.map((f: any) => ({
        exercice: f.fiscalYear,
        ca: f.turnover,
        resultat_net: f.netResult,
        effectif: f.workforce,
        capital_social: f.shareCapital
      }))
    : [];

  // Etablissements (liste de tous les établissements du SIREN parent pour navigation)
  let etablissements = Array.isArray(etablissementsRaw) ? etablissementsRaw.map((etab: any) => ({
    ...etab,
    displayName:
      etab.denomination ||
      etab.nom_raison_sociale ||
      etab.raison_sociale ||
      etab.name ||
      etab.nom_commercial ||
      "-",
    adresse: formatAdresseSIRENE(etab.adresseEtablissement),
  })) : [];

  // Dirigeants
  let dirigeants = [];
  const pouvoirs = getInpi("formality.content.personneMorale.composition.pouvoirs", inpiData);
  if (Array.isArray(pouvoirs)) {
    dirigeants = pouvoirs.map((p: any) => {
      if (p.individu?.descriptionPersonne) {
        return {
          nom: p.individu.descriptionPersonne.nom,
          prenoms: p.individu.descriptionPersonne.prenoms,
          genre: p.individu.descriptionPersonne.genre,
          dateNaissance: p.individu.descriptionPersonne.dateDeNaissance,
          role: p.individu.descriptionPersonne.role
        };
      }
      if (p.entreprise) {
        return {
          nom: p.entreprise.denomination,
          siren: p.entreprise.siren,
          role: p.roleEntreprise
        };
      }
      return p;
    });
  }

  // Divers
  const statut_diffusion =
    inpiData.publicationStatus ||
    sireneUL.statutDiffusionUniteLegale ||
    "-";

  const caractere_employeur =
    inpiData.employerCharacteristic ||
    sireneUL.caractereEmployeurUniteLegale ||
    "-";

  const site_web =
    inpiData.website ||
    "-";

  const email =
    inpiData.email ||
    "-";

  return {
    denomination,
    forme_juridique,
    categorie_juridique: forme_juridique_code,
    sigle,
    nom_commercial,
    siren,
    siret,
    tva: { numero: tvaNum || '-', valide: tvaValide },
    code_ape,
    libelle_ape,
    tranche_effectifs,
    tranche_effectif_salarie,
    capital_social: capital_social !== undefined ? capital_social : "-",
    date_creation,
    adresse,
    etablissements,
    dirigeants,
    finances,
    statut_diffusion,
    caractere_employeur,
    site_web,
    email,
    inpiRaw: inpiDataRaw
  };
}

// Routeur intelligent
export async function fetchEtablissementByCode(code: string) {
  if (/^\d{14}$/.test(code)) {
    return fetchEtablissementBySiret(code);
  } else if (/^\d{9}$/.test(code)) {
    return fetchEtablissementBySiren(code);
  } else {
    throw new Error('Code SIREN/SIRET invalide');
  }
}
