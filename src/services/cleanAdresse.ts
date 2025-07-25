// src/services/cleanAdresse.ts

/**
 * Nettoie et reformate une adresse pour améliorer le géocodage avec Nominatim.
 * - Retire les compléments inutiles (résidence, bâtiment, etc.)
 * - Remplace des abréviations courantes par leur forme complète
 * - Supprime les espaces multiples
 */
export function cleanAdresse(adresse: string): string {
  if (!adresse) return "";
  const toRemove = [
    /BAT[^ ]*/gi,
    /BÂT[^ ]*/gi,
    /RESIDENCE .+?(?= \d|$)/gi,
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
