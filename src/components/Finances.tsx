import React from 'react'

export default function FinancialData({ data }: { data: any }) {
  const finances = data.finances || []
  if (!finances.length) return <div>Aucune donnée financière.</div>
  return (
    <div className="bg-white p-4 rounded shadow">
      <h3 className="font-semibold mb-2">Données financières (INPI)</h3>
      <table className="min-w-full text-sm">
        <thead>
          <tr>
            <th>Exercice</th>
            <th>Chiffre d'affaires</th>
            <th>Résultat net</th>
            <th>Effectif</th>
            <th>Capital social</th>
          </tr>
        </thead>
        <tbody>
          {finances.map((f: any) => (
            <tr key={f.exercice}>
              <td>{f.exercice}</td>
              <td>{f.ca?.toLocaleString() ?? '–'}</td>
              <td>{f.resultat_net?.toLocaleString() ?? '–'}</td>
              <td>{f.effectif ?? '–'}</td>
              <td>{f.capital_social?.toLocaleString() ?? '–'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
