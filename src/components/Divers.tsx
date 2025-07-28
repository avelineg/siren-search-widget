import React, { useState, useEffect } from 'react'

interface ConventionCollective {
  idcc: string
  libelle: string
}

export default function LabelsCertifications({ data }: { data: any }) {
  const labels = data.labels || []
  const divers = data.divers || []

  // On récupère le SIRET principal affiché
  const siret = data.siret || data.etablissements?.[0]?.siret || null;
  // On détermine le préfixe pour choisir le bon fichier JSON
  const siretPrefix = siret ? String(siret)[0] : null;
  // On prépare l'URL du fichier à charger
  const jsonUrl = siretPrefix
    ? `/data/json_${siretPrefix}_siret_9999.json`
    : null;

  const [ccInfo, setCcInfo] = useState<ConventionCollective | null>(null)
  const [ccLoaded, setCcLoaded] = useState(false)

  useEffect(() => {
    if (!jsonUrl || !siret) {
      setCcLoaded(true);
      setCcInfo(null);
      return;
    }
    setCcLoaded(false);
    fetch(jsonUrl)
      .then(res => {
        if (!res.ok) throw new Error("Erreur chargement fichier conventions");
        return res.json();
      })
      .then((json) => {
        const found = json[siret];
        if (found) {
          setCcInfo({
            idcc: found.idcc,
            libelle: found.libelle,
          });
        } else {
          setCcInfo(null);
        }
      })
      .catch(() => {
        setCcInfo(null);
      })
      .finally(() => {
        setCcLoaded(true);
      });
  }, [jsonUrl, siret]);

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
        {!ccLoaded && <p>Chargement...</p>}
        {ccLoaded && ccInfo && (
          <>
            <p><b>IDCC&nbsp;:</b> {ccInfo.idcc}</p>
            <p><b>Titre&nbsp;:</b> {ccInfo.libelle}</p>
          </>
        )}
        {ccLoaded && !ccInfo && (
          <p className="text-gray-600">
            Aucune information sur la convention collective n’est disponible pour cet établissement.
          </p>
        )}
      </div>
    </div>
  )
}
