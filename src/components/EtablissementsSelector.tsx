import React, { useEffect, useState, useRef } from "react";
import { formatDateFR } from "../services/mapping";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { geocodeAdresse } from "../services/geocode";
import { cleanAdresse } from "../services/cleanAdresse";

type Etablissement = {
  siret: string;
  displayName?: string;
  ville?: string;
  adresse?: string;
  statut?: "actif" | "ferme";
  date_fermeture?: string | null;
  lat?: number;
  lng?: number;
  foundAddress?: string;
  cityMatch?: boolean;
  geocodeSource?: string;
  est_siege?: boolean; // Nouveau: permet de centrer sur l'établissement principal (siège)
};

type Props = {
  etablissements: Etablissement[];
  selected: string;
  onSelect: (siret: string) => void;
  legalUnitName?: string;
  searchKey: string; // Ajout pour la clé de cache
};

function getEtablissementDisplayName(etab: Etablissement, legalUnitName?: string): string {
  return etab.displayName || legalUnitName || "(\u00c9tablissement sans nom)";
}

function extractCity(adresse?: string): string | undefined {
  if (!adresse) return undefined;
  const matches = adresse.match(/\b\d{5}\s+([A-Z\- ]+)/i);
  if (matches && matches[1]) return matches[1].trim();
  const parts = adresse.trim().split(" ");
  return parts.length > 0 ? parts[parts.length - 1] : undefined;
}

// Composant utilitaire pour recadrer la carte quand le "center" ou le "zoom" changent
function Recenter({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom, { animate: true });
  }, [center[0], center[1], zoom, map]);
  return null;
}

const EtablissementsSelector: React.FC<Props> = ({
  etablissements,
  selected,
  onSelect,
  legalUnitName,
  searchKey,
}) => {
  const [geoEtabs, setGeoEtabs] = useState<Etablissement[]>([]);
  const cacheRef = useRef<{ [key: string]: Etablissement[] }>({});

  useEffect(() => {
    let cancelled = false;
    // Si déjà géocodé pour cette recherche, on ne fait rien
    if (cacheRef.current[searchKey]) {
      setGeoEtabs(cacheRef.current[searchKey]);
      return;
    }
    async function geocodeAll() {
      const withGeo: Etablissement[] = [];
      for (const etab of etablissements) {
        if (etab.lat && etab.lng) {
          withGeo.push(etab);
          continue;
        }
        if (!etab.adresse) {
          withGeo.push(etab);
          continue;
        }
        const cleanedAdresse = cleanAdresse(etab.adresse);
        const expectedCity = extractCity(etab.adresse);
        const coords = await geocodeAdresse(cleanedAdresse, expectedCity);
        if (coords) {
          withGeo.push({
            ...etab,
            lat: coords.lat,
            lng: coords.lng,
            foundAddress: coords.foundAddress,
            cityMatch: coords.cityMatch,
            geocodeSource: coords.source,
          });
        } else {
          withGeo.push(etab);
        }
        // éviter la saturation geocodeur
        await new Promise((r) => setTimeout(r, 1200));
        if (cancelled) break;
      }
      if (!cancelled) {
        setGeoEtabs(withGeo);
        cacheRef.current[searchKey] = withGeo; // mise en cache
      }
    }
    geocodeAll();
    return () => {
      cancelled = true;
    };
  }, [etablissements, searchKey]);

  // Détermine le centre:
  // 1) établissement sélectionné s'il a des coordonnées
  // 2) siège s'il a des coordonnées
  // 3) premier établissement géocodé
  // 4) fallback Paris
  const first = geoEtabs.find((e) => e.lat && e.lng);
  const selectedEtab = geoEtabs.find((e) => e.siret === selected && e.lat && e.lng);
  const principal = geoEtabs.find((e) => e.est_siege && e.lat && e.lng);

  const center: [number, number] = selectedEtab
    ? [selectedEtab.lat!, selectedEtab.lng!]
    : principal
    ? [principal.lat!, principal.lng!]
    : first
    ? [first.lat!, first.lng!]
    : [48.8566, 2.3522];

  const zoom = selectedEtab || principal ? 10 : 5;

  if (!etablissements || etablissements.length === 0) {
    return <div>Aucun établissement référencé.</div>;
  }

  return (
    <>
      <ul className="divide-y">
        {etablissements.map((etab) => (
          <li key={etab.siret} className="py-2 flex items-center">
            <span className="flex-1">
              <strong>{getEtablissementDisplayName(etab, legalUnitName)}</strong>
              <span className="ml-2 text-gray-600" style={{ fontSize: "0.9em" }}>
                SIRET&nbsp;: {etab.siret}
              </span>
              {etab.adresse && (
                <span className="ml-2 text-gray-500" style={{ fontSize: "0.9em" }}>
                  {etab.adresse}
                </span>
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
              {etab.est_siege && (
                <span className="ml-2 px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 text-xs">
                  Siège
                </span>
              )}
            </span>
            {selected === etab.siret ? (
              <span className="ml-2 px-2 py-1 rounded bg-blue-200 text-blue-800 text-xs">Sélectionné</span>
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
      <div style={{ height: "400px", width: "100%", marginTop: 24 }}>
        <MapContainer center={center} zoom={zoom} style={{ height: "100%", width: "100%" }}>
          <Recenter center={center} zoom={zoom} />
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {geoEtabs
            .filter((e) => e.lat && e.lng)
            .map((etab) => (
              <Marker key={etab.siret} position={[etab.lat!, etab.lng!]}>
                <Popup>
                  <strong>{getEtablissementDisplayName(etab, legalUnitName)}</strong>
                  {etab.est_siege && <span className="ml-2 inline-block px-1 py-0.5 rounded bg-indigo-100 text-indigo-800 text-[10px] align-middle">Siège</span>}
                  <br />
                  <span>Adresse d'origine : {etab.adresse}</span>
                  <br />
                  <span>Adresse nettoyée : {cleanAdresse(etab.adresse ?? "")}</span>
                  {etab.foundAddress && (
                    <>
                      <br />
                      <span>
                        Adresse localisée : <b>{etab.foundAddress}</b>
                        <br />
                        Source: {etab.geocodeSource === "nominatim" ? "Nominatim" : "api-adresse.data.gouv.fr"}
                      </span>
                      {etab.cityMatch === false && (
                        <div style={{ color: "red" }}>
                          ⚠️ Ville localisée différente de la ville attendue !<br />
                          (fallback automatique sur l'autre géocodeur)
                        </div>
                      )}
                    </>
                  )}
                </Popup>
              </Marker>
            ))}
        </MapContainer>
      </div>
    </>
  );
};

export default EtablissementsSelector;
