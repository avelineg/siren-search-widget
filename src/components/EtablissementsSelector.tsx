import React from 'react';

export default function EtablissementsSelector({ etablissements, selected, onSelect }: {
  etablissements: { siret: string, adresse: string }[],
  selected: string,
  onSelect: (siret: string) => void
}) {
  if (!etablissements?.length) return null;
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
    </div>
  );
}
