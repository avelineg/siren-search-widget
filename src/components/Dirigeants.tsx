import React from "react";

const Dirigeants = ({ dirigeants }) => (
  <div>
    <h3>Dirigeants</h3>
    {!Array.isArray(dirigeants) || dirigeants.length === 0 ? (
      <div>Aucun dirigeant trouvé.</div>
    ) : (
      <ul>
        {dirigeants.map((d, i) => (
          <li key={i} style={{marginBottom: 12}}>
            <strong>{d.nom || d.name || "Nom inconnu"}</strong>
            {d.prenoms && (
              <span> – {Array.isArray(d.prenoms) ? d.prenoms.join(" ") : d.prenoms}</span>
            )}
            {d.genre && (
              <span> ({d.genre === "1" ? "Homme" : d.genre === "2" ? "Femme" : d.genre})</span>
            )}
            {d.role && (
              <div>Rôle : {d.role}</div>
            )}
            {d.dateNaissance && (
              <div>Date de naissance : {d.dateNaissance}</div>
            )}
            {d.siren && (
              <div>SIREN : {d.siren}</div>
            )}
          </li>
        ))}
      </ul>
    )}
  </div>
);

export default Dirigeants;
