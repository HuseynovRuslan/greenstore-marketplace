# Backend üçün müqavilə dəyişiklikləri: təklif (noyabr 2026)

**Status:** istiqamət təsdiqlənib (22 noyabr 2026): 1.2 (slug-da nömrə) və 3.1 (telefon nömrələri yalnız «Nömrəni göstər» ilə). `src/services/repository.ts` və `src/types` hələ **dəyişdirilməyib**. Hər faza başlayanda o fazanın bəndləri ayrıca razılıqla koda keçir.
**Arxitektura:** [`backend/ARCHITECTURE.md`](../../backend/ARCHITECTURE.md).

Burada ASP.NET Core API qoşulanda müqavilədə dəyişməli olan hər şey yığılıb. Hər bəndin yanında fazası və frontend-də nəyə toxunduğu yazılıb. Bəndlərin çoxu **əlavədir** (yeni metod və ya sahə). Mövcud kodu qıran bəndlər **⚠** ilə işarələnib.

## Bütün fazalar: dil (az, ru, en)

- **Repository metodlarına dil parametri əlavə olunmur.** `apiRepository` saytın cari dilini sorğunun kontekstindən oxuyur və API-yə `Accept-Language` başlığı ilə ötürür. Bu, sessiya tokeni ilə eyni üsuldur.
- **Public cavablarda adlar sadə `string` olaraq qalır.** `Category.name`, `City.name`, `PromotionPackage.name`, `summary` və `benefits` istənilən dildə gəlir, o dil yoxdursa `az`-da. Ona görə bu tiplər dəyişmir.
- **Admin cavabları və admin girişləri** üç dilin hamısını daşıyır: ★ `type LocalizedText = { az: string; ru?: string; en?: string }`.
- **Sabit siyahılar API-də koddur.** Bunlar şikayət və rədd səbəbləri (bax: 3.5, 4.1), vahidlər, günəş, su və s.dir. Mətnləri UI tərcümə fayllarında saxlanır. Vahidlər və bitki faktları müqavilədə artıq kod kimidir (`PriceUnit`, `SunNeed`, …), burada dəyişən bir şey yoxdur.

## Faza 1: oxuma

### 1.1 Hər şeyi birdən qaytaran metodlar ⚠

`listPublicListings()`, `listSellers()` və `listServices()` bütün sətirləri qaytarır. Mock üçün bu normaldır, real bazada isə minlərlə elan olacaq. Onları bu yerlər istifadə edir:

| Harada | İndi | Təklif |
|---|---|---|
| `src/seo/sitemap.ts` | üç siyahının hamısı | ★ `listSitemapEntries(kind: 'listing' \| 'seller' \| 'service', cursor?)` → `{ items: { slug, updatedAt }[], nextCursor? }` |
| `elanlar/[slug]/page.tsx` (`generateStaticParams`) | bütün elanlar | `generateStaticParams` çıxır: səhifə ilk sorğuda yaranır və keşlənir |
| `xidmetler/[slug]/page.tsx` | oxşar xidmətləri bütün siyahıdan seçir | ★ `getRelatedServices(service)` → `{ fromProvider, similar }` |
| `saticilar/[slug]/page.tsx` | satıcının xidmətlərini süzür | mövcud `listProviderServices(providerId)` |
| `saticilar/page.tsx` | bütün satıcılar, sonra `type === 'business'` süzgəci | `listSellers({ businessKind?, cityId?, page })` → `PageResult<Seller>` |

### 1.2 Slug-da elanın nömrəsi ⚠

Slug `zeytun-agaci-10482` formasında olur: transliterasiya olunmuş ad, sonra nömrə. Belə slug həmişə unikaldır. API elanı nömrəyə görə tapır. URL-dəki slug köhnədirsə (ad dəyişib), cavabdakı `slug` yenisi olur və səhifə `permanentRedirect()` ilə ona yönləndirir.

Frontend-də dəyişən: `elanlar/[slug]/page.tsx`, bir neçə sətir. Tip dəyişmir.

### 1.3 `subcategoryId` [categories.md-dəki təklif]

