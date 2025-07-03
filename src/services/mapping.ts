import { sirene, recherche, vies } from './api'

/**
 * Schéma unifié retourné à l’UI.
 */
export interface UnifiedEtablissement {
  denomination: string
  formeJuridique: string
  siren: string
  siret: string
  tva: { numero: string; valide: boolean }
  codeApe: string
  libelleApe?: string
  trancheEffectifs: string
  capitalSocial?: number
  dateCreation: string
  adresse: string
  geo?: [number, number]
  dirigeants: Array<{
    nom?: string
    prenoms?: string
    qualite?: string
    dateNaissance?: string
    type: 'personne physique' | 'personne morale'
  }>
  finances: Array<{
    annee: string
    ca?: number
    resultatNet?: number
  }>
  annonces: Array<{
    titre?: string
    date?: string
    lien?: string
  }>
  labels: string[]
  divers: string[]
}

/**
 * Récupère et assemble les données depuis :
 * - l’API Sirene (SIRET + SIREN)
 * - l’API Recherche d’entreprises (dirigeants, établissements secondaires, finances…)
 * - l’API VIES (TVA intracommunautaire)
 *
 * @param siret SIRET de l’établissement à rechercher
 */
export async function fetchEtablissementData(
  siret: string
): Promise<UnifiedEtablissement> {
  const siren = siret.slice(0, 9)

  // 1) Sirene - données SIRET
  const { data: siretPayload } = await sirene.get<{
    etablissement: any
  }>(`/siret/${siret}`)
  const etab = siretPayload.etablissement

  // 2) Sirene - données SIREN (unité légale)
  const { data: sirenPayload } = await sirene.get<{
    uniteLegale: any
  }>(`/siren/${siren}`)
  const ul = sirenPayload.uniteLegale

  // 3) Recherche Entreprises
  const { data: rec } = await recherche.get<{
    results: any[]
  }>(`/entreprises/${siren}`)
  const rec0 = rec.results[0] || {}

  // 4) VIES
  const tvaNum = rec0.siege?.numero_tva_intracom || ''
  const { data: viesPayload } = await vies.get<{ valid: boolean }>(
    `/check-vat`,
    { params: { countryCode: 'FR', vatNumber: tvaNum } }
  )

  // 5) Mapping unifié
  return {
    denomination:
      ul.denominationUniteLegale || rec0.nom_raison_sociale || '',
    formeJuridique:
      ul.libelleCategorieJuridiqueUniteLegale ||
      ul.categorieJuridiqueUniteLegale ||
      rec0.nature_juridique ||
      '',
    siren,
    siret,
    tva: {
      numero: tvaNum,
      valide: viesPayload.valid
    },
    codeApe: ul.activitePrincipaleUniteLegale || rec0.activite_principale || '',
    libelleApe: ul.libelleActivitePrincipaleUniteLegale,
    trancheEffectifs:
      etab.trancheEffectifsEtablissement ||
      ul.trancheEffectifsUniteLegale ||
      rec0.tranche_effectif_salarie ||
      '',
    capitalSocial: ul.capitalSocial || undefined,
    dateCreation:
      ul.dateCreationUniteLegale || etab.dateCreationEtablissement || '',
    adresse: [
      etab.adresseEtablissement.numeroVoieEtablissement,
      etab.adresseEtablissement.typeVoieEtablissement,
      etab.adresseEtablissement.libelleVoieEtablissement,
      etab.adresseEtablissement.codePostalEtablissement,
      etab.adresseEtablissement.libelleCommuneEtablissement
    ]
      .filter(Boolean)
      .join(' '),
    geo:
      etab.coordonneesGeoLat && etab.coordonneesGeoLong
        ? [etab.coordonneesGeoLat, etab.coordonneesGeoLong]
        : rec0.siege?.coordonnees
        ? rec0.siege.coordonnees.split(',').map((v: string) => +v.trim())
        : undefined,
    dirigeants:
      rec0.dirigeants?.map((d: any) => ({
        nom: d.nom,
        prenoms: d.prenoms,
        qualite: d.qualite,
        dateNaissance: d.date_de_naissance,
        type: d.type_dirigeant
      })) || [],
    finances: Object.entries(rec0.finances || {}).map(([annee, f]) => ({
      annee,
      ca: (f as any).ca,
      resultatNet: (f as any).resultat_net
    })),
    annonces: [],      // à remplir ultérieurement depuis l’API INPI ou un flux Kbis
    labels: rec0.complements?.liste_idcc || [],
    divers: []         // champs divers à intégrer selon besoin
  }
}
