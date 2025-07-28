import React, { useState, useEffect } from 'react'

export default function LabelsCertifications({ data }: { data: any }) {
  const labels = data.labels || [];
  const divers = data.divers || [];
  const siret = data.siret || data.etablissements?.[0]?.siret || null;

  const [ccInfo, setCcInfo] = useState<any>(null)
  const [ccLoaded, setCcLoaded] = useState(false)
  const [legiInfo, setLegiInfo] = useState<any>(null)
  const [legiLoaded, setLegiLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false;
    setCcInfo(null); setCcLoaded(false);
    setLegiInfo(null); setLegiLoaded(false);

    if (!siret) {
      setCcLoaded(true); setLegiLoaded(true);
      return;
    }

    const siretKey = String(siret).padStart(14, '0');
    fetch(`https://siret-cc-backend.onrender.com/api/convention?siret=${siretKey}`)
      .then(async res => {
        if (!res.ok) throw new Error('Convention non trouvée');
        const cc = await res.json();
        if (!cancelled) {
          setCcInfo(cc);
          setCcLoaded(true);

          if (cc.IDCC) {
            fetch(`https://hubshare-cmexpert.fr/api/legifrance/convention?idcc=${cc.IDCC}`)
              .then(async res2 => {
                if (!res2.ok) throw new Error('Legifrance non trouvé');
                const legi = await res2.json();
                if (!cancelled) {
                  setLegiInfo(legi);
                  setLegiLoaded(true);
                }
              })
              .catch(() => {
                setLegiInfo(null);
                setLegiLoaded(true);
              });
          } else {
            setLegiLoaded(true);
          }
        }
      })
      .catch(() => {
        setCcLoaded(true);
        setLegiLoaded(true);
      });

    return () => { cancelled = true; };
  }, [siret]);

  // Affichage JSON formaté
  const renderJson = (obj: any) =>
    <pre className="bg-gray-100 text-xs rounded p-2 overflow-auto">{JSON.stringify(obj, null, 2)}</pre>;

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
            <details className="my-2">
              <summary className="cursor-pointer">Voir le JSON Legifrance</summary>
              {renderJson(legiInfo)}
            </details>
            {legiInfo.pdfUrl ? (
              <a
                href={legiInfo.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-2 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                download
              >
                Télécharger la convention collective au format PDF
              </a>
            ) : (
              <p className="text-gray-500 italic">PDF non disponible</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
