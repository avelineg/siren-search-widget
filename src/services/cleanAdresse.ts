// src/services/cleanAdresse.ts

/**
 * Nettoie et reformate une adresse pour améliorer le géocodage.
 * - Retire les compléments inutiles (résidence, bâtiment, etc.)
 * - Remplace des abréviations courantes par leur forme complète
 * - Supprime les espaces multiples
 * - Corrige et simplifie certains noms de rues pour maximiser la compatibilité avec les géocodeurs
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
  cleaned = cleaned.replace(/AV /gi, "AVENUE ");
  cleaned = cleaned.replace(/BD /gi, "BOULEVARD ");
  cleaned = cleaned.replace(/STE /gi, "SAINTE ");
  cleaned = cleaned.replace(/ST /gi, "SAINT ");

  // Corrige quelques noms de villes (exemple)
  cleaned = cleaned.replace(/\bSELESTAT\b/gi, "Sélestat");

  // Simplifie certains noms de rues pour améliorer le géocodage (cas Président Raymond Poincaré)
  // Remplace "Président Raymond Poincaré"/"Président R. Poincaré" par "Président Poincaré"
  cleaned = cleaned.replace(/PRÉSIDENT\s+RAYMOND\s+POINCARÉ/gi, "PRÉSIDENT POINCARÉ");
  cleaned = cleaned.replace(/PRÉSIDENT\s+RAYMOND\s+POINCARE/gi, "PRÉSIDENT POINCARÉ");
  cleaned = cleaned.replace(/PRÉSIDENT\s+R\.?\s*POINCARÉ/gi, "PRÉSIDENT POINCARÉ");
  cleaned = cleaned.replace(/PRÉSIDENT\s+R\.?\s*POINCARE/gi, "PRÉSIDENT POINCARÉ");
  // Générique : tout prénom entre "PRÉSIDENT" et "POINCARÉ" ou "POINCARE"
  cleaned = cleaned.replace(/PRÉSIDENT\s+\w+\s+POINCARÉ/gi, "PRÉSIDENT POINCARÉ");
  cleaned = cleaned.replace(/PRÉSIDENT\s+\w+\s+POINCARE/gi, "PRÉSIDENT POINCARÉ");

  // Supprime les mots inutiles
  toRemove.forEach(regex => {
    cleaned = cleaned.replace(regex, "");
  });

  // Enlève les espaces multiples
  cleaned = cleaned.replace(/\s{2,}/g, " ").trim();

  return cleaned;
}
