import React, { useEffect, useMemo, useRef, useState } from "react";
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

const ACTE_DOWNLOAD_BASE = "https://hubshare-cmexpert.fr";

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
  id?: string;
  dateDepot?: string;
  nomDocument?: string;
  libelle?: string;
  description?: string;
  typeRdd?: Array<{ typeActe?: string; decision?: string }>;
};

type DossierDoc = {
  id?: string;
  date?: string;
  titre?: string;
  type?: string; // "acte" | "bilan" | "bilansSaisis" | "document"
  source?: string;
  url?: string;
  raw?: AnyObj;
};

function coalesce<T>(...vals: T[]): T | undefined {
  return vals.find((v) => v !== undefined && v !== null && v !== "") as T | undefined;
}

function parseAmount(val: unknown): number | null {
  if (typeof val === "number") return Number.isFinite(val) ? val : null;
  if (typeof val === "string") {
    const cleaned = val.replace(/\s/g, "").replace(/[^\d-]/g, ""); // garde le '-'
    if (!cleaned) return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function yearFromDateStr(d?: string): string | undefined {
  if (!d) return undefined;
  const y = String(d).slice(0, 4);
  return /^\d{4}$/.test(y) ? y : undefined;
}

// Cherche une liasse par code et renvoie la valeur pour l'exercice N selon priorité des colonnes
function getLiasseValueForN(liasses: AnyObj[] | undefined, code: string, columnPreference: Array<"m3" | "m1" | "m2" | "m4">): number | null {
  if (!Array.isArray(liasses)) return null;
  const row = liasses.find((l) => l?.code === code);
  if (!row) return null;
  for (const col of columnPreference) {
    const v = parseAmount(row[col]);
    if (v !== null) return v;
  }
  return null;
}

// Extrait CA, RN, capital social depuis un objet bilans-saisis détaillé
function extractNumbersFromBilansSaisis(d: AnyObj) {
  // pages[].liasses[] attendues ici
  const pages: AnyObj[] = d?.bilanSaisi?.bilan?.detail?.pages || d?.detail?.pages || [];
  const allLiasses = pages.flatMap((p) => Array.isArray(p?.liasses) ? p.liases || p.liasses : []);

  // Mapping basé sur les données fournies et pratiques usuelles:
  // - CA net: code FY (compte de résultat simplifié) -> m3 pour N
  // - Résultat net: code HK -> m3 (repli GV -> m3)
  // - Capital social: code DA -> m1
  const chiffre_affaires =
    getLiasseValueForN(allLiasses, "FY", ["m3", "m1", "m2", "m4"]);
  const resultat_net =
    getLiasseValueForN(allLiasses, "HK", ["m3", "m1", "m2", "m4"]) ??
    getLiasseValueForN(allLiasses, "GV", ["m3", "m1", "m2", "m4"]); // repli
  const capital_social =
    getLiasseValueForN(allLiasses, "DA", ["m1", "m3", "m2", "m4"]);

  return {
    chiffre_affaires: chiffre_affaires ?? null,
    resultat_net: resultat_net ?? null,
    capital_social: capital_social ?? null,
  };
}

export default function FinancialData({ data }: { data?: { siren?: string } }) {
  const siren = data?.siren;
  const [finances, setFinances] = useState<FinanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [actes, setActes] = useState<ActeLike[]>([]);
  const [loadingActes, setLoadingActes] = useState(true);

  const [documents, setDocuments] = useState<DossierDoc[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);

  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!siren) return;

    cancelledRef.current = false;
    setLoading(true);
    setLoadingActes(true);
    setLoadingDocs(true);
    setError(null);
    setFinances([]);
    setActes([]);
    setDocuments([]);

    (async () => {
      try {
        const res = await inpiEntreprise.get(`/${siren}/documents-comptes`);
        if (cancelledRef.current) return;

        const payload = res.data ?? {};

        // 1) Récup bilans saisis (liste)
        const bilansSaisisRaw: AnyObj[] = Array.isArray(payload.bilansSaisis)
          ? payload.bilansSaisis
          : Array.isArray(payload.bilans_saisis)
          ? payload.bilans_saisis
          : [];

        // 2) Construit les lignes finances depuis bilans-saisis
        const rowsFromBilansSaisis: FinanceRow[] = bilansSaisisRaw
          .map((b) => {
            const idBilan = coalesce(b?.id, b?.bilanId, b?._id);
            const exo =
              yearFromDateStr(b?.bilanSaisi?.bilan?.identite?.dateClotureExercice) ??
              yearFromDateStr(b?.dateCloture) ??
              "";
            const { chiffre_affaires, resultat_net, capital_social } = extractNumbersFromBilansSaisis(b);

            return {
              idBilan,
              exercice: exo,
              chiffre_affaires,
              resultat_net,
              effectif: null, // non fourni par ces liasses
              capital_social,
            };
          })
          .filter((r) => r.exercice)
          .sort((a, b) => Number(a.exercice) - Number(b.exercice));

        setFinances(rowsFromBilansSaisis);

        // 3) Actes
        const actesRaw: ActeLike[] = Array.isArray(payload.actes) ? payload.actes : [];
        setActes(actesRaw);

        // 4) Documents du dossier: agrège actes + bilans + bilansSaisis + objets isolés
        const coll: DossierDoc[] = [];

        // a) actes
        for (const a of actesRaw) {
          coll.push({
            id: a?.id,
            date: a?.dateDepot,
            titre: a?.nomDocument || a?.libelle || "Acte",
            type: "acte",
            source: "actes",
            raw: a as AnyObj,
          });
        }

        // b) bilans (métadonnées “CA_*” côté INPI)
        const bilansRaw: AnyObj[] = Array.isArray(payload.bilans) ? payload.bilans : [];
        for (const b of bilansRaw) {
          coll.push({
            id: coalesce(b?.id, b?.bilanId),
            date: coalesce(b?.dateCloture, b?.dateDepot),
            titre: b?.nomDocument || "Bilan (INPI)",
            type: "bilan",
            source: "bilans",
            raw: b,
          });
        }

        // c) bilansSaisis: on expose aussi comme documents (pratique pour téléchargement)
        for (const b of bilansSaisisRaw) {
          coll.push({
            id: coalesce(b?.id, b?.bilanId),
            date:
              b?.bilanSaisi?.bilan?.identite?.dateClotureExercice ||
              b?.dateCloture ||
              b?.dateDepot,
            titre: "Bilan saisi (liasse INPI)",
            type: "bilansSaisis",
            source: "bilansSaisis",
            raw: b,
          });
        }

        // d) objet isolé au top-level (ex: PJ_52) si présent
        if (payload?.typeDocument && payload?.id) {
          coll.push({
            id: payload.id,
            date: payload.dateDepot || payload.updatedAt,
            titre: payload.nomDocument || payload.libelle || "Document",
            type: payload.typeDocument || "document",
            source: "payload",
            raw: payload,
          });
        }

        // Dédupe
        const seen = new Set<string>();
        const docs = coll.filter((d) => {
          const k = `${d.type || ""}::${d.id || ""}::${d.titre || ""}`;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });

        // Tri par date décroissante si possible
        docs.sort((a, b) => {
          const ta = a.date ? Date.parse(a.date) : NaN;
          const tb = b.date ? Date.parse(b.date) : NaN;
          if (Number.isNaN(ta) && Number.isNaN(tb)) return 0;
          if (Number.isNaN(ta)) return 1;
          if (Number.isNaN(tb)) return -1;
          return tb - ta;
        });

        setDocuments(docs);
      } catch (_e) {
        if (!cancelledRef.current) {
          setError("Aucune donnée financière disponible via l’INPI.");
          setFinances([]);
          setActes([]);
          setDocuments([]);
        }
      } finally {
        if (!cancelledRef.current) {
          setLoading(false);
          setLoadingActes(false);
          setLoadingDocs(false);
        }
      }
    })();

    return () => {
      cancelledRef.current = true;
    };
  }, [siren]);

  const chartData = useMemo(
    () =>
      finances.map((f) => ({
        exercice: f.exercice,
        "Chiffre d'affaires":
          typeof f.chiffre_affaires === "number" ? f.chiffre_affaires : null,
        "Résultat net": typeof f.resultat_net === "number" ? f.resultat_net : null,
      })),
    [finances]
  );

  const renderDownloadHref = (doc: DossierDoc) => {
    if (doc.id) {
      // Votre backend sait télécharger par id via /api/download/acte/:id
      return `${ACTE_DOWNLOAD_BASE}/api/download/acte/${doc.id}`;
    }
    if (doc.url) return doc.url;
    return undefined;
    // Si vous avez un endpoint distinct pour les documents non-actes, dites-le et on ajuste ici.
  };

  if (!siren) return null;
  if (loading) return <div>Chargement des données financières…</div>;

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
                  tickFormatter={(v: any) =>
                    typeof v !== "number"
                      ? ""
                      : v === 0
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
                <tr key={(f.idBilan ?? "") + "-" + f.exercice} className="border-b hover:bg-gray-50">
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
        <h4 className="font-semibold mb-3 text-lg border-b pb-1 mb-4">Actes déposés (INPI)</h4>
        {loadingActes ? (
          <div>Chargement des actes…</div>
        ) : Array.isArray(actes) && actes.length ? (
          <div className="space-y-6">
            {actes.map((acte, idx) => (
              <div key={acte.id ?? `acte-${idx}`} className="bg-gray-50 p-4 rounded shadow-sm border">
                <div className="flex flex-wrap items-center justify-between mb-2">
                  <span className="font-bold text-blue-900 break-all">{acte.id ?? "—"}</span>
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
                    href={
                      acte.id
                        ? `${ACTE_DOWNLOAD_BASE}/api/download/acte/${acte.id}`
                        : undefined
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-block mt-1 px-3 py-1 rounded text-white text-sm font-medium transition ${
                      acte.id ? "bg-blue-600 hover:bg-blue-700" : "bg-gray-400 cursor-not-allowed"
                    }`}
                    onClick={(e) => {
                      if (!acte.id) e.preventDefault();
                    }}
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

      {/* Tous les documents du dossier INPI */}
      <div className="mt-10">
        <h4 className="font-semibold mb-3 text-lg border-b pb-1 mb-4">Documents du dossier (INPI)</h4>
        {loadingDocs ? (
          <div>Chargement des documents…</div>
        ) : Array.isArray(documents) && documents.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-2 py-1 text-left">Date</th>
                  <th className="px-2 py-1 text-left">Titre</th>
                  <th className="px-2 py-1 text-left">Type</th>
                  <th className="px-2 py-1 text-left">Source</th>
                  <th className="px-2 py-1 text-left">Télécharger</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc, i) => {
                  const href = renderDownloadHref(doc);
                  return (
                    <tr key={(doc.id ?? "doc") + "-" + i} className="border-b hover:bg-gray-50">
                      <td className="px-2 py-1">{doc.date?.slice(0, 10) || "—"}</td>
                      <td className="px-2 py-1">{doc.titre || "Document"}</td>
                      <td className="px-2 py-1">{doc.type || "—"}</td>
                      <td className="px-2 py-1 text-gray-500">{doc.source || "—"}</td>
                      <td className="px-2 py-1">
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`inline-block px-3 py-1 rounded text-white text-sm font-medium transition ${
                            href ? "bg-blue-600 hover:bg-blue-700" : "bg-gray-400 cursor-not-allowed"
                          }`}
                          onClick={(e) => {
                            if (!href) e.preventDefault();
                          }}
                        >
                          Télécharger
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-gray-500 italic">Aucun document disponible.</div>
        )}
      </div>
    </div>
  );
}
