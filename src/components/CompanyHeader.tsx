import React from 'react';

interface Props {
  denomination: string;
  siren: string;
  siret: string;
  tva?: { numero: string; valide: boolean };
  code_ape: string;
  capital_social: number;
}

export default function CompanyHeader(props: Props) {
  return (
    <div className="bg-white p-4 rounded shadow mb-6 flex flex-wrap">
      <div className="flex-1 space-y-1">
        <div className="text-lg font-semibold">{props.denomination}</div>
        <div>
          • SIREN {props.siren} &nbsp;• SIRET {props.siret}
        </div>
        <div>
          TVA intracommunautaire : {props.tva?.numero || '–'}{' '}
          {props.tva?.valide === true ? '✅' : props.tva?.valide === false ? '❌' : ''}
        </div>
      </div>
      <div className="flex-1 space-y-1">
        <div>
          Code APE : {props.code_ape ? props.code_ape : '–'}
        </div>
        <div>
          Capital social : {props.capital_social?.toLocaleString() || '–'} €
        </div>
      </div>
    </div>
  );
}
