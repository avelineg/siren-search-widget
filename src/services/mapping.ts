import { getEntrepriseBySiren, searchEntreprisesByRaisonSociale } from './inpiBackend'
import { sirene, vies, recherche } from './api'

export async function fetchEtablissementByCode(code: string) {
  const siren = code.length === 9 ? code : code.slice(0, 9);
  const siret = code.length === 14 ? code : null;

  // Appels en parallèle
  const [
    inpiData,
    rechercheData,
    sireneEtab,
    sireneUL
  ] = await Promise.all([
    getEntrepriseBySiren(siren).catch(() => ({})),
    recherche.get('/search', { params: { q: siren, page: 1, per_page: 1 } }).then(r => r.data).catch(() => ({})),
    siret ? sirene.get(`/siret/${siret}`).then(r => r.data.etablissement).catch(() => ({})) : {},
    sirene.get(`/siren/${siren}`).then(r => r.data.uniteLegale).catch(() => ({}))
  ]);

  // Recherche complémentaire pour les dirigeants/établissements enrichis
  let etablissements = [];
  let dirigeants = [];
  if (rechercheData?.results?.length) {
    const match = rechercheData.results.find(r => r.siren === siren);
    if (match) {
      etablissements = (match.matching_etablissements || []).concat(match.siege ? [match.siege] : []);
      dirigeants = match.dirigeants || [];
    }
  }

  // TVA via VIES
  let tvaNum = inpiData.vatNumber || sireneEtab.numeroTvaIntracommunautaire || sireneUL.numeroTvaIntracommunautaireUniteLegale || '';
  let tvaValide = false;
  if (tvaNum) {
    try {
      const { data: dv } = await vies.get('/check-vat', { params: { countryCode: 'FR', vatNumber: tvaNum } });
      tvaValide = dv.valid;
    } catch {/* ignore */}
  }

  // Données financières (fusion INPI + fallback SIRENE)
  const finances = inpiData.financialStatements?.length
    ? inpiData.financialStatements.map((f: any) => ({
        exercice: f.fiscalYear,
        ca: f.turnover,
        resultat_net: f.netResult,
        effectif: f.workforce,
        capital_social: f.shareCapital
      }))
    : [];

  // Capital social (priorité INPI, sinon SIRENE, sinon Recherche)
  let capital_social =
    inpiData.shareCapital ||
    sireneUL.capitalSocial ||
    (finances.length ? finances[0].capital_social : undefined) ||
    0;

  // Mapping robuste pour chaque champ
  return {
    denomination: inpiData.companyName || sireneUL.denominationUniteLegale || '',
    forme_juridique: inpiData.legalForm || sireneUL.libelleCategorieJuridiqueUniteLegale || '',
    categorie_juridique: inpiData.legalCategory || sireneUL.categorieJuridiqueUniteLegale || '',
    sigle: inpiData.acronym || sireneUL.sigleUniteLegale || '',
    nom_commercial: inpiData.tradeName || sireneUL.nomCommercialUniteLegale || '',
    siren,
    siret: siret || inpiData.siret || (etablissements[0]?.siret),
    tva: { numero: tvaNum, valide: tvaValide },
    code_ape: inpiData.ape || sireneUL.activitePrincipaleUniteLegale || sireneEtab.activitePrincipaleEtablissement || '',
    libelle_ape: inpiData.apeLabel || sireneUL.libelleActivitePrincipaleUniteLegale || '',
    tranche_effectifs: inpiData.workforceLabel || sireneUL.trancheEffectifsUniteLegale || '',
    tranche_effectif_salarie: inpiData.workforceRange || sireneUL.trancheEffectifsUniteLegale || '',
    capital_social,
    date_creation: inpiData.creationDate || sireneUL.dateCreationUniteLegale || sireneEtab.dateCreationEtablissement || '',
    adresse: inpiData.address || sireneEtab.adresse || '',
    etablissements: etablissements.length ? etablissements : (inpiData.establishments || []),
    dirigeants: dirigeants.length ? dirigeants : (inpiData.representatives || []),
    finances,
    statut_diffusion: inpiData.publicationStatus || sireneUL.statutDiffusionUniteLegale || '',
    caractere_employeur: inpiData.employerCharacteristic || sireneUL.caractereEmployeurUniteLegale || '',
    site_web: inpiData.website,
    email: inpiData.email
  };
}
