import React, { useState } from "react";
import axios from "axios";

export function AdresseSearch() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchAdresse = async () => {
    setResult(null);
    setError(null);
    if (!query.trim()) {
      setError("Veuillez saisir une adresse.");
      return;
    }
    try {
      const { data } = await axios.get(
        `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=1`
      );
      setResult(data);
    } catch (e) {
      setError("Erreur lors de la recherche d'adresse.");
    }
  };

  return (
    <div>
      <input
        type="text"
        value={query}
        placeholder="Adresse…"
        onChange={e => setQuery(e.target.value)}
      />
      <button onClick={fetchAdresse}>Rechercher</button>
      {error && <div style={{ color: "#c44" }}>{error}</div>}
      {result && <pre>{JSON.stringify(result, null, 2)}</pre>}
    </div>
  );
}
