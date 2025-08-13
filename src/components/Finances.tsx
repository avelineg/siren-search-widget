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
  marge: number | null; // marge (extraite des bilans saisis)
  effectif?: number | null | string; // conservé pour compatibilité, non affiché
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
  url?: string; // lien direct (PDF si disponible)
  raw?: AnyObj;
  mimeType?: string;
};

function coalesce<T>(...vals: T[]): T | undefined {
  return vals.find((v) => v !== undefined && v !== null && v !== "") as T | undefined;
}

function parseAmount(val: unknown): number | null {
  if (typeof val === "number") return Number.isFinite(val) ? val : null;
  if (typeof val === "string") {
    const cleaned = val.replace(/\s/g, "").replace(/[^\d-]/g, "");
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

function flattenLiasses(pages: AnyObj[] | undefined): AnyObj[] {
  if (!Array.isArray(pages)) return [];
  const out: AnyObj[] = [];
  for (const p of pages) {
    if (Array.isArray(p?.liasses)) out.push(...p.liasses);
  }
  return out;
}

// Récupère la valeur d'une liasse avec une préférence d'ordre de colonnes
function getLiasseValue(
  liasses: AnyObj[] | undefined,
  code: string,
  columnPreference: Array<"m1" | "m3" | "m2" | "m4">
): number | null {
  if (!Array.isArray(liasses)) return null;
  const row = liasses.find((l) => l?.code === code);
  if (!row) return null;
  for (const col of columnPreference) {
    const v = parseAmount(row[col]);
    if (v !== null) return v;
  }
  return null;
}

// Tentative d'extraction de la marge à partir des liasses (valeur directe ou calculée)
function extractMarginFromLiasses(liasses: AnyObj[] | undefined, chiffre_affaires: number | null): number | null {
  if (!Array.isArray(liasses)) return null;

  // 1) valeur directe par libellé
  const rowWithLabel =
    liasses.find((l) => {
      const label = String(l?.intitule || l?.libelle || l?.label || "").toLowerCase();
      return label.includes("marge");
    }) || null;

  if (rowWithLabel) {
    const direct =
      parseAmount(rowWithLabel.m1) ??
      parseAmount(rowWithLabel.m3) ??
      parseAmount(rowWithLabel.m2) ??
      parseAmount(rowWithLabel.m4);
    if (direct !== null) return direct;
  }

  // 2) calcul basique si possible (CA - achats)
  const achats =
    getLiasseValue(liasses, "FH", ["m1", "m3", "m2", "m4"]) ?? // Achats marchandises (exemples)
    getLiasseValue(liasses, "FQ", ["m1", "m3", "m2", "m4"]) ?? // Consommations
    getLiasseValue(liasses, "FL", ["m1", "m3", "m2", "m4"]);

  if (typeof chiffre_affaires === "number" && typeof achats === "number") {
    return chiffre_affaires - achats;
  }

  return null;
}

// Extrait CA, RN, capital social et marge depuis un objet bilans-saisis détaillé
function extractNumbersFromBilansSaisis(d: AnyObj) {
  const pages: AnyObj[] =
    d?.bilanSaisi?.bilan?.detail?.pages ||
    d?.detail?.pages ||
    [];
  const liasses = flattenLiasses(pages);

  const chiffre_affaires =
    getLiasseValue(liasses, "FG", ["m1", "m3", "m2", "m4"]) ??
    getLiasseValue(liasses, "FJ", ["m1", "m3", "m2", "m4"]);

  const resultat_net =
    getLiasseValue(liasses, "DI", ["m1", "m3", "m2", "m4"]) ??
    getLiasseValue(liasses, "HN", ["m1", "m3", "m2", "m4"]);

  const capital_social =
    getLiasseValue(liasses, "DA", ["m1", "m3", "m2", "m4"]);

  // Marge: champs directs possibles -> liasse -> calcul CA - achats
  const margeDirecte =
    parseAmount(coalesce(d?.marge, d?.marge_brute, d?.margeBrute, d?.grossMargin)) ?? null;

  const marge =
    margeDirecte ??
    extractMarginFromLiasses(liasses, chiffre_affaires ?? null);

  return {
    chiffre_affaires: chiffre_affaires ?? null,
    resultat_net: resultat_net ?? null,
    capital_social: capital_social ?? null,
    marge: marge ?? null,
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

  // Aperçu PDF
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string>("Aperçu du document");

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

        // 1) Bilans saisis (liste JSON)
        const bilansSaisisRaw: AnyObj[] = Array.isArray(payload.bilansSaisis)
          ? payload.bilansSaisis
          : Array.isArray(payload.bilans_saisis)
          ? payload.bilans_saisis
          : [];

        // 2) Construit les lignes finances à partir des bilans saisis
        const rowsFromBilansSaisis: FinanceRow[] = bilansSaisisRaw
          .map((b) => {
            const idBilan = coalesce(b?.id, b?.bilanId, b?._id);
            const exo =
              yearFromDateStr(b?.bilanSaisi?.bilan?.identite?.dateClotureExercice) ??
              yearFromDateStr(b?.dateCloture) ??
              "";

            const { chiffre_affaires, resultat_net, capital_social, marge } =
              extractNumbersFromBilansSaisis(b);

            return {
              idBilan,
              exercice: exo,
              chiffre_affaires,
              resultat_net,
              marge: marge ?? null,
              effectif: undefined, // non affiché
              capital_social,
            };
          })
          .filter((r) => r.exercice)
          .sort((a, b) => Number(a.exercice) - Number(b.exercice));

        setFinances(rowsFromBilansSaisis);

        // 3) Actes
        const actesRaw: ActeLike[] = Array.isArray(payload.actes) ? payload.actes : [];
        setActes(actesRaw);

        // 4) Documents du dossier: actes + bilans (PDF) + bilansSaisis (JSON) + éventuel doc top-level
        const coll: DossierDoc[] = [];

        // a) actes (téléchargeables PDF via endpoint)
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

        // b) bilans (métadonnées INPI) — on tente de récupérer une URL PDF si exposée par le backend INPI
        const bilansRaw: AnyObj[] = Array.isArray(payload.bilans) ? payload.bilans : [];
        for (const b of bilansRaw) {
          coll.push({
            id: coalesce(b?.id, b?.bilanId),
            date: coalesce(b?.dateCloture, b?.dateDepot),
            titre: b?.nomDocument || "Bilan (INPI)",
            type: "bilan",
            source: "bilans",
            url: coalesce(b?.url, b?.downloadUrl, b?.pdfUrl, b?.urlPdf) as string | undefined,
            mimeType: (b?.mimeType || b?.contentType) as string | undefined,
            raw: b,
          });
        }

        // c) bilansSaisis (JSON) — listés mais non téléchargeables
        for (const b of bilansSaisisRaw) {
          coll.push({
            id: coalesce(b?.id, b?.bilanId),
            date:
              b?.bilanSaisi?.bilan?.identite?.dateClotureExercice ||
              b?.dateCloture ||
              b?.dateDepot,
            titre: "Bilan saisi (liasse INPI - JSON)",
            type: "bilansSaisis",
            source: "bilansSaisis",
            url: undefined, // force aucune URL (non téléchargeable)
            raw: b,
          });
        }

        // d) doc top-level éventuel (on n'en fait pas un téléchargement par défaut)
        if (payload?.typeDocument && payload?.id) {
          coll.push({
            id: payload.id,
            date: payload.dateDepot || payload.updatedAt,
            titre: payload.nomDocument || payload.libelle || "Document",
            type: payload.typeDocument || "document",
            source: "payload",
            url: coalesce(payload?.url, payload?.downloadUrl) as string | undefined,
            mimeType: (payload?.mimeType || payload?.contentType) as string | undefined,
            raw: payload,
          });
        }

        // Dédupe et tri
        const seen = new Set<string>();
        const docs = coll.filter((d) => {
          const k = `${d.type || ""}::${d.id || ""}::${d.titre || ""}`;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });

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
        // Marge non affichée sur le graphe (seulement dans le tableau)
      })),
    [finances]
  );

  // Détermine si un doc est un PDF téléchargeable et retourne son URL
  const getDocPdfUrl = (doc: DossierDoc): string | undefined => {
    // bilans saisis JSON: non téléchargeables
    if (doc.type === "bilansSaisis") return undefined;

    // actes: téléchargement via endpoint
    if (doc.type === "acte" && doc.id) {
      return `${ACTE_DOWNLOAD_BASE}/api/download/acte/${doc.id}`;
    }

    // bilans déposés: nécessite une URL PDF connue
    if (doc.type === "bilan") {
      const url =
        doc.url ||
        coalesce(doc.raw?.url, doc.raw?.downloadUrl, doc.raw?.pdfUrl, doc.raw?.urlPdf);
      const mime = (doc.mimeType || doc.raw?.mimeType || doc.raw?.contentType || "").toLowerCase();

      // heuristique: url .pdf ou mime type pdf
      if (typeof url === "string" && (/\.pdf(\?|$)/i.test(url) || mime.includes("pdf"))) {
        return url;
      }
      return undefined;
    }

    // autres: si explicitement PDF
    const url = doc.url;
    const mime = (doc.mimeType || doc.raw?.mimeType || doc.raw?.contentType || "").toLowerCase();
    if (typeof url === "string" && (/\.pdf(\?|$)/i.test(url) || mime.includes("pdf"))) {
      return url;
    }

    return undefined;
  };

  const canPreview = (doc: DossierDoc) => {
    const pdf = getDocPdfUrl(doc);
    return typeof pdf === "string";
  };

  const openPreview = (doc: DossierDoc) => {
    const pdf = getDocPdfUrl(doc);
    if (pdf) {
      setPreviewTitle(doc.titre || "Aperçu du document");
      setPreviewUrl(pdf);
    }
  };

  const closePreview = () => {
    setPreviewUrl(null);
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
                <th className="px-2 py-1 text-left">Marge</th>
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
                    {typeof f.marge === "number"
                      ? f.marge.toLocaleString("fr-FR") + " €"
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

      {/* Documents et téléchargements */}
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
                  <th className="px-2 py-1 text-left">Aperçu</th>
                  <th className="px-2 py-1 text-left">Télécharger</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc, i) => {
                  const pdfUrl = getDocPdfUrl(doc);
                  const isPreviewable = !!pdfUrl;
                  const isDownloadable = !!pdfUrl; // on restreint aux PDF uniquement
                  const isBilansSaisis = doc.type === "bilansSaisis";

                  return (
                    <tr key={(doc.id ?? "doc") + "-" + i} className="border-b hover:bg-gray-50">
                      <td className="px-2 py-1">{doc.date?.slice(0, 10) || "—"}</td>
                      <td className="px-2 py-1">{doc.titre || "Document"}</td>
                      <td className="px-2 py-1">{doc.type || "—"}</td>
                      <td className="px-2 py-1 text-gray-500">{doc.source || "—"}</td>
                      <td className="px-2 py-1">
                        <button
                          className={`px-3 py-1 rounded text-white text-sm font-medium transition ${
                            isPreviewable ? "bg-indigo-600 hover:bg-indigo-700" : "bg-gray-400 cursor-not-allowed"
                          }`}
                          onClick={() => {
                            if (isPreviewable) openPreview(doc);
                          }}
                          disabled={!isPreviewable}
                          title={
                            isPreviewable
                              ? "Voir l’aperçu du PDF"
                              : isBilansSaisis
                                ? "Aperçu indisponible pour les bilans saisis (JSON)"
                                : "Aperçu indisponible"
                          }
                        >
                          Aperçu
                        </button>
                      </td>
                      <td className="px-2 py-1">
                        {isDownloadable ? (
                          <button
                            className="px-3 py-1 rounded text-white text-sm font-medium transition bg-blue-600 hover:bg-blue-700"
                            onClick={() => openPreview(doc)}
                            title="Afficher l’aperçu avant téléchargement"
                          >
                            Télécharger
                          </button>
                        ) : (
                          <span className="text-gray-500 italic">
                            {isBilansSaisis ? "Non téléchargeable (JSON)" : "Indisponible"}
                          </span>
                        )}
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

      {/* Modal d’aperçu PDF */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={closePreview}
        >
          <div
            className="bg-white rounded shadow-lg max-w-5xl w-[90%] h-[80%] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h5 className="font-semibold">{previewTitle}</h5>
              <div className="flex items-center gap-2">
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 rounded bg-blue-600 text-white text-sm hover:bg-blue-700"
                >
                  Télécharger le PDF
                </a>
                <button
                  className="px-3 py-1 rounded bg-gray-200 text-gray-800 text-sm hover:bg-gray-300"
                  onClick={closePreview}
                >
                  Fermer
                </button>
              </div>
            </div>
            <div className="flex-1">
              <iframe
                src={previewUrl}
                title="Aperçu PDF"
                className="w-full h-full"
                style={{ border: "none" }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
