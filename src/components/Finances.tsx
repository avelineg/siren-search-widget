import React from "react";
// Installer recharts avec : npm install recharts
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

export default function FinancialData({ data }: { data: any }) {
  const finances = (data.finances || [])
    .filter((f: any) => f && f.exercice)
    .sort((a: any, b: any) => Number(a.exercice) - Number(b.exercice));

  if (!finances.length)
    return <div>Aucune donnée financière disponible.</div>;

  // Préparation des données pour le graphique (chiffre d'affaires et résultat net)
  const chartData = finances.map((f: any) => ({
    exercice: f.exercice,
    "Chiffre d'affaires": typeof f.ca === "number" ? f.ca : null,
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
                {typeof f.ca === "number"
                  ? f.ca.toLocaleString("fr-FR") + " €"
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
    </div>
  );
}
