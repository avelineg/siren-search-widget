/**
 * Calcule le numéro de TVA intracommunautaire français à partir d’un SIREN.
 * Retourne une chaîne du type FRXX999999999 ou '' si SIREN invalide.
 */
export function tvaFRFromSiren(siren: string): string {
  if (!/^\d{9}$/.test(siren)) return '';
  const n = parseInt(siren, 10);
  const cle = (12 + 3 * (n % 97)) % 97;
  return `FR${cle.toString().padStart(2, '0')}${siren}`;
}
