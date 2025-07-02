import React, { useState } from "react"

type TabItem = {
  label: string
  render: () => React.ReactNode
}

export default function Tabs({ items }: { items: TabItem[] }) {
  const [active, setActive] = useState(0)
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
      <div className="tab-content">{items[active].render()}</div>
    </div>
  )
}
