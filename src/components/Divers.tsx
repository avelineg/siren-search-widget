import React, { useState, useEffect } from 'react'

export default function LabelsCertifications({ data }: { data: any }) {
  const labels = data.labels || []
  const divers = data.divers || []
  const siret = data.siret || data.etablissements?.[0]?.siret || null

  const [ccInfo, setCcInfo] = useState<any>(null)
  const [ccLoaded, setCcLoaded] = useState(false)
  const [legiInfo, setLegiInfo] = useState<any>(null)
  const [legiLoaded, setLegiLoaded] = useState(false)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [legiRaw, setLegiRaw] = useState<any>(null)
  const [pdfError, setPdfError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false
    setCcInfo(null)
    setCcLoaded(false)
    setLegiInfo(null)
    setLegiLoaded(false)
    setPdfUrl(null)
    setLegiRaw(null)
    setPdfError(null)

    if (!siret) {
      setCcLoaded(true)
      setLegiLoaded(true)
      return
    }

    const siretKey = String(siret).padStart(14, '0')
    fetch(`https://siret-cc-backend.onrender.com/api/convention?siret=${siretKey}`)
      .then(async res => {
        if (!res.ok) throw new Error('Convention non trouvée')
        const cc = await res.json()
        if (cancelled) return
        setCcInfo(cc)
        setCcLoaded(true)

        if (cc.IDCC) {
          fetch(`https://hubshare-cmexpert.fr/legifrance/convention/by-idcc/${cc.IDCC}`)
            .then(async res2 => {
              if (!res2.ok) throw new Error('Legifrance non trouvé')
              const results = await res2.json()
              const convention = Array.isArray(results) && results.length > 0 ? results[0] : null
              setLegiInfo(convention || null)
              setLegiRaw(results)
              setLegiLoaded(true)

              if (convention && convention.id && (convention.pdfFilePath || convention.pdfFileName)) {
                setPdfUrl(`https://hubshare-cmexpert.fr/legifrance/convention/${convention.id}/pdf`)
              } else {
                setPdfUrl(null)
              }
            })
            .catch(() => {
              setLegiInfo(null)
              setLegiRaw(null)
              setLegiLoaded(true)
              setPdfUrl(null)
            })
        } else {
          setLegiLoaded(true)
          setPdfUrl(null)
        }
      })
      .catch(() => {
        setCcLoaded(true)
        setLegiLoaded(true)
        setPdfUrl(null)
        setLegiRaw(null)
      })

    return () => { cancelled = true }
  }, [siret])

  // Pour le téléchargement, on tente d'ouvrir le PDF, et on gère l'erreur si le backend renvoie une erreur JSON
  const handleDownloadPdf = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!pdfUrl) return;
    e.preventDefault();
    setPdfError(null);
    try {
      const res = await fetch(pdfUrl)
      if (res.ok && res.headers.get('content-type') === 'application/pdf') {
        // Téléchargement direct si c'est un PDF
        window.open(pdfUrl, '_blank');
      } else {
        const json = await res.json().catch(() => ({}));
        setPdfError(json?.error || "PDF non disponible pour cette convention collective.");
      }
    } catch (err) {
      setPdfError("Erreur lors du téléchargement du PDF.");
    }
  };

  // Affichage JSON formaté
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
        {(!ccLoaded || !legiLoaded) && <p>Chargement...</p>}
        {ccLoaded && ccInfo && (
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
        {ccLoaded && !ccInfo && (
          <p className="text-gray-600">
            Aucune information sur la convention collective n’est disponible pour cet établissement.
          </p>
        )}
        {legiLoaded && legiInfo && (
          <>
            <p><b>Libellé</b>&nbsp;: {legiInfo.titre || legiInfo.libelle || "Non disponible"}</p>
            <p><b>Identifiant Légifrance</b> : {legiInfo.id || "Non disponible"}</p>
            {pdfUrl ? (
              <>
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-2 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                  download
                  onClick={handleDownloadPdf}
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
              {renderJson(legiRaw)}
            </details>
          </>
        )}
      </div>
    </div>
  )
}
