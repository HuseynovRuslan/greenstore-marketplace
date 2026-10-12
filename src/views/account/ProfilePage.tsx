'use client'

import { Badge } from '@/components/ui/Badge'
import { ButtonLink } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { sellerById } from '@/data/sellers'
import type { AccountProfile, NotificationSettings } from '@/data/user'
import { AccountTabs } from '@/features/account/AccountTabs'
import { SignInPrompt } from '@/features/account/SignInPrompt'
import { AccountPage, Card, Checkbox, PanelTitle } from '@/features/account/ui'
import { useAccount } from '@/features/account/useAccount'
import { ProfileForm } from '@/features/account/profile/ProfileForm'
import { SecurityForm } from '@/features/account/profile/SecurityForm'

const notificationOptions: Array<{ key: keyof NotificationSettings; label: string }> = [
  { key: 'moderation', label: 'Elanın moderasiya nəticəsi' },
  { key: 'expiry', label: 'Müddətin bitməsi haqqında xəbərdarlıq' },
  { key: 'news', label: 'Yeniliklər və xüsusi təkliflər' },
]
const defaultNotifications: NotificationSettings = { moderation: true, expiry: true, news: false }

/** Figma "Profil məlumatları · 1440" (/kabinet/profil). Requires a session. */
export default function ProfilePage() {
  const { account, updateAccount } = useAccount()
  if (!account) return <SignInPrompt next="/kabinet/profil" />

  const seller = sellerById(account.sellerId)
  const notifications = account.notifications ?? defaultNotifications

  return (
    <AccountPage>
      <SectionHeader as="h1" title="Profil məlumatları" subtitle="Hesabınızı və alıcılara görünən məlumatları idarə edin." />
      <AccountTabs active="profile" />

      <div className="grid w-full grid-cols-1 items-start gap-6 xl:grid-cols-[926fr_358fr] xl:gap-7">
        <div className="flex min-w-0 flex-col gap-6">
          {/* keyed by account id so a different sign-in re-initialises the form */}
          <ProfileForm key={account.id} account={account} onSave={updateAccount} />
          <SecurityForm />
        </div>

        <div className="grid min-w-0 grid-cols-1 items-start gap-6 md:grid-cols-2 xl:grid-cols-1">
          {seller && <PublicProfileCard account={account} image={seller.slug === 'abseron-tingcilik' ? '/images/sellers/abseron-tingcilik-profile.webp' : seller.image} slug={seller.slug} />}

          <Card className="w-full gap-5">
            <PanelTitle>Bildiriş seçimləri</PanelTitle>
            {notificationOptions.map((o) => (
              <Checkbox
                key={o.key}
                className="w-full text-sm leading-[1.5]"
                label={o.label}
                checked={notifications[o.key]}
                onChange={(e) => updateAccount({ notifications: { ...notifications, [o.key]: e.target.checked } })}
              />
            ))}
          </Card>

          {account.verified && account.accountType === 'business' && (
            <Notice tone="success" title="Profiliniz təsdiqlənib" className="md:col-span-2 xl:col-span-1">
              Biznes məlumatlarınız yoxlanılıb. Şirkət adı dəyişərsə, təsdiq yenilənə bilər.
            </Notice>
          )}
        </div>
      </div>
    </AccountPage>
  )
}

/** Figma public profile card: 170 px photo, 15 px name, "Təsdiqlənmiş satıcı", "İctimai profilə bax". */
function PublicProfileCard({ account, image, slug }: { account: AccountProfile; image: string; slug: string }) {
  const name = account.companyName || account.fullName
  return (
    <Card className="w-full gap-5">
      <img src={image} alt={name} className="h-[170px] w-full shrink-0 rounded-lg object-cover" />
      <p className="w-full text-[15px] leading-[1.5] font-semibold text-ink">{name}</p>
      {account.verified && <Badge tone="success">Təsdiqlənmiş satıcı</Badge>}
      <ButtonLink href={`/saticilar/${slug}`} variant="secondary" fullWidth>
        İctimai profilə bax
      </ButtonLink>
    </Card>
  )
}
