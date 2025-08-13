/**
 * Utilitaires TVA FR + validation VIES (via backend)
 */
import { vies } from './api';

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

/**
 * Vérifie un numéro de TVA via votre backend VIES (évite les problèmes de CORS).
 * Le backend attendu doit exposer une route GET /check?countryCode=FR&vatNumber=XXXXXXXXX
 * et retourner un objet de la forme { valid: boolean, name?: string, address?: string }.
 *
 * Retourne null si la vérification échoue (réseau/erreur serveur).
 */
export async function validateTvaViaVies(countryCode: string, vatNumber: string): Promise<{ valid: boolean; name?: string; address?: string } | null> {
  try {
    const res = await vies.get('/check', {
      params: { countryCode, vatNumber },
    });
    const data = res.data || {};
    if (typeof data.valid === 'boolean') {
      return {
        valid: data.valid,
        name: data.name,
        address: data.address,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Pratique: vérifie directement à partir d’un SIREN FR.
 * Retourne { numero, valid } ou { numero, valid: null } si non vérifiable.
 */
export async function validateTvaFromSirenFR(siren: string): Promise<{ numero: string; valid: boolean | null }> {
  const numero = tvaFRFromSiren(siren);
  if (!numero) return { numero: '', valid: null };
  const check = await validateTvaViaVies('FR', numero.slice(2)); // enlève FR
  return { numero, valid: check?.valid ?? null };
}
