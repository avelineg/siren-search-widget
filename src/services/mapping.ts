import { getEntrepriseBySiren } from './inpiBackend'
import { sirene, recherche } from './api'
import { tvaFRFromSiren } from './tva'
import naf from '../naf.json'
import formesJuridique from '../formeJuridique.json'
import { effectifTrancheLabel } from './effectifs'
import dirigeantRoles from './dirigeantRoles'

// Utilitaire pour extraire une valeur profonde
function getInpi(path: string, obj: any) {
  return path.split('.').reduce((acc, key) => (acc && acc[key] != null ? acc[key] : undefined), obj);
}

// Ajouté : calcule le nom affichable pour un SIREN/SIRET INPI (personne physique/morale)
function computeDisplayName(inpiData: any): string {
  // Personne physique
  if (inpiData?.formality?.content?.personnePhysique) {
    const entrepreneur = inpiData.formality.content.personnePhysique?.identite?.entrepreneur?.descriptionPersonne;
    if (entrepreneur) {
      const prenom = Array.isArray(entrepreneur.prenoms) ? entrepreneur.prenoms.join(" ") : "";
      const nom = entrepreneur.nom || "";
      return [prenom, nom].filter(Boolean).join(" ").trim();
    }
  }
  // Personne morale
  if (inpiData?.formality?.content?.personneMorale) {
    return (
      inpiData.formality.content.personneMorale?.identite?.entreprise?.denomination ||
      inpiData.formality.content.personneMorale?.identite?.entreprise?.nom ||
      inpiData.formality.content.personneMorale?.identite?.entreprise?.raisonSociale ||
      ""
    );
  }
  // Fallback
  return "";
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

  // Patch: mapping explicite des noms pour EI/personnes physiques (nom_complet),
  // sinon fallback sur les champs classiques
  return Array.isArray(results)
    ? results.map(r => {
        const { statut, date_fermeture } = etablissementStatut(r);
        // nom_complet => EI/personne physique (API recherche-entreprises)
        // nom_raison_sociale => société classique (API recherche-entreprises)
        // fallback classique
        const displayName =
          r.nom_complet ||
          r.nom_raison_sociale ||
          r.denomination ||
          r.raison_sociale ||
          r.name ||
          r.nom ||
          "-";
        let matching_etablissements = Array.isArray(r.matching_etablissements)
          ? r.matching_etablissements.map((etab: any) => {
              const { statut, date_fermeture } = etablissementStatut(etab);
              return {
                ...etab,
                statut,
                date_fermeture,
                displayName:
                  etab.nom_complet ||
                  etab.nom_raison_sociale ||
                  etab.denomination ||
                  etab.raison_sociale ||
                  etab.name ||
                  etab.nom_commercial ||
                  displayName || // fallback sur unité légale
                  "-",
                ville:
                  etab.libelle_commune ||
                  etab.adresseEtablissement?.libelleCommuneEtablissement ||
                  "-",
                adresse: formatAdresseSIRENE(etab.adresseEtablissement || etab)
              }
            })
          : [];
        return {
          ...r,
          displayName,
          statut,
          date_fermeture,
          matching_etablissements,
          ville:
            r.libelle_commune ||
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
  let displayName = computeDisplayName(inpiData);

  // Personne morale
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
  // Personne physique
  else if (inpiData.formality && inpiData.formality.content && inpiData.formality.content.personnePhysique) {
    const pp = inpiData.formality.content.personnePhysique;
    if (pp.etablissementPrincipal && pp.etablissementPrincipal.descriptionEtablissement) {
      etabINPI.push({
        ...pp.etablissementPrincipal,
        descriptionEtablissement: pp.etablissementPrincipal.descriptionEtablissement,
        adresse: pp.etablissementPrincipal.adresse,
        activites: pp.etablissementPrincipal.activites,
      });
    }
    if (Array.isArray(pp.autresEtablissements)) {
      pp.autresEtablissements.forEach((e: any) => etabINPI.push(e));
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
      displayName: displayName || "-",
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
      displayName: sireneUL.denominationUniteLegale || displayName || "-",
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
  let ville = siege?.ville || "-";

  // Patch: priorité à nom_complet et nom_raison_sociale pour le displayName
  const denomination =
    inpiData.nom_complet ||
    inpiData.nom_raison_sociale ||
    displayName ||
    "-";

  // ---- PATCH FORMES JURIDIQUES + DIRIGEANT EI ----

  const forme_juridique_code =
    getInpi("formality.content.personneMorale.identite.entreprise.formeJuridique", inpiData) ||
    inpiData.legalForm ||
    sireneUL.categorieJuridiqueUniteLegale ||
    "-";
  // Prend toujours le libellé officiel si possible
  const forme_juridique =
    sireneUL.libelleCategorieJuridiqueUniteLegale ||
    getFormeJuridiqueLabel(forme_juridique_code) ||
    forme_juridique_code;

  // EI detection
  const isEI =
    (typeof forme_juridique === "string" && forme_juridique.toLowerCase().includes("entrepreneur individuel")) ||
    forme_juridique_code === "1000" ||
    forme_juridique_code === "1001";

  const code_ape =
    getInpi("formality.content.personneMorale.identite.entreprise.codeApe", inpiData) ||
    getInpi("formality.content.personnePhysique.etablissementPrincipal.descriptionEtablissement.codeApe", inpiData) ||
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
    getInpi("formality.content.personnePhysique.natureCreation.dateCreation", inpiData) ||
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
  if (isEI) {
    // Pour EI, utilise le nom/prénom ou nom_complet
    let nom = sireneUL.nom || inpiData.nom || "";
    let prenoms = sireneUL.prenom || inpiData.prenom || "";
    if (sireneUL.nom_complet || inpiData.nom_complet) {
      nom = sireneUL.nom_complet || inpiData.nom_complet;
      prenoms = "";
    }
    dirigeants = [
      {
        nom,
        prenoms,
        role: "Entrepreneur individuel"
      }
    ];
  } else if (Array.isArray(pouvoirs)) {
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
    displayName: denomination,
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
    ville,
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
    ville: selected?.ville || "-",
    statut: selected?.statut,
    date_fermeture: selected?.date_fermeture,
    displayName: selected?.displayName || base.displayName || "-",
  }
}

// Pour affichage individuel d’un établissement dans une liste paginée
export function mapEtablissement(etab
