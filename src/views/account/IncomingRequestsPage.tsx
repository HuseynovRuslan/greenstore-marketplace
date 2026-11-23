import Link from 'next/link'
import { Hammer, Phone } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { ButtonLink, buttonClass } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { PaginationLinks } from '@/components/ui/PaginationLinks'
import { SignInPrompt } from '@/features/account/SignInPrompt'
import { CabinetHeader } from '@/features/cabinet/CabinetHeader'
import { requestDetails, requestTitle, sharedNote } from '@/features/cabinet/incomingRequests'
import { RequestSeenButton } from '@/features/cabinet/RequestSeenButton'
import { telHref } from '@/features/seller/contact'
import { getRepository } from '@/services/repository'

const BASE = '/kabinet/sorgular'

/**
 * /kabinet/sorgular with DATA_SOURCE=api — «Gələn sorğular» (backend-contract.md 4.2): the «Usta çağır» requests that
 * came to the signed-in provider, newest first, rendered on the server. Each has the customer's name and number to
 * call back; a new one is marked «Yeni» until «Baxıldı». The SMS notice may not reach the provider yet (the SMS
 * provider is chosen later), so this page is where requests are found.
 */
export default async function IncomingRequestsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const pageParam = Number(Array.isArray(params.sehife) ? params.sehife[0] : params.sehife)
  const page = Number.isInteger(pageParam) && pageParam >= 1 ? pageParam : 1
  const repo = getRepository()
  const me = await repo.getMe()
  if (!me) return <SignInPrompt next={BASE} />
  const inbox = await repo.listIncomingServiceRequests(page)

  return (
    <div className="page-x mx-auto flex w-full max-w-[1200px] flex-col gap-6 pt-5 pb-14 md:pt-8">
      <CabinetHeader active="requests" counts={{ requests: inbox.unseen }} />
      {inbox.items.length === 0 ? (
        <div className="flex justify-center py-4">
          <EmptyState
            icon={<Hammer aria-hidden size={30} strokeWidth={1.8} absoluteStrokeWidth />}
            title="Gələn sorğu yoxdur"
            description="Müştəri xidmətinizin səhifəsində «Usta çağır» düyməsinə toxunanda və ya sizin şəhərinizdə bu xidməti axtaranda sorğu burada görünür."
            action={
              <ButtonLink href="/elan-yerlesdir" fullWidth>
                Xidmət elanı yerləşdir
              </ButtonLink>
            }
          />
        </div>
      ) : (
        <section aria-labelledby="requests-title" className="flex flex-col gap-3">
          <h2 id="requests-title" className="text-lg leading-[1.3] font-semibold tracking-[-0.01em] text-forest">
            {inbox.total} sorğu{inbox.unseen > 0 ? ` · ${inbox.unseen} yeni` : ''}
          </h2>
          <ul className="flex flex-col gap-3">
            {inbox.items.map((r) => {
              const shared = sharedNote(r)
              return (
                <li key={r.id} className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="min-w-0 text-[16px] leading-[1.35] font-semibold break-words text-ink">{requestTitle(r)}</h3>
                    {!r.seenAt && <Badge tone="warning">Yeni</Badge>}
                  </div>
                  <p className="text-[13px] leading-[1.5] text-muted">{requestDetails(r)}</p>
                  <p className="text-sm leading-[1.5] break-words whitespace-pre-line text-ink">{r.description}</p>
                  {r.service && (
                    <p className="text-[13px] leading-[1.5] text-ink-soft">
                      Xidmət:{' '}
                      <Link href={`/xidmetler/${r.service.slug}`} className="font-semibold text-forest hover:underline">
                        {r.service.title}
                      </Link>
                    </p>
                  )}
                  {shared && <p className="text-[13px] leading-[1.5] font-semibold text-ink-soft">{shared}</p>}
                  <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
                    <a href={telHref(r.customerPhone)} className={buttonClass('primary', 'tabular-nums')}>
                      <Phone aria-hidden size={18} strokeWidth={1.8} />
                      {r.customerName}: {r.customerPhone}
                    </a>
                    {!r.seenAt && <RequestSeenButton id={r.id} />}
                  </div>
                </li>
              )
            })}
          </ul>
          {inbox.pageCount > 1 && <PaginationLinks page={inbox.page} pageCount={inbox.pageCount} basePath={BASE} query="" />}
        </section>
      )}
    </div>
  )
}
