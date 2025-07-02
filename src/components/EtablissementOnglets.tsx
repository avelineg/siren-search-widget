import React from "react"
import Tabs from "./Tabs"
import { decodeFormeJuridique, decodeNaf } from "../logic/decode"
import CarteAdresse from "./CarteAdresse"
import FilteredObjectListView from "./FilteredObjectListView"

export default function EtablissementOnglets({ etab }: { etab: any }) {
  const onglets = [
    {
      label: "Identité",
      render: () => (
        <div>
          <h2>{etab.denomination}</h2>
          <div>
            <b>SIREN :</b> {etab.siren}
          </div>
          <div>
            <b>SIRET :</b> {etab.siret}
          </div>
          <CarteAdresse adresse={etab.adresse} geo={etab.geo} />
          <div>
            <b>Activité principale :</b>{" "}
            {etab.code_ape} – {decodeNaf(etab.code_ape)}
          </div>
          <div>
            <b>Forme juridique :</b>{" "}
            {decodeFormeJuridique(etab.forme_juridique)}
          </div>
          <div>
            <b>Date de création :</b> {etab.date_creation}
          </div>
          <div>
            <b>Numéro TVA :</b> {etab.tva?.numero}
            {etab.tva
              ? etab.tva.valide === true
                ? " ✅"
                : etab.tva.valide === false
                ? " ❌"
                : ""
              : ""}
          </div>
        </div>
      ),
    },
    {
      label: "Dirigeants",
      render: () =>
        Array.isArray(etab.representants) && etab.representants.length > 0 ? (
          <ul>
            {etab.representants.map((r: any, i: number) => {
              const nom =
                r.individu?.nom || r.personneMorale?.denomination || ""
              const prenom = r.individu?.prenom || ""
              const qualite =
                r.roleEntreprise || r.qualite || r.fonction || ""
              return (
                <li key={i}>
                  <b>{nom}</b> {prenom}
                  {qualite ? <> — <i>{qualite}</i></> : null}
                </li>
              )
            })}
          </ul>
        ) : (
          <em>Aucun dirigeant trouvé</em>
        ),
    },
    {
      label: "Données financières",
      render: () => <FilteredObjectListView data={etab.finances} />,
    },
    {
      label: "Annonces",
      render: () => <FilteredObjectListView data={etab.annonces} />,
    },
    {
      label: "Labels & certificats",
      render: () => <FilteredObjectListView data={etab.labels} />,
    },
    {
      label: "Divers",
      render: () => <FilteredObjectListView data={etab.divers} />,
    },
  ]

  return <Tabs items={onglets} />
}
