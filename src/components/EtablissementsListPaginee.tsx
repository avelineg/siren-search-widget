import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { fetchEtablissementsBySiren } from "../services/api";
import { mapEtablissement } from "../services/mapping";

interface Props {
  siren: string;
  onSelectEtablissement: (siret: string) => void;
}

const parPage = 20;

const EtablissementsListPaginee = ({ siren, onSelectEtablissement }: Props) => {
  const [page, setPage] = useState(1);
  const [etabs, setEtabs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!siren) {
      setEtabs([]);
      setTotal(0);
      return;
    }
    setLoading(true);
    fetchEtablissementsBySiren(siren, page, parPage)
      .then(({ etablissements, total }) => {
        setEtabs(etablissements.map(mapEtablissement));
        setTotal(total);
      })
      .finally(() => setLoading(false));
  }, [siren, page]);

  useEffect(() => {
    setPage(1);
  }, [siren]);

  if (!siren || total === 0) return null;

  // On cherche le premier établissement avec coordonnées pour centrer la carte
  const firstEtabWithCoords = etabs.find(e => e.lat && e.lng);
  const defaultPosition = firstEtabWithCoords
    ? [firstEtabWithCoords.lat, firstEtabWithCoords.lng]
    : [48.8566, 2.3522]; // Paris fallback

  return (
    <div className="mt-6">
      {/* Carte affichant les établissements */}
      <div style={{ height: "400px", width: "100%" }}>
        <MapContainer center={defaultPosition as [number, number]} zoom={6} style={{ height: "100%", width: "100%" }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {etabs.filter(e => e.lat && e.lng).map(etab => (
            <Marker key={etab.siret} position={[etab.lat, etab.lng]}>
              <Popup>
                <div style={{ minWidth: 180 }}>
                  <strong>{etab.denomination}</strong>
                  <br />
                  {etab.adresse}
                  {etab.isSiege && (
                    <span style={{ color: "green", fontSize: 12, marginLeft: 8 }}>[Siège]</span>
                  )}
                  <br />
                  <span
                    style={{
                      background: etab.etat === "Actif" ? "#bbf7d0" : "#fecaca",
                      color: etab.etat === "Actif" ? "#166534" : "#991b1b",
                      padding: "2px 6px",
                      borderRadius: 4,
                      fontSize: "0.8em",
                      marginRight: 8,
                    }}
                  >
                    {etab.etat}
                  </span>
                  <br />
                  <button
                    className="mt-2 px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                    onClick={() => onSelectEtablissement(etab.siret)}
                  >
                    Voir la fiche
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
      {/* Pagination si besoin */}
      {total > parPage && (
        <div className="flex gap-2 mt-4">
          <button
            disabled={page <= 1}
            className="px-2 py-1 border rounded disabled:opacity-50"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Précédent
          </button>
          <span>
            Page {page} / {Math.ceil(total / parPage)}
          </span>
          <button
            disabled={page * parPage >= total}
            className="px-2 py-1 border rounded disabled:opacity-50"
            onClick={() => setPage((p) => p + 1)}
          >
            Suivant
          </button>
        </div>
      )}
    </div>
  );
};

export default EtablissementsListPaginee;
