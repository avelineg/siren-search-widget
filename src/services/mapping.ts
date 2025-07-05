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

export function formatDateFR(date: string | null | undefined) {
  if (!date) return '';
  return new Date(date).toLocaleDateString('fr-FR');
}

// ======================
// AJOUT FORMATAGE ETAB POUR LA LISTE PAGINEE
// ======================
export function mapEtablissement(etab: any) {
  const adresse = [
    etab.adresseEtablissement?.numeroVoieEtablissement,
    etab.adresseEtablissement?.typeVoieEtablissement,
    etab.adresseEtablissement?.libelleVoieEtablissement,
    etab.adresseEtablissement?.codePostalEtablissement,
    etab.adresseEtablissement?.libelleCommuneEtablissement,
  ].filter(Boolean).join(' ');
  return {
    siret: etab.siret,
    denomination: etab.denominationUsuelleEtablissement
      || etab.enseigne1Etablissement
      || etab.uniteLegale?.denominationUniteLegale
      || '—',
    adresse,
    etat: etab.etatAdministratifEtablissement === 'A' ? 'Actif' : 'Fermé',
    isSiege: !!etab.etablissementSiege,
  };
}
