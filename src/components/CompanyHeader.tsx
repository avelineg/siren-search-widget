import React from 'react';

interface Props {
  denomination: string;
  siren: string;
  siret: string;
  ville?: string;
  adresse?: string;
  tva?: { numero: string; valide: boolean };
  code_ape: string;
  capital_social: number;
}

export default function CompanyHeader(props: Props) {
  return (
    <div className="bg-white p-6 rounded shadow mb-6 max-w-5xl mx-auto">
      <div className="text-2xl font-bold text-center mb-4">{props.denomination}</div>
      <div className="flex flex-wrap">
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
          <li>
            <b>TVA intracommunautaire :</b> {props.tva?.numero || '–'}
            {props.tva?.valide === true ? ' ✅' : props.tva?.valide === false ? ' ❌' : ''}
          </li>
        </ul>
        <ul className="flex-1 space-y-2 min-w-[220px] list-disc pl-6">
          <li>
            <b>Code APE :</b> {props.code_ape ? props.code_ape : '–'}
          </li>
          <li>
            <b>Capital social :</b> {props.capital_social?.toLocaleString() || '–'} €
          </li>
        </ul>
      </div>
    </div>
  );
}
