import React from "react";

/**
 * Affiche récursivement les clés/valeurs d'un objet,
 * en ignorant les champs dont la valeur est strictement `true` ou `false`.
 */
export default function FilteredObjectListView({ data, level = 0 }: { data: any; level?: number }) {
  // Ne rien afficher pour les booléens purs
  if (typeof data === "boolean") return null;
  if (data === null || data === undefined) return null;
  if (typeof data !== "object") return <span>{String(data)}</span>;
  if (Array.isArray(data)) {
    return (
      <ul style={{ marginLeft: (level + 1) * 20 }}>
        {data.map((item, idx) =>
          <li key={idx}><FilteredObjectListView data={item} level={level + 1} /></li>
        )}
      </ul>
    );
  }
  // Pour les objets
  return (
    <ul style={{ marginLeft: (level + 1) * 20, listStyleType: "disc" }}>
      {Object.entries(data)
        .filter(([_, v]) => typeof v !== "boolean")
        .map(([k, v]) => (
          <li key={k}>
            <strong style={{ color: "#B973AF" }}>{prettifyKey(k)}:</strong>{" "}
            <FilteredObjectListView data={v} level={level + 1} />
          </li>
        ))}
    </ul>
  );
}

function prettifyKey(key: string) {
  return key.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
}
