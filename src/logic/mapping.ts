// Remplace la fonction formatAdresseINPI par :
function formatAdresseINPI(adresse: any) {
  if (!adresse) return "";
  return [
    adresse.numVoie,
    adresse.typeVoie,
    adresse.voie,
    adresse.codePostal,
    adresse.commune,
    adresse.pays
  ].filter(Boolean).join(" ");
}

export async function fetchEtablissementData(siretOrSiren: string) {
  // ... tout le reste inchangé jusqu'à :
  // 3. Adresse (SIRENE puis fallback INPI)
  let adresse = [
    etab?.numeroVoieEtablissement || uniteLegale?.numeroVoieUniteLegale,
    etab?.typeVoieEtablissement || uniteLegale?.typeVoieUniteLegale,
    etab?.libelleVoieEtablissement || uniteLegale?.libelleVoieUniteLegale,
    etab?.complementAdresseEtablissement || uniteLegale?.complementAdresseUniteLegale,
    etab?.codePostalEtablissement || uniteLegale?.codePostalUniteLegale,
    etab?.libelleCommuneEtablissement || uniteLegale?.libelleCommuneUniteLegale
  ].filter(Boolean).join(" ");
  // Corrigé : si l'adresse SIRENE est vide, on la reconstruit de manière robuste depuis INPI :
  if (!adresse || adresse.trim() === "") {
    adresse = formatAdresseINPI(adresseINPI);
  }

  // ... puis plus loin pour les dirigeants :
  // 7. Données secondaires (onglets)
  // Correction : vérifier que pm.composition est bien un tableau et non undefined
  const representants = Array.isArray(pm.composition) ? pm.composition : [];

  // ... le reste inchangé
  return {
    // ... tous les champs
    adresse,
    // ...
    representants,
    // ...
  };
}
