import { Suspense } from 'react'
import type { Metadata } from 'next'
import { Clock3, Mail, Phone } from 'lucide-react'
import { ContactForm, ContactFormFromUrl } from '@/features/support/ContactForm'
import { pageMetadata } from '@/seo/metadata'
import { HelpShell } from '@/views/HelpPage'

export const metadata: Metadata = pageMetadata({ title: 'Bizimlə əlaqə', description: 'GreenStore dəstək komandası: telefon, e-poçt və müraciət forması.', canonical: '/elaqe' })

const ways = [
  { icon: Phone, label: 'Telefon', value: '(012) 555 40 40', href: 'tel:+994125554040' },
  { icon: Mail, label: 'E-poçt', value: 'destek@greenstore.az', href: 'mailto:destek@greenstore.az' },
  { icon: Clock3, label: 'İş saatları', value: 'Hər gün 09:00–21:00' },
]

/** /elaqe — support contacts and the message form. DEMO: the number and address are samples. */
export default function Page() {
  return (
    <HelpShell title="Bizimlə əlaqə" lead="Elan, hesab və ya ödənişlə bağlı sualınızı yazın — 2 saat ərzində cavab veririk. Elan haqqındadırsa, «Elan №»-ni qeyd edin.">
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {ways.map(({ icon: Icon, label, value, href }) => (
          <li
            key={label}
            className="relative flex items-start gap-3 rounded-xl border border-line bg-surface p-4 has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-olive"
          >
            <Icon aria-hidden size={20} strokeWidth={1.8} className="mt-0.5 shrink-0 text-forest" />
            <div className="flex flex-col gap-0.5">
              <p className="text-[13px] text-muted">{label}</p>
              {href ? (
                <a
                  href={href}
                  // The whole card is the target (44 px+ on a phone), not only the line of text.
                  className="text-[15px] font-semibold text-ink after:absolute after:inset-0 after:rounded-xl after:content-[''] hover:text-forest hover:underline focus-visible:outline-none"
                >
                  {value}
                </a>
              ) : (
                <p className="text-[15px] font-semibold text-ink">{value}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
      {/* Static HTML has the plain form; in the browser ?movzu= picks its topic (footer «Problem bildir»). */}
      <Suspense fallback={<ContactForm />}>
        <ContactFormFromUrl />
      </Suspense>
    </HelpShell>
  )
}
