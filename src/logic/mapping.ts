import axios from "axios"
import {
  decodeFormeJuridique,
  decodeNaf,
  decodeTrancheEffectifs,
} from "./decode"

const API_SIRENE = "https://api.insee.fr/api-sirene/3.11"
const API_GEO = "https://api-adresse.data.gouv.fr/search/"
const API_INPI_ENTREPRISE = import.meta.env.VITE_API_URL + "/inpi/entreprise"
const API_INPI_DIRIGEANTS = import.meta.env.VITE_API_URL + "/inpi/dirigeants"
const API_VIES = import.meta.env.VITE_VAT_API_URL + "/check-vat"
const API_RECHERCHE = "https://recherche-entreprises.api.gouv.fr/api/v3"
const SIRENE_API_KEY = import.meta.env.VITE_SIRENE_API_KEY

/**
 * Formate une adresse INPI avec tous ses champs possibles.
 */
function formatAdresseINPI(ad: any): string {
  if (!ad || Object.keys(ad).length === 0) return ""
  const parts: string[] = []

  const numero = ad.numeroVoie ?? ad.numVoie
  if (numero) parts.push(numero)
  if (ad.typeVoie) parts.push(ad.typeVoie)
  if (ad.voie) parts.push(ad.voie)

  // Compléments et distributions
  ;[ad.complementAdresse, ad.complement1, ad.complement2]
    .filter(Boolean)
    .forEach((c) => parts.push(c))
  ;[
    ad.distributionSpeciale,
    ad.distributionSpeciale1,
    ad.distributionSpeciale2,
  ]
    .filter(Boolean)
    .forEach((d) => parts.push(d))

  // Boîte postale / BP
  const bp = ad.bp ?? ad.boitePostale
  if (bp) parts.push(bp)

  // CEDEX
  const cedex = ad.codeCedex ?? ad.cedex
  if (cedex) parts.push(`CEDEX ${cedex}`)

  // Code postal, ville, pays
  if (ad.codePostal) parts.push(ad.codePostal)
  if (ad.libelleCommune) parts.push(ad.libelleCommune)
  const pays = ad.libellePaysEtranger ?? ad.pays
  if (pays) parts.push(pays)

  return parts.join(" ").trim()
}

function computeTva(siren: string): string {
  if (!/^\d{9}$/.test(siren)) return ""
  const sirenNum = parseInt(siren, 10)
  const cle = (12 + 3 * (sirenNum % 97)) % 97
  return `FR${cle < 10 ? "0" : ""}${cle}${siren}`
}

