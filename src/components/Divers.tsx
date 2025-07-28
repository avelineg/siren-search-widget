import React, { useState, useEffect } from 'react'

// Utilitaire pour tronquer le texte (extrait d'article)
function truncate(str: string, n: number) {
  return str && str.length > n ? str.substr(0, n - 1) + "…" : str
}

export default function LabelsCertifications({ data }: { data: any }) {
  const labels = data.labels || []
  const divers = data.divers || []
  const siret = data.siret || data.etablissements?.[0]?.siret || null
  const ape = data.ape || data.naf || data.etablissements?.[0]?.ape || data.etablissements?.[0]?.naf || null

  const [ccInfo, setCcInfo] = useState<any>(null)
  const [ccLoaded, setCcLoaded] = useState(false)
  const [apeIdccs, setApeIdccs] = useState<any[]>([])
  const [apeLoaded, setApeLoaded] = useState(false)
  const [usedApe, setUsedApe] = useState(false)

  const [idccHtml, setIdccHtml] = useState<any>(null)
  const [idccHtmlLoading, setIdccHtmlLoading] = useState(false)
  const [idccHtmlError, setIdccHtmlError] = useState<string | null>(null)
  const [idccUsed, setIdccUsed] = useState<string | null>(null)

  // Pour le pli/dépli des articles
  const [openArticleIds, setOpenArticleIds] = useState<Record<string, boolean>>({})

  useEffect(() => {
    let cancelled = false
    setCcInfo(null)
    setCcLoaded(false)
    setApeIdccs([])
    setApeLoaded(false)
    setUsedApe(false)
    setIdccHtml(null)
    setIdccHtmlError(null)
    setIdccHtmlLoading(false)
    setIdccUsed(null)
    setOpenArticleIds({})

    // On essaye d'abord SIRET
    const fetchSiret = async () => {
      if (!siret) {
        fetchApeFallback()
        return
      }
      const siretKey = String(siret).padStart(14, '0')
      try {
        const res = await fetch(`https://siret-cc-backend.onrender.com/api/convention?siret=${siretKey}`)
        if (res.ok) {
          const cc = await res.json()
          if (cancelled) return
          setCcInfo(cc)
          setCcLoaded(true)
          if (cc.IDCC) {
            setIdccUsed(cc.IDCC)
            fetchLegifranceHtml(cc.IDCC)
          }
        } else if (res.status === 404) {
          fetchApeFallback()
        }
      } catch (e) {
        fetchApeFallback()
      }
    }

    const fetchApeFallback = async () => {
      if (!ape) {
        setCcLoaded(true)
        setApeLoaded(true)
        return
      }
      setUsedApe(true)
      setApeLoaded(false)
      try {
        const res = await fetch(`https://siret-cc-backend.onrender.com/api/convention/by-ape?ape=${ape}`)
        if (!res.ok) {
          setApeLoaded(true)
          return
        }
        const idccList = await res.json()
        if (cancelled) return
        setApeIdccs(idccList)
        setApeLoaded(true)
        const firstIdcc = idccList.find((row: any) => /^\d+$/.test(row['Code IDCC']))?.['Code IDCC']
        if (firstIdcc) {
          setIdccUsed(firstIdcc)
          fetchLegifranceHtml(firstIdcc)
        }
      } catch (e) {
        setApeLoaded(true)
      }
    }

    const fetchLegifranceHtml = async (idcc: string) => {
      if (!idcc || !/^\d+$/.test(idcc)) return
      setIdccHtmlLoading(true)
      setIdccHtml(null)
      setIdccHtmlError(null)
      try {
        const res = await fetch(`https://hubshare-cmexpert.fr/legifrance/convention/html/${idcc}`)
        if (!res.ok) throw new Error('Erreur lors de la récupération du détail Légifrance')
        const data = await res.json()
        if (cancelled) return
        setIdccHtml(data)
        setIdccHtmlLoading(false)
      } catch (e: any) {
        setIdccHtmlError(e.message || "Erreur lors de la récupération du détail Légifrance")
        setIdccHtmlLoading(false)
        setIdccHtml(null)
      }
    }

    fetchSiret()
    return () => { cancelled = true }
    // eslint-disable-next-line
  }, [siret, ape])

  // Pour plier/déplier un article par id (clé unique)
  const handleToggleArticle = (id: string) => {
    setOpenArticleIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  // Affichage d'un article façon Legifrance
  function renderArticle(a: any, i: number) {
    const articleId = a.id || a.num || `${i}`
    const isOpen = !!openArticleIds[articleId]
    return (
      <div key={articleId} className="rounded border border-gray-300 bg-white mb-4 shadow-sm">
        <div
          className="cursor-pointer flex items-center px-4 py-3 hover:bg-indigo-50 transition"
          onClick={() => handleToggleArticle(articleId)}
        >
          <span className="text-indigo-900 font-bold mr-4" style={{ minWidth: 85 }}>
            {a.num ? `Article ${a.num}` : 'Article'}
          </span>
          <span className="font-semibold text-base text-gray-900 flex-1">{a.title || ''}</span>
          <span className="ml-2 text-gray-400">{isOpen ? "▲" : "▼"}</span>
        </div>
        {isOpen ? (
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 text-justify" style={{ lineHeight: 1.75 }}>
            <div dangerouslySetInnerHTML={{ __html: a.content || a.texteHtml || "" }} />
          </div>
        ) : (
          <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 text-gray-700 text-sm italic">
            {truncate(a.content || a.texteHtml || '', 230)}
          </div>
        )}
      </div>
    )
  }

  function renderArticles(articles: any[]) {
    return (articles || []).map((a, i) => renderArticle(a, i))
  }

  function renderSections(sections: any[]) {
    return (sections || []).map((s, i) =>
      <section key={s.id || i} className="mb-8">
        <h3 className="font-bold text-xl mt-8 mb-3 text-indigo-800 border-b border-indigo-300 pb-1">{s.title || ""}</h3>
        {renderArticles(s.articles)}
        {renderSections(s.sections)}
      </section>
    )
  }

  function renderAllConventions(convs: any[]) {
    return (convs || []).map((conv, idx) => (
      <div key={conv.id || idx} className="my-10 border-t pt-6">
        <h2 className="text-3xl font-black mb-2 text-indigo-900 uppercase tracking-tight">{conv.titre || ""}</h2>
        {conv.descriptionFusionHtml && (
          <div className="mb-3 text-indigo-900" dangerouslySetInnerHTML={{ __html: conv.descriptionFusionHtml }} />
        )}
        {renderArticles(conv.articles)}
        {renderSections(conv.sections)}
      </div>
    ))
  }

  // Nom de la convention collective (affichage dans l'en-tête)
  const conventionName =
    idccHtml && idccHtml.conventions && idccHtml.conventions.length > 0
      ? idccHtml.conventions[0].titre
      : ""

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
          {conventionName && <span className="text-indigo-700 ml-1">« {conventionName} »</span>}
        </h3>
        {(!ccLoaded && !apeLoaded) && <p>Chargement...</p>}
        {ccLoaded && ccInfo && ccInfo.IDCC && (
          <div className="mb-4 text-base">
            <span className="inline-block mr-4 font-semibold text-gray-900">IDCC&nbsp;: <span className="font-bold">{ccInfo.IDCC}</span></span>
            <span className="inline-block mr-4 text-gray-700">Mois référence&nbsp;: <span className="font-bold">{ccInfo.MOIS}</span></span>
            <span className="inline-block text-gray-700">Date MAJ&nbsp;: <span className="font-bold">{ccInfo.DATE_MAJ}</span></span>
          </div>
        )}
        {usedApe && apeLoaded && apeIdccs.length > 0 && (
          <div className="my-2">
            <p className="text-yellow-700 font-semibold">
              Aucun IDCC trouvé par SIRET, correspondance indicative calculée à partir du code APE&nbsp;
              <span className="font-bold">{ape}</span> :
            </p>
            {apeIdccs
              .filter(r => /^\d+$/.test(r['Code IDCC']))
              .map((row, i) => (
                <div key={row['Code IDCC'] + '-' + i} className="mb-1">
                  <b>IDCC proposé :</b> {row['Code IDCC']} {row["Intitul‚ du code IDCC"] && <span>({row["Intitul‚ du code IDCC"]})</span>}
                </div>
              ))}
          </div>
        )}
        {(ccLoaded && !ccInfo && apeLoaded && !apeIdccs.length) && (
          <p className="text-gray-600">
            Aucune information sur la convention collective n’est disponible pour cet établissement (ni via SIRET, ni via APE).
          </p>
        )}

        <div className="my-10">
          {idccHtmlLoading && <p>Chargement du contenu détaillé...</p>}
          {idccHtmlError && <p className="text-red-700">{idccHtmlError}</p>}
          {idccHtml && idccHtml.conventions && idccHtml.conventions.length > 0 && (
            <>
              {renderAllConventions(idccHtml.conventions)}
              <button
                className="mt-8 px-6 py-3 bg-green-700 text-white rounded hover:bg-green-800 text-lg font-semibold shadow"
                onClick={() => idccUsed && window.open(`https://hubshare-cmexpert.fr/legifrance/convention/html/${idccUsed}/pdf`, '_blank')}
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
