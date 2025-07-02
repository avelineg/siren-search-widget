import React from "react"

type AdresseObject = {
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
  // can be full string or structured object
  adresse: string | AdresseObject
  geo?: Geo | [number, number] | null
}) {
  // Determine the address string
  let addressString = ""
  if (typeof adresse === "string") {
    addressString = adresse
  } else {
    const addrParts: string[] = []
    if (adresse.numVoiePresent && adresse.numVoie) addrParts.push(adresse.numVoie)
    if (adresse.voiePresent && adresse.voie) addrParts.push(adresse.voie)
    if (adresse.codePostalPresent && adresse.codePostal) addrParts.push(adresse.codePostal)
    if (adresse.communePresent && adresse.commune) addrParts.push(adresse.commune)
    addressString = addrParts.join(" ")
  }

  // Build OpenStreetMap embed URL
  let mapSrc: string
  // geo from mapping may be [lon, lat]
  const latLon =
    Array.isArray(geo) && geo.length === 2
      ? { lat: geo[1], lon: geo[0] }
      : (geo as Geo) && (geo as Geo).latitude && (geo as Geo).longitude
      ? { lat: (geo as Geo).latitude!, lon: (geo as Geo).longitude! }
      : null

  if (latLon) {
    const { lat, lon } = latLon
    const delta = 0.005
    mapSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${lon -
      delta}%2C${lat - delta}%2C${lon + delta}%2C${lat +
      delta}&layer=mapnik&marker=${lat}%2C${lon}`
  } else {
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
      {addressString && <div className="adresse-text">{addressString}</div>}
    </div>
  )
}
