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
    <div className="bg-white p-4 rounded shadow mb-6 flex flex-wrap">
      <div className="flex-1 space-y-1">
        <div className="text-lg font-semibold">{props.denomination}</div>
        <ul className="space-y-1 list-disc list-inside">
          <li>
            <strong>SIREN :</strong> {props.siren}
          </li>
          <li>
            <strong>SIRET :</strong> {props.siret}
          </li>
          {props.ville && (
            <li>
              <strong>Ville :</strong> {props.ville}
            </li>
          )}
          {props.adresse && (
            <li>
              <strong>Adresse :</strong> {props.adresse}
            </li>
          )}
          <li>
            <strong>TVA intracommunautaire :</strong> {props.tva?.numero || '–'}{' '}
            {props.tva?.valide === true
              ? '✅'
              : props.tva?.valide === false
              ? '❌'
              : ''}
          </li>
        </ul>
      </div>
      <div className="flex-1 space-y-1">
        <ul className="space-y-1 list-disc list-inside">
          <li>
            <strong>Code APE :</strong> {props.code_ape ? props.code_ape : '–'}
          </li>
          <li>
            <strong>Capital social :</strong>{' '}
            {props.capital_social?.toLocaleString() || '–'} €
          </li>
        </ul>
      </div>
    </div>
  );
}
