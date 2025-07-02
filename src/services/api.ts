import axios from 'axios'
import { fetchEtablissementData as rawFetch } from './mapping'

const sirene = axios.create({
  baseURL: 'https://api.insee.fr/api-sirene/3.11',
  headers: { 'X-INSEE-Api-Key-Integration': import.meta.env.VITE_SIRENE_API_KEY }
})
const recherche = axios.create({
  baseURL: import.meta.env.VITE_RECHERCHE_URL
})
const inpiEntreprise = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL}/inpi/entreprise`
})
const inpiDirigeants = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL}/inpi/dirigeants`
})
const vies = axios.create({
  baseURL: import.meta.env.VITE_VIES_API_URL
})

/**
 * wrapper autour de mapping.fetchEtablissementData
 */
export async function fetchEtablissementData(siretOrSiren: string) {
  return rawFetch(siretOrSiren)
}

// expose aussi des fetch spécialisés si besoin
export { sirene, recherche, inpiEntreprise, inpiDirigeants, vies }
