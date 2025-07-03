import { getEntrepriseBySiren, searchEntreprisesByRaisonSociale } from './inpiBackend'
import { sirene, vies, recherche } from './api' // à adapter selon ton projet

export async function searchEtablissementsByName(name: string) {
  // Recherche multi-source, ici INPI + SIRENE si besoin
  const inpi = await searchEntreprisesByRaisonSociale(name);
  // Ajoute ici la logique pour fusionner les résultats INPI + SIRENE si besoin
  return inpi;
}

export async function fetchEtablissementByCode(code: string) {
  const siren = code.length === 9 ? code : code.slice(0, 9);

  // 1. Données SIRENE
  const [{ data: dEtab }, { data: dUL }] = await Promise.all([
    sirene.get<{ etablissement: any }>(`/siret/${code.length === 14 ? code : ''}`),
    sirene.get<{ uniteLegale: any }>(`/siren/${siren}`)
  ]);
  const etab = dEtab?.etablissement || {};
  const ul = dUL?.uniteLegale || {};

  // 2. Données INPI (backend)
  let inpiData = {};
  try {
    inpiData = await getEntrepriseBySiren(siren);
  } catch (e) {
    console.warn('Erreur INPI', e);
  }

  // 3. Vérification TVA via VIES
  let tvaNum = etab.numeroTvaIntracommunautaire || ul.numeroTvaIntracommunautaireUniteLegale || '';
  let tvaValide = false;
  if (tvaNum) {
    try {
      const { data: dv } = await vies.get<{ valid: boolean }>('/check-vat', {
        params: { countryCode: 'FR', vatNumber: tvaNum }
      });
      tvaValide = dv.valid;
    } catch {
      tvaValide = false;
    }
  }

  // 4. Recherche API pour dirigeants, labels, établissements enrichis, etc.
  let etablissements: any[] = [];
  let dirigeants: any[] = [];
  try {
    const { data: searchRes } = await recherche.get<{ results: any[] }>('/search', {
      params: { q: siren, page: 1, per_page: 1 }
    });
    const match = searchRes.results.find(r => r.siren === siren);
    if (match) {
      etablissements = (match.matching_etablissements || []).concat(match.siege ? [match.siege] : []);
      dirigeants = match.dirigeants || [];
    }
  } catch {
    // Optionnel
  }

  // 5. Fusion des données
  // Prends priorité INPI > Recherche > SIRENE pour chaque champ
  const finances = inpiData.financialStatements || [];
  let capital_social = inpiData.shareCapital || ul.capitalSocial || 0;
  if ((!capital_social || capital_social === 0) && finances.length) {
    capital_social = finances[0].capital_social;
  }

  return {
    denomination: inpiData.companyName || ul.denominationUniteLegale || '',
    forme_juridique: inpiData.legalForm || ul.libelleCategorieJuridiqueUniteLegale || '',
    categorie_juridique: inpiData.legalCategory || ul.categorieJuridiqueUniteLegale || '',
    sigle: inpiData.acronym || ul.sigleUniteLegale || '',
    nom_commercial: inpiData.tradeName || ul.nomCommercialUniteLegale || '',
    siren,
    siret: inpiData.siret || etab.siret,
    tva: { numero: tvaNum, valide: tvaValide },
    code_ape: inpiData.ape || ul.activitePrincipaleUniteLegale || etab.activitePrincipaleEtablissement || '',
    libelle_ape: inpiData.apeLabel || ul.libelleActivitePrincipaleUniteLegale || '',
    tranche_effectifs: inpiData.workforceLabel || ul.trancheEffectifsUniteLegale || '',
    tranche_effectif_salarie: inpiData.workforceRange || ul.trancheEffectifsUniteLegale || '',
    capital_social,
    date_creation: inpiData.creationDate || ul.dateCreationUniteLegale || etab.dateCreationEtablissement || '',
    adresse: inpiData.address || etab.adresse || '',
    etablissements: etablissements.length ? etablissements : (inpiData.establishments || []),
    dirigeants: dirigeants.length ? dirigeants : (inpiData.representatives || []),
    finances,
    statut_diffusion: inpiData.publicationStatus || ul.statutDiffusionUniteLegale || '',
    caractere_employeur: inpiData.employerCharacteristic || ul.caractereEmployeurUniteLegale || '',
    site_web: inpiData.website,
    email: inpiData.email
  };
}
