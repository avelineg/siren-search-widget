import { sirene, recherche, vies } from './api'

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

export async function fetchEtablissementData(
  code: string
): Promise<UnifiedEtablissement> {
  let siren: string
  let siret: string

  // Détecter SIREN (9 chiffres) vs SIRET (14 chiffres)
  if (/^\d{9}$/.test(code)) {
    siren = code
    // 1) Récupérer l’unité légale pour trouver le NIC siège
    const { data: sirenPayload } = await sirene.get<{ uniteLegale: any }>(
      `/siren/${siren}`
    )
    const nicSiege = sirenPayload.uniteLegale.nicSiegeUniteLegale
    if (!nicSiege) {
      throw new Error(`NIC siège non trouvé pour le SIREN ${siren}`)
    }
    siret = `${siren}${nicSiege}`
  } else if (/^\d{14}$/.test(code)) {
    siret = code
    siren = code.slice(0, 9)
  } else {
    throw new Error('Le code doit être un SIREN (9 chiffres) ou un SIRET (14 chiffres)')
  }

  // 2) Fetch données SIRET
  const { data: siretPayload } = await sirene.get<{ etablissement: any }>(
    `/siret/${siret}`
  )
  const etab = siretPayload.etablissement

  // 3) Fetch données SIREN (unité légale)
  const { data: sirenPayload2 } = await sirene.get<{ uniteLegale: any }>(
    `/siren/${siren}`
  )
  const ul = sirenPayload2.uniteLegale

  // 4) Recherche d’entreprises pour compléments (dirigeants, finances…)
  const { data: rec } = await recherche.get<{ results: any[] }>(
    `/entreprises/${siren}`
  )
  const rec0 = rec.results[0] || {}

  // 5) Vérification TVA via VIES
  const tvaNum = rec0.siege?.numero_tva_intracom || ''
  const { data: viesPayload } = await vies.get<{ valid: boolean }>(
    `/check-vat`,
    { params: { countryCode: 'FR', vatNumber: tvaNum } }
  )

  // 6) Assemblage du schéma unifié
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
    codeApe:
      ul.activitePrincipaleUniteLegale || rec0.activite_principale || '',
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
      etab.geoLatitude && etab.geoLongitude
        ? [etab.geoLatitude, etab.geoLongitude]
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
    finances: Object.entries(rec0.finances || {}).map(([annee, f]: any) => ({
      annee,
      ca: f.ca,
      resultatNet: f.resultat_net
    })),
    annonces: [], // À remplir depuis INPI/formalités
    labels: rec0.complements?.liste_idcc || [],
    divers: []
  }
}
