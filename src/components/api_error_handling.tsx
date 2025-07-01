import React, { useState } from "react";
import axios from "axios";

interface Props {
  siren: string;
  apiInpi: string; // Ex: "https://hubshare-cmexpert.fr/inpi/actes/"
}

export default function ApiErrorHandling({ siren, apiInpi }: Props) {
  const [loading, setLoading] = useState(false);
  const [actes, setActes] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchActes = async () => {
    setLoading(true);
    setError(null);
    setActes(null);
    try {
      const { data } = await axios.get(`${apiInpi}${siren}`);
      setActes(data);
    } catch (e: any) {
      setError(
        e?.response?.status === 404
          ? "Aucun acte trouvé pour ce SIREN."
          : "Erreur lors de la récupération des actes."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={fetchActes} disabled={loading}>
        {loading ? "Chargement..." : "Récupérer les actes"}
      </button>
      {error && <div style={{ color: "#c44", marginTop: 10 }}>{error}</div>}
      {actes && (
        <pre style={{ textAlign: "left", marginTop: 10 }}>
          {JSON.stringify(actes, null, 2)}
        </pre>
      )}
    </div>
  );
}
