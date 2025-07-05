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

// Client INPI (comptes annuels)
export const inpiEntreprise = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL}/inpi/entreprise`,
  headers: { Accept: 'application/json' }
})

// Client VIES pour TVA
export const vies = axios.create({
  baseURL: import.meta.env.VITE_VIES_API_URL,
  headers: { Accept: 'application/json' }
})

// Client Recherche d'entreprises (texte & détails)
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
  const { data } = await recherche.get<{ results: any[] }>('/search', {
    params: { q: name, page, per_page: perPage }
  })
  return data.results
}

/**
 * Wrapper lookup (SIREN ou SIRET)
 */
export function fetchEtablissementData(code: string) {
  return fetchEtablissementByCode(code)
}
// Récupère les établissements d'un SIREN paginés (20 par page)
export async function fetchEtablissementsBySiren(
  siren: string,
  page: number = 1,
  nombre: number = 20
) {
  const offset = (page - 1) * nombre;
  const res = await sirene.get(`/siret`, {
    params: {
      q: `siren:${siren}`,
      nombre,
      debut: offset,
      tri: 'desc'
    }
  });
  return {
    total: res.data.header?.total || 0,
    etablissements: res.data.etablissements || []
  };
}
// Récupère les établissements d'un SIREN paginés (20 par page)
export async function fetchEtablissementsBySiren(
  siren: string,
  page: number = 1,
  nombre: number = 20
) {
  const offset = (page - 1) * nombre;
  const res = await sirene.get(`/siret`, {
    params: {
      q: `siren:${siren}`,
      nombre,
      debut: offset,
      tri: 'desc'
    }
  });
  return {
    total: res.data.header?.total || 0,
    etablissements: res.data.etablissements || []
  };
}
