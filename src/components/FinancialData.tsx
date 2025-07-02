import React from 'react'

export default function FinancialData({ data }: { data: any }) {
  const finances = data.finances || []
  const annonces = data.annonces || []
  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded shadow">
        <h3 className="font-semibold mb-2">Données financières</h3>
        {finances.map((f: any, i: number) => (
          <p key={i}>
            {f.montant.toLocaleString()} {f.devise || '€'}
          </p>
        ))}
        {finances.length === 0 && <p>Aucune donnée financière.</p>}
      </div>
      <div className="bg-white p-4 rounded shadow">
        <h3 className="font-semibold mb-2">Publications légales</h3>
        {annonces.map((a: any, i: number) => (
          <div key={i}>
            <p>{a.titre || a}</p>
            {a.date && <p className="text-sm text-gray-600">{a.date}</p>}
          </div>
        ))}
        {annonces.length === 0 && <p>Aucune publication légale.</p>}
      </div>
    </div>
  )
}
