import React from "react";

export default function FilteredObjectListView({ data }: { data: any[] }) {
  if (!Array.isArray(data) || data.length === 0) {
    return <em>Aucune donnée</em>;
  }
  // Si primitives
  if (typeof data[0] !== "object") {
    return (
      <ul>
        {data.map((item, i) => (
          <li key={i}>{String(item)}</li>
        ))}
      </ul>
    );
  }
  // Objet => table
  const cols = Object.keys(data[0]);
  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr>
          {cols.map((c) => (
            <th key={c} style={{ border: "1px solid #ddd", padding: "0.3em" }}>
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row: any, i) => (
          <tr key={i}>
            {cols.map((c) => (
              <td key={c} style={{ border: "1px solid #eee", padding: "0.3em" }}>
                {String(row[c])}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
