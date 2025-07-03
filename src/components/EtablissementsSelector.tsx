import React from 'react';

export default function EtablissementsSelector({
  etablissements,
  selected,
  onSelect
}: {
  etablissements: { siret: string, adresse: string }[],
  selected: string,
  onSelect: (siret: string) => void
}) {
  const selectedEtab = etablissements.find(e => e.siret === selected);

  // Génère l'URL de téléchargement de l'avis SIRENE
  const avisURL = selectedEtab
    ? `https://api-avis-situation-sirene.insee.fr/identification/pdf/${selectedEtab.siret}`
    : '';

  return (
    <div className="mb-4">
      <label className="block mb-1 font-medium">Sélectionnez un établissement :</label>
      <select
        className="border px-2 py-1 rounded"
        value={selected}
        onChange={e => onSelect(e.target.value)}
      >
        {etablissements.map(e => (
          <option key={e.siret} value={e.siret}>
            {e.siret} — {e.adresse}
          </option>
        ))}
      </select>
      {selectedEtab && (
        <div className="mt-2">
          <a
            href={avisURL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm"
            download
          >
            Télécharger l'avis SIRENE (PDF)
          </a>
        </div>
      )}
    </div>
  );
}
