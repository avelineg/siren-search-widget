import React, { useState, useEffect } from 'react'

interface ConventionCollective {
  idcc: string
  titre: string
  idKali: string
}

export default function LabelsCertifications({ data }: { data: any }) {
  const labels = data.labels || []
  const divers = data.divers || []

  // DEBUG : log complet de data pour comprendre la structure réelle
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log("Divers.tsx - data prop:", data)
  }, [data])

  // DEBUG : log les chemins potentiels pour l'idcc
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log("Divers.tsx - essais idcc:",
      {
        idcc: data.idcc,
        etab0_idcc: data.etablissements?.[0]?.idcc,
        etab0_conventionCollective_idcc: data.etablissements?.[0]?.conventionCollective?.idcc,
        sireneRaw_cc0_idcc: data.sireneRaw?.conventionsCollectives?.[0]?.idcc,
        sireneRaw_ccul0_codeIdcc: data.sireneRaw?.conventionsCollectivesUniteLegale?.[0]?.codeIdcc,
        sireneRaw_ccul0_idcc: data.sireneRaw?.conventionsCollectivesUniteLegale?.[0]?.idcc,
      }
    )
  }, [data])

  // Recherche l'idcc dans différents chemins connus
  const idcc =
    data.idcc ||
    data.etablissements?.[0]?.idcc ||
    data.etablissements?.[0]?.conventionCollective?.idcc ||
    data.sireneRaw?.conventionsCollectives?.[0]?.idcc ||
    data.sireneRaw?.conventionsCollectivesUniteLegale?.[0]?.codeIdcc ||
    data.sireneRaw?.conventionsCollectivesUniteLegale?.[0]?.idcc ||
    null

  const [convention, setConvention] = useState<ConventionCollective | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadingPdf, setLoadingPdf] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)

  useEffect(() => {
    // DEBUG : log si aucun idcc trouvé
    if (!idcc) {
      // eslint-disable-next-line no-console
      console.log("Divers.tsx - Aucun idcc trouvé, rien ne sera affiché pour la convention collective.")
      return
    }
    setLoading(true)
    setError(null)
    fetch(`https://hubshare-cmexpert.fr/legifrance/convention/by-idcc/${idcc}`)
      .then(res => {
        if (!res.ok) throw new Error("Convention collective introuvable")
        return res.json()
      })
      .then(results => {
        // DEBUG : log les résultats de l'API legifrance
        // eslint-disable-next-line no-console
        console.log("Divers.tsx - Résultat API legifrance/by-idcc:", results)
        if (Array.isArray(results) && results.length > 0) {
          setConvention({
            idcc,
            titre: results[0].title || results[0].titre || results[0].intitule || '',
            idKali: results[0].id || results[0].idKali || results[0].kaliContId || ''
          })
        } else {
          setConvention(null)
          setError("Aucune convention collective trouvée pour cet IDCC")
        }
      })
      .catch(e => {
        setConvention(null)
        setError(e.message)
      })
      .finally(() => setLoading(false))
  }, [idcc])

  const handleDownloadPdf = async () => {
    if (!convention?.idKali) return
    setLoadingPdf(true)
    setPdfError(null)
    try {
      const res = await fetch(
        `https://hubshare-cmexpert.fr/legifrance/convention/${convention.idKali}/pdf`
      )
      if (!res.ok) throw new Error("PDF non disponible")
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `convention-collective.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (e: any) {
      setPdfError(e.message || "Erreur lors du téléchargement")
    } finally {
      setLoadingPdf(false)
    }
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
      {idcc && (
        <div className="bg-white p-4 rounded shadow">
          <h3 className="font-semibold mb-2">Convention collective</h3>
          {loading && <p>Chargement...</p>}
          {error && <p className="text-red-600">{error}</p>}
          {convention && (
            <>
              <p><b>IDCC&nbsp;:</b> {convention.idcc}</p>
              <p><b>Titre&nbsp;:</b> {convention.titre || "N/A"}</p>
              <p><b>ID KALI&nbsp;:</b> {convention.idKali || "N/A"}</p>
              <button
                className="mt-2 px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
                disabled={loadingPdf || !convention.idKali}
                onClick={handleDownloadPdf}
              >
                {loadingPdf ? "Téléchargement..." : "Télécharger le PDF officiel"}
              </button>
              {pdfError && <p className="text-red-600 mt-2">{pdfError}</p>}
            </>
          )}
        </div>
      )}
    </div>
  )
}
