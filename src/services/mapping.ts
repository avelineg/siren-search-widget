import { EFFECTIFS_LIBELLES } from './effectifs'
import {
  sirene,
  vies,
  inpiEntreprise,
  recherche,
  searchCompaniesByName
} from './api'

export interface Etablissement {
  siret: string
  adresse: string
  activite_principale: string
  tranche_effectif_salarie: string
  tranche_effectif_libelle: string
  est_siege: boolean
  date_creation: string
  etat_administratif: string
}

export interface Dirigeant {
  nom?: string
  prenoms?: string
  qualite?: string
  dateNaissance?: string
  type: 'personne physique' | 'personne morale'
  denomination?: string
  siren?: string
}

export interface UnifiedEtablissement {
  denomination: string
  forme_juridique: string
  categorie_juridique?: string
  sigle?: string
  nom_commercial?: string
  siren: string
  siret: string
  tva: { numero: string; valide: boolean }
  code_ape: string
  libelle_ape?: string
  tranche_effectifs: string
  tranche_effectif_salarie?: string
  capital_social: number
  date_creation: string
  adresse: string
  geo?: [number, number]
  etablissements: Etablissement[]
  dirigeants: Dirigeant[]
  finances: Array<{
    exercice: string
    ca?: number
    resultat_net?: number
    effectif?: number
    capital_social?: number
  }>
  annonces: Array<{ titre?: string; date?: string; lien?: string }>
  labels: string[]
  divers: string[]
  statut_diffusion?: string
  caractere_employeur?: string
  site_web?: string
  email?: string
}

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

  // 4) Comptes annuels INPI
  let inpiEnt: any = {}
  try {
    inpiEnt = (await inpiEntreprise.get(`/${siren}`)).data
  } catch {
    console.warn('Échec récupération INPI comptes annuels')
  }
  const content = inpiEnt.content || {}

  // Récupération du capital social
  let capitalSocial = 0
  if (typeof content.montantCapital === 'number') {
    capitalSocial = content.montantCapital
  } else if (Array.isArray(content.comptesAnnuels) && content.comptesAnnuels.length) {
    const last = content.comptesAnnuels[0]
    capitalSocial = last.capital_social || last.capital || 0
  } else if (typeof ul.capitalSocial === 'number') {
    capitalSocial = ul.capitalSocial
  }

  // Comptes annuels/données financières
  let finances: Array<{
    exercice: string
    ca?: number
    resultat_net?: number
    effectif?: number
    capital_social?: number
  }> = []
  if (Array.isArray(content.comptesAnnuels)) {
    finances = content.comptesAnnuels.map((c: any) => ({
      exercice: c.exercice,
      ca: c.ca ?? c.chiffre_affaires,
      resultat_net: c.resultat_net,
      effectif: c.effectif,
      capital_social: c.capital_social ?? c.capital
    }))
  } else if (content.finances && typeof content.finances === 'object') {
    // Support format: { "2015": { ca:..., resultat_net:... }, ... }
    finances = Object.entries(content.finances).map(([exercice, f]: [string, any]) => ({
      exercice,
      ca: f.ca ?? f.chiffre_affaires,
      resultat_net: f.resultat_net,
      effectif: f.effectif,
      capital_social: f.capital_social ?? f.capital
    }))
  }

  // 5) Recherche API pour établissements et dirigeants enrichis
  let etablissements: Etablissement[] = []
  let dirigeants: Dirigeant[] = []
  let statut_diffusion = undefined
  let caractere_employeur = undefined
  let sigle = undefined
  let nom_commercial = undefined
  let site_web = undefined
  let email = undefined
  let categorie_juridique = undefined
  try {
    const { data: searchRes } = await recherche.get<{ results: any[] }>('/search', {
      params: { q: siren, page: 1, per_page: 1 }
    })
    const match = searchRes.results.find(r => r.siren === siren)
    if (match) {
      etablissements = (match.matching_etablissements || []).concat(
        match.siege ? [match.siege] : []
      ).map((e: any) => ({
        siret: e.siret,
        adresse: e.adresse,
        activite_principale: e.activite_principale,
        tranche_effectif_salarie: e.tranche_effectif_salarie,
        tranche_effectif_libelle: EFFECTIFS_LIBELLES[e.tranche_effectif_salarie] || '',
        est_siege: !!e.est_siege,
        date_creation: e.date_creation,
        etat_administratif: e.etat_administratif
      })).filter(e => !!e.siret)
      dirigeants = (match.dirigeants || []).map((d: any) =>
        d.type_dirigeant === 'personne morale'
          ? {
              type: d.type_dirigeant,
              denomination: d.denomination,
              siren: d.siren
            }
          : {
              type: d.type_dirigeant,
              nom: d.nom,
              prenoms: d.prenoms,
              qualite: d.qualite,
              dateNaissance: d.date_de_naissance
            }
      )
      statut_diffusion = match.statut_diffusion
      caractere_employeur = match.caractere_employeur
      sigle = match.sigle
      nom_commercial = match.nom_commercial
      categorie_juridique = match.nature_juridique
      site_web = match.site_web
      email = match.email
    }
  } catch {
    console.warn('Échec récupération dirigeants/établissements via Recherche API')
  }

  // 6) Annonces et divers
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
    categorie_juridique,
    sigle,
    nom_commercial,
    siren,
    siret,
    tva: { numero: tvaNum, valide: tvaValide },
    code_ape:
      content.codeApe ||
      ul.activitePrincipaleUniteLegale ||
      etab.activitePrincipaleEtablissement ||
      '',
    libelle_ape: content.libelleApe || ul.libelleActivitePrincipaleUniteLegale || '',
    tranche_effectifs:
      EFFECTIFS_LIBELLES[
        etab.trancheEffectifsEtablissement || ul.trancheEffectifsUniteLegale || ''
      ] ||
      etab.trancheEffectifsEtablissement ||
      ul.trancheEffectifsUniteLegale ||
      '',
    tranche_effectif_salarie:
      etab.trancheEffectifsEtablissement || ul.trancheEffectifsUniteLegale || '',
    capital_social: capitalSocial,
    date_creation:
      ul.dateCreationUniteLegale || etab.dateCreationEtablissement || '',
    adresse: [
      etab.adresseEtablissement?.numeroVoieEtablissement,
      etab.adresseEtablissement?.typeVoieEtablissement,
      etab.adresseEtablissement?.libelleVoieEtablissement,
      etab.adresseEtablissement?.codePostalEtablissement,
      etab.adresseEtablissement?.libelleCommuneEtablissement
    ]
      .filter(Boolean)
      .join(' ') || etab.adresse || '',
    geo:
      etab.geoLatitude && etab.geoLongitude
        ? [etab.geoLatitude, etab.geoLongitude]
        : undefined,
    etablissements,
    dirigeants,
    finances,
    annonces,
    labels: inpiEnt.labels || [],
    divers,
    statut_diffusion,
    caractere_employeur,
    site_web,
    email
  }
}
