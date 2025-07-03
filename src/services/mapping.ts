import {
  sirene,
  vies,
  inpiEntreprise,
  recherche,
  searchCompaniesByName
} from './api'

export interface UnifiedEtablissement {
  denomination: string
  forme_juridique: string
  siren: string
  siret: string
  tva: { numero: string; valide: boolean }
  code_ape: string
  libelle_ape?: string
  tranche_effectifs: string
  capital_social: number
  date_creation: string
  adresse: string
  geo?: [number, number]
  dirigeants: Array<{
    nom?: string
    prenoms?: string
    qualite?: string
    dateNaissance?: string
    type: 'personne physique' | 'personne morale'
  }>
  finances: Array<{ montant: number; devise: string }>
  annonces: Array<{ titre?: string; date?: string; lien?: string }>
  labels: string[]
  divers: string[]
}

// Réexport brut recherche par nom
export { searchCompaniesByName }

/**
 * Recherche simplifiée par nom
 */
export async function searchEtablissementsByName(
  name: string,
  page?: number,
  perPage?: number
) {
  const raw = await searchCompaniesByName(name, page, perPage)
  return raw.map(r => ({
    siren: r.siren,
    nom_complet: r.nom_complet || r.nom_raison_sociale || '',
    nom_raison_sociale: r.nom_raison_sociale
  }))
}

/**
 * Lookup SIREN(9)/SIRET(14) + Sirene / VIES / INPI / Recherche
 */
export async function fetchEtablissementByCode(
  code: string
): Promise<UnifiedEtablissement> {
  let siren: string
  let siret: string

  // 1) Extraction du NIC siège
  if (/^\d{9}$/.test(code)) {
    siren = code
    const { data: pl } = await sirene.get<{ uniteLegale: any }>(`/siren/${siren}`)
    const periodes = pl.uniteLegale.periodesUniteLegale || []
    let current = periodes.find((p: any) => p.dateFin === null)
    if (!current && periodes.length) {
      current = periodes
        .sort((a: any, b: any) => Date.parse(b.dateDebut) - Date.parse(a.dateDebut))[0]
    }
    const nic = current?.nicSiegeUniteLegale
    if (!nic) throw new Error(`NIC siège non trouvé pour le SIREN ${siren}`)
    siret = `${siren}${nic}`
  } else if (/^\d{14}$/.test(code)) {
    siret = code
    siren = code.slice(0, 9)
  } else {
    throw new Error('Le code doit être un SIREN (9 chiffres) ou un SIRET (14 chiffres)')
  }

  // 2) Sirene données unité et établissement
  const { data: dEtab } = await sirene.get<{ etablissement: any }>(`/siret/${siret}`)
  const etab = dEtab.etablissement
  const { data: dUL } = await sirene.get<{ uniteLegale: any }>(`/siren/${siren}`)
  const ul = dUL.uniteLegale

  // 3) TVA VIES
  const tvaNum =
    etab.numeroTvaIntracommunautaire ||
    ul.numeroTvaIntracommunautaireUniteLegale ||
    ''
  let tvaValide = false
  if (tvaNum) {
    try {
      const { data: dv } = await vies.get<{ valid: boolean }>('/check-vat', {
        params: { countryCode: 'FR', vatNumber: tvaNum }
      })
      tvaValide = dv.valid
    } catch {
      tvaValide = false
    }
  }

  // 4) INPI comptes annuels (montantCapital dans content)
  let inpiEnt: any = {}
  try {
    inpiEnt = (await inpiEntreprise.get(`/${siren}`)).data
  } catch {
    console.warn('Échec récupération INPI comptes annuels')
  }
  const content = inpiEnt.content || {}
  const montantCapital =
    typeof content.montantCapital === 'number'
      ? content.montantCapital
      : ul.capitalSocial || 0

  // 5) Dirigeants via Recherche-Entreprises API
  let rawDir: any[] = []
  try {
    const { data: searchRes } = await recherche.get<{ results: any[] }>('/search', {
      params: { q: siren, page: 1, per_page: 1 }
    })
    const match = searchRes.results.find(r => r.siren === siren)
    rawDir = match?.dirigeants || []
  } catch {
    console.warn('Échec récupération dirigeants via Recherche API')
  }

  // 6) Mapping final
  const dirigeants = rawDir.map(d => ({
    nom: d.nom,
    prenoms: d.prenoms,
    qualite: d.qualite,
    dateNaissance: d.date_de_naissance,
    type: d.type_dirigeant
  }))

  const finances = Array.isArray(inpiEnt.finances)
    ? inpiEnt.finances.map((f: any) => ({
        montant: f.chiffre_affaires ?? f.ca ?? 0,
        devise: f.devise || '€'
      }))
    : []

  const annonces = Array.isArray(inpiEnt.annonces)
    ? inpiEnt.annonces.map((a: any) => ({
        titre: a.titre,
        date: a.date,
        lien: a.lien
      }))
    : []

  const divers = Array.isArray(inpiEnt.divers)
    ? inpiEnt.divers.map((x: any) => JSON.stringify(x))
    : []

  return {
    denomination: ul.denominationUniteLegale || etab.uniteLegale?.denomination || '',
    forme_juridique:
      ul.libelleCategorieJuridiqueUniteLegale ||
      ul.categorieJuridiqueUniteLegale ||
      '',
    siren,
    siret,
    tva: { numero: tvaNum, valide: tvaValide },
    code_ape:
      ul.activitePrincipaleUniteLegale ||
      etab.activitePrincipaleEtablissement ||
      '',
    libelle_ape: ul.libelleActivitePrincipaleUniteLegale,
    tranche_effectifs:
      etab.trancheEffectifsEtablissement ||
      ul.trancheEffectifsUniteLegale ||
      '',
    capital_social: montantCapital,
    date_creation:
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
        : undefined,
    dirigeants,
    finances,
    annonces,
    labels: inpiEnt.labels || [],
    divers
  }
}
