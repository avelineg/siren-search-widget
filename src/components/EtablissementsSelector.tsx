import React from "react";
import { formatDateFR } from "../services/mapping";

type Etablissement = {
  siret: string;
  displayName: string;
  adresse?: string;
  statut?: "actif" | "ferme";
  date_fermeture?: string | null;
};

type Props = {
  etablissements: Etablissement[];
  selected: string;
  onSelect: (siret: string) => void;
};

const EtablissementsSelector: React.FC<Props> = ({
  etablissements,
  selected,
  onSelect,
}) => {
  if (!etablissements || etablissements.length === 0) {
    return <div>Aucun établissement référencé.</div>;
  }
  return (
    <ul className="divide-y">
      {etablissements.map((etab) => (
        <li key={etab.siret} className="py-2 flex items-center">
          <span className="flex-1">
            <strong>{etab.displayName || "(Sans nom)"}</strong>
            <span className="ml-2 text-gray-600">SIRET : {etab.siret}</span>
            {etab.adresse && (
              <span className="ml-2 text-gray-500">{etab.adresse}</span>
            )}
            <span
              className="ml-2 px-2 py-1 rounded text-xs"
              style={{
                background: etab.statut === "ferme" ? "#fde8ea" : "#e6faea",
                color: etab.statut === "ferme" ? "#b71c1c" : "#208b42",
                fontWeight: 600,
              }}
              title={etab.statut === "ferme" ? "Établissement fermé" : "Établissement actif"}
            >
              {etab.statut === "ferme" ? "Fermé" : "Actif"}
              {etab.statut === "ferme" && etab.date_fermeture && (
                <span className="ml-1 text-xs text-gray-500">
                  (le {formatDateFR(etab.date_fermeture)})
                </span>
              )}
            </span>
          </span>
          {selected === etab.siret ? (
            <span className="ml-2 px-2 py-1 rounded bg-blue-200 text-blue-800 text-xs">
              Sélectionné
            </span>
          ) : (
            <button
              className="ml-2 px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs"
              onClick={() => onSelect(etab.siret)}
            >
              Voir la fiche
            </button>
          )}
        </li>
      ))}
    </ul>
  );
};

export default EtablissementsSelector;
