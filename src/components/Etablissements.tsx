import React from 'react'

export default function Etablissements({ etablissements }: { etablissements: any[] }) {
  if (!etablissements?.length) return null
  return (
    <div className="bg-white p-4 rounded shadow">
      <h3 className="font-semibold mb-2">Établissements</h3>
      <table className="min-w-full text-sm">
        <thead>
          <tr>
            <th>SIRET</th>
            <th>Adresse</th>
            <th>Activité principale</th>
            <th>Effectifs</th>
            <th>Siège</th>
            <th>État</th>
            <th>Date création</th>
          </tr>
        </thead>
        <tbody>
          {etablissements.map(e => (
            <tr key={e.siret}>
              <td>{e.siret}</td>
              <td>{e.adresse}</td>
              <td>{e.activite_principale}</td>
              <td>{e.tranche_effectif_libelle || e.tranche_effectif_salarie}</td>
              <td>{e.est_siege ? 'Oui' : 'Non'}</td>
              <td>{e.etat_administratif}</td>
              <td>{e.date_creation}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
