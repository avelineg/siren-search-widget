/**
 * fetchEtablissementData : combine les réponses des différentes APIs
 * (Sirene, Recherche, INPI, TVA…) pour retourner un objet unifié.
 *
 * TODO : remplacer ce stub par l’enchaînement réel des appels axios :
 *   sirene.get(...), recherche.get(...), inpiEntreprise.get(...), inpiDirigeants.get(...), vies.get(...),
 * puis merger et mapper les champs selon le schéma de l’Annuaire-Entreprises.
 */
export async function fetchEtablissementData(siretOrSiren: string): Promise<any> {
  // Stub temporaire pour lever l’erreur de build
  return {
    denomination: '',
    forme_juridique: '',
    siren: siretOrSiren,
    siret: siretOrSiren,
    tva: { numero: '', valide: null },
    code_ape: '',
    libelle_ape: '',
    tranche_effectifs: '',
    capital_social: 0,
    date_creation: '',
    adresse: '',
    geo: null,
    recherche: {},
    representants: [],
    finances: [],
    annonces: [],
    labels: [],
    divers: []
  }
}
