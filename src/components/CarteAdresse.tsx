import React from "react";

interface CarteAdresseProps {
  adresse: string;
  geo?: { lat?: number; lon?: number };
}

export default function CarteAdresse({ adresse, geo }: CarteAdresseProps) {
  return (
    <div className="carte-adresse">
      <div>
        <b>Adresse :</b> {adresse || "Non disponible"}
      </div>
      {geo?.lat && geo?.lon && (
        <div>
          <a
            href={`https://www.google.com/maps?q=${geo.lat},${geo.lon}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Voir sur la carte
          </a>
        </div>
      )}
    </div>
  );
}
