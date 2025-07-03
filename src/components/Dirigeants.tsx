import React from "react";

const Dirigeants = ({ dirigeants }) => (
  <div>
    <h3 className="text-lg font-semibold mb-2">Dirigeants</h3>
    {(!dirigeants || !dirigeants.length) && <div>Aucun dirigeant trouvé.</div>}
    <ul>
      {dirigeants && dirigeants.map((d, i) => (
        <li key={i}>
          {(d.nom || "") + " " + (d.prenoms || d.prenom || "")}
        </li>
      ))}
    </ul>
  </div>
);

export default Dirigeants;
