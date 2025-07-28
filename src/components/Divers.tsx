import React, { useState, useEffect } from 'react'

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

  const [legiInfos, setLegiInfos] = useState<any[]>([])
  const [legiLoaded, setLegiLoaded] = useState(false)
  const [pdfUrls, setPdfUrls] = useState<any[]>([])
  const [legiRaws, setLegiRaws] = useState<any[]>([])
  const [pdfError, setPdfError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setCcInfo(null)
    setCcLoaded(false)
    setApeIdccs([])
    setApeLoaded(false)
    setUsedApe(false)
    setLegiInfos([])
    setLegiLoaded(false)
    setPdfUrls([])
    setLegiRaws([])
    setPdfError(null)

    const fetchApe = async (apeCode: string) => {
      setUsedApe(true)
      setApeLoaded(false)
      try {
        const res = await fetch(`https://siret-cc-backend.onrender.com/api/convention/by-ape?ape=${apeCode}`)
        if (!res.ok) throw new Error('APE → IDCC non trouvé')
        const idccList = await res.json()
        if (cancelled) return
        setApeIdccs(idccList)
        setApeLoaded(true)
        // Pour chaque IDCC trouvé, fetch legifrance
        fetchLegifranceForIdccs(idccList.map(i => i['Code IDCC']))
      } catch (e) {
        setApeIdccs([])
        setApeLoaded(true)
        setLegiLoaded(true)
      }
    }

    const fetchLegifranceForIdccs = (idccs: string[]) => {
      setLegiLoaded(false)
      setLegiInfos([])
      setPdfUrls([])
      setLegiRaws([])
      Promise.all(idccs.map(async idcc => {
        if (!/^\d+$/.test(idcc)) return null // ignore "Autre" ou code texte
        try {
          const res = await fetch(`https://hubshare-cmexpert.fr/legifrance/convention/by-idcc/${idcc}`)
          if (!res.ok) return null
          const results = await res.json()
          const convention = Array.isArray(results) && results.length > 0 ? results[0] : null
          if (!convention) return null
          return {
            legiInfo: convention,
            legiRaw: results,
            pdfUrl: (convention.id && (convention.pdfFilePath || convention.pdfFileName))
              ? `https://hubshare-cmexpert.fr/legifrance/convention/${convention.id}/pdf`
              : null,
            idcc
          }
        } catch (e) { return null }
      })).then(legiResults => {
        if (cancelled) return
        setLegiInfos(legiResults.filter(Boolean).map(r => r.legiInfo))
        setPdfUrls(legiResults.filter(Boolean).map(r => r.pdfUrl))
        setLegiRaws(legiResults.filter(Boolean).map(r => r.legiRaw))
        setLegiLoaded(true)
      })
    }

    // Nouvelle logique : d'abord essayer le SIRET, puis fallback APE si 404
    const fetchSiretOrApe = async () => {
      if (siret) {
        const siretKey = String(siret).padStart(14, '0')
        try {
          const res = await fetch(`https://siret-cc-backend.onrender.com/api/convention?siret=${siretKey}`)
          if (res.ok) {
            const cc = await res.json()
            if (cancelled) return
            setCcInfo(cc)
            setCcLoaded(true)
            if (cc.IDCC) {
              fetchLegifranceForIdccs([cc.IDCC])
            } else if (ape) {
              fetchApe(ape)
            } else {
              setLegiLoaded(true)
            }
          } else if (res.status === 404 && ape) {
            setCcLoaded(true)
            fetchApe(ape)
          } else {
            setCcLoaded(true)
            setLegiLoaded(true)
          }
        } catch (err) {
          setCcLoaded(true)
          if (ape) fetchApe(ape)
          else setLegiLoaded(true)
        }
      } else if (ape) {
        fetchApe(ape)
      } else {
        setCcLoaded(true)
        setApeLoaded(true)
        setLegiLoaded(true)
      }
    }

    fetchSiretOrApe()

    return () => { cancelled = true }
  }, [siret, ape])

  // Téléchargement PDF, gère plusieurs conventions si besoin
  const handleDownloadPdf = async (e: React.MouseEvent<HTMLAnchorElement>, pdfUrl: string) => {
    if (!pdfUrl) return;
    e.preventDefault();
    setPdfError(null);
    try {
      const res = await fetch(pdfUrl)
      if (res.ok && res.headers.get('content-type') === 'application/pdf') {
        window.open(pdfUrl, '_blank');
      } else {
        const json = await res.json().catch(() => ({}));
        setPdfError(json?.error || "PDF non disponible pour cette convention collective.");
      }
    } catch (err) {
      setPdfError("Erreur lors du téléchargement du PDF.");
    }
  };

  const renderJson = (obj: any) =>
    <pre className="bg-gray-100 text-xs rounded p-2 overflow-auto">{JSON.stringify(obj, null, 2)}</pre>

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
        {(!ccLoaded && !apeLoaded) || !legiLoaded ? <p>Chargement...</p> : null}

        {/* SIRET trouvé */}
        {ccLoaded && ccInfo && ccInfo.IDCC && (
          <>
            <p><b>IDCC&nbsp;:</b> {ccInfo.IDCC}</p>
            <p><b>Mois référence&nbsp;:</b> {ccInfo.MOIS}</p>
            <p><b>Date MAJ&nbsp;:</b> {ccInfo.DATE_MAJ}</p>
            <details className="my-2">
              <summary className="cursor-pointer">Voir le JSON SIRET-CC</summary>
              {renderJson(ccInfo)}
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
              .filter(r => /^\d+$/.test(r['Code IDCC'])) // ne garde que les vrais codes IDCC
              .map((row, i) => (
                <div key={row['Code IDCC'] + '-' + i} className="mb-1">
                  <b>IDCC proposé :</b> {row['Code IDCC']} {row["Intitul‚ du code IDCC"] && <span>({row["Intitul‚ du code IDCC"]})</span>}
                </div>
              ))}
            <details className="my-2">
              <summary className="cursor-pointer">Voir tous les résultats bruts APE→IDCC</summary>
              {renderJson(apeIdccs)}
            </details>
          </div>
        )}

        {(ccLoaded && !ccInfo && apeLoaded && !apeIdccs.length) && (
          <p className="text-gray-600">
            Aucune information sur la convention collective n’est disponible pour cet établissement (ni via SIRET, ni via APE).
          </p>
        )}

        {/* Affichage conventions Legifrance (une ou plusieurs si multi-IDCC APE) */}
        {legiLoaded && legiInfos.length > 0 && legiInfos.map((legiInfo, idx) => (
          <div key={legiInfo.id || idx} className="my-4 border-t pt-3">
            <p><b>Libellé</b>&nbsp;: {legiInfo.titre || legiInfo.libelle || "Non disponible"}</p>
            <p><b>Identifiant Légifrance</b> : {legiInfo.id || "Non disponible"}</p>
            {pdfUrls[idx] ? (
              <>
                <a
                  href={pdfUrls[idx]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-2 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                  download
                  onClick={e => handleDownloadPdf(e, pdfUrls[idx])}
                >
                  Télécharger la convention collective au format PDF
                </a>
                {pdfError && (
                  <p className="text-red-600 italic">{pdfError}</p>
                )}
              </>
            ) : (
              <>
                <p className="text-gray-500 italic">PDF non disponible</p>
                {legiInfo?.id && (
                  <a
                    href={`https://www.legifrance.gouv.fr/conv_coll/id/${legiInfo.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-2 px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                  >
                    Consulter ou télécharger manuellement sur Légifrance
                  </a>
                )}
              </>
            )}
            <details className="my-2">
              <summary className="cursor-pointer">Voir le JSON Légifrance (détail)</summary>
              {renderJson(legiInfo)}
            </details>
            <details className="my-2">
              <summary className="cursor-pointer">Voir la réponse brute Légifrance (tableau)</summary>
              {renderJson(legiRaws[idx])}
            </details>
          </div>
        ))}
      </div>
    </div>
  )
}
