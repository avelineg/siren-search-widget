import { getEntrepriseBySiren, searchEntreprisesByRaisonSociale } from './inpiBackend'
import { sirene, vies, recherche } from './api'
import { tvaFRFromSiren } from './tva'

export async function searchEtablissementsByName(name: string) {
  return await searchEntreprisesByRaisonSociale(name);
}

export async function fetchEtablissementByCode(code: string) {
  const siren = code.length === 9 ? code : code.slice(0, 9)
  const siret = code.length === 14 ? code : null

  // Appels en parallèle
  const [
    inpiDataRaw,
    rechercheDataRaw,
    sireneEtabRaw,
    sireneULRaw
  ] = await Promise.all([
    getEntrepriseBySiren(siren).catch(() => ({})),
    recherche.get('/search', { params: { q: siren, page: 1, per_page: 1 } }).then(r => r.data).catch(() => ({})),
    siret ? sirene.get(`/siret/${siret}`).then(r => r.data.etablissement).catch(() => ({})) : {},
    sirene.get(`/siren/${siren}`).then(r => r.data.uniteLegale).catch(() => ({}))
  ]);
  const inpiData = inpiDataRaw || {}
  const rechercheData = rechercheDataRaw || {}
  const sireneEtab = sireneEtabRaw || {}
  const sireneUL = sireneULRaw || {}

  // Recherche complémentaire pour les dirigeants/établissements
  let etablissements = []
  let dirigeants = []
  if (rechercheData?.results?.length) {
    const match = rechercheData.results.find(r => r.siren === siren);
    if (match) {
      etablissements = (match.matching_etablissements || []).concat(match.siege ? [match.siege] : []);
      dirigeants = match.dirigeants || [];
    }
  }

  // Calcul du numéro de TVA intracom
  const tvaNum = tvaFRFromSiren(siren); // toujours calculé
  let tvaValide: boolean | null = null;
  if (tvaNum) {
    try {
      const { data: dv } = await vies.get('/check-vat', {
        params: { countryCode: 'FR', vatNumber: tvaNum.slice(2) } // Sans le "FR"
      });
      tvaValide = dv.valid;
    } catch {
      tvaValide = null; // Pas d'info
    }
  }

  // Données financières
  const finances = inpiData.financialStatements?.length
    ? inpiData.financialStatements.map((f: any) => ({
        exercice: f.fiscalYear,
        ca: f.turnover,
        resultat_net: f.netResult,
        effectif: f.workforce,
        capital_social: f.shareCapital
      }))
    : [];

  // Capital social
  let capital_social =
    inpiData.shareCapital ||
    sireneUL.capitalSocial ||
    (finances.length ? finances[0].capital_social : undefined) ||
    undefined;

  // Mapping robuste
  return {
    denomination:
      inpiData.companyName ||
      (rechercheData?.results?.[0]?.denomination) ||
      sireneUL.denominationUniteLegale ||
      "-",

    forme_juridique:
      inpiData.legalForm ||
      (rechercheData?.results?.[0]?.forme_juridique) ||
      sireneUL.libelleCategorieJuridiqueUniteLegale ||
      "-",

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
    siret: siret || inpiData.siret || (etablissements[0]?.siret) || "-",

    tva: { numero: tvaNum || '-', valide: tvaValide },

    code_ape:
      inpiData.ape ||
      (rechercheData?.results?.[0]?.code_ape) ||
      sireneUL.activitePrincipaleUniteLegale ||
      sireneEtab.activitePrincipaleEtablissement ||
      "-",

    libelle_ape:
      inpiData.apeLabel ||
      (rechercheData?.results?.[0]?.libelle_ape) ||
      sireneUL.libelleActivitePrincipaleUniteLegale ||
      "-",

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
      inpiData.creationDate ||
      (rechercheData?.results?.[0]?.date_creation) ||
      sireneUL.dateCreationUniteLegale ||
      sireneEtab.dateCreationEtablissement ||
      "-",

    adresse:
      inpiData.address ||
      (rechercheData?.results?.[0]?.adresse) ||
      sireneEtab.adresse ||
      "-",

    etablissements: etablissements.length
      ? etablissements
      : (inpiData.establishments || []),

    dirigeants: dirigeants.length
      ? dirigeants
      : (inpiData.representatives || []),

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
  };
}
