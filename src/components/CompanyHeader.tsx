import React from 'react';

interface Props {
  denomination?: string; // optionnel pour fallback
  nom_complet?: string;  // nom EI/personne physique (recherche-entreprises)
  nom_raison_sociale?: string; // nom société (recherche-entreprises)
  siren: string;
  siret: string;
  ville?: string;
  adresse?: string;
  tva?: { numero: string; valide: boolean };
  code_ape?: string;
  label_ape?: string;
  forme_juridique?: string;
  date_creation?: string;
  date_fermeture?: string | null;
  capital_social?: number;
  categorie_entreprise?: string;
  statut?: "actif" | "ferme";
  email?: string;
  telephone?: string;
  site_web?: string;
  rcs?: string;
  pays?: string;
  departement?: string;
  region?: string;
  tranche_effectif?: string;
  greffe?: string;
}

// Fallback: nom d'établissement ou unité légale
function getCompanyDisplayName(props: Props): string {
  return (
    props.nom_complet ||
    props.nom_raison_sociale ||
    props.denomination ||
    '(\u00c9tablissement sans nom)'
  );
}

export default function CompanyHeader(props: Props) {
  return (
    <div className="bg-white p-6 rounded shadow mb-6 max-w-5xl mx-auto">
      <div className="text-2xl font-bold text-center mb-4">
        {getCompanyDisplayName(props)}
      </div>
      <div className="flex flex-wrap gap-4">
        <ul className="flex-1 space-y-2 min-w-[260px] list-disc pl-6">
          <li>
            <b>SIREN :</b> {props.siren}
          </li>
          <li>
            <b>SIRET :</b> {props.siret}
          </li>
          {props.ville && (
            <li>
              <b>Ville :</b> {props.ville}
            </li>
          )}
          {props.adresse && (
            <li>
              <b>Adresse :</b> {props.adresse}
            </li>
          )}
          {props.pays && (
            <li>
              <b>Pays :</b> {props.pays}
            </li>
          )}
          {props.region && (
            <li>
              <b>Région :</b> {props.region}
            </li>
          )}
          {props.departement && (
            <li>
              <b>Département :</b> {props.departement}
            </li>
          )}
          <li>
            <b>TVA intracommunautaire :</b> {props.tva?.numero || '–'}
            {props.tva?.valide === true ? ' ✅' : props.tva?.valide === false ? ' ❌' : ''}
          </li>
        </ul>
        <ul className="flex-1 space-y-2 min-w-[220px] list-disc pl-6">
          {props.code_ape && (
            <li>
              <b>Code APE :</b> {props.code_ape} {props.label_ape ? <span>({props.label_ape})</span> : null}
            </li>
          )}
          {props.forme_juridique && (
            <li>
              <b>Forme juridique :</b> {props.forme_juridique}
            </li>
          )}
          {props.categorie_entreprise && (
            <li>
              <b>Catégorie :</b> {props.categorie_entreprise}
            </li>
          )}
          {props.capital_social !== undefined && (
            <li>
              <b>Capital social :</b> {props.capital_social?.toLocaleString() || '–'} €
            </li>
          )}
          {props.tranche_effectif && (
            <li>
              <b>Tranche effectif :</b> {props.tranche_effectif}
            </li>
          )}
          {props.date_creation && (
            <li>
              <b>Date de création :</b> {props.date_creation}
            </li>
          )}
          {props.date_fermeture && (
            <li>
              <b>Date de fermeture :</b> {props.date_fermeture}
            </li>
          )}
          {props.statut && (
            <li>
              <b>Statut :</b> {props.statut === "ferme" ? "Fermé" : "Actif"}
            </li>
          )}
          {props.rcs && (
            <li>
              <b>RCS :</b> {props.rcs}
            </li>
          )}
          {props.greffe && (
            <li>
              <b>Greffe :</b> {props.greffe}
            </li>
          )}
        </ul>
        <ul className="flex-1 space-y-2 min-w-[220px] list-disc pl-6">
          {props.email && (
            <li>
              <b>Email :</b> {props.email}
            </li>
          )}
          {props.telephone && (
            <li>
              <b>Téléphone :</b> {props.telephone}
            </li>
          )}
          {props.site_web && (
            <li>
              <b>Site web :</b> <a href={props.site_web} target="_blank" rel="noopener noreferrer">{props.site_web}</a>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
