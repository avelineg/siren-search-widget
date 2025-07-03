import React from "react";

export default function EtablissementDetail({ etab }) {
  if (!etab) return null;
  return (
    <div>
      <h2 style={{ marginBottom: 0 }}>
        {etab.denomination}
        <span
          style={{
            marginLeft: 16,
            color: etab.actif ? "#22a722" : "#b71c1c",
            fontWeight: 700,
            fontSize: "1em"
          }}
          title={etab.actif ? "Établissement actif" : "Établissement fermé"}
        >
          {etab.actif ? "Actif" : "Fermé"}
        </span>
      </h2>
      {/* ...autres infos (adresse, etc) */}
    </div>
  );
}
