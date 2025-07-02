import React from "react"

type Adresse = {
  numVoiePresent?: boolean
  numVoie?: string
  voiePresent?: boolean
  voie?: string
  codePostalPresent?: boolean
  codePostal?: string
  communePresent?: boolean
  commune?: string
}

type Geo = {
  latitude?: number
  longitude?: number
}

export default function CarteAdresse({
  adresse,
  geo,
}: {
  adresse: Adresse
  geo?: Geo
}) {
  // Compose the address string
  const addrParts = []
  if (adresse.numVoiePresent && adresse.numVoie) addrParts.push(adresse.numVoie)
  if (adresse.voiePresent && adresse.voie) addrParts.push(adresse.voie)
  if (adresse.codePostalPresent && adresse.codePostal) addrParts.push(adresse.codePostal)
  if (adresse.communePresent && adresse.commune) addrParts.push(adresse.commune)
  const addressString = addrParts.join(" ")

  // Build OpenStreetMap embed URL
  let mapSrc: string
  if (geo?.latitude && geo?.longitude) {
    // center around lat/lon with a small bbox
    const lat = geo.latitude
    const lon = geo.longitude
    const delta = 0.005
    mapSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${
      lon - delta
    }%2C${lat - delta}%2C${lon + delta}%2C${lat + delta}&layer=mapnik&marker=${lat}%2C${lon}`
  } else {
    // fallback: search by query
    mapSrc = `https://www.openstreetmap.org/export/embed.html?query=${encodeURIComponent(
      addressString
    )}`
  }

  return (
    <div className="carte-adresse">
      <iframe
        width="100%"
        height="300"
        frameBorder="0"
        scrolling="no"
        marginHeight={0}
        marginWidth={0}
        src={mapSrc}
        aria-label={`Carte de l'adresse : ${addressString}`}
      />
      <div className="adresse-text">{addressString}</div>
    </div>
)
}
