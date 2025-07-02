import React from "react"
import Tabs from "./Tabs"
import CarteAdresse from "./CarteAdresse"
import FilteredObjectListView from "./FilteredObjectListView"

export default function EtablissementOnglets({ etab }: { etab: any }) {
  const onglets = [
    {
      label: "Identité",
      render: () => (
        <div className="identite-legal">
          <h2>Informations légales de {etab.denomination}</h2>

          {/* Référentiels publics */}
          <p>
            Toutes les structures référencées sur notre site sont inscritesimport React from "react"
import Tabs from "./Tabs"
import CarteAdresse from "./CarteAdresse"
import FilteredObjectListView from "./FilteredObjectListView"

export default function EtablissementOnglets({ etab }: { etab: any }) {
  const onglets = [
    {
      label: "Identité",
      render: () => (
        <div>
          <h2>{etab.denomination}</h2>
          <div><b>SIREN :</b> {etab.siren}</div>
          <div><b>SIRET :</b> {etab.siret}</div>
          <div><b>N° TVA :</b> {etab.tva?.numero || "–"} {etab.tva?.valide === true ? "✅" : etab.tva?.valide === false ? "❌" : ""}</div>
          <div><b>Activité :</b> {etab.libelle_ape} ({etab.code_ape})</div>
          <div><b>Forme juridique :</b> {etab.forme_juridique}</div>
          <div><b>Date de création :</b> {etab.date_creation}</div>
          <div><b>Tranche d’effectif :</b> {etab.tranche_effectifs || "–"}</div>
          <div><b>Année de validité effectif :</b> {etab.tranche_annee || "–"}</div>
          <div><b>Catégorie entreprise :</b> {etab.categorie_entreprise || "–"}</div>
          <div style={{ margin: "1rem 0" }}>
            <CarteAdresse adresse={etab.adresse} geo={etab.geo} />
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
              const nom = r.individu?.nom || r.personneMorale?.denomination || ""
              const prenom = r.individu?.prenom || ""
              const qualite = r.roleEntreprise || r.qualite || r.fonction || ""
              return (
                <li key={i}>
                  <b>{nom}</b> {prenom} {qualite && <em>— {qualite}</em>}
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
} à
            un ou plusieurs référentiels publics : base Sirene, RNE, RNA.
          </p>
          <ul>
            <li><b>INSEE</b></li>
            <li><b>VIES</b></li>
            <li><b>Douanes</b></li>
            <li><b>INPI</b></li>
            <li><b>État des inscriptions</b></li>
          </ul>

          {/* Extrait RNE */}
          <p>
            L’extrait RNE est le justificatif d’immatriculation de
            l’entreprise. Il contient les mêmes données qu’un extrait KBIS/D1.
          </p>
          <ul>
            <li>
              <b>Inscrite (Insee)</b> le{" "}
              {etab.date_debut_activ || etab.date_creation || "–"}
            </li>
            <li>
              <b>Avis de situation</b>
            </li>
            <li>
              <b>Immatriculée au RNE (INPI)</b> le{" "}
              {etab.date_immatriculation || etab.date_creation || "–"}
            </li>
            <li>
              <b>Extrait RNE</b>
            </li>
          </ul>

          {/* Tableau synthétique */}
          <table className="legal-info-table">
            <tbody>
              <tr>
                <th>Dénomination</th>
                <td>{etab.denomination || "–"}</td>
              </tr>
              <tr>
                <th>SIREN</th>
                <td>{etab.siren || "–"}</td>
              </tr>
              <tr>
                <th>SIRET du siège social</th>
                <td>{etab.siret || "–"}</td>
              </tr>
              <tr>
                <th>N° TVA Intracommunautaire</th>
                <td>{etab.tva?.numero || "–"}</td>
              </tr>
              <tr>
                <th>N° EORI</th>
                <td>{etab.eori || "–"}</td>
              </tr>
              <tr>
                <th>Activité principale (NAF/APE)</th>
                <td>{etab.libelle_ape || "–"}</td>
              </tr>
              <tr>
                <th>Code NAF/APE</th>
                <td>{etab.code_ape || "–"}</td>
              </tr>
              <tr>
                <th>Adresse postale</th>
                <td>
                  <CarteAdresse adresse={etab.adresse} geo={etab.geo} />
                </td>
              </tr>
              <tr>
                <th>Forme juridique</th>
                <td>{etab.forme_juridique || "–"}</td>
              </tr>
              <tr>
                <th>Effectif salarié</th>
                <td>{etab.effectif || "–"}</td>
              </tr>
              <tr>
                <th>Taille de la structure</th>
                <td>{etab.taille_structure || "–"}</td>
              </tr>
              <tr>
                <th>Date de création</th>
                <td>{etab.date_creation || "–"}</td>
              </tr>
              <tr>
                <th>Convention(s) collective(s)</th>
                <td>{etab.conventions || "IDCC 0787"}</td>
              </tr>
            </tbody>
          </table>
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
