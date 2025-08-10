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

const ACTE_DOWNLOAD_BASE = "https://hubshare-cmexpert.fr"; // Backend URL pour les téléchargements

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
  type?: string; // "acte" | "document" | "bilan" | ...
  source?: string; // d'où ça vient pour debug (actes, documents, bilan.fichiers, ...)
  raw?: AnyObj; // référence brute pour debug
  url?: string; // lien brut si dispo
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

// Concurrence simple limitée pour les appels détail
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;

  async function next() {
    const current = idx++;
    if (current >= items.length) return;
    try {
      results[current] = await worker(items[current], current);
    } catch (e) {
      // on ignore l'erreur, la valeur restera undefined
    }
    await next();
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => next());
  await Promise.all(workers);
  return results;
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

        if (process.env.NODE_ENV !== "production") {
          // Aide au debug local si besoin
          // eslint-disable-next-line no-console
          console.debug("[INPI documents-comptes] payload keys:", Object.keys(payload || {}));
        }

        // 1) Bilans: accepter plusieurs structures
        const bilansRaw: AnyObj[] = Array.isArray(payload)
          ? payload
          : payload.bilans ??
            payload.comptes_annuels ??
            payload.bilansSaisis ??
            payload.bilans_saisis ??
            [];

        // mapping initial
        const initialRows: FinanceRow[] = bilansRaw
          .map((f) => {
            const exercice = getExercice(f);
            const idBilan = getBilanId(f);
            const nums = pickNumbersFromRootOrNested(f);
            return {
              idBilan,
              exercice: exercice ?? "",
              ...nums,
            };
          })
          .filter((r) => r.exercice)
          .sort((a, b) => Number(a.exercice) - Number(b.exercice));

        setFinances(initialRows);

        // 2) Actes (déjà visibles séparément)
        const actesRaw: ActeLike[] =
          payload.actes ?? payload.documents_actes ?? [];
        setActes(Array.isArray(actesRaw) ? actesRaw : []);

        // 3) Documents du dossier (agrégation de plusieurs sources)
        const collectDocs: DossierDoc[] = [];

        // a) actes -> documents téléchargeables
        if (Array.isArray(actesRaw)) {
          for (const a of actesRaw) {
            collectDocs.push({
              id: a?.id,
              date: a?.dateDepot,
              titre: a?.nomDocument || a?.libelle || "Acte",
              type: "acte",
              source: "actes",
              raw: a as AnyObj,
            });
          }
        }

        // b) payload.documents / pieces / fichiers
        const diverseDocsArrays: { arr?: AnyObj[]; label: string }[] = [
          { arr: payload.documents, label: "documents" },
          { arr: payload.pieces, label: "pieces" },
          { arr: payload.fichiers, label: "fichiers" },
          { arr: payload.rneDocuments, label: "rneDocuments" },
        ];
        for (const { arr, label } of diverseDocsArrays) {
          if (Array.isArray(arr)) {
            for (const d of arr) {
              collectDocs.push({
                id: coalesce(d.id, d.documentId, d.fichierId, d.uid),
                date: coalesce(d.date, d.dateDepot, d.date_creation),
                titre: coalesce(d.titre, d.title, d.nom, d.libelle, d.nomDocument, "Document"),
                type: coalesce(d.type, d.categorie, "document"),
                source: label,
                raw: d,
                url: d.url,
              });
            }
          }
        }

        // c) fichiers attachés dans chaque bilan
        for (const b of bilansRaw) {
          const filesArr = coalesce(b.fichiers, b.files, b.documents, b.pieces) as AnyObj[] | undefined;
          if (Array.isArray(filesArr)) {
            for (const f of filesArr) {
              collectDocs.push({
                id: coalesce(f.id, f.documentId, f.fichierId, f.uid),
                date: coalesce(f.date, f.dateDepot, f.date_creation, b.dateCloture, b.date_cloture),
                titre: coalesce(
                  f.titre,
                  f.title,
                  f.nom,
                  f.libelle,
                  f.nomDocument,
                  "Fichier de bilan"
                ),
                type: coalesce(f.type, f.categorie, "bilan"),
                source: "bilan.fichiers",
                raw: f,
                url: f.url,
              });
            }
          }
        }

        // dédoublonner (id + titre)
        const seen = new Set<string>();
        const deduped = collectDocs.filter((d) => {
          const key = `${d.id || ""}::${d.titre || ""}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        // tri par date descendante si possible
        deduped.sort((a, b) => {
          const da = a.date ? new Date(a.date).getTime() : 0;
          const db = b.date ? new Date(b.date).getTime() : 0;
          return db - da;
        });

        setDocuments(deduped);

        // 4) Enrichir les montants avec le détail si manquants (limite de concurrence)
        const rowsNeedingDetail = (initialRows || []).filter(
          (r) =>
            r.idBilan &&
            (r.chiffre_affaires === null ||
              r.resultat_net === null ||
              r.effectif === null ||
              r.capital_social === null)
        );

        if (rowsNeedingDetail.length) {
          await mapWithConcurrency(rowsNeedingDetail, 3, async (row) => {
            if (!row.idBilan) return row;
            try {
              const resp = await inpiEntreprise.get(
                `/${siren}/comptes-annuels/${row.idBilan}`
              );
              if (cancelledRef.current) return row;
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
              // on ignore: si le détail échoue on garde l'existant
            }
            return row;
          });
        }
      } catch (e) {
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
    // priorité: actes -> endpoint acte
    if (doc.type === "acte" || (doc.raw && Array.isArray(doc.raw?.typeRdd))) {
      if (doc.id) return `${ACTE_DOWNLOAD_BASE}/api/download/acte/${doc.id}`;
    }
    // générique document
    if (doc.id) return `${ACTE_DOWNLOAD_BASE}/api/download/document/${doc.id}`;
    // url brute si présente
    if (doc.url) return doc.url;
    return undefined;
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
                  tickFormatter={(v) =>
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

      {/* Actes INPI (inchangé) */}
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
