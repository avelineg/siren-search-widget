import formeJuridique from "../formeJuridique.json";
import naf from "../naf.json";

export function decodeFormeJuridique(code: string) {
  return formeJuridique[code] || code;
}

export function decodeNaf(code: string) {
  return naf[code] || code;
}
