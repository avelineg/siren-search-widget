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
 * Détermine le statut ("actif" / "ferme") et la date de fermeture éventuelle pour un établissement.
 */
function etablissementStatut(etab: any) {
  const date_fermeture = etab.dateFermetureEtablissement || etab.date_fermeture || null;
  if (date_fermeture) {
    return { statut: "ferme", date_fermeture };
  }
  // Etat administratif ("A" = Actif, sinon fermé)
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

/**
 * Recherche par nom de société (affiche aussi le statut d'activité + date fermeture si connue).
 */
export async function searchEtablissementsByName(name: string) {
  const results = await recherche
    .get('/search', {
      params: { q: name, page: 1, per_page: 20 }
    })
    .then(r => r.data.results || [])
    .catch(() => []);

  return Array.isArray(results)
    ? results.map(r => {
        const { statut, date_fermeture } = etablissementStatut(r);
        return {
          ...r,
          displayName:
            r.denomination ||
            r.nom_raison_sociale ||
            r.raison_sociale ||
            r.name ||
            r.nom ||
            "-",
          statut, // "actif" ou "ferme"
          date_fermeture,
        }
      })
    : [];
}

export async function fetchEtablissementBySiren(siren: string) {
  const [
    inpiDataRaw,
    rechercheDataRaw,
    sireneULRaw,
    etablissementsRaw
  ] = await Promise.all([
    getEntrepriseBySiren(siren).catch(() => ({})),
    recherche.get('/search', { params: { q: siren, page: 1, per_page: 1 } }).then(r => r.data).catch(() => ({})),
    sirene.get(`/siren/${siren}`).then(r => r.data.uniteLegale).catch(() => ({})),
    sirene.get(`/siren/${siren}/etablissements`).then(r => r.data.etablissements).catch(() => ([])),
  ]);

  const inpiData = inpiDataRaw || {};
  const rechercheData = rechercheDataRaw || {};
  const sireneUL = sireneULRaw || {};

  let etablissements = Array.isArray(etablissementsRaw)
    ? etablissementsRaw.map((etab: any) => {
        const { statut, date_fermeture } = etablissementStatut(etab);
        return {
          ...etab,
          displayName:
            etab.denomination ||
            etab.nom_raison_sociale ||
            etab.raison_sociale ||
            etab.name ||
            etab.nom_commercial ||
            "-",
          adresse: formatAdresseSIRENE(etab.adresseEtablissement),
          statut,
          date_fermeture,
        }
      })
    : [];

  // Dénomination principale
  const denomination =
    getInpi("formality.content.personneMorale.identite.entreprise.denomination", inpiData) ||
    inpiData.denomination ||
    getInpi("formality.content.personneMorale.identite.entreprise.nom", inpiData) ||
    (rechercheData?.results?.[0]?.denomination) ||
    (rechercheData?.results?.[0]?.nom_raison_sociale) ||
    sireneUL.denominationUniteLegale ||
    "-";

  // Adresse, statut et date_fermeture = celles du siège (si trouvé)
  let adresse = "-";
  let statut = "actif";
  let date_fermeture = null;
  let siege = null;
  if (Array.isArray(etablissementsRaw)) {
    siege = etablissementsRaw.find((etab: any) => etab.siege);
    if (siege) {
      adresse = formatAdresseSIRENE(siege.adresseEtablissement);
      ({ statut, date_fermeture } = etablissementStatut(siege));
    }
  }

  return {
    denomination,
    siren,
    adresse,
    etablissements,
    statut,
    date_fermeture,
    inpiRaw: inpiDataRaw
    // ... autres propriétés comme avant ...
  };
}

export async function fetchEtablissementBySiret(siret: string) {
  const siren = siret.slice(0, 9)
  const [
    inpiDataRaw,
    sireneEtabRaw,
    sireneULRaw,
    etablissementsRaw
  ] = await Promise.all([
    getEntrepriseBySiren(siren).catch(() => ({})),
    sirene.get(`/siret/${siret}`).then(r => r.data.etablissement).catch(() => ({})),
    sirene.get(`/siren/${siren}`).then(r => r.data.uniteLegale).catch(() => ({})),
    sirene.get(`/siren/${siren}/etablissements`).then(r => r.data.etablissements).catch(() => ([])),
  ]);

  const inpiData = inpiDataRaw || {};
  const sireneEtab = sireneEtabRaw || {};
  const sireneUL = sireneULRaw || {};

  let etablissements = Array.isArray(etablissementsRaw)
    ? etablissementsRaw.map((etab: any) => {
        const { statut, date_fermeture } = etablissementStatut(etab);
        return {
          ...etab,
          displayName:
            etab.denomination ||
            etab.nom_raison_sociale ||
            etab.raison_sociale ||
            etab.name ||
            etab.nom_commercial ||
            "-",
          adresse: formatAdresseSIRENE(etab.adresseEtablissement),
          statut,
          date_fermeture,
        }
      })
    : [];

  const { statut, date_fermeture } = etablissementStatut(sireneEtab);

  return {
    denomination:
      getInpi("formality.content.personneMorale.identite.entreprise.denomination", inpiData) ||
      inpiData.denomination ||
      getInpi("formality.content.personneMorale.identite.entreprise.nom", inpiData) ||
      sireneUL.denominationUniteLegale ||
      "-",
    siren,
    siret,
    adresse: formatAdresseSIRENE(sireneEtab?.adresseEtablissement) || "-",
    etablissements,
    statut,
    date_fermeture,
    inpiRaw: inpiDataRaw
    // ... autres propriétés comme avant ...
  };
}

export async function fetchEtablissementByCode(code: string) {
  if (/^\d{14}$/.test(code)) {
    return fetchEtablissementBySiret(code);
  } else if (/^\d{9}$/.test(code)) {
    return fetchEtablissementBySiren(code);
  } else {
    throw new Error('Code SIREN/SIRET invalide');
  }
}
