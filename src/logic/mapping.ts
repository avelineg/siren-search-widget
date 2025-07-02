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
const SIRENE_API_KEY = import.meta.env.VITE_SIRENE_API_KEY

function formatAdresseINPI(ad: any): string {
  if (!ad) return ""
  return [
    ad.numVoie,
    ad.typeVoie,
    ad.voie,
    ad.complementAdresse,
    ad.distributionSpeciale,
    ad.codePostal,
    ad.commune,
    ad.pays,
  ]
    .filter(Boolean)
    .join(" ")
    .trim()
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

  // 3) Construire l'adresse (SIRENE puis INPI)
  const adresseSirene = [
    etab?.numeroVoieEtablissement,
    etab?.typeVoieEtablissement,
    etab?.libelleVoieEtablissement,
    etab?.complementAdresseEtablissement,
    etab?.distributionSpecialeEtablissement,
    etab?.cedexEtablissement,
    etab?.codePostalEtablissement,
    etab?.libelleCommuneEtablissement,
    etab?.libellePaysEtablissement,
  ]
    .filter(Boolean)
    .join(" ")
    .trim()

  const pm = inpiData.content?.personneMorale ?? {}
  const etabINPI = pm.etablissementPrincipal ?? {}
  const adresseINPI = etabINPI.adresse ?? pm.adresseEntreprise ?? {}

  const adresse = adresseSirene || formatAdresseINPI(adresseINPI)

  // 4) Géolocalisation
  if (adresse) {
    try {
      const { data } = await axios.get(API_GEO, {
        params: { q: adresse, limit: 1 },
      })
      const coords = data.features?.[0]?.geometry?.coordinates
      if (coords) geo = coords
    } catch {}
  }

  // 5) Infos juridiques et identité
  const forme_juridique = decodeFormeJuridique(
    uniteLegale?.categorieJuridiqueUniteLegale || pm.formeJuridique || ""
  )
  const denomination =
    uniteLegale?.denominationUniteLegale ||
    pm.enseigne ||
    pm.nomCommercial ||
    pm.denomination ||
    ""
  const code_ape =
    etab?.activitePrincipaleEtablissement ||
    uniteLegale?.activitePrincipaleUniteLegale ||
    etabINPI.codeApe ||
    ""
  const libelle_ape = decodeNaf(code_ape)
  const siret = etab?.siret || etabINPI.siret || ""
  const date_creation =
    etab?.dateCreationEtablissement ||
    uniteLegale?.dateCreationUniteLegale ||
    pm.dateCreation ||
    ""

  // 6) Capital social
  const capital_social = uniteLegale?.capitalSocial ?? pm.montantCapital ?? 0

  // 7) TVA intracommunautaire
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

  // 8) Autres onglets
  const representants = inpiDirigeants.length
    ? inpiDirigeants
    : Array.isArray(pm.composition)
    ? pm.composition
    : []
  const annonces = pm.publicationLegale ? [pm.publicationLegale] : []
  const finances = capital_social
    ? [{ montant: capital_social, devise: pm.deviseCapital }]
    : []
  const labels = inpiData.labels || []
  const divers = inpiData.divers || []

  // 9) Tranches & catégorie
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
  }
}
