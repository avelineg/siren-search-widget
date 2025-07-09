import React from 'react';

interface Props {
  denomination: string;
  siren: string;
  siret: string;
  tva?: { numero: string; valide: boolean };
  code_ape: string;
  capital_social: number | string;
  adresse?: string;
  ville?: string;
}

export default function CompanyHeader(props: Props) {
  return (
    <div className="bg-white p-6 rounded shadow mb-6">
      {/* En-tête : dénomination centrée et en gras */}
      <div className="text-2xl font-bold text-center mb-6">{props.denomination}</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Colonne gauche */}
        <ul className="space-y-2 list-disc list-inside">
          <li>
            <span className="font-bold">SIREN :</span> {props.siren}
          </li>
          <li>
            <span className="font-bold">SIRET :</span> {props.siret}
          </li>
          {props.ville && (
            <li>
              <span className="font-bold">Ville :</span> {props.ville}
            </li>
          )}
          {props.adresse && (
            <li>
              <span className="font-bold">Adresse :</span> {props.adresse}
            </li>
          )}
          <li>
            <span className="font-bold">TVA intracommunautaire :</span> {props.tva?.numero || '–'}
          </li>
        </ul>
        {/* Colonne droite */}
        <ul className="space-y-2 list-disc list-inside">
          <li>
            <span className="font-bold">Code APE :</span> {props.code_ape ? props.code_ape : '–'}
          </li>
          <li>
            <span className="font-bold">Capital social :</span>{' '}
            {props.capital_social?.toLocaleString() || '–'} €
          </li>
        </ul>
      </div>
    </div>
  );
}
