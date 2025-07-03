const API_URL = import.meta.env.VITE_API_URL;

// Récupère la fiche entreprise INPI (toutes infos, y compris comptes annuels si ton backend les expose)
export async function getEntrepriseBySiren(siren: string) {
  const res = await fetch(`${API_URL}/inpi/entreprise/${siren}`);
  if (!res.ok) throw new Error('Erreur récupération INPI');
  return await res.json();
}

// Recherche floue par raison sociale
export async function searchEntreprisesByRaisonSociale(raisonSociale: string) {
  const res = await fetch(`${API_URL}/inpi/entreprises?raisonSociale=${encodeURIComponent(raisonSociale)}`);
  if (!res.ok) throw new Error('Erreur recherche INPI');
  return await res.json();
}
