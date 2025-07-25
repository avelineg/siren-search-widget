import axios from 'axios'

// Client Sirene (INSEE)
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
 * Récupère la liste paginée des établissements pour un SIREN.
 * @param siren - le SIREN recherché
 * @param page - page courante (début = 1)
 * @param nombre - nombre d'établissements par page (défaut : 20)
 * @returns { total, etablissements }
 */
export async function fetchEtablissementsBySiren(
  siren: string,
  page: number = 1,
  nombre: number = 20
) {
  const res = await recherche.get('/search', {
    params: {
      q: `siren:${siren}`,
      per_page: 1 // On ne veut que l'unité légale principale
    }
  });

  // Les établissements sont dans le champ .etablissements du premier résultat
  const allEtab = (res.data.results && res.data.results[0]?.etablissements) || [];
  const total = allEtab.length;
  // Pagination côté front
  const etablissements = allEtab.slice((page - 1) * nombre, page * nombre);
  return { total, etablissements };
}

/**
 * Récupère la liste des actes INPI pour un SIREN.
 * @param siren
 * @returns tableau d'actes
 */
export const getActesINPI = (siren: string) =>
  axios.get(`/inpi/entreprise/${siren}/documents-comptes`)
    .then(res => res.data.actes || []);
