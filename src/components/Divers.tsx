import React, { useState, useEffect } from 'react'

export default function LabelsCertifications({ data }: { data: any }) {
  const labels = data.labels || []
  const divers = data.divers || []
  const siret = data.siret || data.etablissements?.[0]?.siret || null
  const ape = data.ape || data.naf || data.etablissements?.[0]?.ape || data.etablissements?.[0]?.naf || null

  // Convention collective via SIRET ou APE
  const [ccInfo, setCcInfo] = useState<any>(null)
  const [ccLoaded, setCcLoaded] = useState(false)
  const [apeIdccs, setApeIdccs] = useState<any[]>([])
  const [apeLoaded, setApeLoaded] = useState(false)
  const [usedApe, setUsedApe] = useState(false)

  // Pour l'affichage enrichi Légifrance
  const [idccHtml, setIdccHtml] = useState<any>(null)
  const [idccHtmlLoading, setIdccHtmlLoading] = useState(false)
  const [idccHtmlError, setIdccHtmlError] = useState<string | null>(null)
  const [idccUsed, setIdccUsed] = useState<string | null>(null)

  // Fallback SIRET → APE
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
          // Fallback APE si pas de correspondance SIRET
          fetchApeFallback()
        }
      } catch (e) {
        fetchApeFallback()
      }
    }

    // Fallback APE si SIRET KO
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
        // Prend le 1er IDCC trouvé (le plus probable) pour la suite Légifrance
        const firstIdcc = idccList.find((row: any) => /^\d+$/.test(row['Code IDCC']))?.['Code IDCC']
        if (firstIdcc) {
          setIdccUsed(firstIdcc)
          fetchLegifranceHtml(firstIdcc)
        }
      } catch (e) {
        setApeLoaded(true)
      }
    }

    // Récupération Légifrance enrichie (tous les articles de toutes les conventions de l'IDCC)
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

  // Affiche tous les articles de toutes les conventions trouvées
  function renderArticles(articles: any[]) {
    return (articles || []).map((a, i) =>
      <article key={a.id || a.num || i} className="mb-4">
        <h4 className="font-semibold mt-4 text-indigo-700">{a.num ? `Article ${a.num}` : ''} {a.title || ''}</h4>
        <div dangerouslySetInnerHTML={{ __html: a.content || a.texteHtml || "" }} />
      </article>
    )
  }

  function renderSections(sections: any[]) {
    return (sections || []).map((s, i) =>
      <section key={s.id || i} className="mb-6">
        <h3 className="font-bold text-lg mt-6">{s.title || ""}</h3>
        {renderArticles(s.articles)}
        {renderSections(s.sections)}
      </section>
    )
  }

  function renderAllConventions(convs: any[]) {
    return (convs || []).map((conv, idx) => (
      <div key={conv.id || idx} className="my-6 border-t pt-3">
        <h3 className="text-lg font-bold mb-2">{conv.titre || ""}</h3>
        {conv.descriptionFusionHtml && (
          <div className="mb-2" dangerouslySetInnerHTML={{ __html: conv.descriptionFusionHtml }} />
        )}
        {/* Articles à plat (même hors sections) */}
        {renderArticles(conv.articles)}
        {/* Sections (récursif, avec sous-articles si présents) */}
        {renderSections(conv.sections)}
      </div>
    ))
  }

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded shadow">
        <h3 className="font-semibold mb-2">Labels & certifications</h3>
        {labels.map((l: any, i: number) => (
          <p key={i}>{l}</p>
        ))}
        {labels.length === 0 && <p>Aucun label.</p>}
      </div>
      <div className="bg-white p-4 rounded shadow">
        <h3 className="font-semibold mb-2">Divers</h3>
        {divers.map((d: any, i: number) => (
          <p key={i}>{d}</p>
        ))}
        {divers.length === 0 && <p>Rien à afficher.</p>}
      </div>
      <div className="bg-white p-4 rounded shadow">
        <h3 className="font-semibold mb-2">Convention collective</h3>
        {(!ccLoaded && !apeLoaded) && <p>Chargement...</p>}
        {/* SIRET trouvé */}
        {ccLoaded && ccInfo && ccInfo.IDCC && (
          <>
            <p><b>IDCC&nbsp;:</b> {ccInfo.IDCC}</p>
            <p><b>Mois référence&nbsp;:</b> {ccInfo.MOIS}</p>
            <p><b>Date MAJ&nbsp;:</b> {ccInfo.DATE_MAJ}</p>
            <details className="my-2">
              <summary className="cursor-pointer">Voir le JSON SIRET-CC</summary>
              <pre className="bg-gray-100 text-xs rounded p-2 overflow-auto">{JSON.stringify(ccInfo, null, 2)}</pre>
            </details>
          </>
        )}
        {/* Fallback par APE */}
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
            <details className="my-2">
              <summary className="cursor-pointer">Voir tous les résultats bruts APE→IDCC</summary>
              <pre className="bg-gray-100 text-xs rounded p-2 overflow-auto">{JSON.stringify(apeIdccs, null, 2)}</pre>
            </details>
          </div>
        )}

        {(ccLoaded && !ccInfo && apeLoaded && !apeIdccs.length) && (
          <p className="text-gray-600">
            Aucune information sur la convention collective n’est disponible pour cet établissement (ni via SIRET, ni via APE).
          </p>
        )}

        {/* Détail complet Légifrance */}
        <div className="my-4 border-t pt-3">
          <h4 className="font-semibold text-indigo-900 mb-2">Détail complet de la convention collective (Légifrance)</h4>
          {idccHtmlLoading && <p>Chargement du contenu détaillé...</p>}
          {idccHtmlError && <p className="text-red-700">{idccHtmlError}</p>}
          {idccHtml && idccHtml.conventions && idccHtml.conventions.length > 0 && (
            <>
              {renderAllConventions(idccHtml.conventions)}
              {/* PDF bouton - désactive si erreur PDF côté backend */}
              <button
                className="mt-4 px-4 py-2 bg-green-700 text-white rounded hover:bg-green-800"
                onClick={() => idccUsed && window.open(`https://hubshare-cmexpert.fr/legifrance/convention/html/${idccUsed}/pdf`, '_blank')}
              >
                Télécharger ce détail au format PDF (mise en page lisible)
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
