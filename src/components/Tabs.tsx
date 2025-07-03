import React from 'react'

export default function Tabs({
  labels,
  current,
  onChange
}: {
  labels: string[]
  current: number
  onChange: (i: number) => void
}) {
  return (
    <div className="flex border-b mb-4">
      {labels.map((l, i) => (
        <div
          key={l}
          className={`px-4 py-2 cursor-pointer ${
            current === i
              ? 'border-b-2 border-blue-600 text-blue-600 font-semibold'
              : 'text-gray-600'
          }`}
          onClick={() => onChange(i)}
        >
          {l}
        </div>
      ))}
    </div>
  )
}