`Listing` və `ListingInput` tiplərinə `subcategoryId?: string` əlavə olunur (məsələn `agaclar-meyve`). `subcategory` (ad) qalır. Səbəb: alt kateqoriyanın adı dəyişəndə köhnə elanlar qırılmır.

### 1.4 Filtr sayları

★ `getFacetCounts(state: SearchState)` → `{ categories: Record<id, number>, cities: Record<id, number> }`. Bu sayları indi `src/features/search/facets.ts` mock məlumatdan hesablayır; real rejimdə repository-dən gələcək.

### 1.5 Şəkil ünvanları

`cover`, `images` və `thumbnail` tam URL olur (CDN). `coverTablet` və `coverMobile` göndərilmir, onlar yalnız Figma şəkilləri üçün idi. `ListingCard` onlar olmayanda `cover`-ə keçir, burada heç nə dəyişmir. Dəyişən yeganə şey `next.config.ts`-dir: `images.remotePatterns` və CSP-də `img-src`.

### 1.6 «Razılaşma ilə» qiyməti: müqavilə dəyişmir

API belə elanlar üçün `price: 0` və `priceType: 'agreement'` göndərir. UI bunu artıq «Razılaşma ilə» kimi göstərir (`src/features/listing/facts.ts:53`). «Ucuzdan bahaya» sıralamasında belə elanlar sonda gəlir. Bu bənd [follow-ups.md](follow-ups.md)-dəki «Price 0» sualını bağlayır.

### 1.7 Xidmətin qiyməti sahələrlə

- **Problem.** `Service.priceLabel` hazır azərbaycanca mətndir («25 ₼/m²-dən», `src/data/services.ts`). Üç dildə belə mətni saxlamaq olmur.
- **Təklif.** `Service`-ə ★ `priceType?: PriceType` və ★ `priceUnit?: PriceUnit` əlavə olunur. `priceFrom` artıq var. UI mətni bu sahələrdən cari dildə özü yığır.
- **Keçid dövrü.** UI keçənə qədər API `priceLabel`-i də istənilən dildə hazır göndərir. Sonra `priceLabel` çıxa bilər.

## Faza 2: hesablar

### 2.1 Giriş, çıxış, profil

Bu metodlar müqavilədə ümumiyyətlə yoxdur. İndi istənilən düzgün formatlı giriş demo hesabı açır (`src/views/LoginPage.tsx`).

```ts
login(input: { login: string; password: string }): Promise<LoginResult>      // telefon və ya e-poçt
loginWithOtp(input: { otpChallengeId: string }): Promise<LoginResult>        // purpose: 'login'
logout(): Promise<void>
getMe(): Promise<UserProfile | undefined>
updateMe(patch: { fullName?: string; email?: string }): Promise<UserProfile>
changePassword(input: { current: string; next: string }): Promise<{ ok: boolean }>
changePhone(input: { otpChallengeId: string }): Promise<UserProfile>         // purpose: 'change-phone'

type LoginResult =
  | { ok: true; user: UserProfile }
  | { ok: false; error: 'wrong-credentials' | 'locked' | 'blocked' }
```

- **`register`** `{ userId }` əvəzinə `LoginResult` qaytarır. Qeydiyyatdan sonra istifadəçi dərhal daxil olmuş olur.
- **Sessiya tokeni metodlara parametr kimi ötürülmür.** `apiRepository` onu `cookies()`-dən özü oxuyur, cookie-ni login Server Action-u yazır. Ona görə interfeys sadə qalır.
- **`UserProfile`-a** `role: 'user' | 'moderator' | 'admin'` sahəsi əlavə olunur. `/idareetme` səhifələri bu sahəyə görə qorunur.
- **`UserProfile`-a** ★ `locale: 'az' | 'ru' | 'en'` sahəsi də əlavə olunur. SMS və e-poçt bu dildə gedir. Qeydiyyatda saytın cari dili yazılır, `updateMe` ilə dəyişmək olar.

### 2.2 `listOwnListings(sellerId)` → `listOwnListings()` ⚠

Satıcını sessiya müəyyən edir.

