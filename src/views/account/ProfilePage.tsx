'use client'

import { useRef } from 'react'
import { Notice } from '@/components/ui/Notice'
import { cityName } from '@/data/cities'
import { sellerById } from '@/data/sellers'
import type { NotificationSettings } from '@/data/user'
import { CabinetHeader } from '@/features/cabinet/CabinetHeader'
import { SignInPrompt } from '@/features/account/SignInPrompt'
import { Card, PanelTitle } from '@/features/account/ui'
import { Switch } from '@/components/ui/FormControls'
import { useAccount } from '@/features/account/useAccount'
import { ProfileCompleteness, profileCompleteness, type CompletenessKey } from '@/features/account/profile/ProfileCompleteness'
import { ProfileForm } from '@/features/account/profile/ProfileForm'
import { ProfileHero, type ProfileHeroHandle } from '@/features/account/profile/ProfileHero'
import { SecurityForm } from '@/features/account/profile/SecurityForm'
import { businessKindsLabel } from '@/features/seller/businessKinds'

const notificationOptions: Array<{ key: keyof NotificationSettings; label: string }> = [
  { key: 'moderation', label: 'Elan yoxlamadan keçəndə və ya rədd ediləndə' },
  { key: 'expiry', label: 'Elanın müddəti bitməzdən 3 gün əvvəl' },
  { key: 'news', label: 'Yeniliklər və xüsusi təkliflər' },
]
const defaultNotifications: NotificationSettings = { moderation: true, expiry: true, news: false }

/**
 * /kabinet/profil. A business sees its profile the way buyers do first (ProfileHero: cover, logo, name, kinds, city,
 * «İctimai profilə bax», with the photos editable in place), «Profilin tamlığı» beside the form, then the form in
 * cards and «Təhlükəsizlik». Requires a session.
 */
export default function ProfilePage() {
  const { account, updateAccount, source } = useAccount()
  const hero = useRef<ProfileHeroHandle>(null)
  if (!account) return <SignInPrompt next="/kabinet/profil" />

  const business = account.accountType === 'business'
  // The public page: the demo seller's from src/data, or (DATA_SOURCE=api) the business's own from the API. A photo
  // removed in the demo is "" (it does not fall back to the demo seller's).
  const demoSeller = sellerById(account.sellerId)
  const slug = account.sellerSlug ?? demoSeller?.slug
  const logo = account.sellerLogo !== undefined ? account.sellerLogo : demoSeller?.logo
  const cover = account.sellerCover !== undefined ? account.sellerCover : demoSeller?.coverImage
  const completeness = profileCompleteness({ logo, cover, about: account.about, address: account.address, email: account.email })
  const notifications = account.notifications ?? defaultNotifications

  const add = (key: CompletenessKey) => {
    if (key === 'logo' || key === 'cover') return hero.current?.pick(key)
    const field = document.getElementById(`profile-${key}`)
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    field?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' })
    field?.focus({ preventScroll: true })
  }

  return (
    <div className="page-x mx-auto flex w-full max-w-[1200px] flex-col gap-6 pt-5 pb-14 md:pt-8">
      <CabinetHeader active="profile" />

      {business && (
        <ProfileHero
          ref={hero}
          name={account.companyName || account.fullName}
          kinds={businessKindsLabel(account.businessKinds)}
          city={account.cityId ? [cityName(account.cityId), account.address].filter(Boolean).join(', ') : account.address}
          verified={account.verified}
          publicHref={slug ? `/saticilar/${slug}` : undefined}
          logo={logo}
          cover={cover}
          api={source === 'api'}
          onSaved={updateAccount}
        />
      )}

      <div className="grid w-full grid-cols-1 items-start gap-6 xl:grid-cols-[926fr_358fr] xl:gap-7">
        <div className="flex min-w-0 flex-col gap-6">
          {/* keyed by account id so a different sign-in re-initialises the form */}
          <ProfileForm key={account.id} account={account} onSave={updateAccount} />
          <SecurityForm />
        </div>

        <div className="grid min-w-0 grid-cols-1 items-start gap-6 md:grid-cols-2 xl:sticky xl:top-24 xl:grid-cols-1">
          {business && <ProfileCompleteness percent={completeness.percent} items={completeness.items} onAdd={add} />}

          <Card className="w-full gap-5">
            <PanelTitle>Bildiriş seçimləri</PanelTitle>
            <div className="flex w-full flex-col gap-1">
              {notificationOptions.map((o) => (
                <Switch
                  key={o.key}
                  label={o.label}
                  checked={notifications[o.key]}
                  onCheckedChange={(on) => updateAccount({ notifications: { ...notifications, [o.key]: on } })}
                />
              ))}
            </div>
          </Card>

          {account.verified && business && (
            <Notice tone="success" title="Profiliniz təsdiqlənib" className="md:col-span-2 xl:col-span-1">
              Biznes məlumatlarınız yoxlanılıb. Şirkət adı dəyişərsə, təsdiq yenilənə bilər.
            </Notice>
          )}
        </div>
      </div>
    </div>
  )
}
