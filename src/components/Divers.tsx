import React, { useState, useEffect } from 'react'

// Utilitaire pour tronquer du texte (pour aperçu article)
function truncate(str: string, n: number) {
  return str && str.length > n ? str.substr(0, n - 1) + "…" : str
}

// Fonction utilitaire pour extraire le code APE "propre" (juste les 5 caractères)
function extractApeCode(rawApe: string | null): string {
  if (!rawApe) return ""
  return String(rawApe).trim().split(/[ (]/)[0].toUpperCase()
}

export default function LabelsCertifications({ data }: { data: any }) {
  const labels = data.labels || []
  const divers = data.divers || []
  const siret = data.siret || data.etablissements?.[0]?.siret || null

  // Correction : on extrait le code APE brut pour le fallback, même si data.ape inclut un libellé !
  // On ajoute data.code_ape en priorité car c'est le champ issu du mapping principal
  const apeFull =
    data.code_ape ||
    data.ape ||
    data.naf ||
    data.etablissements?.[0]?.ape ||
    data.etablissements?.[0]?.naf ||
    null
  const ape = extractApeCode(apeFull)

  const [ccInfo, setCcInfo] = useState<any>(null)
  const [ccLoaded, setCcLoaded] = useState(false)
  const [apeIdccs, setApeIdccs] = useState<any[]>([])
  const [apeLoaded, setApeLoaded] = useState(false)
  const [usedApe, setUsedApe] = useState(false)

  const [idccHtml, setIdccHtml] = useState<any>(null)
  const [idccHtmlLoading, setIdccHtmlLoading] = useState(false)
  const [idccHtmlError, setIdccHtmlError] = useState<string | null>(null)
  const [idccUsed, setIdccUsed] = useState<string | null>(null)

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
        } else {
          // Toujours tenter le fallback même si erreur ou 404
          console.log("SIRET non trouvé ou erreur, on tente le fallback APE")
          fetchApeFallback()
        }
      } catch (e) {
        console.log("Erreur lors du fetch SIRET, on tente le fallback APE")
        fetchApeFallback()
      }
    }

    const fetchApeFallback = async () => {
      console.log("FETCH APE FALLBACK ape=", ape, "apeFull=", apeFull, "data.code_ape=", data.code_ape, "data.ape=", data.ape, "data.naf=", data.naf)
      if (!ape) {
        setCcLoaded(true)
        setApeLoaded(true)
        // log si jamais on entre ici
        console.warn("APE Fallback non tenté car ape est vide !", { ape, apeFull, data })
        return
      }
      setUsedApe(true)
      setApeLoaded(false)
      // Debug log pour traçage
      console.log("Fallback APE déclenché pour", ape)
      try {
        // Correction : on passe le code APE "propre"
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

    // Correction ici : nettoyer l'IDCC pour enlever les zéros initiaux
    const fetchLegifranceHtml = async (idcc: string) => {
      const idccClean = String(idcc).replace(/^0+/, '');
      if (!idccClean || !/^\d+$/.test(idccClean)) return
      setIdccHtmlLoading(true)
      setIdccHtml(null)
      setIdccHtmlError(null)
      try {
        const res = await fetch(`https://hubshare-cmexpert.fr/legifrance/convention/html/${idccClean}`)
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
  }, [siret, apeFull]) // attention ici : relancer si apeFull change

  // Affichage sommaire façon Legifrance
  function renderSommaire(articles: any[]) {
    if (!articles?.length) return null
    return (
      <nav style={{borderBottom: "1px solid #ddd", marginBottom: 24, paddingBottom: 8, fontSize: 16}}>
        <b>Sommaire : </b>
        {articles.map((a, i) => (
          <a
            key={a.id || a.num || i}
            href={`#article-${a.id || a.num || i}`}
            style={{marginRight: 16, color: "#0053b3", textDecoration: "underline"}}
          >
            {a.num ? `Article ${a.num}` : 'Article'}
          </a>
        ))}
      </nav>
    )
  }

  // Affichage article ouvert façon Legifrance
  function renderArticleLegifrance(a: any, i: number) {
    const articleId = a.id || a.num || `${i}`
    return (
      <div key={articleId}
        id={`article-${articleId}`}
        style={{
          background: "#fafafc",
          border: "1px solid #e1e1ea",
          borderRadius: 8,
          marginBottom: 32,
          padding: "18px 24px"
        }}>
        <h3 style={{fontWeight: "bold", color: "#0b2353", fontSize: 20, marginBottom: 8}}>
          {a.num ? `Article ${a.num}` : 'Article'} : {a.title || ''}
        </h3>
        <div style={{color: "#222", fontSize: 17, lineHeight: 1.7}}
             dangerouslySetInnerHTML={{ __html: a.content || a.texteHtml || "" }} />
      </div>
    )
  }

  function renderSectionsLegifrance(sections: any[]) {
    return (sections || []).map((s, i) =>
      <section key={s.id || i} className="mb-8">
        <h3 style={{
          fontWeight: "bold",
          fontSize: 18,
          marginTop: 32,
          marginBottom: 16,
          color: "#0053b3",
          borderBottom: "1px solid #e1e1ea",
          paddingBottom: 4
        }}>{s.title || ""}</h3>
        {(s.articles || []).map((a: any, idx: number) => renderArticleLegifrance(a, idx))}
        {renderSectionsLegifrance(s.sections)}
      </section>
    )
  }

  function renderAllConventionsLegifrance(convs: any[]) {
    return (convs || []).map((conv, idx) => (
      <div key={conv.id || idx} className="my-10 border-t pt-6">
        {/* Grand titre à la Legifrance */}
        <div style={{
          fontSize: 25,
          fontWeight: "bolder",
          color: "#002752",
          textAlign: "center",
          margin: "30px 0 10px 0",
          borderBottom: "4px solid #b50910",
          paddingBottom: 6
        }}>
          {conv.titre || ""}
        </div>
        {/* Intro/résumé */}
        {conv.descriptionFusionHtml && (
          <div style={{fontSize: 18, color: "#222", marginBottom: 24}}
               dangerouslySetInnerHTML={{ __html: conv.descriptionFusionHtml }} />
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
              {renderAllConventionsLegifrance(idccHtml.conventions)}
              <button
                className="mt-8 px-6 py-3 bg-green-700 text-white rounded hover:bg-green-800 text-lg font-semibold shadow"
                onClick={() => idccUsed && window.open(`https://hubshare-cmexpert.fr/legifrance/convention/html/${String(idccUsed).replace(/^0+/, '')}/pdf`, '_blank')}
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
