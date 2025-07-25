import React, { useEffect, useState } from "react";
import { inpiEntreprise } from "../services/api";
import { getActesINPI } from "../services/api";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";

export default function FinancialData({ siren }) {
  const [finances, setFinances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Nouvel état pour les actes INPI
  const [actes, setActes] = useState([]);
  const [loadingActes, setLoadingActes] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError(null);
    inpiEntreprise
      .get(`/${siren}/comptes-annuels`)
      .then((res) => {
        const ca = res.data.comptes_annuels || [];
        setFinances(
          ca
            .filter((f) => f.date_cloture)
            .map((f) => ({
              exercice: String(f.date_cloture).slice(0, 4),
              chiffre_affaires: f.chiffre_affaires ?? f.chiffre_affaires_net ?? null,
              resultat_net: f.resultat_net ?? null,
              effectif: f.effectif ?? null,
              capital_social: f.capital_social ?? null,
            }))
            .sort((a, b) => Number(a.exercice) - Number(b.exercice))
        );
      })
      .catch((err) => {
        setError("Aucune donnée financière disponible via l’INPI.");
      })
      .finally(() => setLoading(false));
  }, [siren]);

  // Chargement des actes INPI
  useEffect(() => {
    setLoadingActes(true);
    setActes([]);
    getActesINPI(siren)
      .then(data => setActes(data))
      .catch(() => setActes([]))
      .finally(() => setLoadingActes(false));
  }, [siren]);

  if (loading) return <div>Chargement des données financières…</div>;
  if (error)
    return (
      <div>
        {error}
        <br />
        <a
          href={`https://annuaire-entreprises.data.gouv.fr/donnees-financieres/${siren}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Voir les données financières sur Annuaire-Entreprises
        </a>
      </div>
    );
  if (!finances.length)
    return (
      <div>
        Aucune donnée financière disponible.
        <br />
        <a
          href={`https://annuaire-entreprises.data.gouv.fr/donnees-financieres/${siren}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Voir les données financières sur Annuaire-Entreprises
        </a>
      </div>
    );

  // Préparation pour le graphique
  const chartData = finances.map((f) => ({
    exercice: f.exercice,
    "Chiffre d'affaires": typeof f.chiffre_affaires === "number" ? f.chiffre_affaires : null,
    "Résultat net": typeof f.resultat_net === "number" ? f.resultat_net : null,
  }));

  return (
    <div className="bg-white p-4 rounded shadow">
      <h3 className="font-semibold mb-2">Données financières (INPI)</h3>
      <div style={{ width: "100%", height: 320, marginBottom: 24 }}>
        <ResponsiveContainer>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="exercice" />
            <YAxis
              tickFormatter={(v) =>
                v === 0
                  ? "0"
                  : v >= 1_000_000
                  ? `${(v / 1_000_000).toLocaleString("fr-FR")} M€`
                  : v >= 1_000
                  ? `${(v / 1_000).toLocaleString("fr-FR")} k€`
                  : v.toLocaleString("fr-FR")
              }
            />
            <Tooltip
              formatter={(value: any) =>
                typeof value === "number"
                  ? value.toLocaleString("fr-FR") + " €"
                  : value
              }
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="Chiffre d'affaires"
              stroke="#8884d8"
              strokeWidth={3}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="Résultat net"
              stroke="#82ca9d"
              strokeWidth={3}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <table className="min-w-full text-sm">
        <thead>
          <tr>
            <th>Exercice</th>
            <th>Chiffre d'affaires</th>
            <th>Résultat net</th>
            <th>Effectif</th>
            <th>Capital social</th>
          </tr>
        </thead>
        <tbody>
          {finances.map((f: any) => (
            <tr key={f.exercice}>
              <td>{f.exercice}</td>
              <td>
                {typeof f.chiffre_affaires === "number"
                  ? f.chiffre_affaires.toLocaleString("fr-FR") + " €"
                  : "–"}
              </td>
              <td>
                {typeof f.resultat_net === "number"
                  ? f.resultat_net.toLocaleString("fr-FR") + " €"
                  : "–"}
              </td>
              <td>{f.effectif ?? "–"}</td>
              <td>
                {typeof f.capital_social === "number"
                  ? f.capital_social.toLocaleString("fr-FR") + " €"
                  : "–"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Liste des actes INPI */}
      <div className="mt-6">
        <h4 className="font-semibold mb-2">Actes déposés (INPI)</h4>
        {loadingActes ? (
          <div>Chargement des actes…</div>
        ) : (
          actes.length ? (
            <ul>
              {actes.map((acte: any) => (
                <li key={acte.id} className="mb-1">
                  <span>
                    {acte.nomDocument || acte.typeBilan || "Acte"} — {acte.dateDepot?.slice(0, 10) || "?"}
                  </span>
                  {" "}
                  <a
                    href={`/api/download/acte/${acte.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 text-blue-600 underline"
                  >
                    Télécharger PDF
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <div>Aucun acte disponible.</div>
          )
        )}
      </div>
    </div>
  );
}
