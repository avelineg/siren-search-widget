import React, { useState, useEffect } from 'react'

interface ConventionRow {
  MOIS: string
  SIRET: number | string
  IDCC: number | string
  DATE_MAJ: string
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

  const [ccInfo, setCcInfo] = useState<{ idcc: string | number; mois: string; dateMaj: string } | null>(null)
  const [ccLoaded, setCcLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false;
    if (!siret) {
      // eslint-disable-next-line no-console
      console.log("Divers.tsx - Aucun SIRET fourni pour la recherche de convention collective.");
      setCcLoaded(true);
      setCcInfo(null);
      return;
    }
    const siretKey = String(siret).padStart(14, '0');
    // eslint-disable-next-line no-console
    console.log(`Divers.tsx - Recherche de convention collective pour le SIRET (clé) : ${siretKey}`);

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
          const arr: ConventionRow[] = await res.json();
          // Debug: afficher 5 SIRET présents dans ce fichier
          const siretList = arr.slice(0, 5).map(obj => String(obj.SIRET).padStart(14, '0'));
          // eslint-disable-next-line no-console
          console.log(`Divers.tsx - Exemples de SIRET dans ${url}:`, siretList);

          const found = arr.find(obj => String(obj.SIRET).padStart(14, '0') === siretKey);
          if (found) {
            // eslint-disable-next-line no-console
            console.log(`Divers.tsx - SIRET ${siretKey} trouvé dans ${url} :`, found);
            if (!cancelled) {
              setCcInfo({
                idcc: found.IDCC,
                mois: found.MOIS,
                dateMaj: found.DATE_MAJ,
              });
              setCcLoaded(true);
            }
            return;
          } else {
            // eslint-disable-next-line no-console
            console.log(`Divers.tsx - SIRET ${siretKey} non trouvé dans ${url}`);
          }
        } catch (e) {
          // eslint-disable-next-line no-console
          console.log(`Divers.tsx - Erreur lors du chargement de ${url} :`, e);
        }
      }
      // eslint-disable-next-line no-console
      console.log(`Divers.tsx - Convention collective non trouvée pour le SIRET : ${siretKey}`);
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
            <p><b>Mois référence&nbsp;:</b> {ccInfo.mois}</p>
            <p><b>Date MAJ&nbsp;:</b> {ccInfo.dateMaj}</p>
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
