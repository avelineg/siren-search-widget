import React, { useState } from "react";
import axios from "axios";

const API_URL = "https://recherche-entreprises.api.gouv.fr/search";

const Dirigeants = ({ dirigeants }) => {
  const [mandatsByIndex, setMandatsByIndex] = useState({});
  const [loading, setLoading] = useState({});
  const [error, setError] = useState({});

  const fetchMandats = async (d, idx) => {
    setLoading(l => ({ ...l, [idx]: true }));
    setError(e => ({ ...e, [idx]: null }));
    setMandatsByIndex(m => ({ ...m, [idx]: [] }));

    try {
      const params = {
        dir_nom: d.nom || d.name || "",
      };
      if (d.prenoms) {
        params.dir_prenom = Array.isArray(d.prenoms) ? d.prenoms[0] : d.prenoms;
      }
      if (d.dateNaissance) {
        params.dir_date_naissance = d.dateNaissance;
      }
      const resp = await axios.get(API_URL, { params });
      const entreprises = [];
      if (Array.isArray(resp.data.results)) {
        resp.data.results.forEach(r => {
          // On tente d'extraire la qualité du dirigeant dans chaque entreprise
          let qualite = "";
          if (Array.isArray(r.matching_dirigeants)) {
            const match = r.matching_dirigeants.find(
              md =>
                (md.nom || "").toLowerCase() === (d.nom || d.name || "").toLowerCase() &&
                (!d.prenoms ||
                  (Array.isArray(md.prenoms)
                    ? md.prenoms.join(" ")
                    : md.prenoms || "")
                    .toLowerCase()
                      .includes(
                        (Array.isArray(d.prenoms)
                          ? d.prenoms.join(" ")
                          : d.prenoms || ""
                        ).toLowerCase()
                      )
                )
            );
            if (match) qualite = match.role;
          }
          entreprises.push({
            siren: r.siren,
            nom: r.nom_complet || r.nom_raison_sociale || r.denomination || r.raison_sociale || r.name || "-",
            qualite,
            statut: r.statut,
            date_fermeture: r.date_fermeture
          });
        });
      }
      setMandatsByIndex(m => ({ ...m, [idx]: entreprises }));
    } catch (e) {
      setError(er => ({ ...er, [idx]: "Erreur lors de la recherche." }));
    } finally {
      setLoading(l => ({ ...l, [idx]: false }));
    }
  };

  return (
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
                <button
                  onClick={() => fetchMandats(d, i)}
                  style={{
                    marginLeft: 12,
                    padding: "2px 10px",
                    fontSize: "0.94em",
                    background: "#e4e8f8",
                    border: "1px solid #b6c3e8",
                    borderRadius: 4,
                    cursor: "pointer",
                  }}
                  disabled={loading[i]}
                >
                  {loading[i] ? "Recherche..." : "Voir ses entreprises"}
                </button>
              </div>
              {error[i] && <div style={{ color: "red" }}>{error[i]}</div>}
              {mandatsByIndex[i] && mandatsByIndex[i].length > 0 && (
                <ul style={{ marginTop: 8, marginBottom: 8, paddingLeft: 20, fontSize: "0.96em" }}>
                  {mandatsByIndex[i].map((m, j) => (
                    <li key={j} style={{ marginBottom: 6 }}>
                      <a
                        href={`https://annuaire-entreprises.data.gouv.fr/entreprise/${m.siren}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontWeight: 600 }}
                      >
                        {m.nom}
                      </a>{" "}
                      ({m.siren})
                      {m.qualite && (
                        <span style={{ marginLeft: 8, color: "#444" }}>• {m.qualite}</span>
                      )}
                      {m.statut && (
                        <span
                          style={{
                            marginLeft: 8,
                            color: m.statut === "ferme" ? "#b71c1c" : "#208b42",
                            fontWeight: 600,
                          }}
                        >
                          {m.statut === "ferme" ? "Fermée" : "Active"}
                          {m.statut === "ferme" && m.date_fermeture && (
                            <span style={{ color: "#888", marginLeft: 4 }}>
                              (le {m.date_fermeture})
                            </span>
                          )}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Dirigeants;
