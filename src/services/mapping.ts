import { getEntrepriseBySiren, searchEntreprisesByRaisonSociale } from './inpiBackend'
import { sirene, vies, recherche } from './api'
import { tvaFRFromSiren } from './tva'

export async function searchEtablissementsByName(name: string) {
  return await searchEntreprisesByRaisonSociale(name);
}

// Recherche SIREN
export async function fetchEtablissementBySiren(siren: string) {
  // Appels en parallèle aux différentes sources
  const [
    inpiDataRaw,
    rechercheDataRaw,
    sireneULRaw
  ] = await Promise.all([
    getEntrepriseBySiren(siren).catch(() => ({})),
    recherche.get('/search', { params: { q: siren, page: 1, per_page: 1 } }).then(r => r.data).catch(() => ({})),
    sirene.get(`/siren/${siren}`).then(r => r.data.uniteLegale).catch(() => ({}))
  ]);

  const inpiData = inpiDataRaw || {}
  const rechercheData = rechercheDataRaw || {}
  const sireneUL = sireneULRaw || {}

  // Raison sociale (Recherche entreprise)
  let raison_sociale = '-'
  let dirigeants = []
  if (rechercheData?.results?.length) {
    const match = rechercheData.results.find((r: any) => r.siren === siren)
    if (match) {
      raison_sociale = match.denomination || match.nom_raison_sociale || '-'
      dirigeants = match.dirigeants || []
    }
  }

  // Code APE et Forme juridique (SIRENE)
  const code_ape =
    sireneUL.activitePrincipaleUniteLegale ||
    inpiData.ape ||
    (rechercheData?.results?.[0]?.code_ape) ||
    "-";
  const libelle_ape =
    sireneUL.libelleActivitePrincipaleUniteLegale ||
    inpiData.apeLabel ||
    (rechercheData?.results?.[0]?.libelle_ape) ||
    "-";
  const forme_juridique =
    sireneUL.libelleCategorieJuridiqueUniteLegale ||
    inpiData.legalForm ||
    (rechercheData?.results?.[0]?.forme_juridique) ||
    "-";

  // Capital social (INPI)
  let capital_social =
    inpiData.content?.description?.montantCapital ??
    inpiData.shareCapital ??
    sireneUL.capitalSocial ??
    (inpiData.financialStatements?.[0]?.shareCapital) ??
    "-";

  // Calcul du numéro TVA intracom
  const tvaNum = tvaFRFromSiren(siren)
  let tvaValide: boolean | null = null
  if (tvaNum) {
    try {
      const { data: dv } = await vies.get('/check-vat', {
        params: { countryCode: 'FR', vatNumber: tvaNum.slice(2) }
      });
      tvaValide = dv.valid;
    } catch {
      tvaValide = null
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

  // Etablissements (fallback classique)
  let etablissements = []
  if (rechercheData?.results?.length) {
    const match = rechercheData.results.find((r: any) => r.siren === siren)
    if (match) {
      etablissements = (match.matching_etablissements || []).concat(match.siege ? [match.siege] : [])
    }
  }
  if (!etablissements.length && inpiData.establishments) {
    etablissements = inpiData.establishments
  }

  // Mapping final avec priorités/fallbacks
  return {
    denomination: raison_sociale,
    forme_juridique,
    categorie_juridique:
      inpiData.legalCategory ||
      (rechercheData?.results?.[0]?.categorie_juridique) ||
      sireneUL.categorieJuridiqueUniteLegale ||
      "-",

    sigle:
      inpiData.acronym ||
      (rechercheData?.results?.[0]?.sigle) ||
      sireneUL.sigleUniteLegale ||
      "-",

    nom_commercial:
      inpiData.tradeName ||
      (rechercheData?.results?.[0]?.nom_commercial) ||
      sireneUL.nomCommercialUniteLegale ||
      "-",

    siren,
    siret: (etablissements[0]?.siret) || "-",

    tva: { numero: tvaNum || '-', valide: tvaValide },

    code_ape,
    libelle_ape,

    tranche_effectifs:
      inpiData.workforceLabel ||
      (rechercheData?.results?.[0]?.tranche_effectifs) ||
      sireneUL.trancheEffectifsUniteLegale ||
      "-",

    tranche_effectif_salarie:
      inpiData.workforceRange ||
      (rechercheData?.results?.[0]?.tranche_effectif_salarie) ||
      sireneUL.trancheEffectifsUniteLegale ||
      "-",

    capital_social: capital_social !== undefined ? capital_social : "-",

    date_creation:
      inpiData.content?.dateCreation ||
      inpiData.creationDate ||
      (rechercheData?.results?.[0]?.date_creation) ||
      sireneUL.dateCreationUniteLegale ||
      "-",

    adresse:
      inpiData.content?.adresseEntreprise?.numVoie
        ? [
            inpiData.content.adresseEntreprise.numVoie,
            inpiData.content.adresseEntreprise.voie,
            inpiData.content.adresseEntreprise.codePostal,
            inpiData.content.adresseEntreprise.commune,
          ].filter(Boolean).join(' ')
        : (
            inpiData.address ||
            (rechercheData?.results?.[0]?.adresse) ||
            "-"
          ),

    etablissements,
    dirigeants,

    finances,

    statut_diffusion:
      inpiData.publicationStatus ||
      (rechercheData?.results?.[0]?.statut_diffusion) ||
      sireneUL.statutDiffusionUniteLegale ||
      "-",

    caractere_employeur:
      inpiData.employerCharacteristic ||
      (rechercheData?.results?.[0]?.caractere_employeur) ||
      sireneUL.caractereEmployeurUniteLegale ||
      "-",

    site_web:
      inpiData.website ||
      (rechercheData?.results?.[0]?.site_web) ||
      "-",

    email:
      inpiData.email ||
      (rechercheData?.results?.[0]?.email) ||
      "-",

    inpiRaw: inpiDataRaw // pour debug JSON INPI brut
  };
}

// Recherche SIRET
export async function fetchEtablissementBySiret(siret: string) {
  const siren = siret.slice(0, 9)
  // Appels en parallèle aux différentes sources
  const [
    inpiDataRaw,
    sireneEtabRaw,
    sireneULRaw
  ] = await Promise.all([
    getEntrepriseBySiren(siren).catch(() => ({})),
    sirene.get(`/siret/${siret}`).then(r => r.data.etablissement).catch(() => ({})),
    sirene.get(`/siren/${siren}`).then(r => r.data.uniteLegale).catch(() => ({}))
  ]);

  const inpiData = inpiDataRaw || {}
  const sireneEtab = sireneEtabRaw || {}
  const sireneUL = sireneULRaw || {}

  // Code APE et Forme juridique (SIRENE)
  const code_ape =
    sireneUL.activitePrincipaleUniteLegale ||
    sireneEtab.activitePrincipaleEtablissement ||
    inpiData.ape ||
    "-";
  const libelle_ape =
    sireneUL.libelleActivitePrincipaleUniteLegale ||
    inpiData.apeLabel ||
    "-";
  const forme_juridique =
    sireneUL.libelleCategorieJuridiqueUniteLegale ||
    inpiData.legalForm ||
    "-";

  // Capital social (INPI)
  let capital_social =
    inpiData.content?.description?.montantCapital ??
    inpiData.shareCapital ??
    sireneUL.capitalSocial ??
    (inpiData.financialStatements?.[0]?.shareCapital) ??
    "-";

  // TVA
  const tvaNum = tvaFRFromSiren(siren)
  let tvaValide: boolean | null = null
  if (tvaNum) {
    try {
      const { data: dv } = await vies.get('/check-vat', {
        params: { countryCode: 'FR', vatNumber: tvaNum.slice(2) }
      });
      tvaValide = dv.valid;
    } catch {
      tvaValide = null
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

  // Mapping final
  return {
    denomination: inpiData.denomination || "-",
    forme_juridique,
    categorie_juridique:
      inpiData.legalCategory ||
      sireneUL.categorieJuridiqueUniteLegale ||
      "-",

    sigle: inpiData.acronym || sireneUL.sigleUniteLegale || "-",

    nom_commercial: inpiData.tradeName || sireneUL.nomCommercialUniteLegale || "-",

    siren,
    siret,

    tva: { numero: tvaNum || '-', valide: tvaValide },

    code_ape,
    libelle_ape,

    tranche_effectifs:
      inpiData.workforceLabel ||
      sireneUL.trancheEffectifsUniteLegale ||
      "-",

    tranche_effectif_salarie:
      inpiData.workforceRange ||
      sireneUL.trancheEffectifsUniteLegale ||
      "-",

    capital_social: capital_social !== undefined ? capital_social : "-",

    date_creation:
      inpiData.content?.dateCreation ||
      inpiData.creationDate ||
      sireneUL.dateCreationUniteLegale ||
      sireneEtab.dateCreationEtablissement ||
      "-",

    adresse:
      inpiData.content?.adresseEntreprise?.numVoie
        ? [
            inpiData.content.adresseEntreprise.numVoie,
            inpiData.content.adresseEntreprise.voie,
            inpiData.content.adresseEntreprise.codePostal,
            inpiData.content.adresseEntreprise.commune,
          ].filter(Boolean).join(' ')
        : (
            inpiData.address ||
            sireneEtab.adresse ||
            "-"
          ),

    etablissements: [],
    dirigeants: [],

    finances,

    statut_diffusion:
      inpiData.publicationStatus ||
      sireneUL.statutDiffusionUniteLegale ||
      "-",

    caractere_employeur:
      inpiData.employerCharacteristic ||
      sireneUL.caractereEmployeurUniteLegale ||
      "-",

    site_web: inpiData.website || "-",
    email: inpiData.email || "-",

    inpiRaw: inpiDataRaw // pour debug JSON INPI brut
  };
}

// Routeur intelligent
export async function fetchEtablissementByCode(code: string) {
  if (/^\d{14}$/.test(code)) {
    return fetchEtablissementBySiret(code)
  } else if (/^\d{9}$/.test(code)) {
    return fetchEtablissementBySiren(code)
  } else {
    throw new Error('Code SIREN/SIRET invalide')
  }
}
