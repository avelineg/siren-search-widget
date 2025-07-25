import React from "react";

const Dirigeants = ({ dirigeants }) => (
  <div>
    <h3>Dirigeants</h3>
    {!Array.isArray(dirigeants) || dirigeants.length === 0 ? (
      <div>Aucun dirigeant trouvé.</div>
    ) : (
      <ul>
        {dirigeants.map((d, i) => (
          <li key={i} style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <strong>{d.nom || d.name || "Nom inconnu"}</strong>
              {d.prenoms && (
                <span>
                  – {Array.isArray(d.prenoms) ? d.prenoms.join(" ") : d.prenoms}
                </span>
              )}
              {d.genre && (
                <span>
                  ({d.genre === "1"
                    ? "Homme"
                    : d.genre === "2"
                    ? "Femme"
                    : d.genre})
                </span>
              )}
              {d.role && <span style={{ color: "#555" }}>• Rôle : {d.role}</span>}
              {d.dateNaissance && (
                <span style={{ marginLeft: 6 }}>
                  • Né(e) {d.dateNaissance}
                </span>
              )}
              {d.siren && (
                <span style={{ marginLeft: 6 }}>• SIREN : {d.siren}</span>
              )}
              <a
                href={`https://annuaire-entreprises.data.gouv.fr/personne?n=${encodeURIComponent(
                  d.nom || d.name || ""
                )}&fn=${encodeURIComponent(
                  Array.isArray(d.prenoms)
                    ? d.prenoms[0]
                    : d.prenoms || ""
                )}${
                  d.dateNaissance
                    ? `&partialDate=${encodeURIComponent(d.dateNaissance)}`
                    : ""
                }`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  marginLeft: 12,
                  padding: "2px 10px",
                  fontSize: "0.94em",
                  background: "#e4e8f8",
                  border: "1px solid #b6c3e8",
                  borderRadius: 4,
                  cursor: "pointer",
                  textDecoration: "none",
                }}
              >
                Voir ses entreprises (annuaire-entreprises)
              </a>
            </div>
          </li>
        ))}
      </ul>
    )}
  </div>
);

export default Dirigeants;
