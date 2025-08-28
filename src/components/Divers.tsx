import React, { useEffect, useState } from 'react'

/* ========================
   Utilitaires
======================== */
function truncate(str: string, n: number) {
  return str && str.length > n ? str.substr(0, n - 1) + '…' : str
}
function extractApeCode(rawApe: string | null): string {
  if (!rawApe) return ''
  return String(rawApe).trim().split(/[ (]/)[0].toUpperCase()
}

/** ======================================================
 *  BASE BACKEND
 *  - priorité à VITE_API_URL (build-time)
 *  - fallback runtime : si on est sur onrender.com, utiliser ton domaine
 *  - sinon chemins relatifs (même origine)
 *  ====================================================== */
const ENV_BASE = (((import.meta as any) ?? {}).env?.VITE_API_URL as string | undefined) || ''
const RUNTIME_FALLBACK =
  typeof window !== 'undefined' &&
  /siren-search-widget\.onrender\.com$/i.test(window.location.hostname)
    ? 'https://hubshare-cmexpert.fr'
    : ''
const BACKEND_BASE = (ENV_BASE || RUNTIME_FALLBACK).replace(/\/+$/, '')
if (typeof window !== 'undefined') {
  console.info('[CC] BACKEND_BASE =', BACKEND_BASE || '(même origine)')
}

/* ========================
   Types
======================== */
type IdccItem = {
  siret: string
  idcc: string
  libelle?: string | null
  periode?: string | null
  source?: string | null
  source_updated_at?: string | null
}
type IdccResponse = {
  siret: string
  count: number
  items: IdccItem[]
}

/* ========================
   Composant principal
======================== */
export default function LabelsCertifications({ data }: { data: any }) {
  const labels = data.labels || []
  const divers = data.divers || []

  const siret = data.siret || data.etablissements?.[0]?.siret || null

  // Conserve ce que tu utilises ailleurs
  const apeFull =
    data.code_ape ||
    data.ape ||
    data.naf ||
    data.etablissements?.[0]?.ape ||
    data.etablissements?.[0]?.naf ||
    null
  const ape = extractApeCode(apeFull)

  // Etats IDCC (via API tabulaire)
  const [idccApi, setIdccApi] = useState<IdccResponse | null>(null)
  const [idccApiLoaded, setIdccApiLoaded] = useState(false)
  const [idccApiError, setIdccApiError] = useState<string | null>(null)

  // Etats Légifrance (détail affichage)
  const [idccUsed, setIdccUsed] = useState<string | null>(null)
  const [idccHtml, setIdccHtml] = useState<any>(null)
  const [idccHtmlLoading, setIdccHtmlLoading] = useState(false)
  const [idccHtmlError, setIdccHtmlError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setIdccApi(null)
    setIdccApiLoaded(false)
    setIdccApiError(null)
    setIdccUsed(null)
    setIdccHtml(null)
    setIdccHtmlError(null)
    setIdccHtmlLoading(false)

    const fetchIdccBySiret = async () => {
      if (!siret) {
        setIdccApiLoaded(true)
        return
      }
      const siretKey = String(siret).padStart(14, '0')
      const url = `${BACKEND_BASE}/api/idcc/${encodeURIComponent(siretKey)}`
      try {
        const res = await fetch(url)
        if (!res.ok) {
          setIdccApiLoaded(true)
          setIdccApiError(`HTTP ${res.status} sur ${url}`)
          return
        }
        const json: IdccResponse = await res.json()
        if (cancelled) return
        setIdccApi(json)
        setIdccApiLoaded(true)

        const idcc = json?.items?.[0]?.idcc
        if (idcc) {
          setIdccUsed(String(idcc))
          fetchLegifranceHtml(String(idcc))
        }
      } catch (e: any) {
        setIdccApiLoaded(true)
        setIdccApiError(e?.message || 'Erreur réseau')
      }
    }

    const fetchLegifranceHtml = async (idcc: string) => {
      const idccClean = String(idcc).replace(/^0+/, '')
      if (!/^\d+$/.test(idccClean)) return
      const url = `${BACKEND_BASE}/legifrance/convention/html/${idccClean}`
      setIdccHtmlLoading(true)
      setIdccHtml(null)
      setIdccHtmlError(null)
      try {
        const res = await fetch(url)
        if (!res.ok) throw new Error(`HTTP ${res.status} sur ${url}`)
        const d = await res.json()
        if (cancelled) return
        setIdccHtml(d)
        setIdccHtmlLoading(false)
      } catch (e: any) {
        setIdccHtmlError(e?.message || 'Erreur lors de la récupération du détail Légifrance')
        setIdccHtmlLoading(false)
        setIdccHtml(null)
      }
    }

    fetchIdccBySiret()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siret])

  /* ========================
     Rendus Légifrance
  ======================== */
  function renderSommaire(articles: any[]) {
    if (!articles?.length) return null
    return (
      <nav style={{ borderBottom: '1px solid #ddd', marginBottom: 24, paddingBottom: 8, fontSize: 16 }}>
        <b>Sommaire : </b>
        {articles.map((a, i) => (
          <a
            key={a.id || a.num || i}
            href={`#article-${a.id || a.num || i}`}
            style={{ marginRight: 16, color: '#0053b3', textDecoration: 'underline' }}
          >
            {a.num ? `Article ${a.num}` : 'Article'}
          </a>
        ))}
      </nav>
    )
  }

  function renderArticleLegifrance(a: any, i: number) {
    const articleId = a.id || a.num || `${i}`
    return (
      <div
        key={articleId}
        id={`article-${articleId}`}
        style={{
          background: '#fafafc',
          border: '1px solid #e1e1ea',
          borderRadius: 8,
          marginBottom: 32,
          padding: '18px 24px',
        }}
      >
        <h3 style={{ fontWeight: 'bold', color: '#0b2353', fontSize: 20, marginBottom: 8 }}>
          {a.num ? `Article ${a.num}` : 'Article'} : {a.title || ''}
        </h3>
        <div
          style={{ color: '#222', fontSize: 17, lineHeight: 1.7 }}
          dangerouslySetInnerHTML={{ __html: a.content || a.texteHtml || '' }}
        />
      </div>
    )
  }

  function renderSectionsLegifrance(sections: any[]) {
    return (sections || []).map((s, i) => (
      <section key={s.id || i} className="mb-8">
        <h3
          style={{
            fontWeight: 'bold',
            fontSize: 18,
            marginTop: 32,
            marginBottom: 16,
            color: '#0053b3',
            borderBottom: '1px solid #e1e1ea',
            paddingBottom: 4,
          }}
        >
          {s.title || ''}
        </h3>
        {(s.articles || []).map((a: any, idx: number) => renderArticleLegifrance(a, idx))}
        {renderSectionsLegifrance(s.sections)}
      </section>
    ))
  }

  function renderAllConventionsLegifrance(convs: any[]) {
    return (convs || []).map((conv, idx) => (
      <div key={conv.id || idx} className="my-10 border-t pt-6">
        {/* Grand titre à la Legifrance */}
        <div
          style={{
            fontSize: 25,
            fontWeight: 'bolder',
            color: '#002752',
            textAlign: 'center',
            margin: '30px 0 10px 0',
            borderBottom: '4px solid #b50910',
            paddingBottom: 6,
          }}
        >
          {conv.titre || ''}
        </div>

        {/* Intro/résumé */}
        {conv.descriptionFusionHtml && (
          <div
            style={{ fontSize: 18, color: '#222', marginBottom: 24 }}
            dangerouslySetInnerHTML={{ __html: conv.descriptionFusionHtml }}
          />
        )}

        {/* Sommaire */}
        {renderSommaire(conv.articles)}

        {/* Articles ouverts */}
        {(conv.articles || []).map((a: any, i: number) => renderArticleLegifrance(a, i))}

        {/* Sections éventuelles */}
        {renderSectionsLegifrance(conv.sections)}
      </div>
    ))
  }

  /* ========================
     Données d'en-tête
  ======================== */
  const conventionName =
    idccHtml?.conventions?.[0]?.titre || idccApi?.items?.[0]?.libelle || ''

  const meta = idccApi?.items?.[0]
  const moisRef = meta?.periode || undefined
  const majSource = meta?.source_updated_at || undefined

  /* ========================
     Rendu
  ======================== */
  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded shadow">
        <h3 className="font-semibold mb-2 text-indigo-900">Labels & certifications</h3>
        {labels.map((l: any, i: number) => (
          <p key={i}>{l}</p>
        ))}
        {labels.length === 0 && <p>Aucun label.</p>}
      </div>

      <div className="bg-white p-4 rounded shadow">
        <h3 className="font-semibold mb-2 text-indigo-900">Divers</h3>
        {divers.map((d: any, i: number) => (
          <p key={i}>{d}</p>
        ))}
        {divers.length === 0 && <p>Rien à afficher.</p>}
      </div>

      <div className="bg-white p-6 rounded shadow border border-indigo-100">
        <h3 className="font-bold text-2xl mb-4 text-indigo-900 border-b-2 border-indigo-200 pb-2 flex items-center">
          Convention collective&nbsp;
          {conventionName && <span className="text-indigo-700 ml-1">« {conventionName} »</span>}
        </h3>

        {!idccApiLoaded && <p>Chargement…</p>}
        {idccApiError && (
          <p className="text-red-700 mb-2">
            Erreur lors de la récupération de l’IDCC : {idccApiError}
          </p>
        )}

        {idccApiLoaded && idccApi && idccApi.count > 0 && (
          <div className="mb-4 text-base">
            <span className="inline-block mr-4 font-semibold text-gray-900">
              IDCC&nbsp;:{' '}
              <span className="font-bold">{idccApi.items[0].idcc}</span>
              {idccApi.items[0].libelle ? (
                <span className="ml-1 text-gray-700">({idccApi.items[0].libelle})</span>
              ) : null}
            </span>
            {moisRef && (
              <span className="inline-block mr-4 text-gray-700">
                Mois référence&nbsp;: <span className="font-bold">{moisRef}</span>
              </span>
            )}
            {majSource && (
              <span className="inline-block text-gray-700">
                Date MAJ (source)&nbsp;:{' '}
                <span className="font-bold">
                  {new Date(majSource).toLocaleDateString('fr-FR')}
                </span>
              </span>
            )}
          </div>
        )}

        {idccApiLoaded && (!idccApi || idccApi.count === 0) && !idccApiError && (
          <p className="text-gray-600">
            Aucune information sur la convention collective n’est disponible pour cet établissement.
          </p>
        )}

        <div className="my-10">
          {idccHtmlLoading && <p>Chargement du contenu détaillé…</p>}
          {idccHtmlError && <p className="text-red-700">{idccHtmlError}</p>}
          {idccHtml?.conventions?.length > 0 && (
            <>
              {renderAllConventionsLegifrance(idccHtml.conventions)}
              <button
                className="mt-8 px-6 py-3 bg-green-700 text-white rounded hover:bg-green-800 text-lg font-semibold shadow"
                onClick={() =>
                  idccUsed &&
                  window.open(
                    `${BACKEND_BASE}/legifrance/convention/html/${String(idccUsed).replace(/^0+/, '')}/pdf`,
                    '_blank'
                  )
                }
              >
                Télécharger ce détail au format PDF
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
