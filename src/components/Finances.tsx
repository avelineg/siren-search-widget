import React, { useEffect, useState } from "react";
import { inpiEntreprise } from "../services/api";
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

const ACTE_DOWNLOAD_BASE = "https://hubshare-cmexpert.fr"; // Backend URL for acte downloads

export default function FinancialData({ data }) {
  const siren = data?.siren;
  const [finances, setFinances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [actes, setActes] = useState([]);
  const [loadingActes, setLoadingActes] = useState(true);

  // Load bilans and actes via /documents-comptes endpoint
  useEffect(() => {
    if (!siren) return;
    setLoading(true);
    setLoadingActes(true);
    setError(null);
    setFinances([]);
    setActes([]);
    inpiEntreprise
      .get(`/${siren}/documents-comptes`)
      .then((res) => {
        // --- Bilans ---
        const bilans = res.data.bilans || [];
        setFinances(
          bilans
            .filter((f) => f.dateCloture)
            .map((f) => ({
              exercice: String(f.dateCloture).slice(0, 4),
              chiffre_affaires: f.chiffreAffaires ?? f.chiffre_affaires_net ?? null,
              resultat_net: f.resultatNet ?? null,
              effectif: f.effectif ?? null,
              capital_social: f.capitalSocial ?? null,
            }))
            .sort((a, b) => Number(a.exercice) - Number(b.exercice))
        );
        // --- Actes ---
        setActes(res.data.actes || []);
      })
      .catch((err) => {
        setError("Aucune donnée financière disponible via l’INPI.");
        setFinances([]);
        setActes([]);
      })
      .finally(() => {
        setLoading(false);
        setLoadingActes(false);
      });
  }, [siren]);

  if (!siren) return null;
  if (loading) return <div>Chargement des données financières…</div>;

  // Data for the chart
  const chartData = finances.map((f) => ({
    exercice: f.exercice,
    "Chiffre d'affaires": typeof f.chiffre_affaires === "number" ? f.chiffre_affaires : null,
    "Résultat net": typeof f.resultat_net === "number" ? f.resultat_net : null,
  }));

  return (
    <div className="bg-white p-4 rounded shadow">
      <h3 className="font-semibold mb-2">Données financières (INPI)</h3>
      {error || !finances.length ? (
        <div>
          {error || "Aucune donnée financière disponible."}
          <br />
          <a
            href={`https://annuaire-entreprises.data.gouv.fr/donnees-financieres/${siren}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Voir les données financières sur Annuaire-Entreprises
          </a>
        </div>
      ) : (
        <>
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
          <table className="min-w-full text-sm mb-8">
            <thead>
              <tr className="border-b">
                <th className="px-2 py-1 text-left">Exercice</th>
                <th className="px-2 py-1 text-left">Chiffre d'affaires</th>
                <th className="px-2 py-1 text-left">Résultat net</th>
                <th className="px-2 py-1 text-left">Effectif</th>
                <th className="px-2 py-1 text-left">Capital social</th>
              </tr>
            </thead>
            <tbody>
              {finances.map((f: any) => (
                <tr key={f.exercice} className="border-b hover:bg-gray-50">
                  <td className="px-2 py-1">{f.exercice}</td>
                  <td className="px-2 py-1">
                    {typeof f.chiffre_affaires === "number"
                      ? f.chiffre_affaires.toLocaleString("fr-FR") + " €"
                      : "–"}
                  </td>
                  <td className="px-2 py-1">
                    {typeof f.resultat_net === "number"
                      ? f.resultat_net.toLocaleString("fr-FR") + " €"
                      : "–"}
                  </td>
                  <td className="px-2 py-1">{f.effectif ?? "–"}</td>
                  <td className="px-2 py-1">
                    {typeof f.capital_social === "number"
                      ? f.capital_social.toLocaleString("fr-FR") + " €"
                      : "–"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* Nouvelle mise en forme des actes INPI */}
      <div className="mt-8">
        <h4 className="font-semibold mb-3 text-lg border-b pb-1 mb-4">Actes déposés (INPI)</h4>
        {loadingActes ? (
          <div>Chargement des actes…</div>
        ) : actes.length ? (
          <div className="space-y-6">
            {actes.map((acte: any) => (
              <div key={acte.id} className="bg-gray-50 p-4 rounded shadow-sm border">
                <div className="flex flex-wrap items-center justify-between mb-2">
                  <span className="font-bold text-blue-900 break-all">{acte.id}</span>
                  <span className="text-gray-500 text-sm ml-2">{acte.dateDepot?.slice(0, 10) || "?"}</span>
                </div>
                <div className="mb-2">
                  <span className="block text-blue-700 font-medium">
                    {acte.nomDocument || acte.libelle || "Acte"}
                  </span>
                  {acte.description && (
                    <span className="block text-gray-700">{acte.description}</span>
                  )}
                  {/* Les sous-détails, typiquement typeRdd */}
                  {Array.isArray(acte.typeRdd) && acte.typeRdd.length > 0 && (
                    <ul className="mt-2 pl-4 list-disc space-y-1">
                      {acte.typeRdd.map((t: any, i: number) => (
                        <li key={i}>
                          <span className="font-semibold text-gray-800">{t.typeActe} :</span>{" "}
                          <span className="text-gray-700">{t.decision}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <a
                    href={`${ACTE_DOWNLOAD_BASE}/api/download/acte/${acte.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-1 px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium transition"
                  >
                    Télécharger PDF
                  </a>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-gray-500 italic">Aucun acte disponible.</div>
        )}
      </div>
    </div>
  );
}
