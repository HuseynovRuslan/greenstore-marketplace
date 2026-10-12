import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/format'

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'danger'

/*
 * Figma "Düymə" states (components frame):
 * primary   #173f32 → hover #285541, focus 3 px #788149 ring, disabled #e8ebe5 / #727c72
 * secondary white + 1 px #dee3d9 border, text #173f32
 * tertiary  #eaf0e9, text #173f32
 * danger    #b6443f, text white
 */
const variants: Record<ButtonVariant, string> = {
  primary: 'bg-forest text-white hover:bg-forest-hover',
  secondary: 'bg-surface text-forest border border-line hover:border-olive',
  tertiary: 'bg-mint text-forest hover:bg-[#dfe8de]',
  danger: 'bg-danger text-white hover:bg-[#a13a35]',
}

const base =
  'inline-flex min-h-[46px] shrink-0 items-center justify-center gap-2 rounded-lg px-4 py-[11px] text-sm leading-[normal] font-semibold whitespace-nowrap transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-olive focus-visible:ring-inset ' +
  'disabled:bg-disabled disabled:text-muted disabled:border-transparent'

export function buttonClass(variant: ButtonVariant = 'primary', className?: string) {
  return cn(base, variants[variant], className)
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  icon?: ReactNode
  fullWidth?: boolean
}

export function Button({ variant = 'primary', icon, fullWidth, className, children, type = 'button', ...rest }: ButtonProps) {
  return (
    <button type={type} className={buttonClass(variant, cn(fullWidth && 'w-full', className))} {...rest}>
      {icon}
      {children}
    </button>
  )
}

interface ButtonLinkProps extends ComponentProps<typeof Link> {
  variant?: ButtonVariant
  icon?: ReactNode
  fullWidth?: boolean
}

export function ButtonLink({ variant = 'primary', icon, fullWidth, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={buttonClass(variant, cn(fullWidth && 'w-full', className))} {...rest}>
      {icon}
      {children}
    </Link>
  )
}
