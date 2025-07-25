import React, { useEffect, useState } from "react";
import { formatDateFR } from "../services/mapping";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { geocodeAdresse } from "../services/geocode";
import { cleanAdresse } from "../services/cleanAdresse";

type Etablissement = {
  siret: string;
  nom_complet?: string; // recherche-entreprises.api.gouv.fr (EI)
  nom_raison_sociale?: string; // recherche-entreprises.api.gouv.fr (sociétés)
  denomination?: string;
  raison_sociale?: string;
  nom_commercial?: string;
  displayName?: string;
  siegeRaisonSociale?: string;
  nom_usage?: string;
  nom?: string;
  prenom?: string;
  adresse?: string;
  statut?: "actif" | "ferme";
  date_fermeture?: string | null;
  lat?: number;
  lng?: number;
  foundAddress?: string;
  cityMatch?: boolean;
  geocodeSource?: string;
};

type Props = {
  etablissements: Etablissement[];
  selected: string;
  onSelect: (siret: string) => void;
  legalUnitName?: string;
};

function getEtablissementDisplayName(etab: Etablissement, legalUnitName?: string): string {
  return (
    etab.nom_complet ||
    etab.nom_raison_sociale ||
    etab.denomination ||
    etab.raison_sociale ||
    etab.nom_commercial ||
    etab.displayName ||
    etab.siegeRaisonSociale ||
    ((etab.nom_usage || etab.nom)
      ? [etab.prenom, etab.nom_usage || etab.nom].filter(Boolean).join(" ")
      : null) ||
    legalUnitName ||
    "(\u00c9tablissement sans nom)"
  );
}

function extractCity(adresse?: string): string | undefined {
  if (!adresse) return undefined;
  const matches = adresse.match(/\b\d{5}\s+([A-Z\- ]+)/i);
  if (matches && matches[1]) return matches[1].trim();
  const parts = adresse.trim().split(" ");
  return parts.length > 0 ? parts[parts.length - 1] : undefined;
}

const EtablissementsSelector: React.FC<Props> = ({
  etablissements,
  selected,
  onSelect,
  legalUnitName,
}) => {
  const [geoEtabs, setGeoEtabs] = useState<Etablissement[]>([]);

  useEffect(() => {
    let cancelled = false;
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
            geocodeSource: coords.source
          });
        } else {
          withGeo.push(etab);
        }
        await new Promise(r => setTimeout(r, 1200));
        if (cancelled) break;
      }
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
              <strong>{getEtablissementDisplayName(etab, legalUnitName)}</strong>
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
                <strong>{getEtablissementDisplayName(etab, legalUnitName)}</strong>
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
                        ⚠️ Ville localisée différente de la ville attendue !<br/>
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
