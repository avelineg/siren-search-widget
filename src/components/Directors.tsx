import React from 'react'

export default function Directors({ data }: { data: any }) {
  const reps = data.representants || []
  return (
    <div className="bg-white p-4 rounded shadow space-y-2">
      {reps.map((r: any, i: number) => (
        <div key={i} className="border-b pb-2">
          <p className="font-medium">{r.prenom} {r.nom}</p>
          <p className="text-sm">
            {r.fonction} • Nommé(e) : {r.dateNomination} 
            {r.dateCessation && ` • Cessé(e) : ${r.dateCessation}`}
          </p>
        </div>
      ))}
      {reps.length === 0 && <p>Aucun dirigeant connu.</p>}
    </div>
  )
}
