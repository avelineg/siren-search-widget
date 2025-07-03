import React from "react";

const Dirigeants = ({ dirigeants }) => (
  <div>
    <h3>Dirigeants</h3>
    {!Array.isArray(dirigeants) || dirigeants.length === 0 ? (
      <div>Aucun dirigeant trouvé.</div>
    ) : (
      <ul>
        {dirigeants.map((d, i) => (
          <li key={i}>{d.nom || d.name || "Nom inconnu"}</li>
        ))}
      </ul>
    )}
  </div>
);

export default Dirigeants;
