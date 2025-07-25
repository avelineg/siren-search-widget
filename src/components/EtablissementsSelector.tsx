import React, { useEffect, useState } from "react";
import { formatDateFR } from "../services/mapping";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { geocodeAdresse } from "../services/geocode";

type Etablissement = {
  siret: string;
  displayName: string;
  adresse?: string;
  statut?: "actif" | "ferme";
  date_fermeture?: string | null;
  lat?: number;
  lng?: number;
};

type Props = {
  etablissements: Etablissement[];
  selected: string;
  onSelect: (siret: string) => void;
};

const EtablissementsSelector: React.FC<Props> = ({
  etablissements,
  selected,
  onSelect,
}) => {
  const [geoEtabs, setGeoEtabs] = useState<Etablissement[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function geocodeAll() {
      const withGeo = await Promise.all(
        etablissements.map(async (etab) => {
          if (etab.lat && etab.lng) return etab;
          if (!etab.adresse) return etab;
          const coords = await geocodeAdresse(etab.adresse);
          if (coords) return { ...etab, lat: coords.lat, lng: coords.lng };
          return etab;
        })
      );
      if (!cancelled) setGeoEtabs(withGeo);
    }
    geocodeAll();
    return () => { cancelled = true; };
  }, [etablissements]);

  const first = geoEtabs.find(e => e.lat && e.lng);
  const defaultPosition: [number, number] = first ? [first.lat!, first.lng!] : [48.8566, 2.3522];

  if (!etablissements || etablissements.length === 0) {
    return <div>Aucun établissement référencé.</div>;
  }

  return (
    <>
      <ul className="divide-y">
        {etablissements.map((etab) => (
          <li key={etab.siret} className="py-2 flex items-center">
            <span className="flex-1">
              <strong>{etab.displayName || "(Sans nom)"}</strong>
              <span className="ml-2 text-gray-600">SIRET : {etab.siret}</span>
              {etab.adresse && (
                <span className="ml-2 text-gray-500">{etab.adresse}</span>
              )}
              <span
                className="ml-2 px-2 py-1 rounded text-xs"
                style={{
                  background: etab.statut === "ferme" ? "#fde8ea" : "#e6faea",
                  color: etab.statut === "ferme" ? "#b71c1c" : "#208b42",
                  fontWeight: 600,
                }}
                title={etab.statut === "ferme" ? "Établissement fermé" : "Établissement actif"}
              >
                {etab.statut === "ferme" ? "Fermé" : "Actif"}
                {etab.statut === "ferme" && etab.date_fermeture && (
                  <span className="ml-1 text-xs text-gray-500">
                    (le {formatDateFR(etab.date_fermeture)})
                  </span>
                )}
              </span>
            </span>
            {selected === etab.siret ? (
              <span className="ml-2 px-2 py-1 rounded bg-blue-200 text-blue-800 text-xs">
                Sélectionné
              </span>
            ) : (
              <button
                className="ml-2 px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs"
                onClick={() => onSelect(etab.siret)}
              >
                Voir la fiche
              </button>
            )}
          </li>
        ))}
      </ul>
      {/* Ajout de la carte */}
      <div style={{ height: "400px", width: "100%", marginTop: 24 }}>
        <MapContainer
          center={defaultPosition}
          zoom={6}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {geoEtabs.filter(e => e.lat && e.lng).map(etab => (
            <Marker key={etab.siret} position={[etab.lat!, etab.lng!]}>
              <Popup>
                <strong>{etab.displayName}</strong>
                <br />
                {etab.adresse}
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </>
  );
};

export default EtablissementsSelector;
