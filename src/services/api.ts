import axios from 'axios'
import { fetchEtablissementByCode } from './mapping'

// Client Sirene
export const sirene = axios.create({
  baseURL: 'https://api.insee.fr/api-sirene/3.11',
  headers: {
    'X-INSEE-Api-Key-Integration': import.meta.env.VITE_SIRENE_API_KEY,
    Accept: 'application/json'
  }
})

// Client INPI
export const inpiEntreprise = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL}/inpi/entreprise`,
  headers: { Accept: 'application/json' }
})
export const inpiDirigeants = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL}/inpi/dirigeants`,
  headers: { Accept: 'application/json' }
})

// Client VIES
export const vies = axios.create({
  baseURL: import.meta.env.VITE_VIES_API_URL,
  headers: { Accept: 'application/json' }
})

// Client Recherche d'entreprises (nom)
export const recherche = axios.create({
  baseURL: 'https://recherche-entreprises.api.gouv.fr',
  headers: { Accept: 'application/json' }
})

/**
 * Recherche entreprises par nom / raison sociale
 */
export async function searchCompaniesByName(
  name: string,
  page = 1,
  perPage = 5
): Promise<any[]> {
  // appel GET https://recherche-entreprises.api.gouv.fr/search?q=xxx&page=1&per_page=5
  const { data } = await recherche.get<{ results: any[] }>('/search', {
    params: { q: name, page, per_page: perPage }
  })
  return data.results
}

/**
 * Wrapper lookup (SIREN / SIRET)
 */
export function fetchEtablissementData(code: string) {
  return fetchEtablissementByCode(code)
}
