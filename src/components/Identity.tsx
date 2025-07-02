import React from 'react'

export default function Identity({ data }: { data: any }) {
  const { adresse, geo, recherche } = data
  return (
    <div className="bg-white p-4 rounded shadow">
      <h3 className="font-semibold mb-2">Coordonnées</h3>
      <p>{adresse}</p>
      {recherche?.telephones && (
        <p>Téléphone : {recherche.telephones.join(' / ')}</p>
      )}
      {recherche?.email && <p>Email : {recherche.email}</p>}
      {recherche?.site && (
        <p>
          Site web : <a href={recherche.site}>{recherche.site}</a>
        </p>
      )}
      {geo && (
        <p className="text-xs text-gray-500">
          Géolocalisation : {geo[1].toFixed(5)}, {geo[0].toFixed(5)}
        </p>
      )}
    </div>
  )
}
