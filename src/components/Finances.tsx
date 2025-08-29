import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
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
import { formatDateFR } from "../services/mapping";

type AnyObj = Record<string, any>;

type FinanceRow = {
  idBilan?: string;
  exercice: string;
  chiffre_affaires: number | null;
  resultat_net: number | null;
  marge: number | null;
  effectif?: number | null | string;
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
  titre?: string;
  type?: "acte" | "bilan";
  source?: string;
  url?: string; // Lien (backend) de téléchargement/aperçu
  mimeType?: string;
  raw?: AnyObj;

  dateDepot?: string;     // date de dépôt/publication (parution)
  dateDocument?: string;  // date du document (ex: date de clôture pour bilans)

  // Nouveaux champs pour l’affichage et le téléchargement
  originalName?: string;      // nom de fichier/libellé “brut” provenant de l’INPI
  suggestedFilename?: string; // nom de fichier proposé à l’utilisateur lors du téléchargement
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

// Helpers pour titres lisibles et noms de fichiers
function safeFileName(s: string): string {
  if (!s) return "document.pdf";
  const noAccents = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return noAccents
    .replace(/[^\w\s\-.()]/g, "") // garder lettres/chiffres/underscore/espace/-.()
    .replace(/\s+/g, "_");
}

function buildBilanTitle(b: AnyObj): { title: string; suggested: string } {
  const dClot = (b?.dateCloture || b?.dateDocument) as string | undefined;
  const year = yearFromDateStr(dClot);
  const parts: string[] = ["Comptes annuels"];
  if (year) parts.push(year);
  if (dClot) parts.push(`clôture ${formatDateFR(String(dClot).slice(0, 10))}`);
  const title = parts.join(" — ");
  return {
    title,
    suggested: safeFileName(`${title}.pdf`),
  };
}

function buildActeTitle(a: ActeLike): { title: string; suggested: string } {
  const t = a?.typeRdd?.[0]?.typeActe || a?.libelle || a?.description || "Acte";
  const decision = a?.typeRdd?.[0]?.decision;
  const dateRef = (a?.dateDocument || a?.dateDepot) as string | undefined;
  const datePart = dateRef ? ` (${formatDateFR(String(dateRef).slice(0, 10))})` : "";
  const labelCore = [t, decision].filter(Boolean).join(" — ") || "Acte";
  const title = `${labelCore}${datePart}`;
  return {
    title,
    suggested: safeFileName(`${labelCore}${datePart}.pdf`),
  };
}

export default function FinancialData({ data }: { data?: { siren?: string } }) {
  const siren = data?.siren;
  const [finances, setFinances] = useState<FinanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [documents, setDocuments] = useState<DossierDoc[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);

  // Aperçu PDF
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewOriginalUrl, setPreviewOriginalUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string>("Aperçu du document");
  const objectUrlRef = useRef<string | null>(null);

  const cancelledRef = useRef(false);

  // Base backend (ex: https://hubshare-cmexpert.fr/api). Fallback /api si non défini.
  const API_BASE = (
    import.meta.env.VITE_API_URL ||
    (typeof window !== "undefined" ? `${window.location.origin}/api` : "/api")
  ).replace(/\/+$/, "");

  useEffect(() => {
    if (!siren) return;

    cancelledRef.current = false;
    setLoading(true);
    setLoadingDocs(true);
    setError(null);
    setFinances([]);
    setDocuments([]);

    (async () => {
      try {
        const res = await inpiEntreprise.get(`/${siren}/documents-comptes`);
        if (cancelledRef.current) return;

        const payload = res.data ?? {};

        // 1) Bilans saisis (liste JSON) — utilisés uniquement pour les chiffres, pas listés
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

        // 3) Documents téléchargeables via VOTRE backend
        //    - Actes:  GET {API_BASE}/download/acte/:id
        //    - Bilans: GET {API_BASE}/download/bilan/:id  (route que vous venez d'ajouter)
        const coll: DossierDoc[] = [];

        // a) Bilans déposés (PDF via backend)
        const bilansRaw: AnyObj[] = Array.isArray(payload.bilans) ? payload.bilans : [];
        for (const b of bilansRaw) {
          const id =
            coalesce(b?.id, b?.bilanId, b?.documentId, b?.uuid) as string | undefined;
          const originalName =
            (b?.nomDocument as string | undefined) ||
            (b?.libelle as string | undefined);
          const dateDepot = coalesce(b?.dateDepot, b?.date_depot);
          const dateDocument = coalesce(
            b?.dateCloture,
            b?.date_cloture,
            b?.dateDocument
          );

          const { title, suggested } = buildBilanTitle(b);

          if (id) {
            coll.push({
              id,
              titre: title,
              originalName,
              suggestedFilename: suggested,
              type: "bilan",
              source: "INPI",
              url: `${API_BASE}/download/bilan/${encodeURIComponent(id)}`,
              mimeType: "application/pdf",
              raw: b,
              dateDepot,
              dateDocument,
            });
          }
        }

        // b) Actes (PDF via backend)
        const actesRaw: ActeLike[] = Array.isArray(payload.actes) ? payload.actes : [];
        for (const a of actesRaw) {
          const id = (a as AnyObj)?.id || (a as AnyObj)?.documentId;
          const originalName = a?.nomDocument || a?.libelle;
          const dateDepot = a?.dateDepot;
          const dateDocument = coalesce((a as AnyObj)?.dateDocument, (a as AnyObj)?.dateActe);

          const { title, suggested } = buildActeTitle(a);

          if (id) {
            coll.push({
              id,
              titre: title,
              originalName,
              suggestedFilename: suggested,
              type: "acte",
              source: "INPI",
              url: `${API_BASE}/download/acte/${encodeURIComponent(id)}`,
              mimeType: "application/pdf",
              raw: a as AnyObj,
              dateDepot,
              dateDocument,
            });
          }
        }

        // Dédupe et tri (du plus récent au plus ancien par date de dépôt si dispo, sinon date doc)
        const seen = new Set<string>();
        const docs = coll.filter((d) => {
          const k = `${d.type || ""}::${d.id || ""}::${d.titre || ""}`;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });

        docs.sort((a, b) => {
          const ta = a.dateDepot ? Date.parse(a.dateDepot) : (a.dateDocument ? Date.parse(a.dateDocument) : NaN);
          const tb = b.dateDepot ? Date.parse(b.dateDepot) : (b.dateDocument ? Date.parse(b.dateDocument) : NaN);
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
          setDocuments([]);
        }
      } finally {
        if (!cancelledRef.current) {
          setLoading(false);
          setLoadingDocs(false);
        }
      }
    })();

    return () => {
      cancelledRef.current = true;
    };
  }, [siren, API_BASE]);

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

  // On retourne l'URL telle quelle: c'est votre endpoint backend
  const getDocPdfUrl = (doc: DossierDoc): string | undefined => doc.url;

  // Prévisualisation: on récupère le PDF en blob pour éviter les téléchargements forcés
  const openPreview = async (doc: DossierDoc) => {
    const pdf = getDocPdfUrl(doc);
    if (!pdf) return;

    // Optionnel: pour forcer un affichage navigateur si votre backend supporte ?inline=1
    const previewUrl = pdf.includes("?") ? `${pdf}&inline=1` : `${pdf}?inline=1`;

    try {
      const resp = await axios.get(previewUrl, { responseType: "blob" });
      const blob = resp.data as Blob;
      const url = URL.createObjectURL(blob);

      // Cleanup ancien objectURL si nécessaire
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
      objectUrlRef.current = url;

      setPreviewTitle(doc.titre || "Aperçu du document");
      setPreviewOriginalUrl(previewUrl);
      setPreviewBlobUrl(url);
    } catch {
      // Fallback: si CORS interdit le blob, on ouvre dans un nouvel onglet
      window.open(previewUrl, "_blank", "noopener,noreferrer");
    }
  };

  const closePreview = () => {
    setPreviewOriginalUrl(null);
    setPreviewBlobUrl(null);
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  const formatDocDate = (d?: string) => (d ? formatDateFR(d.slice(0, 10)) || "—" : "—");

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

      {/* Documents téléchargeables