export async function fetchEtablissementData(siretOrSiren: string) {
  let etab: any = null
  let uniteLegale: any = null
  let siren = ""
  let inpiData: any = {}
  let inpiDirigeants: any[] = []
  let rechercheData: any = {}
  let geo: [number, number] | null = null

  // 1) SIRENE : établissement & unité légale
  if (/^\d{14}$/.test(siretOrSiren)) {
    const { data } = await axios.get(`${API_SIRENE}/siret/${siretOrSiren}`, {
      headers: { "X-INSEE-Api-Key-Integration": SIRENE_API_KEY },
    })
    etab = data.etablissement
    siren = etab.siren
    uniteLegale = etab.uniteLegale
  } else {
    siren = siretOrSiren
    const { data } = await axios.get(`${API_SIRENE}/siren/${siren}`, {
      headers: { "X-INSEE-Api-Key-Integration": SIRENE_API_KEY },
    })
    uniteLegale = data.uniteLegale
  }

  // 2) INPI entreprise & dirigeants
  try {
    const resE = await axios.get(`${API_INPI_ENTREPRISE}/${siren}`)
    inpiData = resE.data
  } catch {
    inpiData = {}
  }
  try {
    const resD = await axios.get(`${API_INPI_DIRIGEANTS}/${siren}`)
    inpiDirigeants =
      resD.data.content?.composition ?? resD.data.composition ?? []
  } catch {
    inpiDirigeants = []
  }

  // 3) Recherche d'entreprises API
  try {
    const resR = await axios.get(`${API_RECHERCHE}/entreprises/${siren}`)
    rechercheData = resR.data
  } catch {
    rechercheData = {}
  }

  // 4) Construire l'adresse SIRENE
  const sireneAddressParts: any[] = [
    etab?.numeroVoieEtablissement,
    etab?.indiceRepetitionEtablissement,
    etab?.typeVoieEtablissement,
    etab?.libelleVoieEtablissement,
    etab?.complementAdresseEtablissement,
    etab?.distributionSpecialeEtablissement,
    etab?.codeCedexEtablissement ?? etab?.cedexEtablissement,
    etab?.codePostalEtablissement,
    etab?.libelleCommuneEtablissement,
    etab?.libellePaysEtrangerEtablissement ??
      etab?.libellePaysEtablissement,
  ]
  const adresseSirene = sireneAddressParts.filter(Boolean).join(" ").trim()

  // 5) Fallback INPI
  const pm = inpiData.content?.personneMorale ?? {}
  const etabINPI = pm.etablissementPrincipal ?? {}
  const adresseINPI = etabINPI.adresse ?? pm.adresseEntreprise ?? {}
  let adresse = adresseSirene || formatAdresseINPI(adresseINPI)

  // 6) Fallback Recherche d'entreprises
  if (!adresse && rechercheData.adresse) {
    const a = rechercheData.adresse
    adresse = [
      a.numeroRue,
      a.typeVoie,
      a.libelleVoie,
      a.complement1,
      a.complement2,
      a.codePostal,
      a.libelleCommune,
      a.libellePaysEtranger,
    ]
      .filter(Boolean)
      .join(" ")
      .trim()
  }

  if (!adresse) {
    console.warn("Aucune adresse trouvée pour SIREN/SIRET", siretOrSiren)
  }

  // 7) Géolocalisation
  if (adresse) {
    try {
      const { data } = await axios.get(API_GEO, {
        params: { q: adresse, limit: 1 },
      })
      const coords = data.features?.[0]?.geometry?.coordinates
      if (coords) geo = coords
    } catch {}
  }

  // 8) Juridique & identité
  const forme_juridique = decodeFormeJuridique(
    uniteLegale?.categorieJuridiqueUniteLegale ??
      pm.formeJuridique ??
      ""
  )
  const denomination =
    uniteLegale?.denominationUniteLegale ??
    pm.enseigne ??
    pm.nomCommercial ??
    pm.denomination ??
    ""
  const code_ape =
    etab?.activitePrincipaleEtablissement ??
    uniteLegale?.activitePrincipaleUniteLegale ??
    etabINPI.codeApe ??
    ""
  const libelle_ape = decodeNaf(code_ape)
  const siret = etab?.siret ?? etabINPI.siret ?? ""
  const date_creation =
    etab?.dateCreationEtablissement ??
    uniteLegale?.dateCreationUniteLegale ??
    pm.dateCreation ??
    ""

  // 9) Capital social
  const capital_social = uniteLegale?.capitalSocial ?? pm.montantCapital ?? 0

  // 10) TVA
  const tvaNum = computeTva(siren)
  let tva = null
  if (tvaNum) {
    try {
      const { data } = await axios.get(API_VIES, {
        params: { countryCode: "FR", vatNumber: tvaNum.slice(2) },
      })
      tva = { numero: tvaNum, valide: !!data.isValid }
    } catch {
      tva = { numero: tvaNum, valide: null }
    }
  }

  // 11) Récupération des dirigeants
  //  - INPI composition (prioritaire)
  //  - sinon SIRENE periodesDirigeantUniteLegale
  let representants = inpiDirigeants
  if (representants.length === 0 && Array.isArray(pm.composition)) {
    representants = pm.composition
  }
  if (representants.length === 0 && Array.isArray(uniteLegale?.periodesDirigeantUniteLegale)) {
    representants = uniteLegale.periodesDirigeantUniteLegale.map((p: any) => ({
      nom: p.nom,
      prenom: p.prenom,
      fonction: p.qualite,
      dateNomination: p.dateNomination,
      dateCessation: p.dateCessation,
    }))
  }
  if (representants.length === 0) {
    console.warn("Aucun dirigeant trouvé pour SIREN/SIRET", siretOrSiren)
  }

  // 12) Annonces, finances, labels, divers
  const annonces = pm.publicationLegale ? [pm.publicationLegale] : []
  const finances = capital_social
    ? [{ montant: capital_social, devise: pm.deviseCapital }]
    : []
  const labels = inpiData.labels || rechercheData.labels || []
  const divers = inpiData.divers || rechercheData.divers || []

  // 13) Tranches & catégorie
  const rawTranche = uniteLegale?.trancheEffectifsUniteLegale ?? ""
  const tranche_effectifs = decodeTrancheEffectifs(rawTranche)
  const tranche_annee =
    uniteLegale?.dateDernierTraitementUniteLegale ?? ""
  const categorie_entreprise = uniteLegale?.categorieEntreprise ?? ""

  return {
    denomination,
    siren,
    siret,
    adresse,
    geo,
    code_ape,
    libelle_ape,
    forme_juridique,
    date_creation,
    capital_social,
    tva,
    representants,
    annonces,
    finances,
    labels,
    divers,
    tranche_effectifs,
    tranche_annee,
    categorie_entreprise,
    recherche: rechercheData,
  }
}
