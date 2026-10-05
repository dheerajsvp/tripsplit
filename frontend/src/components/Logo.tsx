import { Split } from 'lucide-react'

export default function Logo({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const boxSize = size === 'sm' ? 'h-7 w-7' : 'h-9 w-9'
  const iconSize = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'
  const textSize = size === 'sm' ? 'text-base' : 'text-xl'

  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`inline-flex ${boxSize} shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white`}
      >
        <Split className={iconSize} strokeWidth={2.5} />
      </span>
      <span className={`${textSize} font-extrabold tracking-tight text-gray-900`}>TripSplit</span>
    </span>
  )
}
