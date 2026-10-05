import type { ButtonHTMLAttributes } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost'
export type ButtonSize = 'md' | 'sm'

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-300',
  secondary: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
  outline: 'border border-gray-300 text-gray-900 hover:bg-gray-50',
  danger: 'border border-red-200 text-red-600 hover:bg-red-50',
  ghost: 'text-gray-500 hover:text-gray-700',
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  md: 'px-4 py-2.5 text-sm',
  sm: 'px-3 py-1.5 text-xs',
}

/** Shared visual style for anything that looks like a button — including
 * <Link>/<a> elements, which can't use the <Button> component below since
 * it renders a real <button>.
 */
export function buttonClasses(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  extraClassName = '',
): string {
  return `inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${extraClassName}`
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

export default function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: ButtonProps) {
  return <button className={buttonClasses(variant, size, className)} {...props} />
}
