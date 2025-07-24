import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { fetchEtablissementsBySiren } from "../services/api";
import { mapEtablissement } from "../services/mapping";
import { geocodeAdresse } from "../services/geocode";

const parPage = 20;

const EtablissementsListPaginee = ({ siren, onSelectEtablissement }) => {
  const [page, setPage] = useState(1);
  const [etabs, setEtabs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // Ajoute l'état pour stocker les coordonnées géocodées
  const [geoEtabs, setGeoEtabs] = useState([]);

  useEffect(() => {
    if (!siren) {
      setEtabs([]);
      setTotal(0);
      setGeoEtabs([]);
      return;
    }
    setLoading(true);
    fetchEtablissementsBySiren(siren, page, parPage)
      .then(async ({ etablissements, total }) => {
        const mapped = etablissements.map(mapEtablissement);
        setEtabs(mapped);
        setTotal(total);
        // Géocode les adresses pour les établissements SANS coordonnées
        const withGeo = await Promise.all(mapped.map(async (etab) => {
          if (etab.lat && etab.lng) return etab;
          if (!etab.adresse) return etab;
          const coords = await geocodeAdresse(etab.adresse);
          if (coords) {
            return { ...etab, lat: coords.lat, lng: coords.lng };
          }
          return etab;
        }));
        setGeoEtabs(withGeo);
      })
      .finally(() => setLoading(false));
  }, [siren, page]);

  useEffect(() => {
    setPage(1);
  }, [siren]);

  // La carte doit TOUJOURS s'afficher si siren est présent
  if (!siren) return null;

  // Centre sur Paris par défaut ou sur le premier point
  const first = geoEtabs.find(e => e.lat && e.lng);
  const defaultPosition = first ? [first.lat, first.lng] : [48.8566, 2.3522];

  return (
    <div className="mt-6">
      <div style={{ height: "400px", width: "100%" }}>
        <MapContainer center={defaultPosition as [number, number]} zoom={6} style={{ height: "100%", width: "100%" }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {geoEtabs.filter(e => e.lat && e.lng).map(etab => (
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
