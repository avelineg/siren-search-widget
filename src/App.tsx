import React, { useState } from "react";
import "./styles.css";
import EtablissementOnglets from "./components/EtablissementOnglets";
import { fetchEtablissementData } from "./logic/mapping";

export default function App() {
  const [input, setInput] = useState("");
  const [etabData, setEtabData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const handleSearch = async (evt?: React.FormEvent) => {
    if (evt) evt.preventDefault();
    // Remettre tout à zéro AVANT de lancer la recherche
    setErreur(null);
    setEtabData(null);
    setLoading(true);
    try {
      const data = await fetchEtablissementData(input.trim());
      setEtabData(data);
    } catch (e: any) {
      setErreur(e.message || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h2 className="titre">🔍 Recherche (SIRET ou SIREN)</h2>
      <form className="controls" onSubmit={handleSearch}>
        <input
          className="input"
          placeholder="SIRET/SIREN"
          value={input}
          onChange={e => setInput(e.target.value)}
        />
        <button className="btn" type="submit" disabled={loading || !input.trim()}>
          {loading ? "..." : "Rechercher"}
        </button>
      </form>
      {loading && <div className="loading">Chargement…</div>}
      {erreur && <div className="error">{erreur}</div>}
      {(!loading && etabData) && <EtablissementOnglets etab={etabData} />}
    </div>
  );
}
