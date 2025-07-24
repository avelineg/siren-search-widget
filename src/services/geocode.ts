// src/services/geocode.ts
export async function geocodeAdresse(adresse: string): Promise<{ lat: number; lng: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(adresse)}`;
  try {
    const resp = await fetch(url, { headers: { 'User-Agent': 'siren-search-widget' } });
    const data = await resp.json();
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
      };
    }
    return null;
  } catch {
    return null;
  }
}
