/**
 * Centralise le parsing des erreurs d'appels API
 * pour renvoyer un message utilisateur clair.
 */
import axios from 'axios'

/**
 * @param {unknown} error
 * @returns {string} message utilisateur
 */
export function parseApiError(error) {
  // AxiosError sans réponse = échec de réseau / CORS
  if (axios.isAxiosError(error)) {
    const err = error
    if (!err.response) {
      return 'Impossible de contacter le serveur distant. Vérifiez la configuration CORS ou la disponibilité du service.'
    }
    // 404 = pas de données
    if (err.response.status === 404) {
      return 'Aucune donnée trouvée pour ce SIREN/SIRET.'
    }
    // 400 = requête invalide (ex : géoloc vide)
    if (err.response.status === 400) {
      return 'Requête invalide. Veuillez vérifier les paramètres fournis.'
    }
    // 503, 500 etc.
    return `Erreur serveur (${err.response.status}). Merci de réessayer plus tard.`
  }

  // Erreur JS classique
  if (error instanceof Error) {
    return error.message
  }

  // Fallback
  return 'Une erreur inconnue est survenue.'
}
