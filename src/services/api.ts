import axios from 'axios'
import { fetchEtablissementByCode } from './mapping'

// Client Sirene
export const sirene = axios.create({
  baseURL: 'https://api.insee.fr/api-sirene/3.11',
  headers: { 'X-INSEE-Api-Key-Integration': import.meta.env.VITE_SIRENE_API_KEY }
})

// Client INPI (entreprise & dirigeants)
export const inpiEntreprise = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL}/inpi/entreprise`
})
export const inpiDirigeants = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL}/inpi/dirigeants`
})

// Client VIES
export const vies = axios.create({
  baseURL: import.meta.env.VITE_VIES_API_URL
})

// Client Recherche d'entreprises (nom / adresse)
export const recherche = axios.create({
  baseURL: import.meta.env.VITE_RECHERCHE_URL
})

/**
 * Recherche les entreprises par raison sociale ou nom via l'API Recherche.
 * @param name chaîne à rechercher
 * @param page numéro de page (défaut 1)
 * @param perPage résultats par page (défaut 5)
 * @returns tableau brut des résultats
 */
export async function searchCompaniesByName(
  name: string,
  page = 1,
  perPage = 5
): Promise<any[]> {
  const { data } = await recherche.get<{ results: any[] }>('/search', {
    params: { q: name, page, per_page: perPage }
  })
  return data.results
}

/**
 * Lookup par code (SIREN ou SIRET), wrapper autour de mapping.fetchEtablissementByCode
 * @param code 9 ou 14 chiffres
 */
export async function fetchEtablissementData(code: string) {
  return fetchEtablissementByCode(code)
}
