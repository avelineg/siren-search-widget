import { sirene, vies, inpiEntreprise, inpiDirigeants, searchCompaniesByName } from './api'

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
  finances: Array<{ annee: string; ca?: number; resultatNet?: number }>
  annonces: Array<{ titre?: string; date?: string; lien?: string }>
  labels: string[]
  divers: string[]
}

// Réexport pour la recherche par nom
export { searchCompaniesByName }

/**
 * Recherche simplifiée par nom : renvoie siren + nom complet.
 */
export async function searchEtablissementsByName(
  name: string,
  page?: number,
  perPage?: number
): Promise<Array<{
  siren: string
  nom_complet: string
  nom_raison_sociale?: string
}>> {
  const raw = await searchCompaniesByName(name, page, perPage)
  return raw.map(r => ({
    siren: r.siren,
    nom_complet: r.nom_complet || r.nom_raison_sociale || '',
    nom_raison_sociale: r.nom_raison_sociale
  }))
}

/**
 * Lookup par code (SIREN/SIRET) via Sirene + VIES + INPI.
 */
export async function fetchEtablissementByCode(
  code: string
): Promise<UnifiedEtablissement> {
  let siren: string
  let siret: string

  // 1) Détection du format
  if (/^\d{9}$/.test(code)) {
    siren = code
    // NIC siège
    const { data: pl } = await sirene.get<{ uniteLegale: any }>(`/siren/${siren}`)
    const nic = pl.uniteLegale.nicSiegeUniteLegale
    if (!nic) throw new Error(`NIC siège non trouvé pour le SIREN ${siren}`)
    siret = `${siren}${nic}`
  } else if (/^\d{14}$/.test(code)) {
    siret = code
    siren = code.slice(0, 9)
  } else {
    throw new Error('Le code doit être un SIREN (9 chiffres) ou un SIRET (14 chiffres)')
  }

  // 2) Données Sirene
  const { data: dEtab } = await sirene.get<{ etablissement: any }>(`/siret/${siret}`)
  const etab = dEtab.etablissement
  const { data: dUL } = await sirene.get<{ uniteLegale: any }>(`/siren/${siren}`)
  const ul = dUL.uniteLegale

  // 3) Vérif. TVA via VIES
  const tvaNum =
    etab.numeroTvaIntracommunautaire ||
    ul.numeroTvaIntracommunautaireUniteLegale ||
    ''
  const { data: dVies } = await vies.get<{ valid: boolean }>(
    '/check-vat',
    { params: { countryCode: 'FR', vatNumber: tvaNum } }
  )

  // 4) Enrichissement INPI
  let inpiEnt: any = {}
  try {
    const resEnt = await inpiEntreprise.get(`/${siren}`)
    inpiEnt = resEnt.data
  } catch (e) {
    console.warn('INPI entreprise error', e)
  }

  let inpiDir: any = {}
  try {
    const resDir = await inpiDirigeants.get(`/${siren}`)
    inpiDir = resDir.data
  } catch (e) {
    console.warn('INPI dirigeants error', e)
  }

  // 5) Mapping unifié
  const dirigeants =
    inpiDir.dirigeants?.map((d: any) => ({
      nom: d.nom,
      prenoms: d.prenoms,
      qualite: d.qualite,
      dateNaissance: d.date_naissance,
      type: d.type_dirigeant
    })) || []

  const finances =
    inpiEnt.finances?.map((f: any) => ({
      annee: f.annee,
      ca: f.ca,
      resultatNet: f.resultat_net
    })) || []

  const annonces =
    inpiEnt.annonces?.map((a: any) => ({
      titre: a.titre,
      date: a.date,
      lien: a.lien
    })) || []

  const divers = inpiEnt.divers
    ? inpiEnt.divers.map((x: any) => JSON.stringify(x))
    : []

  return {
    denomination: ul.denominationUniteLegale || etab.uniteLegale?.denomination || '',
    formeJuridique:
      ul.libelleCategorieJuridiqueUniteLegale ||
      ul.categorieJuridiqueUniteLegale ||
      '',
    siren,
    siret,
    tva: { numero: tvaNum, valide: dVies.valid },
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
    dirigeants,
    finances,
    annonces,
    labels: inpiEnt.labels || [],
    divers
  }
}