- **Bu, həm də bir xətanı düzəldir:** fərdi istifadəçinin `sellerId`-si yoxdur, ona görə indiki imza ilə o öz elanlarını görə bilməz.
- **`getListingStats(listingId)`** də yalnız elanın sahibinə cavab verir.
- **Frontend-də dəyişən:** `src/features/cabinet/actions.ts`.

### 2.3 Seçilmişlər və yadda saxlanılan axtarışlar

```ts
listFavorites(): Promise<string[]>                                  // ["listing:<id>", "service:<id>"]
setFavorite(kind: 'listing' | 'service', id: string, on: boolean): Promise<void>
mergeFavorites(keys: string[]): Promise<string[]>                   // girişdən sonra qonağın seçilmişləri hesaba keçir
listSavedSearches(): Promise<SavedSearch[]>
saveSearch(input: { name: string; query: string; alerts: boolean }): Promise<SavedSearch>
updateSavedSearch(id: string, patch: { name?: string; alerts?: boolean }): Promise<SavedSearch>
deleteSavedSearch(id: string): Promise<void>
```

Qonaqlar üçün seçilmişlər `localStorage`-da qalır, turbo.az-da da belədir.

## Faza 3: elan dövrü

### 3.1 Telefon nömrələri public cavablardan çıxır ⚠

- **İndi nömrə elan səhifəsinin HTML-inə yazılır** (`src/views/ListingDetailPage.tsx:105`). «Nömrəni göstər» isə yalnız sayğacı artırır. Real məlumatla bütün nömrələr skreypinqlə yığıla bilər.
- **Public cavablardan çıxan sahələr:** `Listing.contactPhone`, `Seller.phone`, `ServiceProvider.phone`. Onların yerinə `phoneMasked?: string` gəlir («+994 50 *** ** 34»).
- **Nömrə yalnız bu metodlarla verilir:**
  - `revealPhone(listingId)` → `{ phone?: string; whatsappUrl?: string }`;
  - ★ `revealSellerPhone(sellerId)`, eyni cavabla.
  - `phoneHidden` elanda yalnız `whatsappUrl` qaytarılır. Xidmətlər də elan olduğu üçün `revealPhone` onlara da işləyir.
- **Frontend-də dəyişən:** `ListingDetailPage`, `ListingContact`, `SellerContact`, `features/services/contact.ts`. Nömrə serverdən render zamanı yox, kliklə gəlir.
- **Admin cavablarında** nömrələr qalır.

### 3.2 Şəkil yükləmə

```ts
createPhotoUpload(input: { fileName: string; contentType: string; bytes: number }):
  Promise<{ photoId: string; uploadUrl: string; expiresAt: string }>
```

Brauzer faylı `uploadUrl`-ə `PUT` edir. Bu, birbaşa API-yə gedir, çünki Vercel funksiyası 4,5 MB-dan böyük sorğu qəbul etmir. `ListingInput.photoIds`-in mənası dəyişmir.

### 3.3 «Elanlarım» əməliyyatları

```ts
getOwnListing(id: string): Promise<Listing | undefined>            // /kabinet/elanlar/[slug] önizləməsi
updateListing(id: string, input: ListingInput): Promise<{ status: 'pending' }>
renewListing(id: string): Promise<Listing>
deactivateListing(id: string): Promise<Listing>
activateListing(id: string): Promise<Listing>
deleteListing(id: string): Promise<void>
```

Bunlar `useCabinet.ts`-də `localStorage`-da saxlanılan dəyişikliklərin yerini tutur.

### 3.4 Baxış sayğacı

★ `recordListingView(listingId)`. Elan səhifəsi keşlənəcək, ona görə baxışı serverdəki render saya bilməz. Səhifə yüklənəndə brauzer Server Action ilə xəbər verir. API eyni ziyarətçinin eyni gün təkrar baxışlarını bir dəfə sayır.

### 3.5 Admin üçün ayrıca interfeys

Admin səhifələri indi birbaşa `src/data/admin`-dən oxuyur. Təklif: ayrıca `AdminRepository`. Beləcə ictimai müqavilə qarışmır.

