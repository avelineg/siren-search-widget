import React, { useEffect, useState } from 'react';
import { fetchEtablissementsBySiren } from '../services/api';
import { mapEtablissement } from '../services/mapping';

interface EtablissementsProps {
  siren: string;
  onSelectEtablissement: (siret: string) => void;
}

const Etablissements: React.FC<EtablissementsProps> = ({ siren, onSelectEtablissement }) => {
  const [etabs, setEtabs] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const parPage = 20;

  useEffect(() => {
    setPage(1);
  }, [siren]);

  useEffect(() => {
    if (!siren) return;
    setLoading(true);
    fetchEtablissementsBySiren(siren, page, parPage)
      .then(data => {
        setEtabs(data.etablissements.map(mapEtablissement));
        setTotal(data.total);
      })
      .finally(() => setLoading(false));
  }, [siren, page]);

  const totalPages = Math.ceil(total / parPage);

  if (loading) return <p>Chargement…</p>;
  if (etabs.length === 0) return null;

  return (
    <div>
      <h3>Établissements ({total})</h3>
      <ul>
        {etabs.map(etab => (
          <li
            key={etab.siret}
            style={{
              cursor: 'pointer',
              margin: '0.4em 0',
              padding: '0.2em 0.4em',
              borderRadius: 6,
              background: etab.isSiege ? '#f0f6ff' : '#fff'
            }}
            onClick={() => onSelectEtablissement(etab.siret)}
            title="Voir la fiche de cet établissement"
          >
            <strong>{etab.isSiege ? 'Siège' : 'Établissement'}</strong> — <b>SIRET</b> {etab.siret} — {etab.denomination} <br />
            <span style={{ color: '#666', fontSize: 13 }}>{etab.adresse}</span>
            <span style={{ float: 'right', fontSize: 13, color: etab.etat === 'Actif' ? 'green' : 'red' }}>{etab.etat}</span>
          </li>
        ))}
      </ul>
      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 12 }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Précédent</button>
          <span>Page {page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Suivant</button>
        </div>
      )}
      <small style={{ display: 'block', marginTop: 6, color: '#999' }}>
        Cliquez sur une ligne pour charger la fiche de l’établissement.
      </small>
    </div>
  );
};

export default Etablissements;
