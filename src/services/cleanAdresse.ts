// Nettoie et reformate une adresse pour le géocodage Nominatim
export function cleanAdresse(adresse: string): string {
  // Liste des mots-clés à retirer car Nominatim les ignore ou les confond
  const toRemove = [
    /BAT[^ ]*/gi,         // BAT, BATIMENT, BAT A, etc.
    /BÂT[^ ]*/gi,
    /RESIDENCE .+?(?= \d|$)/gi, // RESIDENCE ... (jusqu'à numéro suivant ou fin)
    /RÉSIDENCE .+?(?= \d|$)/gi,
    /LE PLEIN CENTRE/gi,
    /TECH IROISE/gi
  ];
  let cleaned = adresse;

  // Corrige quelques abréviations courantes
  cleaned = cleaned.replace(/PRESIDT/gi, "PRESIDENT");
  cleaned = cleaned.replace(/AV /gi, "AVENUE ");
  cleaned = cleaned.replace(/BD /gi, "BOULEVARD ");
  cleaned = cleaned.replace(/STE /gi, "SAINTE ");
  cleaned = cleaned.replace(/ST /gi, "SAINT ");

  // Supprime les mots inutiles
  toRemove.forEach(regex => {
    cleaned = cleaned.replace(regex, "");
  });

  // Enlève les espaces multiples
  cleaned = cleaned.replace(/\s{2,}/g, " ").trim();

  return cleaned;
}
