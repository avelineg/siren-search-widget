// src/services/geocode.ts

/**
 * Géocode une adresse en utilisant Nominatim, puis en fallback api-adresse.data.gouv.fr si besoin.
 * Retourne également l'adresse trouvée et si la ville attendue correspond.
 */
export async function geocodeAdresse(
  adresse: string,
  expectedCity?: string
): Promise<{ lat: number; lng: number; foundAddress?: string; cityMatch?: boolean, source: string } | null> {
  // 1. Essai Nominatim
  const urlNominatim = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(adresse)}`;
  try {
    const resp = await fetch(urlNominatim, { headers: { 'User-Agent': 'siren-search-widget' } });
    const data = await resp.json();
    if (data && data.length > 0) {
      const found = data[0];
      const foundAddress = found.display_name;
      const cityMatch = expectedCity
        ? foundAddress && foundAddress.toUpperCase().includes(expectedCity.toUpperCase())
        : undefined;
      return {
        lat: parseFloat(found.lat),
        lng: parseFloat(found.lon),
        foundAddress,
        cityMatch,
        source: "nominatim"
      };
    }
  } catch (e) {
    // continue to fallback
  }

  // 2. Fallback api-adresse.data.gouv.fr
  const urlBAN = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(adresse)}`;
  try {
    const resp = await fetch(urlBAN);
    const data = await resp.json();
    if (data && data.features && data.features.length > 0) {
      const f = data.features[0];
      const foundAddress = f.properties.label;
      const cityMatch = expectedCity
        ? foundAddress && foundAddress.toUpperCase().includes(expectedCity.toUpperCase())
        : undefined;
      return {
        lat: f.geometry.coordinates[1],
        lng: f.geometry.coordinates[0],
        foundAddress,
        cityMatch,
        source: "ban"
      };
    }
  } catch (e) {
    // ignore
  }

  return null;
}
