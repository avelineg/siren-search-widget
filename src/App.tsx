import React, { useState } from "react";
import "./styles.css";
import { fetchEtablissementData } from "./logic/mapping";
import formeJuridique from "./formeJuridique.json";
import naf from "./naf.json";
import { decodeNatureJuridique, decodeNAF } from "./logic/decode";

export default function App() {
  const [input, setInput] = useState("");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    setErr(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    setData(null);
    try {
      const res = await fetchEtablissementData(input.trim());
      setData(res);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h2>🔍 Recherche (SIRET ou SIREN)</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={handleChange}
          placeholder="SIRET ou SIREN"
        />
        <button type="submit" disabled={loading}>
          {loading ? "Recherche..." : "Rechercher"}
        </button>
      </form>
      {err && <div className="error">{err}</div>}
      {data && (
        <div className="result">
          <div>
            <b>SIREN:</b> {data.siren}
            {data.siret && (
              <>
                {" "}
                <b>SIRET:</b> {data.siret}
              </>
            )}
          </div>
          <div>
            <b>Adresse:</b> {data.adresse}
          </div>
          <div>
            <b>Forme juridique:</b>{" "}
            {decodeNatureJuridique(
              data.uniteLegale?.categorieJuridiqueUniteLegale,
              formeJuridique
            )}
          </div>
          <div>
            <b>Activité principale:</b>{" "}
            {decodeNAF(data.uniteLegale?.activitePrincipaleUniteLegale, naf)}
          </div>
          <div>
            <b>Numéro TVA:</b> {data.numeroTVA ?? "Non renseigné"}
            {data.tvaValidity != null && (
              <span>
                {" "}
                ({data.tvaValidity ? "Valide" : "Non valide"})
              </span>
            )}
          </div>
          <div>
            <b>Dirigeants:</b>
            <ul>
              {data.representants && data.representants.length > 0 ? (
                data.representants.map((r: any, idx: number) => (
                  <li key={idx}>
                    {r.nom} {r.prenom} ({r.qualite})
                  </li>
                ))
              ) : (
                <li>Non disponible</li>
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
