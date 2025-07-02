import axios from 'axios'

const sirene = axios.create({
  baseURL: 'https://api.insee.fr/api-sirene/3.11',
  headers: {
    'X-INSEE-Api-Key-Integration': import.meta.env.VITE_SIRENE_API_KEY
  }
})

const recherche = axios.create({
  baseURL: import.meta.env.VITE_RECHERCHE_URL
})

const inpiEntreprise = axios.create({
  baseURL: import.meta.env.VITE_API_URL + '/inpi/entreprise'
})
const inpiDirigeants = axios.create({
  baseURL: import.meta.env.VITE_API_URL + '/inpi/dirigeants'
})

const vies = axios.create({
  baseURL: import.meta.env.VITE_VIES_API_URL
})

export {
  sirene,
  recherche,
  inpiEntreprise,
  inpiDirigeants,
  vies
}

// TODO : créer des fonctions fetchEtablissement, fetchDirigeants, etc.
