import React from 'react'

interface Props {
  denomination: string
  forme_juridique: string
  siren: string
  siret: string
  tva?: { numero: string; valide: boolean }
  code_ape: string
  libelle_ape?: string
  tranche_effectifs: string
  capital_social: number
  date_creation: string
}

export default function CompanyHeader(props: Props) {
  return (
    <div className="bg-white p-4 rounded shadow mb-6">
      <h2 className="text-xl font-bold">{props.denomination}</h2>
      <p className="text-sm text-gray-600">
        {props.forme_juridique} • SIREN {props.siren} • SIRET {props.siret}
      </p>
      <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
        <div>
          TVA intracom: {props.tva?.numero} (
          {props.tva?.valide ? 'OK' : props.tva?.valide === false ? 'KO' : '–'})
        </div>
        <div>
          Code APE : {props.code_ape} – {props.libelle_ape}
        </div>
        <div>Effectifs : {props.tranche_effectifs}</div>
        <div>Capital social : {props.capital_social.toLocaleString()} €</div>
        <div>Date de création : {props.date_creation}</div>
      </div>
    </div>
  )
}
