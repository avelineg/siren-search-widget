import { getEntrepriseBySiren } from './inpiBackend'
import { sirene, recherche } from './api'
import { tvaFRFromSiren } from './tva'
import naf from '../naf.json'
import formesJuridique from '../formeJuridique.json'
import { effectifTrancheLabel } from './effectifs'

// Si tu as ajouté la correspondance des rôles dans un fichier séparé
import dirigeantRoles from './dirigeantRoles'

// Petit utilitaire pour extraire une valeur profonde
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

function formatAdresseINPI(adresseObj: any): string {
  if (!adresseObj || typeof adresseObj !== "object") return "-";
  return [
    adresseObj.numVoie || adresseObj.numeroVoie || adresseObj.numVoiePresent,
    adresseObj.typeVoie || adresseObj.typeVoiePresent,
    adresseObj.voie || adresseObj.libelleVoie || adresseObj.libelleVoieEtablissement,
    adresseObj.complementLocalisation,
    adresseObj.codePostal || adresseObj.codePostalEtablissement,
    adresseObj.commune || adresseObj.libelleCommuneEtablissement
  ].filter(Boolean).join(' ');
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

// Statut = fermé SEULEMENT si une date de fermeture existe
function etablissementStatut(etab: any) {
  const date_fermeture = etab.dateFermetureEtablissement || etab.date_fermeture || etab.dateEffetFermeture || null;
  if (date_fermeture) return { statut: "ferme", date_fermeture };
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
                ville: etab.libelle_commune ||
                  etab.adresseEtablissement?.libelleCommuneEtablissement ||
                  "-"
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
          ville: r.libelle_commune ||
            r.adresseEtablissement?.libelleCommuneEtablissement ||
            "-"
        }
      })
    : [];
}

