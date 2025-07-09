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
  if (date_fermeture) return { statut: "ferme", date_fermeture };
  const etat =
    etab.etatAdministratifEtablissement ||
    etab.etat_administratif ||
    etab.etatAdministratifUniteLegale ||
    etab.etat_administratif_unite_legale ||
    null;
  if (etat && etat !== "A") return { statut: "ferme", date_fermeture: null };
  return { statut: "actif", date_fermeture: null };
}

// Recherche d'établissements par raison sociale
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

// ====== SIREN (nouvelle version, nécessite la dénomination fournie) ======
export async function fetchEtablissementBySiren(siren: string, denomination: string) {
  const [
    inpiDataRaw,
    sireneULRaw
  ] = await Promise.all([
    getEntrepriseBySiren(siren).catch(() => ({})),
    sirene.get(`/siren/${siren}`).then(r => r.data.uniteLegale).catch(() => ({})),
  ]);

  // Recherche par nom pour retrouver tous les établissements du groupe
  const rechercheEtabResp = await recherche.get('/search', { params: { q: denomination, per_page: 50 } }).catch(() => ({ data: { results: [] } }));
  const results = rechercheEtabResp.data.results || [];

  // On prend tous les établissements dont le siret commence par le siren
  let etabsFromRecherche: any[] = [];
  results.forEach(ent => {
    if (Array.isArray(ent.matching_etablissements)) {
      etabsFromRecherche.push(...ent.matching_etablissements.filter(etab => etab.siret && etab.siret.startsWith(siren)));
    }
    if (Array.isArray(ent.etablissements)) {
      etabsFromRecherche.push(...ent.etablissements.filter(etab => etab.siret && etab.siret.startsWith(siren)));
    }
  });

  let etablissements = etabsFromRecherche.map((etab: any) => {
    const { statut, date_fermeture } = etablissementStatut(etab);
    return {
      siret: etab.siret,
      displayName: etab.denominationUsuelleEtablissement
        || etab.enseigne1Etablissement
        || etab.uniteLegale?.denominationUniteLegale
        || "-",
      adresse: formatAdresseSIRENE(etab.adresseEtablissement),
      activite_principale: etab.activitePrincipaleEtablissement || "",
      tranche_effectif_libelle: etab.trancheEffectifsEtablissement || "",
      tranche_effectif_salarie: "",
      date_creation: etab.dateCreationEtablissement || "",
      est_siege: etab.etablissementSiege === true,
      statut,
      date_fermeture,
    };
  });

  if (etablissements.length === 0 && sireneULRaw) {
    const siegesiret = sireneULRaw.siretSiegeUniteLegale || sireneULRaw.siret_siege_unite_legale || null;
    const adresseSiege = formatAdresseSIRENE(sireneULRaw.adresseSiegeUniteLegale || sireneULRaw.adresse_siege_unite_legale || {});
    etablissements = [{
      siret: siegesiret || "-",
      displayName: sireneULRaw.denominationUniteLegale || "-",
      adresse: adresseSiege,
      activite_principale: sireneULRaw.activitePrincipaleUniteLegale || "-",
      tranche_effectif_libelle: sireneULRaw.trancheEffectifsUniteLegale || "-",
      tranche_effectif_salarie: "-",
      date_creation: sireneULRaw.dateCreationUniteLegale || "-",
      est_siege: true,
      statut: sireneULRaw.etatAdministratifUniteLegale === "A" ? "actif" : "ferme",
      date_fermeture: null,
    }];
  }

  const siege = etablissements.find(e => e.est_siege) || etablissements[0] || {};
  let adresse = siege?.adresse || "-";
  let statut = siege?.statut || "actif";
  let date_fermeture = siege?.date_fermeture || null;

  const denominationFinale =
    getInpi("formality.content.personneMorale.identite.entreprise.denomination", inpiDataRaw) ||
    inpiDataRaw.denomination ||
    getInpi("formality.content.personneMorale.identite.entreprise.nom", inpiDataRaw) ||
    (sireneULRaw.denominationUniteLegale) ||
    denomination ||
    "-";

  const forme_juridique_code =
    getInpi("formality.content.personneMorale.identite.entreprise.formeJuridique", inpiDataRaw) ||
    inpiDataRaw.legalForm ||
    sireneULRaw.categorieJuridiqueUniteLegale ||
    "-";
  const forme_juridique =
    getFormeJuridiqueLabel(forme_juridique_code) ||
    sireneULRaw.libelleCategorieJuridiqueUniteLegale ||
    forme_juridique_code;

  const code_ape =
    getInpi("formality.content.personneMorale.identite.entreprise.codeApe", inpiDataRaw) ||
    inpiDataRaw.ape ||
    sireneULRaw.activitePrincipaleUniteLegale ||
    "-";
  const libelle_ape =
    getLibelleApeFromINPI(inpiDataRaw) ||
    sireneULRaw.libelleActivitePrincipaleUniteLegale ||
    getApeLabelFromNAF(code_ape) ||
    "-";

  const capital_social =
    getInpi("formality.content.personneMorale.identite.description.montantCapital", inpiDataRaw) ||
    getInpi("formality.content.description.montantCapital", inpiDataRaw) ||
    inpiDataRaw.shareCapital ||
    sireneULRaw.capitalSocial ||
    (inpiDataRaw.financialStatements?.[0]?.shareCapital) ||
    "-";

  const date_creation =
    getInpi("formality.content.personneMorale.identite.entreprise.dateDebutActiv", inpiDataRaw) ||
    getInpi("formality.content.personneMorale.identite.entreprise.dateImmat", inpiDataRaw) ||
    inpiDataRaw.creationDate ||
    sireneULRaw.dateCreationUniteLegale ||
    "-";

  const tranche_effectifs_code =
    getInpi("formality.content.personneMorale.identite.entreprise.trancheEffectifs", inpiDataRaw) ||
    inpiDataRaw.workforceLabel ||
    sireneULRaw.trancheEffectifsUniteLegale ||
    "-";
  const tranche_effectifs =
    effectifTrancheLabel(tranche_effectifs_code) || tranche_effectifs_code;

  const tranche_effectif_salarie =
    inpiDataRaw.workforceRange ||
    sireneULRaw.trancheEffectifsUniteLegale ||
    "-";

  const tvaNum = tvaFRFromSiren(siren);

  const finances = inpiDataRaw.financialStatements?.length
    ? inpiDataRaw.financialStatements.map((f: any) => ({
        exercice: f.fiscalYear,
        ca: f.turnover,
        resultat_net: f.netResult,
        effectif: f.workforce,
        capital_social: f.shareCapital
      }))
    : [];

  let dirigeants = [];
  const pouvoirs = getInpi("formality.content.personneMorale.composition.pouvoirs", inpiDataRaw);
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

  const statut_diffusion =
    inpiDataRaw.publicationStatus ||
    sireneULRaw.statutDiffusionUniteLegale ||
    "-";

  const site_web =
    inpiDataRaw.website ||
    "-";

  const email =
    inpiDataRaw.email ||
    "-";

  return {
    denomination: denominationFinale,
    forme_juridique,
    categorie_juridique: forme_juridique_code,
    siren,
    siret: siege?.siret || "-",
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
    inpiRaw: inpiDataRaw,
    sireneRaw: sireneULRaw
  };
}

