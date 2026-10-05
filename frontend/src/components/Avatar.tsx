const PALETTES = [
  'bg-emerald-100 text-emerald-700',
  'bg-blue-100 text-blue-700',
  'bg-amber-100 text-amber-700',
  'bg-purple-100 text-purple-700',
  'bg-pink-100 text-pink-700',
  'bg-teal-100 text-teal-700',
  'bg-orange-100 text-orange-700',
  'bg-indigo-100 text-indigo-700',
]

// Deterministic, not random — the same name always gets the same color so a
// member's avatar doesn't change every time the list re-renders.
function paletteFor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0
  }
  return PALETTES[Math.abs(hash) % PALETTES.length]
}

export default function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const initial = name.trim().charAt(0).toUpperCase() || '?'
  const sizeClasses = size === 'sm' ? 'h-7 w-7 text-xs' : 'h-9 w-9 text-sm'

  return (
    <span
      className={`inline-flex ${sizeClasses} shrink-0 items-center justify-center rounded-full font-semibold ${paletteFor(name)}`}
    >
      {initial}
    </span>
  )
}
