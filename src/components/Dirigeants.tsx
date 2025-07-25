import React, { useState } from "react";
import axios from "axios";

const API_URL = "https://recherche-entreprises.api.gouv.fr/search";

type DirigeantResult = {
  nom: string;
  prenoms?: string | string[];
  date_naissance?: string;
  siren?: string;
  role?: string;
};

const Dirigeants = ({ dirigeants }) => {
  const [search, setSearch] = useState({ nom: "", prenom: "", date: "" });
  const [results, setResults] = useState<DirigeantResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch({ ...search, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResults([]);
    setLoading(true);

    try {
      const params: any = {};
      if (search.nom) params.dir_nom = search.nom;
      if (search.prenom) params.dir_prenom = search.prenom;
      if (search.date) params.dir_date_naissance = search.date; // Format AAAA ou AAAA-MM

      const resp = await axios.get(API_URL, { params });
      // L'API retourne des unités légales avec matching_dirigeants
      const allDirigeants: DirigeantResult[] = [];
      if (Array.isArray(resp.data.results)) {
        resp.data.results.forEach((r) => {
          if (Array.isArray(r.matching_dirigeants)) {
            r.matching_dirigeants.forEach((d) => {
              allDirigeants.push({
                nom: d.nom,
                prenoms: d.prenoms,
                date_naissance: d.date_naissance,
                siren: r.siren,
                role: d.role,
              });
            });
          }
        });
      }
      setResults(allDirigeants);
    } catch (err) {
      setError("Erreur lors de la recherche.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h3>Dirigeants</h3>
      <form onSubmit={handleSubmit} style={{marginBottom:20, background: "#f7f7fa", padding: 12, borderRadius: 6}}>
        <label>
          Nom&nbsp;
          <input type="text" name="nom" value={search.nom} onChange={handleInput} style={{marginRight:10}} />
        </label>
        <label>
          Prénom&nbsp;
          <input type="text" name="prenom" value={search.prenom} onChange={handleInput} style={{marginRight:10}} />
        </label>
        <label>
          Date de naissance (AAAA ou AAAA-MM)&nbsp;
          <input type="text" name="date" value={search.date} onChange={handleInput} style={{width:100, marginRight:10}} />
        </label>
        <button type="submit" style={{padding: "4px 14px"}} disabled={loading || !search.nom}>
          {loading ? "Recherche..." : "Rechercher un dirigeant"}
        </button>
      </form>

      {error && <div style={{color:"red"}}>{error}</div>}

      {results.length > 0 && (
        <div style={{marginBottom:20}}>
          <strong>Résultats :</strong>
          <ul>
            {results.map((d, i) => (
              <li key={i} style={{marginBottom: 10, fontSize: "0.97em"}}>
                <strong>{d.nom}</strong>
                {d.prenoms && (
                  <span> – {Array.isArray(d.prenoms) ? d.prenoms.join(" ") : d.prenoms}</span>
                )}
                {d.date_naissance && (
                  <span> (né(e) {d.date_naissance})</span>
                )}
                {d.role && (
                  <span style={{marginLeft:6, color:"#555"}}>• Rôle : {d.role}</span>
                )}
                {d.siren && (
                  <span style={{marginLeft:10}}>
                    • <a href={`https://annuaire-entreprises.data.gouv.fr/entreprise/${d.siren}`} target="_blank" rel="noopener noreferrer">Voir entreprise {d.siren}</a>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

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
};

export default Dirigeants;
