import { getEntrepriseBySiren, searchEntreprisesByRaisonSociale } from './inpiBackend'
import { sirene, vies, recherche } from './api'
import { tvaFRFromSiren } from './tva'

/**
 * Utilitaire pour extraire une propriété imbriquée dans un objet (type lodash get)
 * @param path - chemin sous forme 'prop1.prop2.prop3'
 * @param obj - objet source
 */
function getInpi(path: string, obj: any) {
  return path.split('.').reduce((acc, key) => (acc && acc[key] != null ? acc[key] : undefined), obj);
}

export async function searchEtablissementsByName(name: string) {
  return await searchEntreprisesByRaisonSociale(name);
}

// Mapping principal pour SIREN
export async function fetchEtablissementBySiren(siren: string) {
  const [
    inpiDataRaw,
    rechercheDataRaw,
    sireneULRaw
  ] = await Promise.all([
    getEntrepriseBySiren(siren).catch(() => ({})),
    recherche.get('/search', { params: { q: siren, page: 1, per_page: 1 } }).then(r => r.data).catch(() => ({})),
    sirene.get(`/siren/${siren}`).then(r => r.data.uniteLegale).catch(() => ({}))
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

  const forme_juridique =
    getInpi("formality.content.personneMorale.identite.entreprise.formeJuridique", inpiData) ||
    inpiData.legalForm ||
    sireneUL.libelleCategorieJuridiqueUniteLegale ||
    (rechercheData?.results?.[0]?.forme_juridique) ||
    "-";

  const categorie_juridique =
    getInpi("formality.content.personneMorale.identite.entreprise.formeJuridique", inpiData) ||
    inpiData.legalCategory ||
    sireneUL.categorieJuridiqueUniteLegale ||
    (rechercheData?.results?.[0]?.categorie_juridique) ||
    "-";

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
    sireneUL.libelleActivitePrincipaleUniteLegale ||
    inpiData.apeLabel ||
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

  // Adresse principale
  const adresseObj = getInpi("formality.content.personneMorale.adresseEntreprise.adresse", inpiData);
  const adresse =
    adresseObj
      ? [adresseObj.numVoie, adresseObj.voie, adresseObj.codePostal, adresseObj.commune].filter(Boolean).join(" ")
      : (
        inpiData.address ||
        (rechercheData?.results?.[0]?.adresse) ||
        sireneUL.adresseEtablissement ||
        "-"
      );

  // Effectifs
  const tranche_effectifs =
    getInpi("formality.content.personneMorale.identite.entreprise.trancheEffectifs", inpiData) ||
    inpiData.workforceLabel ||
    (rechercheData?.results?.[0]?.tranche_effectifs) ||
    sireneUL.trancheEffectifsUniteLegale ||
    "-";

  const tranche_effectif_salarie =
    inpiData.workforceRange ||
    (rechercheData?.results?.[0]?.tranche_effectif_salarie) ||
    sireneUL.trancheEffectifsUniteLegale ||
    "-";

  // TVA
  const tvaNum = tvaFRFromSiren(siren);
  let tvaValide: boolean | null = null;
  if (tvaNum) {
    try {
      const { data: dv } = await vies.get('/check-vat', {
        params: { countryCode: 'FR', vatNumber: tvaNum.slice(2) }
      });
      tvaValide = dv.valid;
    } catch {
      tvaValide = null;
    }
  }

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

  // Etablissements
  let etablissements = [];
  if (rechercheData?.results?.length) {
    const match = rechercheData.results.find((r: any) => r.siren === siren)
    if (match) {
      etablissements = (match.matching_etablissements || []).concat(match.siege ? [match.siege] : []);
    }
  }
  if (!etablissements.length && inpiData.formality?.content?.personneMorale?.autresEtablissements) {
    etablissements = inpiData.formality.content.personneMorale.autresEtablissements;
  }
  if (!etablissements.length && inpiData.establishments) {
    etablissements = inpiData.establishments;
  }

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
    // Fallback recherche
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
    categorie_juridique,
    sigle,
    nom_commercial,
    siren,
    siret: etablissements[0]?.siret || "-",
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

// Mapping principal pour SIRET
export async function fetchEtablissementBySiret(siret: string) {
  const siren = siret.slice(0, 9)
  const [
    inpiDataRaw,
    sireneEtabRaw,
    sireneULRaw
  ] = await Promise.all([
    getEntrepriseBySiren(siren).catch(() => ({})),
    sirene.get(`/siret/${siret}`).then(r => r.data.etablissement).catch(() => ({})),
    sirene.get(`/siren/${siren}`).then(r => r.data.uniteLegale).catch(() => ({}))
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

  const forme_juridique =
    getInpi("formality.content.personneMorale.identite.entreprise.formeJuridique", inpiData) ||
    inpiData.legalForm ||
    sireneUL.libelleCategorieJuridiqueUniteLegale ||
    "-";

  const categorie_juridique =
    getInpi("formality.content.personneMorale.identite.entreprise.formeJuridique", inpiData) ||
    inpiData.legalCategory ||
    sireneUL.categorieJuridiqueUniteLegale ||
    "-";

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
    sireneUL.libelleActivitePrincipaleUniteLegale ||
    inpiData.apeLabel ||
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

  // Adresse principale
  const adresseObj = getInpi("formality.content.personneMorale.adresseEntreprise.adresse", inpiData);
  const adresse =
    adresseObj
      ? [adresseObj.numVoie, adresseObj.voie, adresseObj.codePostal, adresseObj.commune].filter(Boolean).join(" ")
      : (
        inpiData.address ||
        sireneEtab.adresseEtablissement ||
        sireneUL.adresseEtablissement ||
        "-"
      );

  // Effectifs
  const tranche_effectifs =
    getInpi("formality.content.personneMorale.identite.entreprise.trancheEffectifs", inpiData) ||
    inpiData.workforceLabel ||
    sireneUL.trancheEffectifsUniteLegale ||
    "-";

  const tranche_effectif_salarie =
    inpiData.workforceRange ||
    sireneUL.trancheEffectifsUniteLegale ||
    "-";

  // TVA
  const tvaNum = tvaFRFromSiren(siren);
  let tvaValide: boolean | null = null;
  if (tvaNum) {
    try {
      const { data: dv } = await vies.get('/check-vat', {
        params: { countryCode: 'FR', vatNumber: tvaNum.slice(2) }
      });
      tvaValide = dv.valid;
    } catch {
      tvaValide = null;
    }
  }

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

  // Etablissements (pour fiche SIRET, on ne renvoie pas les autres)
  const etablissements = [];

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
    categorie_juridique,
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
