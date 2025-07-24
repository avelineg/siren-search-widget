import React from 'react';

export default function Identity({ data }: { data: any }) {
  return (
    <div className="bg-white p-4 rounded shadow">
      <h3 className="font-semibold mb-2">Identité de l'entreprise</h3>
      <table className="w-full text-sm">
        <tbody>
          <tr>
            <td className="font-bold">Raison sociale</td>
            <td>{data.denomination}</td>
          </tr>
          <tr>
            <td className="font-bold">SIREN</td>
            <td>{data.siren}</td>
          </tr>
          <tr>
            <td className="font-bold">SIRET</td>
            <td>{data.siret}</td>
          </tr>
          <tr>
            <td className="font-bold">Adresse</td>
            <td>{data.adresse}</td>
          </tr>
          <tr>
            <td className="font-bold">Forme juridique</td>
            <td>{data.forme_juridique}</td>
          </tr>
          <tr>
            <td className="font-bold">Date de création</td>
            <td>{data.date_creation}</td>
          </tr>
          <tr>
            <td className="font-bold">Code APE</td>
            <td>
              {data.code_ape || '–'} {data.libelle_ape ? `– ${data.libelle_ape}` : ''}
            </td>
          </tr>
          <tr>
            <td className="font-bold">Effectifs</td>
            <td>
              {data.tranche_effectifs}
              {data.tranche_effectif_salarie ? ` (code ${data.tranche_effectif_salarie})` : ''}
            </td>
          </tr>
          <tr>
            <td className="font-bold">Capital social</td>
            <td>
              {typeof data.capital_social === 'number'
                ? `${data.capital_social.toLocaleString()} €`
                : data.capital_social || '–'}
            </td>
          </tr>
          <tr>
            <td className="font-bold">TVA intracommunautaire</td>
            <td>
              {data.tva?.numero || '–'}{' '}
              {data.tva?.valide === true
                ? '✅'
                : data.tva?.valide === false
                ? '❌'
                : ''}
            </td>
          </tr>
          <tr>
            <td className="font-bold">Statut diffusion</td>
            <td>{data.statut_diffusion || '–'}</td>
          </tr>
          <tr>
            <td className="font-bold">Dirigeant principal</td>
            <td>
              {data.dirigeants && data.dirigeants.length
                ? `${data.dirigeants[0].nom || ''} ${data.dirigeants[0].prenoms || ''}`.trim()
                : '–'}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
