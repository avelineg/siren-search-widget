import { getEntrepriseBySiren } from './inpiBackend'
import { sirene, recherche } from './api'
import { tvaFRFromSiren } from './tva'
import naf from '../naf.json'
import formesJuridique from '../formeJuridique.json'
import { effectifTrancheLabel } from './effectifs'

function getInpi(path: string, obj: any) {
  return path.split('.').reduce((acc, key) => (acc && acc[key] != null ? acc[key] : undefined), obj);
}

function getLibelleApeFromINPI(inpiData: any): string | undefined {
  const activites = getInpi('formality.content.activites', inpiData);
  if (Array.isArray(activites)) {
    const principale = activites.find(act => act.codeApe || act.principale) || activites[0];
    if (principale && principale.descriptionDetaillee) {
      return principale.descriptionDetaillee;
    }
  }
  return undefined;
}

function getApeLabelFromNAF(codeApe: string): string | undefined {
  if (!codeApe) return undefined;
  return naf[codeApe] || naf[codeApe.replace(/^(\d{2})(\d{2})([A-Z])$/, '$1.$2$3')];
}

function getFormeJuridiqueLabel(code: string): string | undefined {
  if (!code) return undefined;
  return formesJuridique[code] || formesJuridique[code.padStart(4, '0')];
}

function formatAdresseSIRENE(adresseObj: any): string {
  if (!adresseObj || typeof adresseObj !== "object") return "-";
  return [
    adresseObj.numeroVoieEtablissement,
    adresseObj.typeVoieEtablissement,
    adresseObj.libelleVoieEtablissement,
    adresseObj.codePostalEtablissement,
    adresseObj.libelleCommuneEtablissement,
  ].filter(Boolean).join(' ');
}

export function formatDateFR(date: string | undefined | null): string | null {
  if (!date) return null;
  const [y, m, d] = date.split("-");
  if (!y || !m || !d) return date;
  return `${d}/${m}/${y}`;
}

/**
 * Détermine le statut ("actif" / "ferme") et la date de fermeture éventuelle pour un établissement donné.
 * Cette fonction doit être appelée sur chaque établissement INDIVIDUEL, pas sur le SIREN principal.
 */
function etablissementStatut(etab: any) {
  const date_fermeture = etab.dateFermetureEtablissement || etab.date_fermeture || null;
  if (date_fermeture) {
    return { statut: "ferme", date_fermeture };
  }
  const etat =
    etab.etatAdministratifEtablissement ||
    etab.etat_administratif ||
    etab.etatAdministratifUniteLegale ||
    etab.etat_administratif_unite_legale ||
    null;
  if (etat && etat !== "A") {
    return { statut: "ferme", date_fermeture: null };
  }
  return { statut: "actif", date_fermeture: null };
}

export async function searchEtablissementsByName(name: string) {
  const results = await recherche
    .get('/search', {
      params: { q: name, page: 1, per_page: 20 }
    })
    .then(r => r.data.results || [])
    .catch(() => []);

  return Array.isArray(results)
    ? results.map(r => {
        // Statut pour le SIREN (pas utilisé pour l'affichage des SIRET enfants !)
        const { statut, date_fermeture } = etablissementStatut(r);

        // mapping correct pour chaque matching_etablissements
        let matching_etablissements = Array.isArray(r.matching_etablissements)
          ? r.matching_etablissements.map((etab: any) => {
              const { statut, date_fermeture } = etablissementStatut(etab);
              return {
                ...etab,
                statut,
                date_fermeture,
                displayName:
                  etab.denomination ||
                  etab.nom_raison_sociale ||
                  etab.raison_sociale ||
                  etab.name ||
                  etab.nom_commercial ||
                  "-",
              }
            })
          : [];
        return {
          ...r,
          displayName:
            r.denomination ||
            r.nom_raison_sociale ||
            r.raison_sociale ||
            r.name ||
            r.nom ||
            "-",
          statut, // pour la fiche principale SIREN
          date_fermeture,
          matching_etablissements, // chaque établissement a son propre statut
        }
      })
    : [];
}

// Les autres fonctions de mapping (fetchEtablissementBySiren, fetchEtablissementBySiret...) restent inchangées.
// On garde la même logique pour les établissements dans ces fonctions.
