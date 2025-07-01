import React, { useState } from "react";

type TabItem = {
  label: string;
  // on passe data en second paramètre si besoin
  render: (data: any) => React.ReactNode;
};

export default function Tabs({ items, data }: { items: TabItem[]; data?: any }) {
  const [active, setActive] = useState(0);
  return (
    <div className="tabs">
      <ul className="tab-list">
        {items.map((it, i) => (
          <li
            key={i}
            className={i === active ? "active" : ""}
            onClick={() => setActive(i)}
          >
            {it.label}
          </li>
        ))}
      </ul>
      <div className="tab-content">
        {items[active].render(data)}
      </div>
    </div>
  );
}
