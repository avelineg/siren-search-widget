import React from "react";

const Dirigeants = ({ dirigeants }) => (
  <div>
    <h3 className="mb-3 font-semibold text-base">Dirigeants</h3>
    {!Array.isArray(dirigeants) || dirigeants.length === 0 ? (
      <div>Aucun dirigeant trouvé.</div>
    ) : (
      <ul className="space-y-2">
        {dirigeants.map((d, i) => {
          // Extraction pour mise en forme
          const nom = d.nom || d.name || "";
          const prenoms = Array.isArray(d.prenoms) ? d.prenoms.join(" ") : d.prenoms || "";
          const genre =
            d.genre === "1"
              ? "Homme"
              : d.genre === "2"
              ? "Femme"
              : (typeof d.genre === "string" && d.genre.trim() !== "" ? d.genre : undefined);
          const role = d.role ? d.role : undefined;
          const dateNaissance = d.dateNaissance || "";
          const siren = d.siren || "";
          const isPersonneMorale = !prenoms && !dateNaissance && !!siren;

          return (
            <li key={i}>
              <div
                className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 px-2 rounded hover:bg-gray-50"
                style={{ alignItems: "flex-start" }}
              >
                {/* Bloc NOM/PRENOMS/Personne morale */}
                <div className="flex flex-col min-w-[130px] mr-2" style={{ fontWeight: "bold" }}>
                  <span className="uppercase">{nom || "Nom inconnu"}</span>
                  {prenoms && (
                    <span className="block normal-case font-normal tracking-normal">{prenoms}</span>
                  )}
                </div>

                {/* Genre, rôle, etc */}
                <div className="flex flex-wrap items-center gap-x-2 text-gray-700 text-sm flex-1">
                  {genre && (
                    <span className="whitespace-nowrap">({genre})</span>
                  )}
                  {role && (
                    <span>
                      • Rôle&nbsp;:
                      <span className="ml-1">{role}</span>
                    </span>
                  )}
                  {dateNaissance && (
                    <span>
                      • Né(e)<span className="ml-1">{dateNaissance}</span>
                    </span>
                  )}
                  {siren && (
                    <span>
                      • SIREN&nbsp;: <span className="ml-1">{siren}</span>
                    </span>
                  )}
                </div>

                {/* Lien Annuaire-entreprises */}
                <a
                  href={`https://annuaire-entreprises.data.gouv.fr/personne?n=${encodeURIComponent(
                    nom
                  )}&fn=${encodeURIComponent(
                    Array.isArray(d.prenoms)
                      ? d.prenoms[0]
                      : d.prenoms || ""
                  )}${
                    d.dateNaissance
                      ? `&partialDate=${encodeURIComponent(d.dateNaissance)}`
                      : ""
                  }`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto px-3 py-1 rounded border bg-gray-100 hover:bg-gray-200 text-sm font-medium transition"
                  style={{
                    minWidth: 220,
                    textAlign: "center",
                  }}
                >
                  Voir ses entreprises (annuaire-entreprises)
                </a>
              </div>
            </li>
          );
        })}
      </ul>
    )}
  </div>
);

export default Dirigeants;
