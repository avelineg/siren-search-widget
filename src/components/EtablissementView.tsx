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
          <div><b>SIREN :</b> {etab.siren}</div>
          <div><b>SIRET :</b> {etab.siret}</div>
          <div><b>Adresse :</b> {etab.adresse}</div>
          <CarteAdresse lat={etab.geo?.lat || null} lon={etab.geo?.lon || null} label={etab.adresse} />
          <div><b>Activité principale :</b> {etab.code_ape} – {decodeNaf(etab.code_ape)}</div>
          <div><b>Forme juridique :</b> {decodeFormeJuridique(etab.forme_juridique)}</div>
          <div><b>Date de création :</b> {etab.date_creation}</div>
          <div><b>Numéro TVA :</b> {etab.tva?.numero} {etab.tva ? (etab.tva.valide ? "✅" : "❌") : null}</div>
          <div><b>Capital social :</b> {etab.capital_social ?? "—"}</div>
          <div><b>Effectif :</b> {etab.effectif ?? "—"}</div>
          {/* Ajoute ici toutes les informations identitaires utiles */}
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
      content: etab.documents
        ? <FilteredObjectListView data={etab.documents} />
        : <em>Aucun document trouvé</em>
    },
    {
      label: "Données financières",
      content: etab.finances
        ? <FilteredObjectListView data={etab.finances} />
        : <em>Aucune donnée financière</em>
    },
    {
      label: "Annonces",
      content: etab.annonces
        ? <FilteredObjectListView data={etab.annonces} />
        : <em>Aucune annonce</em>
    },
    {
      label: "Labels & certificats",
      content: etab.labels
        ? <FilteredObjectListView data={etab.labels} />
        : <em>Aucun label/certificat</em>
    },
    {
      label: "Divers",
      content: etab.divers
        ? <FilteredObjectListView data={etab.divers} />
        : <em>Aucune autre information</em>
    }
  ];
  return <Tabs items={onglets} />;
}
