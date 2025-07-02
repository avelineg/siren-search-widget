import React from 'react'

interface TabsProps {
  labels: string[]
  current: number
  onChange: (i: number) => void
}

export default function Tabs({ labels, current, onChange }: TabsProps) {
  return (
    <ul className="flex border-b">
      {labels.map((label, i) => (
        <li key={i} className="-mb-px mr-4">
          <button
            className={`py-2 px-4 font-medium ${
              current === i
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
            onClick={() => onChange(i)}
          >
            {label}
          </button>
        </li>
      ))}
    </ul>
  )
}
