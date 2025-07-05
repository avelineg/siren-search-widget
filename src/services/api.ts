import axios from 'axios'

// ... autres clients axios

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
      q: siren,
      per_page: 1 // On récupère l'unité légale uniquement
    }
  });

  // Les établissements sont dans le champ .etablissements du premier résultat
  const allEtab = (res.data.results && res.data.results[0]?.etablissements) || [];
  const total = allEtab.length;
  // Pagination côté front
  const etablissements = allEtab.slice((page - 1) * nombre, page * nombre);
  return { total, etablissements };
}
