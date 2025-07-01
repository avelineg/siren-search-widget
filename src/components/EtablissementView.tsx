import React from "react";
import EtablissementOnglets from "./EtablissementOnglets";

interface EtablissementViewProps {
  etab: any;
  uniteLegale: any;
  geo?: { lat?: number; lon?: number };
  representants: any[];
  adresse: string;
}

export default function EtablissementView(props: EtablissementViewProps) {
  return (
    <div className="etablissement-view">
      <EtablissementOnglets {...props} />
    </div>
  );
}
