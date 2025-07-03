import { sirene, vies } from './api'

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
 * Récupère et assemble les données pour un SIREN (9 chiffres) ou un SIRET (14 chiffres).
 * - Pour un SIREN seul, on appelle /siren pour récupérer NIC siège, puis /siret.
 * - Pour un SIRET, on en extrait le SIREN et on appelle directement /siret.
 * @param code SIREN ou SIRET à 9 ou 14 chiffres
 */
export async function fetchEtablissementByCode(
  code: string
): Promise<UnifiedEtablissement> {
  let siren: string
  let siret: string

  if (/^\d{9}$/.test(code)) {
    // SIREN seul
    siren = code
    const { data: payloadSiren } = await sirene.get<{ uniteLegale: any }>(
      `/siren/${siren}`
    )
    const nicSiege = payloadSiren.uniteLegale.nicSiegeUniteLegale
    if (!nicSiege) {
      throw new Error(`NIC siège non trouvé pour le SIREN ${siren}`)
    }
    siret = `${siren}${nicSiege}`
  } else if (/^\d{14}$/.test(code)) {
    // SIRET complet
    siret = code
    siren = code.slice(0, 9)
  } else {
    throw new Error('Le code doit être un SIREN (9 chiffres) ou un SIRET (14 chiffres)')
  }

  // 1) Détails de l'établissement
  const { data: payloadEtab } = await sirene.get<{ etablissement: any }>(
    `/siret/${siret}`
  )
  const etab = payloadEtab.etablissement

  // 2) Détails de l'unité légale
  const { data: payloadUL } = await sirene.get<{ uniteLegale: any }>(
    `/siren/${siren}`
  )
  const ul = payloadUL.uniteLegale

  // 3) Vérification TVA via VIES
  const tvaNum = etab.numeroTvaIntracommunautaire || ''
  const { data: viesPayload } = await vies.get<{ valid: boolean }>(
    `/check-vat`,
    { params: { countryCode: 'FR', vatNumber: tvaNum } }
  )

  return {
    denomination:
      ul.denominationUniteLegale || etab.uniteLegale?.denomination || '',
    formeJuridique:
      ul.libelleCategorieJuridiqueUniteLegale ||
      ul.categorieJuridiqueUniteLegale ||
      '',
    siren,
    siret,
    tva: {
      numero: tvaNum,
      valide: viesPayload.valid
    },
    codeApe:
      ul.activitePrincipaleUniteLegale ||
      etab.activitePrincipaleEtablissement ||
      '',
    libelleApe: ul.libelleActivitePrincipaleUniteLegale,
    trancheEffectifs:
      etab.trancheEffectifsEtablissement ||
      ul.trancheEffectifsUniteLegale ||
      '',
    capitalSocial: ul.capitalSocial || undefined,
    dateCreation:
      ul.dateCreationUniteLegale ||
      etab.dateCreationEtablissement ||
      '',
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
        : undefined,
    dirigeants: [], // à enrichir via INPI / officialités si besoin
    finances: [],   // à enrichir via INPI ou sources financières
    annonces: [],   // à enrichir via INPI / publications légales
    labels: [],
    divers: []
  }
}
