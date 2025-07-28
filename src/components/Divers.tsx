import React, { useState, useEffect } from 'react'

interface ConventionCollective {
  idcc: string
  libelle: string
}

const SIRET_JSON_FILES = [
  '/data/json_1_siret_9999.json',
  '/data/json_2_siret_9999.json',
  '/data/json_3_siret_9999.json',
  '/data/json_4_siret_9999.json'
];

export default function LabelsCertifications({ data }: { data: any }) {
  const labels = data.labels || [];
  const divers = data.divers || [];

  const siret = data.siret || data.etablissements?.[0]?.siret || null;

  const [ccInfo, setCcInfo] = useState<ConventionCollective | null>(null)
  const [ccLoaded, setCcLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false;
    if (!siret) {
      // Log SIRET introuvable
      // eslint-disable-next-line no-console
      console.log("Divers.tsx - Aucun SIRET fourni pour la recherche de convention collective.");
      setCcLoaded(true);
      setCcInfo(null);
      return;
    }
    // Log SIRET recherché
    // eslint-disable-next-line no-console
    console.log(`Divers.tsx - Recherche de convention collective pour le SIRET : ${siret}`);

    setCcLoaded(false);
    setCcInfo(null);

    (async () => {
      for (const url of SIRET_JSON_FILES) {
        // eslint-disable-next-line no-console
        console.log(`Divers.tsx - Tentative de chargement du fichier : ${url}`);
        try {
          const res = await fetch(url);
          if (!res.ok) {
            // eslint-disable-next-line no-console
            console.log(`Divers.tsx - Fichier non trouvé ou erreur réseau : ${url}`);
            continue;
          }
          const json = await res.json();
          const found = json[siret];
          if (found) {
            // eslint-disable-next-line no-console
            console.log(`Divers.tsx - SIRET ${siret} trouvé dans ${url} :`, found);
            if (!cancelled) {
              setCcInfo({
                idcc: found.idcc,
                libelle: found.libelle,
              });
              setCcLoaded(true);
            }
            return;
          } else {
            // eslint-disable-next-line no-console
            console.log(`Divers.tsx - SIRET ${siret} non trouvé dans ${url}`);
          }
        } catch (e) {
          // eslint-disable-next-line no-console
          console.log(`Divers.tsx - Erreur lors du chargement de ${url} :`, e);
        }
      }
      // eslint-disable-next-line no-console
      console.log(`Divers.tsx - Convention collective non trouvée pour le SIRET : ${siret}`);
      if (!cancelled) {
        setCcInfo(null);
        setCcLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [siret]);

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
  );
}
