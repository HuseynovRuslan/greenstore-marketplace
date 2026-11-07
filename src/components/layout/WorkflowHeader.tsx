import type { ReactNode } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'

/**
 * Focused header of the posting flow (and the moderator tools): the logo and one way out. Leaving keeps the draft,
 * and the link says so. 58 px on phones, 68 px from 768 px.
 */
export function WorkflowHeader({ right }: { right?: ReactNode }) {
  return (
    <header className="sticky top-0 z-40 w-full bg-surface shadow-[inset_0_-1px_0_var(--color-line)]">
      <div className="page-x mx-auto flex h-[58px] w-full max-w-[1440px] items-center justify-between gap-4 md:h-[68px]">
        <Logo />
        {right ?? (
          <Link
            href="/"
            className="-mr-2 inline-flex h-11 items-center gap-1.5 rounded-option px-3 text-sm leading-[normal] font-medium text-ink transition-colors duration-(--dur-fast) hover:bg-mint hover:text-forest"
          >
            <X aria-hidden size={18} strokeWidth={1.8} />
            Çıx<span className="sr-only">: qaralama saxlanılır</span>
          </Link>
        )}
      </div>
    </header>
  )
}
