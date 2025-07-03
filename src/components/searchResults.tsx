import React from "react";

export default function SearchResults({ results, onSelect }) {
  return (
    <div>
      {results.map(etab => (
        <div
          key={etab.siret || etab.siren}
          className="result-item"
          onClick={() => onSelect(etab)}
          style={{ cursor: "pointer", padding: 8, borderBottom: "1px solid #eee", display: "flex", alignItems: "center" }}
        >
          <span style={{ flex: 1 }}>{etab.displayName}</span>
          {/* Affichage indicateur activité */}
          <span
            style={{
              marginLeft: 8,
              color: etab.actif ? "#22a722" : "#b71c1c",
              fontWeight: 600,
              fontSize: "0.95em"
            }}
            title={etab.actif ? "Établissement actif" : "Établissement fermé"}
          >
            {etab.actif ? "Actif" : "Fermé"}
          </span>
        </div>
      ))}
    </div>
  );
}
