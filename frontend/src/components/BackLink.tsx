import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export default function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-700"
    >
      <ChevronLeft className="h-4 w-4" />
      {children}
    </Link>
  )
}
