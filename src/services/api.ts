import axios from 'axios'

// Client Recherche d'entreprises (texte & détails)
export const recherche = axios.create({
  baseURL: 'https://recherche-entreprises.api.gouv.fr',
  headers: { Accept: 'application/json' }
})

// Client Sirene (optionnel, gardé si besoin ailleurs dans ton app)
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

// ==========================
// Nouvelle fonction de recherche d'établissements par SIREN
// ==========================
/**
 * Récupère la liste paginée des établissements pour un SIREN via recherche textuelle,
 * puis filtre côté front pour ne garder que les établissements du SIREN.
 * @param siren - le SIREN recherché
 * @param denomination - la dénomination (nom) de l'entreprise à rechercher
 * @returns { total, etablissements }
 */
export async function fetchEtablissementsBySiren(siren: string, denomination: string) {
  // On cherche par nom, puis on filtre côté front sur le SIREN
  const res = await recherche.get('/search', {
    params: {
      q: denomination,
      per_page: 20 // nombre de résultats d'entreprise (pas d'établissements !)
    }
  });

  // Agrège tous les établissements de chaque résultat, puis filtre sur le SIREN
  const results = res.data.results || [];
  let allEtablissements = [];
  results.forEach(ent => {
    if (Array.isArray(ent.matching_etablissements)) {
      allEtablissements.push(...ent.matching_etablissements.filter(etab =>
        etab.siret && etab.siret.startsWith(siren)
      ));
    }
    // Certains résultats peuvent aussi avoir une clé etablissements (moins courant)
    if (Array.isArray(ent.etablissements)) {
      allEtablissements.push(...ent.etablissements.filter(etab =>
        etab.siret && etab.siret.startsWith(siren)
      ));
    }
  });
  return {
    total: allEtablissements.length,
    etablissements: allEtablissements
  }
}
