export function decodeNatureJuridique(code: string, data: Record<string, string>) {
  return data[code] || code;
}

export function decodeNAF(code: string, data: Record<string, string>) {
  return data[code] || code;
}
