import React from 'react'

interface Announcement {
  titre?: string
  date?: string
  lien?: string
}

/**
 * Composant pour afficher la liste des publications légales (« Annonces »).
 */
export default function Announcements({ data }: { data: any }) {
  const annonces: Announcement[] = data.annonces || []

  return (
    <div className="bg-white p-4 rounded shadow">
      <h3 className="font-semibold mb-4">Publications légales</h3>
      {annonces.length > 0 ? (
        annonces.map((a, i) => (
          <div key={i} className="mb-4">
            {a.titre && <p className="font-medium">{a.titre}</p>}
            {a.date && <p className="text-sm text-gray-600">{a.date}</p>}
            {a.lien && (
              <p>
                <a
                  href={a.lien}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Voir l’annonce
                </a>
              </p>
            )}
          </div>
        ))
      ) : (
        <p>Aucune publication légale à afficher.</p>
      )}
    </div>
  )
}
