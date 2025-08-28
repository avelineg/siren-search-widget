// src/services/cleanAdresse.ts

/**
 * Nettoie et reformate une adresse pour améliorer le géocodage.
 * - Retire les compléments inutiles (résidence, bâtiment, etc.)
 * - Remplace des abréviations courantes par leur forme complète
 * - Supprime les espaces multiples
 * - Corrige et enrichit les noms de rues et de villes fréquemment mal orthographiés
 */
export function cleanAdresse(adresse: string): string {
  if (!adresse) return "";
  const toRemove = [
    /BAT[^ ]*/gi,
    /BÂT[^ ]*/gi,
    /RESIDENCE .+?(?= \d|$)/gi,
    /RÉSIDENCE .+?(?= \d|$)/gi,
    /PAEI .+?(?= \d|$)/gi, // Ajout pour "PAEI du Giessen"
    /ZA DE .+?(?= \d|$)/gi, // Ajout zone d'activité
    /LE PLEIN CENTRE/gi,
    /TECH IROISE/gi
  ];
  let cleaned = adresse;

  // Corrige quelques abréviations courantes
  cleaned = cleaned.replace(/PRESIDT/gi, "PRÉSIDENT");
  cleaned = cleaned.replace(/PRESIDENT/gi, "PRÉSIDENT");
  cleaned = cleaned.replace(/RAY POINCARE/gi, "RAYMOND POINCARÉ");
  cleaned = cleaned.replace(/AV /gi, "AVENUE ");
  cleaned = cleaned.replace(/BD /gi, "BOULEVARD ");
  cleaned = cleaned.replace(/STE /gi, "SAINTE ");
  cleaned = cleaned.replace(/ST /gi, "SAINT ");

  // Corrige quelques noms de villes (exemple)
  cleaned = cleaned.replace(/\bSELESTAT\b/gi, "Sélestat");

  // Supprime les mots inutiles
  toRemove.forEach(regex => {
    cleaned = cleaned.replace(regex, "");
  });

  // Enlève les espaces multiples
  cleaned = cleaned.replace(/\s{2,}/g, " ").trim();

  return cleaned;
}
