import React from "react";
import Tabs from "./Tabs";
import { decodeFormeJuridique, decodeNaf } from "../logic/decode";
import CarteAdresse from "./CarteAdresse";
import FilteredObjectListView from "./FilteredObjectListView";

export default function EtablissementOnglets({ etab }: { etab: any }) {
  // on stocke désormais une factory plutôt qu’un JSX closuré
  const onglets = [
    {
      label: "Identité",
      render: () => (
        <div>
          <h2>{etab.denomination}</h2>
          <div><b>SIREN :</b> {etab.siren}</div>
          <div><b>SIRET :</b> {etab.siret}</div>
          <div><b>Adresse :</b> {etab.adresse}</div>
          <CarteAdresse lat={etab.geo?.lat ?? null} lon={etab.geo?.lon ?? null} label={etab.adresse} />
          <div><b>Activité principale :</b> {etab.code_ape} – {decodeNaf(etab.code_ape)}</div>
          <div><b>Forme juridique :</b> {decodeFormeJuridique(etab.forme_juridique)}</div>
          <div><b>Date de création :</b> {etab.date_creation}</div>
          <div><b>Numéro TVA :</b> {etab.tva?.numero} {etab.tva?.valide ? "✅" : "❌"}</div>
          <div><b>Capital social :</b> {etab.capital_social ?? "—"}</div>
          <div><b>Effectif :</b> {etab.effectif ?? "—"}</div>
        </div>
      )
    },
    {
      label: "Dirigeants",
      render: () => (
        etab.representants?.length
          ? <ul>{etab.representants.map((r: any,i:number)=><li key={i}>{r.nom} {r.prenom}{r.qualite?` — ${r.qualite}`:""}</li>)}</ul>
          : <em>Aucun dirigeant trouvé</em>
      )
    },
    // ... idem pour les autres onglets
  ];

  // on passe dorénavant la data à Tabs
  return <Tabs items={onglets} data={etab} />;
}
