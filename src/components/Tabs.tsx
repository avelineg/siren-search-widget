import React, { useState } from "react";
import "./Tabs.css";

export type TabItem = { label: string; content: React.ReactNode };

export default function Tabs({ items }: { items: TabItem[] }) {
  const [activeIdx, setActiveIdx] = useState(0);

  return (
    <div className="tabs-widget">
      <div className="tabs-bar">
        {items.map((t, i) => (
          <button
            key={t.label}
            className={`tab-btn${activeIdx === i ? " active" : ""}`}
            onClick={() => setActiveIdx(i)}
            tabIndex={0}
            type="button"
          >
            {t.label}
            {activeIdx === i && <span className="tab-underline" />}
          </button>
        ))}
      </div>
      <div className="tab-content">{items[activeIdx]?.content}</div>
    </div>
  );
}
