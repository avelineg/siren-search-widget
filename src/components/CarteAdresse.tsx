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

// Affiche une carte OSM centrée sur les coordonnées ou la chaîne d'adresse
export default function CarteAdresse({
  adresse,
  geo,
}: {
  adresse: string | AdresseObject
  geo?: Geo | [number, number] | null
}) {
  // Préparer la chaîne d'adresse
  let addressString = ""
  if (typeof adresse === "string") {
    addressString = adresse
  } else {
    const parts: string[] = []
    if (adresse.numVoiePresent && adresse.numVoie) parts.push(adresse.numVoie)
    if (adresse.voiePresent && adresse.voie) parts.push(adresse.voie)
    if (adresse.codePostalPresent && adresse.codePostal) parts.push(adresse.codePostal)
    if (adresse.communePresent && adresse.commune) parts.push(adresse.commune)
    addressString = parts.join(" ")
  }

  // Calculer lat/lon depuis geo
  let lat: number | null = null
  let lon: number | null = null
  if (Array.isArray(geo) && geo.length === 2) {
    // [lon, lat]
    lon = geo[0]
    lat = geo[1]
  } else if (geo && (geo as Geo).latitude && (geo as Geo).longitude) {
    lat = (geo as Geo).latitude!
    lon = (geo as Geo).longitude!
  }

  // Construire URL d'embed sans retours à la ligne ni espaces
  let mapSrc: string
  if (lat !== null && lon !== null) {
    const delta = 0.005
    const minLon = lon - delta
    const minLat = lat - delta
    const maxLon = lon + delta
    const maxLat = lat + delta
    // bbox: minLon,minLat,maxLon,maxLat
    mapSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${minLon},${minLat},${maxLon},${maxLat}&layer=mapnik&marker=${lat},${lon}&zoom=15`
  } else {
    // fallback sur recherche par texte
    mapSrc = `https://www.openstreetmap.org/export/embed.html?query=${encodeURIComponent(
      addressString
    )}`
  }

  return (
    <div className="carte-adresse">
      <iframe
        title={`Carte de l'adresse : ${addressString}`}
        src={mapSrc}
        width="100%"
        height="300"
        frameBorder="0"
        scrolling="no"
        marginHeight={0}
        marginWidth={0}
      />
      {addressString && <div className="adresse-text">{addressString}</div>}
    </div>
  )
}
