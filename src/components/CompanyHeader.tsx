import React from 'react';

interface Props {
  displayName?: string;
  denomination?: string;
  nom_complet?: string;
  nom_raison_sociale?: string;
  siren: string;
  siret: string;
  ville?: string;
  adresse?: string;
  tva?: { numero: string; valide: boolean | null }; // accepte null (indéterminé)
  code_ape?: string;
  libelle_ape?: string;
  forme_juridique?: string;
  date_creation?: string;
  date_fermeture?: string | null;
  capital_social?: number | string;
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

// Affiche le nom d'établissement ou unité légale
function getCompanyDisplayName(props: Props): string {
  return (
    props.displayName ||
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
              <b>Code APE :</b> {props.code_ape} {props.libelle_ape ? <span>({props.libelle_ape})</span> : null}
            </li>
          )}
          {props.forme_juridique && (
            <li>
              <b>Forme juridique :</b> {props.forme_juridique}
            </li>
          )}
          {props.categorie_entreprise && (
            <li>
              <b>Catégorie d’entreprise :</b> {props.categorie_entreprise}
            </li>
          )}
          {props.capital_social !== undefined && (
            <li>
              <b>Capital social :</b> {props.capital_social}
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
