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
        const { statut, date_fermeture } = etablissementStatut(r);
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
          statut,
          date_fermeture,
          matching_etablissements,
        }
      })
    : [];
}

/**
 * Récupère toutes les données d'un SIREN (INPI + SIRENE + liste des établissements via API recherche)
 */
export async function fetchEtablissementBySiren(siren: string) {
  const [
    inpiDataRaw,
    rechercheDataRaw,
    sireneULRaw
  ] = await Promise.all([
    getEntrepriseBySiren(siren).catch(() => ({})),
    recherche.get('/search', { params: { q: siren, page: 1, per_page: 1 } }).then(r => r.data).catch(() => ({})),
    sirene.get(`/siren/${siren}`).then(r => r.data.uniteLegale).catch(() => ({})),
  ]);

  const inpiData = inpiDataRaw || {};
  const rechercheData = rechercheDataRaw || {};
  const sireneUL = sireneULRaw || {};

  // Récupération de tous les établissements liés au SIREN via API recherche entreprise
  let etablissements: any[] = [];
  try {
    const etablissementsResp = await recherche.get('/search', { params: { q: siren, per_page: 1000 } });
    etablissements = (etablissementsResp.data.results || []).map((etab: any) => {
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
        adresse: etab.adresse || etab.adresseEtablissement || "",
        statut,
        date_fermeture,
        siret: etab.siret || etab.siret_etablissement,
        est_siege: etab.siege || etab.est_siege || false,
        activite_principale: etab.activite_principale || etab.code_ape || "",
        tranche_effectif_libelle: etab.tranche_effectif_libelle || etab.tranche_effectifs || "",
        tranche_effectif_salarie: etab.tranche_effectif_salarie || "",
        date_creation: etab.date_creation || etab.dateCreationEtablissement || "",
      }
    });
  } catch (e) {
    etablissements = [];
  }

  // Dénomination principale
  const denomination =
    getInpi("formality.content.personneMorale.identite.entreprise.denomination", inpiData) ||
    inpiData.denomination ||
    getInpi("formality.content.personneMorale.identite.entreprise.nom", inpiData) ||
    (rechercheData?.results?.[0]?.denomination) ||
    (rechercheData?.results?.[0]?.nom_raison_sociale) ||
    sireneUL.denominationUniteLegale ||
    "-";

  // On tente de trouver le siège
  let adresse = "-";
  let statut = "actif";
  let date_fermeture = null;
  let siege = null;
  if (etablissements.length) {
    siege = etablissements.find((etab: any) => etab.est_siege) || etablissements[0];
    if (siege) {
      adresse = siege.adresse || "-";
      ({ statut, date_fermeture } = etablissementStatut(siege));
    }
  }

  const forme_juridique_code =
    getInpi("formality.content.personneMorale.identite.entreprise.formeJuridique", inpiData) ||
    inpiData.legalForm ||
    sireneUL.categorieJuridiqueUniteLegale ||
    (rechercheData?.results?.[0]?.categorie_juridique) ||
    "-";
  const forme_juridique =
    getFormeJuridiqueLabel(forme_juridique_code) ||
    sireneUL.libelleCategorieJuridiqueUniteLegale ||
    forme_juridique_code;

  const code_ape =
    getInpi("formality.content.personneMorale.identite.entreprise.codeApe", inpiData) ||
    inpiData.ape ||
    sireneUL.activitePrincipaleUniteLegale ||
    (rechercheData?.results?.[0]?.code_ape) ||
    "-";
  const libelle_ape =
    getLibelleApeFromINPI(inpiData) ||
    sireneUL.libelleActivitePrincipaleUniteLegale ||
    getApeLabelFromNAF(code_ape) ||
    (rechercheData?.results?.[0]?.libelle_ape) ||
    "-";

  const capital_social =
    getInpi("formality.content.personneMorale.identite.description.montantCapital", inpiData) ||
    getInpi("formality.content.description.montantCapital", inpiData) ||
    inpiData.shareCapital ||
    sireneUL.capitalSocial ||
    (inpiData.financialStatements?.[0]?.shareCapital) ||
    "-";

  const date_creation =
    getInpi("formality.content.personneMorale.identite.entreprise.dateDebutActiv", inpiData) ||
    getInpi("formality.content.personneMorale.identite.entreprise.dateImmat", inpiData) ||
    inpiData.creationDate ||
    (rechercheData?.results?.[0]?.date_creation) ||
    sireneUL.dateCreationUniteLegale ||
    "-";

  const tranche_effectifs_code =
    getInpi("formality.content.personneMorale.identite.entreprise.trancheEffectifs", inpiData) ||
    inpiData.workforceLabel ||
    (rechercheData?.results?.[0]?.tranche_effectifs) ||
    sireneUL.trancheEffectifsUniteLegale ||
    "-";
  const tranche_effectifs =
    effectifTrancheLabel(tranche_effectifs_code) || tranche_effectifs_code;

  const tranche_effectif_salarie =
    inpiData.workforceRange ||
    (rechercheData?.results?.[0]?.tranche_effectif_salarie) ||
    sireneUL.trancheEffectifsUniteLegale ||
    "-";

  const tvaNum = tvaFRFromSiren(siren);

  const finances = inpiData.financialStatements?.length
    ? inpiData.financialStatements.map((f: any) => ({
        exercice: f.fiscalYear,
        ca: f.turnover,
        resultat_net: f.netResult,
        effectif: f.workforce,
        capital_social: f.shareCapital
      }))
    : [];

  let dirigeants = [];
  const pouvoirs = getInpi("formality.content.personneMorale.composition.pouvoirs", inpiData);
  if (Array.isArray(pouvoirs)) {
    dirigeants = pouvoirs.map((p: any) => {
      if (p.individu?.descriptionPersonne) {
        return {
          nom: p.individu.descriptionPersonne.nom,
          prenoms: p.individu.descriptionPersonne.prenoms,
          genre: p.individu.descriptionPersonne.genre,
          dateNaissance: p.individu.descriptionPersonne.dateDeNaissance,
          role: p.individu.descriptionPersonne.role
        };
      }
      if (p.entreprise) {
        return {
          nom: p.entreprise.denomination,
          siren: p.entreprise.siren,
          role: p.roleEntreprise
        };
      }
      return p;
    });
  }
  if (!dirigeants.length) {
    if (rechercheData?.results?.length) {
      const match = rechercheData.results.find((r: any) => r.siren === siren)
      if (match) {
        dirigeants = match.dirigeants || [];
      }
    }
  }

  const statut_diffusion =
    inpiData.publicationStatus ||
    (rechercheData?.results?.[0]?.statut_diffusion) ||
    sireneUL.statutDiffusionUniteLegale ||
    "-";

  const site_web =
    inpiData.website ||
    (rechercheData?.results?.[0]?.site_web) ||
    "-";

  const email =
    inpiData.email ||
    (rechercheData?.results?.[0]?.email) ||
    "-";

  return {
    denomination,
    forme_juridique,
    categorie_juridique: forme_juridique_code,
    siren,
    siret: siege?.siret || (etablissements[0]?.siret || "-"),
    tva: { numero: tvaNum || '-', valide: null },
    code_ape,
    libelle_ape,
    tranche_effectifs,
    tranche_effectif_salarie,
    capital_social: capital_social !== undefined ? capital_social : "-",
    date_creation,
    adresse,
    etablissements,
    dirigeants,
    finances,
    statut_diffusion,
    site_web,
    email,
    statut,
    date_fermeture,
    inpiRaw: inpiDataRaw
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

  // ... (champs de retour inchangés, voir plus haut) ...
  const denomination =
    getInpi("formality.content.personneMorale.identite.entreprise.denomination", inpiData) ||
    inpiData.denomination ||
    getInpi("formality.content.personneMorale.identite.entreprise.nom", inpiData) ||
    sireneUL.denominationUniteLegale ||
    "-";

  return {
    denomination,
    siren,
    siret,
    adresse: formatAdresseSIRENE(sireneEtab?.adresseEtablissement) || "-",
    etablissements,
    statut,
    date_fermeture,
    inpiRaw: inpiDataRaw
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
