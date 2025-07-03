import React from 'react'

export default function Directors({ dirigeants }: { dirigeants: any[] }) {
  if (!dirigeants?.length) return <div>Aucun dirigeant.</div>
  return (
    <div className="bg-white p-4 rounded shadow">
      <h3 className="font-semibold mb-2">Dirigeants</h3>
      <ul>
        {dirigeants.map((d, i) =>
          d.type === 'personne morale' ? (
            <li key={i}>
              <b>Personne morale</b> : {d.denomination} (SIREN {d.siren})
            </li>
          ) : (
            <li key={i}>
              {d.qualite ? d.qualite + ' : ' : ''}
              {d.nom} {d.prenoms && d.prenoms}
              {d.dateNaissance && `, né(e) ${d.dateNaissance}`}
            </li>
          )
        )}
      </ul>
    </div>
  )
}
