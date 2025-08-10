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

type AnyObj = Record<string, any>;

type FinanceRow = {
  idBilan?: string;
  exercice: string;
  chiffre_affaires: number | null;
  resultat_net: number | null;
  effectif: number | null | string;
  capital_social: number | null;
};

type ActeLike = {
  id: string;
  dateDepot?: string;
  nomDocument?: string;
  libelle?: string;
  description?: string;
  typeRdd?: Array<{ typeActe?: string; decision?: string }>;
};

function coalesce<T>(...vals: T[]): T | undefined {
  return vals.find((v) => v !== undefined && v !== null && v !== "") as T | undefined;
}

function toNumber(val: unknown): number | null {
  if (typeof val === "number") return Number.isFinite(val) ? val : null;
  if (typeof val === "string") {
    const cleaned = val.replace?.(/\s/g, "").replace?.(/[^\d.-]/g, "") ?? val;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function getExercice(obj: AnyObj): string | undefined {
  const cloture = coalesce(obj.dateCloture, obj.date_cloture);
  if (cloture) return String(cloture).slice(0, 4);
  const exo = coalesce(obj.exercice, obj.annee, obj.year);
  return exo ? String(exo) : undefined;
}

function getBilanId(obj: AnyObj): string | undefined {
  return coalesce(
    obj.bilanId,
    obj.bilan_id,
    obj.id,
    obj._id,
    obj.identifiant,
    obj.uid
  );
}

function pickNumbersFromRootOrNested(d: AnyObj) {
  // Essaye diverses formes rencontrées dans bilans-saisis
  const cr = coalesce(
    d.compte_de_resultat,
    d.compteDeResultat,
    d.compte_resultat,
    d.compte
  ) || {};

  const ca = coalesce(
    toNumber(d.chiffreAffaires),
    toNumber(d.chiffre_affaires),
    toNumber(d.chiffreAffairesNet),
    toNumber(d.chiffre_affaires_net),
    toNumber(cr.chiffreAffaires),
    toNumber(cr.chiffre_affaires),
    toNumber(cr.chiffreAffairesNet),
    toNumber(cr.chiffre_affaires_net)
  );

  const rn = coalesce(
    toNumber(d.resultatNet),
    toNumber(d.resultat_net),
    toNumber(cr.resultatNet),
    toNumber(cr.resultat_net)
  );

  const effectif = coalesce(
    toNumber(d.effectifMoyen),
    toNumber(d.effectif_moyen),
    toNumber(d.effectif),
    d.effectif // peut parfois être une chaîne ex: "NC"
  );

  const capital = coalesce(
    toNumber(d.capitalSocial),
    toNumber(d.capital_social),
    toNumber(d.capital)
  );

  return {
    chiffre_affaires: ca ?? null,
    resultat_net: rn ?? null,
    effectif: effectif ?? null,
    capital_social: capital ?? null,
  };
}

export default function FinancialData({ data }: { data?: { siren?: string } }) {
  const siren = data?.siren;
  const [finances, setFinances] = useState<FinanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [actes, setActes] = useState<ActeLike[]>([]);
  const [loadingActes, setLoadingActes] = useState(true);

  useEffect(() => {
    if (!siren) return;

    let cancelled = false;
    setLoading(true);
    setLoadingActes(true);
    setError(null);
    setFinances([]);
    setActes([]);

    inpiEntreprise
      .get(`/${siren}/documents-comptes`)
      .then(async (res) => {
        if (cancelled) return;
        const payload = res.data ?? {};

        // 1) Normaliser la liste des bilans
        const bilansRaw: AnyObj[] = Array.isArray(payload)
          ? payload
          : payload.bilans ??
            payload.comptes_annuels ??
            payload.bilansSaisis ??
            payload.bilans_saisis ??
            [];

        const initialRows: FinanceRow[] = bilansRaw
          .map((f) => {
            const exercice = getExercice(f);
            const idBilan = getBilanId(f);

            const { chiffre_affaires, resultat_net, effectif, capital_social } =
              pickNumbersFromRootOrNested(f);

            return {
              idBilan,
              exercice: exercice ?? "",
              chiffre_affaires,
              resultat_net,
              effectif,
              capital_social,
            };
          })
          .filter((r) => r.exercice)
          .sort((a, b) => Number(a.exercice) - Number(b.exercice));

        setFinances(initialRows);

        // 2) Actes
        const actesRaw: ActeLike[] =
          payload.actes ?? payload.documents ?? payload.actes_inpi ?? [];
        setActes(Array.isArray(actesRaw) ? actesRaw : []);

        // 3) Enrichir avec le détail bilans-saisis quand nécessaire
        const needDetail = initialRows.filter(
          (r) =>
            r.idBilan &&
            (r.chiffre_affaires === null ||
              r.resultat_net === null ||
              r.effectif === null ||
              r.capital_social === null)
        );

        if (needDetail.length) {
          // charge en parallèle; si beaucoup, on peut limiter la concurrence
          await Promise.allSettled(
            needDetail.map(async (row) => {
              try {
                const resp = await inpiEntreprise.get(
                  `/${siren}/comptes-annuels/${row.idBilan}`
                );
                if (cancelled) return;

                const d = resp.data ?? {};
                const enriched = pickNumbersFromRootOrNested(d);

                setFinances((prev) =>
                  prev.map((p) =>
                    p.idBilan === row.idBilan
                      ? {
                          ...p,
                          ...enriched,
                        }
                      : p
                  )
                );
              } catch {
                // silencieux: si le détail échoue, on garde les valeurs existantes
              }
            })
          );
        }
      })
      .catch(() => {
        if (cancelled) return;
        setError("Aucune donnée financière disponible via l’INPI.");
        setFinances([]);
        setActes([]);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
        setLoadingActes(false);
      });

    return () => {
      cancelled = true;
    };
  }, [siren]);

  if (!siren) return null;
  if (loading) return <div>Chargement des données financières…</div>;

  const chartData = finances.map((f) => ({
    exercice: f.exercice,
    "Chiffre d'affaires":
      typeof f.chiffre_affaires === "number" ? f.chiffre_affaires : null,
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
              {finances.map((f) => (
                <tr key={f.idBilan ?? f.exercice} className="border-b hover:bg-gray-50">
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
                  <td className="px-2 py-1">
                    {typeof f.effectif === "number" || typeof f.effectif === "string"
                      ? String(f.effectif)
                      : "–"}
                  </td>
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

      {/* Actes INPI */}
      <div className="mt-8">
        <h4 className="font-semibold text-lg border-b pb-1 mb-4">Actes déposés (INPI)</h4>
        {loadingActes ? (
          <div>Chargement des actes…</div>
        ) : actes.length ? (
          <div className="space-y-6">
            {actes.map((acte) => (
              <div key={acte.id} className="bg-gray-50 p-4 rounded shadow-sm border">
                <div className="flex flex-wrap items-center justify-between mb-2">
                  <span className="font-bold text-blue-900 break-all">{acte.id}</span>
                  <span className="text-gray-500 text-sm ml-2">
                    {acte.dateDepot?.slice(0, 10) || "?"}
                  </span>
                </div>
                <div className="mb-2">
                  <span className="block text-blue-700 font-medium">
                    {acte.nomDocument || acte.libelle || "Acte"}
                  </span>
                  {acte.description && (
                    <span className="block text-gray-700">{acte.description}</span>
                  )}
                  {Array.isArray(acte.typeRdd) && acte.typeRdd.length > 0 && (
                    <ul className="mt-2 pl-4 list-disc space-y-1">
                      {acte.typeRdd.map((t, i) => (
                        <li key={i}>
                          <span className="font-semibold text-gray-800">
                            {t.typeActe} :
                          </span>{" "}
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
