import {
  sirene,
  vies,
  inpiEntreprise,
  inpiDirigeants,
  searchCompaniesByName
} from './api'

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

// Réexport recherche brut
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
 * Lookup par SIREN (9) ou SIRET (14)
 */
export async function fetchEtablissementByCode(
  code: string
): Promise<UnifiedEtablissement> {
  let siren: string
  let siret: string

  // 1) Extract SIREN + SIRET
  if (/^\d{9}$/.test(code)) {
    siren = code
    const { data: pl } = await sirene.get<{ uniteLegale: any }>(`/siren/${siren}`)
    const nic = pl.uniteLegale.nicSiegeUniteLegale
    if (!nic) throw new Error(`NIC siège non trouvé pour le SIREN ${siren}`)
    siret = `${siren}${nic}`
  } else if (/^\d{14}$/.test(code)) {
    siret = code
    siren = code.slice(0, 9)
  } else {
    throw new Error('Code invalide : 9 (SIREN) ou 14 chiffres (SIRET) requis')
  }

  // 2) Sirene data
  const { data: dEtab } = await sirene.get<{ etablissement: any }>(`/siret/${siret}`)
  const etab = dEtab.etablissement
  const { data: dUL } = await sirene.get<{ uniteLegale: any }>(`/siren/${siren}`)
  const ul = dUL.uniteLegale

  // 3) VIES (si intracom TVA présent)
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

  // 4) Enrichissement INPI
  let inEnt: any = {}
  try {
    inEnt = (await inpiEntreprise.get(`/${siren}`)).data
  } catch {
    console.warn('Échec INPI entreprise')
  }
  let inDir: any = {}
  try {
    inDir = (await inpiDirigeants.get(`/${siren}`)).data
  } catch {
    console.warn('Échec INPI dirigeants')
  }

  // 5) Mapping
  const dirigeants =
    inDir.dirigeants?.map((d: any) => ({
      nom: d.nom,
      prenoms: d.prenoms,
      qualite: d.qualite,
      dateNaissance: d.date_de_naissance,
      type: d.type_dirigeant
    })) || []

  const finances =
    inEnt.finances?.map((f: any) => ({
      annee: f.annee,
      ca: f.ca,
      resultatNet: f.resultat_net
    })) || []

  const annonces =
    inEnt.annonces?.map((a: any) => ({
      titre: a.titre,
      date: a.date,
      lien: a.lien
    })) || []

  const divers = inEnt.divers ? inEnt.divers.map((x: any) => JSON.stringify(x)) : []

  return {
    denomination:
      ul.denominationUniteLegale || etab.uniteLegale?.denomination || '',
    formeJuridique:
      ul.libelleCategorieJuridiqueUniteLegale ||
      ul.categorieJuridiqueUniteLegale ||
      '',
    siren,
    siret,
    tva: { numero: tvaNum, valide: tvaValide },
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
    labels: inEnt.labels || [],
    divers
  }
}
