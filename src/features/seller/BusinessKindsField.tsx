'use client'

import { Fence, Store, Trees } from 'lucide-react'
import { ChoiceCard, FieldGroup } from '@/components/ui/FormControls'
import type { BusinessKind } from '@/types'
import { BUSINESS_KINDS, toggleKind } from './businessKinds'

const OPTIONS: Record<BusinessKind, { title: string; description: string; icon: typeof Trees }> = {
  nursery: { title: 'Tingçilik təsərrüfatı', description: 'Ağac, fidan və ting yetişdirirsiniz', icon: Trees },
  'garden-centre': { title: 'Bağ mərkəzi', description: 'Bitki, dibçək, torpaq və alət satırsınız', icon: Store },
  landscaping: { title: 'Landşaft şirkəti', description: 'Layihə, əkin və bağ baxımı xidməti göstərirsiniz', icon: Fence },
}

/**
 * «Biznesin növü»: one or more of the three kinds (a nursery that is a garden centre too ticks both). Checkbox cards in
 * a fieldset with a legend; `id` goes on the first box, so an error summary can focus it.
 */
export function BusinessKindsField({ value, onChange, error, id, hint = 'Bir və ya bir neçəsini seçin.', className }: { value: readonly BusinessKind[]; onChange: (kinds: BusinessKind[]) => void; error?: string; id?: string; hint?: string; className?: string }) {
  return (
    <FieldGroup legend="Biznesin növü" error={error} hint={hint} className={className}>
      <div className="flex flex-col gap-2.5">
        {BUSINESS_KINDS.map((kind, i) => {
          const { title, description, icon: Icon } = OPTIONS[kind]
          return (
            <ChoiceCard
              key={kind}
              type="checkbox"
              id={i === 0 ? id : undefined}
              name="businessKinds"
              value={kind}
              checked={value.includes(kind)}
              onChange={() => onChange(toggleKind(value, kind))}
              icon={<Icon size={20} strokeWidth={1.8} />}
              title={title}
              description={description}
              className="p-3.5"
            />
          )
        })}
      </div>
    </FieldGroup>
  )
}
