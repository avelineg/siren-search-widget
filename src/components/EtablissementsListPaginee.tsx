import { useEffect, useState } from "react";
import { fetchEtablissementsBySiren } from "../services/api";
import { mapEtablissement } from "../services/mapping";

interface Props {
  siren: string;
  onSelectEtablissement: (siret: string) => void;
}

const EtablissementsListPaginee = ({ siren, onSelectEtablissement }: Props) => {
  const [page, setPage] = useState(1);
  const [etabs, setEtabs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const parPage = 20;
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchEtablissementsBySiren(siren, page, parPage)
      .then(({ etablissements, total }) => {
        setEtabs(etablissements.map(mapEtablissement));
        setTotal(total);
      })
      .finally(() => setLoading(false));
  }, [siren, page]);

  if (!siren) return null;

  return (
    <div className="mt-6">
      <h3 className="text-lg font-bold mb-2">Liste complète des établissements ({total})</h3>
      {loading && <div>Chargement...</div>}
      {etabs.length === 0 && !loading && (
        <div className="text-gray-400 mb-4">Aucun établissement trouvé.</div>
      )}
      <ul>
        {etabs.map(etab => (
          <li
            key={etab.siret}
            className="hover:bg-blue-50 cursor-pointer px-2 py-1 border-b flex justify-between items-center"
            onClick={() => onSelectEtablissement(etab.siret)}
          >
            <div>
              <strong>{etab.denomination}</strong>
              <span className="ml-2 text-sm text-gray-600">{etab.adresse}</span>
              {etab.isSiege && <span className="ml-2 text-green-600 text-xs">[Siège]</span>}
            </div>
            <div className="text-xs">
              {etab.etat === "Actif" ? (
                <span className="bg-green-100 text-green-800 px-2 py-1 rounded">Actif</span>
              ) : (
                <span className="bg-red-100 text-red-800 px-2 py-1 rounded">Fermé</span>
              )}
            </div>
          </li>
        ))}
      </ul>
      {/* PAGINATION */}
      {total > parPage && (
        <div className="flex gap-2 mt-4">
          <button
            disabled={page <= 1}
            className="px-2 py-1 border rounded disabled:opacity-50"
            onClick={() => setPage(p => Math.max(1, p - 1))}
          >
            Précédent
          </button>
          <span>Page {page} / {Math.ceil(total / parPage)}</span>
          <button
            disabled={page * parPage >= total}
            className="px-2 py-1 border rounded disabled:opacity-50"
            onClick={() => setPage(p => p + 1)}
          >
            Suivant
          </button>
        </div>
      )}
      <div className="text-xs text-gray-400 mt-2">Cliquez sur une ligne pour charger la fiche de l'établissement.</div>
    </div>
  );
};

export default EtablissementsListPaginee;
