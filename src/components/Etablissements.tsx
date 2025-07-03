import React from 'react'
import { formatDateFR } from '../services/mapping'

type Etablissement = {
  siret: string;
  displayName?: string;
  adresse?: string;
  activite_principale?: string;
  tranche_effectif_libelle?: string;
  tranche_effectif_salarie?: string;
  est_siege?: boolean;
  statut?: "actif" | "ferme";
  date_fermeture?: string | null;
  date_creation?: string;
};

export default function Etablissements({ etablissements }: { etablissements: Etablissement[] }) {
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
              <td>
                <span
                  className="px-2 py-1 rounded text-xs"
                  style={{
                    background: e.statut === "ferme" ? "#fde8ea" : "#e6faea",
                    color: e.statut === "ferme" ? "#b71c1c" : "#208b42",
                    fontWeight: 600,
                  }}
                  title={e.statut === "ferme" ? "Établissement fermé" : "Établissement actif"}
                >
                  {e.statut === "ferme" ? "Fermé" : "Actif"}
                  {e.statut === "ferme" && e.date_fermeture && (
                    <span className="ml-1 text-xs text-gray-500">
                      (le {formatDateFR(e.date_fermeture)})
                    </span>
                  )}
                </span>
              </td>
              <td>{e.date_creation}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