// ====== SIRET (nécessite aussi la dénomination) ======
export async function fetchEtablissementBySiret(siret: string, denomination: string) {
  const siren = siret.slice(0, 9);
  const data = await fetchEtablissementBySiren(siren, denomination);
  const etab = data.etablissements.find((e: any) => e.siret === siret);
  return {
    ...data,
    etablissements: etab ? [etab] : [],
    siret,
  };
}

// Pour affichage individuel d’un établissement dans une liste paginée (ex : EtablissementsListPaginee)
export function mapEtablissement(etab: any) {
  const adresse =
    [
      etab.numero_voie || etab.adresseEtablissement?.numeroVoieEtablissement,
      etab.type_voie || etab.adresseEtablissement?.typeVoieEtablissement,
      etab.libelle_voie || etab.adresseEtablissement?.libelleVoieEtablissement,
      etab.code_postal || etab.adresseEtablissement?.codePostalEtablissement,
      etab.libelle_commune || etab.adresseEtablissement?.libelleCommuneEtablissement,
    ].filter(Boolean).join(' ');

  return {
    siret: etab.siret,
    denomination:
      etab.denomination ||
      etab.denomination_usuelle_entreprise ||
      etab.nom_raison_sociale ||
      etab.nom_commercial ||
      etab.enseigne1 ||
      etab.uniteLegale?.denominationUniteLegale ||
      "—",
    adresse,
    etat:
      (etab.etatAdministratifEtablissement || etab.etat_administratif) === "A"
        ? "Actif"
        : "Fermé",
    isSiege: !!(etab.etablissementSiege || etab.siege || etab.est_siege),
  };
}

// Compatibilité SIREN ou SIRET (besoin de la dénomination pour les 2)
export async function fetchEtablissementByCode(code: string, denomination: string) {
  if (/^\d{14}$/.test(code)) {
    return fetchEtablissementBySiret(code, denomination);
  } else if (/^\d{9}$/.test(code)) {
    return fetchEtablissementBySiren(code, denomination);
  } else {
    throw new Error('Code SIREN/SIRET invalide');
  }
}
