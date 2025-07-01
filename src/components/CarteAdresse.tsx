import React from "react";

export default function CarteAdresse({
  adresse,
  geo
}: {
  adresse: string;
  geo: [number, number] | null;
}) {
  return (
    <div style={{ margin: "0.5em 0" }}>
      <div>
        <b>Adresse :</b> {adresse}
      </div>
      {geo ? (
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${geo[1]},${geo[0]}`}
          target="_blank"
          rel="noreferrer"
        >
          Voir sur la carte
        </a>
      ) : null}
    </div>
  );
}
