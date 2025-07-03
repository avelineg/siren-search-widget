import axios from 'axios'

export const sirene = axios.create({
  baseURL: 'https://api.insee.fr/api-sirene/3.11',
  headers: { 'X-INSEE-Api-Key-Integration': import.meta.env.VITE_SIRENE_API_KEY }
})

export const inpiEntreprise = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL}/inpi/entreprise`
})

export const inpiDirigeants = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL}/inpi/dirigeants`
})

export const vies = axios.create({
  baseURL: import.meta.env.VITE_VIES_API_URL
})

// Client for Recherche d'entreprises (nom / adresse)
export const recherche = axios.create({
  baseURL: import.meta.env.VITE_RECHERCHE_URL
})

/**
 * Recherche les entreprises par raison sociale ou nom.
 * @param name chaîne à rechercher
 * @param page numéro de page (défaut 1)
 * @param perPage nombre de résultats par page (défaut 5)
 * @returns tableau de résultats bruts
 */
export async function searchCompaniesByName(
  name: string,
  page = 1,
  perPage = 5
): Promise<any[]> {
  const { data } = await recherche.get<{
    results: any[]
  }>(`/search`, {
    params: { q: name, page, per_page: perPage }
  })
  return data.results
}
