import type { ReactNode } from 'react'

export default function Card({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`rounded-2xl border border-gray-100 bg-white p-4 shadow-sm ${className}`}>
      {children}
    </div>
  )
}
