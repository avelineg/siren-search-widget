import React, { useState } from "react";

export type TabItem = { label: string; content: React.ReactNode };

export default function Tabs({ items }: { items: TabItem[] }) {
  const [activeIdx, setActiveIdx] = useState(0);
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        {items.map((t, i) => (
          <button
            key={t.label}
            onClick={() => setActiveIdx(i)}
            style={{
              fontWeight: activeIdx === i ? "bold" : undefined,
              borderBottom: activeIdx === i ? "2px solid #228" : "1px solid #ccc",
              background: "none",
              padding: "0.2em 1em",
              cursor: "pointer"
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div>{items[activeIdx]?.content}</div>
    </div>
  );
}
