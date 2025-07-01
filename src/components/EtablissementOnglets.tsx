import React from "react";
import Tabs from "./Tabs";
import { decodeFormeJuridique, decodeNaf } from "../logic/decode";
import CarteAdresse from "./CarteAdresse";
import FilteredObjectListView from "./FilteredObjectListView";

export default function EtablissementOnglets({ etab }: { etab: any }) {
  const onglets = [
    {
      label: "Identité",
      content: (
        <div>
          <h2>{etab.denomination}</h2>
          <div><b>SIREN : </b>{etab.siren}</div>
          <div><b>SIRET : </b>{etab.siret}</div>
          <div><b>Adresse : </b>{etab.adresse}</div>
          <div><b>Activité principale : </b>{etab.code_ape} – {decodeNaf(etab.code_ape)}</div>
          <div><b>Forme juridique : </b>{decodeFormeJuridique(etab.forme_juridique)}</div>
          <div><b>Date de création : </b>{etab.date_creation}</div>
          <div><b>Numéro TVA : </b>{etab.tva?.numero} {etab.tva ? (etab.tva.valide ? "✅" : "❌") : null}</div>
        </div>
      )
    },
    {
      label: "Dirigeants",
      content: etab.representants?.length ? (
        <ul>
          {etab.representants.map((r: any, i: number) => (
            <li key={i}>{r.nom} {r.prenom} {r.qualite ? `— ${r.qualite}` : ""}</li>
          ))}
        </ul>
      ) : <em>Aucun dirigeant trouvé</em>
    },
    {
      label: "Documents",
      content: <FilteredObjectListView data={etab.documents} />
    },
    {
      label: "Données financières",
      content: <FilteredObjectListView data={etab.finances} />
    },
    {
      label: "Annonces",
      content: <FilteredObjectListView data={etab.annonces} />
    },
    {
      label: "Labels & certificats",
      content: <FilteredObjectListView data={etab.labels} />
    },
    {
      label: "Divers",
      content: <FilteredObjectListView data={etab.divers} />
    }
  ];
  return <Tabs items={onglets} />;
}