```ts
interface AdminRepository {
  overview(): Promise<AdminOverview>
  moderationQueue(q: { status?: ModerationStatus; kind?: ModerationKind; sort?: string; page: number }): Promise<PageResult<ModerationItem>>
  decide(listingId: string, d: { decision: 'approve' | 'reject'; reasonCode?: string; explanation?: string; version: string }): Promise<void>
  reports(q: { status?: ComplaintStatus; page: number }): Promise<PageResult<Complaint>>
  updateReport(id: string, patch: { status: ComplaintStatus; note?: string }): Promise<void>
  listCategories(): Promise<Category[]>
  saveCategory(input: Category & { parentId?: string; isActive: boolean }): Promise<Category>
  verifySeller(sellerId: string, verified: boolean): Promise<void>
  blockUser(userId: string, blocked: boolean): Promise<void>
}
```

- `ModerationItem`, `Complaint` və status tipləri `src/data/admin.ts`-dən `src/types`-a köçür.
- `version` sahəsi iki moderatorun eyni elan üzrə qərarı bir-birinin üzərinə yazmasının qarşısını alır.
- **Rədd səbəbləri koda çevrilir ⚠.** İndi `src/data/admin.ts`-dəki `rejectionReasons` azərbaycanca sətirlərdir. Yeni kodlar: `wrong-category`, `wrong-price`, `unverified-contact`, `bad-photos`, `duplicate`, `other`.
  - `Listing.rejectionReason` (mətn) əvəzinə ★ `rejectionReasonCode` və moderatorun öz izahı `rejectionNote` gəlir.
  - Sahibi kabinetdə səbəbi öz dilində görür, çünki mətni UI kodla seçir.

## Faza 4: şikayətlər

### 4.1 Şikayət səbəbi kod olur ⚠

İndi `ReportInput.reason` azərbaycanca sətirdir, məsələn «Satılıb və ya aktual deyil» (`src/features/seller/complaintReasons.ts`). Üç dildə moderator şikayətləri səbəbə görə süzə bilməz və statistika çıxmaz. Təklif:

```ts
type ReportReason =
  | 'sold' | 'wrong-price' | 'wrong-photos' | 'wrong-info' | 'unreachable'
  | 'duplicate' | 'fraud' | 'misconduct' | 'not-provided' | 'stolen-photos' | 'other'

interface ReportInput { target: ReportTarget; targetId: string; reason: ReportReason; comment?: string }
```

| Hədəf | Kodlar (indiki mətnlərin sırası ilə) |
|---|---|
| elan | `sold`, `wrong-price`, `wrong-photos`, `wrong-info`, `unreachable`, `duplicate`, `fraud`, `other` |
| satıcı | `unreachable`, `wrong-info`, `misconduct`, `fraud`, `other` |
| xidmət | `not-provided`, `wrong-price`, `stolen-photos`, `unreachable`, `fraud`, `other` |

`other` olanda `comment` məcburidir, indi də belədir. Frontend-də dəyişənlər: `complaintReasons.ts` kod-mətn cütlərinə çevrilir, `ComplaintDialog` mətni göstərir və kodu göndərir.

## Faza 5: ödəniş

### 5.1 `PromotionOrder.paymentUrl`

`createPromotionOrder` real rejimdə `status: 'pending'` və ★ `paymentUrl?: string` qaytarır. Frontend istifadəçini ödəniş səhifəsinə yönləndirir. Provayder ödənişi təsdiqləyəndə reklam başlayır. Saxta provayder (dev və staging) indiki kimi dərhal `paid` qaytarır.

## Toxunulmayanlar

- **`Listing.vip`** sahəsi adı ilə qalır. API onu `is_promoted`-dən doldurur. UI-da «VIP» sözü yenə işlənmir, yalnız «Önə çıxan».
- **`ListingStatus`** və **`OtpPurpose`** dəyişmir. Enum dəyərləri API-də də eyni kebab-case sətirlərdir.
- **`PageResult`**, **`HomeContent`**, **`ServiceSearchResult`** dəyişmir.