// ======= Recherche par SIREN =======
export async function fetchEtablissementBySiren(siren: string) {
  const [
    inpiDataRaw,
    sireneULRaw,
    rechercheEtabResp
  ] = await Promise.all([
    getEntrepriseBySiren(siren).catch(() => ({})),
    sirene.get(`/siren/${siren}`).then(r => r.data.uniteLegale).catch(() => ({})),
    recherche.get('/search', { params: { q: `siren:${siren}`, per_page: 100 } }).then(r => r.data).catch(() => ({ results: [] })),
  ]);

  const inpiData = inpiDataRaw || {};
  const sireneUL = sireneULRaw || {};
  let etablissements: any[] = [];

  // Extraction des établissements depuis INPI
  const etabINPI: any[] = [];
  if (inpiData.formality && inpiData.formality.content && inpiData.formality.content.personneMorale) {
    const pm = inpiData.formality.content.personneMorale;
    if (pm.etablissementPrincipal && pm.etablissementPrincipal.descriptionEtablissement) {
      etabINPI.push({
        ...pm.etablissementPrincipal,
        descriptionEtablissement: pm.etablissementPrincipal.descriptionEtablissement,
        adresse: pm.etablissementPrincipal.adresse,
        activites: pm.etablissementPrincipal.activites,
      });
    }
    if (Array.isArray(pm.autresEtablissements)) {
      pm.autresEtablissements.forEach((e: any) => etabINPI.push(e));
    }
  }

  // Remap INPI établissements
  etablissements = etabINPI.map(etab => {
    const desc = etab.descriptionEtablissement || {};
    const adresse = etab.adresse || {};
    const activite = Array.isArray(etab.activites) ? etab.activites[0] : {};
    const { statut, date_fermeture } = etablissementStatut(desc);
    const ville =
      adresse.commune ||
      adresse.libelleCommuneEtablissement ||
      "-";
    return {
      siret: desc.siret || "-",
      displayName: inpiData.formality?.content?.identite?.entreprise?.denomination || "-",
      ville,
      adresse: formatAdresseINPI(adresse),
      activite_principale: activite.codeApe || "",
      tranche_effectif_libelle: "",
      tranche_effectif_salarie: "",
      date_creation: activite.dateDebut || desc.dateDebutActivite || "-",
      est_siege: desc.indicateurEtablissementPrincipal === true,
      statut,
      date_fermeture,
    };
  });

  // Si aucun établissement en INPI, fallback SIRENE/Recherche
  if (etablissements.length === 0 && sireneUL) {
    const siegesiret = sireneUL.siretSiegeUniteLegale || sireneUL.siret_siege_unite_legale || null;
    const adresseSiege = formatAdresseSIRENE(sireneUL.adresseSiegeUniteLegale || sireneUL.adresse_siege_unite_legale || {});
    const villeSiege = sireneUL.libelleCommuneEtablissement || "-";
    etablissements = [{
      siret: siegesiret || "-",
      displayName: sireneUL.denominationUniteLegale || "-",
      ville: villeSiege,
      adresse: adresseSiege,
      activite_principale: sireneUL.activitePrincipaleUniteLegale || "-",
      tranche_effectif_libelle: sireneUL.trancheEffectifsUniteLegale || "-",
      tranche_effectif_salarie: "-",
      date_creation: sireneUL.dateCreationUniteLegale || "-",
      est_siege: true,
      statut: sireneUL.etatAdministratifUniteLegale === "A" ? "actif" : "ferme",
      date_fermeture: null,
    }];
  }

  // Choix du siège
  const siege = etablissements.find(e => e.est_siege) || etablissements[0] || {};
  let adresse = siege?.adresse || "-";
  let statut = siege?.statut || "actif";
  let date_fermeture = siege?.date_fermeture || null;

  const denomination =
    getInpi("formality.content.personneMorale.identite.entreprise.denomination", inpiData) ||
    inpiData.denomination ||
    getInpi("formality.content.personneMorale.identite.entreprise.nom", inpiData) ||
    (sireneUL.denominationUniteLegale) ||
    "-";

  const forme_juridique_code =
    getInpi("formality.content.personneMorale.identite.entreprise.formeJuridique", inpiData) ||
    inpiData.legalForm ||
    sireneUL.categorieJuridiqueUniteLegale ||
    "-";
  const forme_juridique =
    getFormeJuridiqueLabel(forme_juridique_code) ||
    sireneUL.libelleCategorieJuridiqueUniteLegale ||
    forme_juridique_code;

  const code_ape =
    getInpi("formality.content.personneMorale.identite.entreprise.codeApe", inpiData) ||
    inpiData.ape ||
    sireneUL.activitePrincipaleUniteLegale ||
    "-";
  const libelle_ape =
    getLibelleApeFromINPI(inpiData) ||
    sireneUL.libelleActivitePrincipaleUniteLegale ||
    getApeLabelFromNAF(code_ape) ||
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
    sireneUL.dateCreationUniteLegale ||
    "-";

  const tranche_effectifs_code =
    getInpi("formality.content.personneMorale.identite.entreprise.trancheEffectifs", inpiData) ||
    inpiData.workforceLabel ||
    sireneUL.trancheEffectifsUniteLegale ||
    "-";
  const tranche_effectifs =
    effectifTrancheLabel(tranche_effectifs_code) || tranche_effectifs_code;

  const tranche_effectif_salarie =
    inpiData.workforceRange ||
    sireneUL.trancheEffectifsUniteLegale ||
    "-";

  const tvaNum = tvaFRFromSiren(siren);

  // Dirigeants enrichis avec la correspondance des rôles
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
          role: dirigeantRoles[p.individu.descriptionPersonne.role] || p.individu.descriptionPersonne.role,
        };
      }
      if (p.entreprise) {
        return {
          nom: p.entreprise.denomination,
          siren: p.entreprise.siren,
          role: dirigeantRoles[p.roleEntreprise] || p.roleEntreprise
        };
      }
      return p;
    });
  }

  const finances = inpiData.financialStatements?.length
    ? inpiData.financialStatements.map((f: any) => ({
        exercice: f.fiscalYear,
        ca: f.turnover,
        resultat_net: f.netResult,
        effectif: f.workforce,
        capital_social: f.shareCapital
      }))
    : [];

  const statut_diffusion =
    inpiData.publicationStatus ||
    sireneUL.statutDiffusionUniteLegale ||
    "-";
  const site_web = inpiData.website || "-";
  const email = inpiData.email || "-";

  return {
    denomination,
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

// ===== Recherche par SIRET =====
export async function fetchEtablissementBySiret(siret: string) {
  const siren = siret.slice(0, 9);
  // Récupérer TOUTES les infos du SIREN (pour lister tous les établissements)
  const base = await fetchEtablissementBySiren(siren);
  // Sélectionner établissement courant pour les infos principales
  const selected = base.etablissements.find(e => e.siret === siret) || base.etablissements[0];

  return {
    ...base,
    siret: selected?.siret || "-",
    adresse: selected?.adresse || "-",
    statut: selected?.statut,
    date_fermeture: selected?.date_fermeture,
    ville: selected?.ville || "-"
  }
}

// Pour affichage individuel d’un établissement dans une liste paginée
export function mapEtablissement(etab: any) {
  const adresse =
    [
      etab.numero_voie || etab.adresseEtablissement?.numeroVoieEtablissement,
      etab.type_voie || etab.adresseEtablissement?.typeVoieEtablissement,
      etab.libelle_voie || etab.adresseEtablissement?.libelleVoieEtablissement,
      etab.code_postal || etab.adresseEtablissement?.codePostalEtablissement,
      etab.libelle_commune || etab.adresseEtablissement?.libelleCommuneEtablissement,
    ].filter(Boolean).join(' ');

  let statut = "Actif";
  if (etab.date_fermeture) statut = "Fermé";

  const ville =
    etab.libelle_commune ||
    etab.adresseEtablissement?.libelleCommuneEtablissement ||
    "-";

  return {
    siret: etab.siret,
    ville: ville,
    denomination:
      etab.denomination ||
      etab.denomination_usuelle_entreprise ||
      etab.nom_raison_sociale ||
      etab.nom_commercial ||
      etab.enseigne1 ||
      etab.uniteLegale?.denominationUniteLegale ||
      "—",
    adresse,
    etat: statut,
    isSiege: !!(etab.est_siege),
  };
}

// Compatibilité SIREN ou SIRET
export async function fetchEtablissementByCode(code: string) {
  if (/^\d{14}$/.test(code)) {
    return fetchEtablissementBySiret(code);
  } else if (/^\d{9}$/.test(code)) {
    return fetchEtablissementBySiren(code);
  } else {
    throw new Error('Code SIREN/SIRET invalide');
  }
}
