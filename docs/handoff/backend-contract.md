# Backend üçün müqavilə dəyişiklikləri: təklif (noyabr 2026)

**Status:** istiqamət təsdiqlənib (22 noyabr 2026): 1.2 (slug-da nömrə) və 3.1 (telefon nömrələri yalnız «Nömrəni göstər» ilə). Bütün bəndlər bu iş üçün təsdiqlənib. Faza 1 həm API, həm frontend tərəfində yazılıb (bəndlərdə «Implemented (phase 1)»): `src/services/repository.ts` və `src/types` 1.1–1.7 və 3.1-ə görə dəyişib, `DATA_SOURCE=api` rejimini `src/services/apiRepository.ts` işlədir. Faza 2 (2.1, 2.2, 2.3) həm API, həm frontend tərəfində yazılıb («Implemented (phase 2)»): `DATA_SOURCE=api` rejimində giriş, qeydiyyat, profil, «mağaza», seçilmişlər və axtarışlar API ilə işləyir; `DATA_SOURCE=mock` əvvəlki kimidir. Faza 3 həm API, həm frontend tərəfində yazılıb («Implemented (phase 3)»: 1.3-ün `ListingInput.subcategoryId`-si, 1.5, 2.2, 3.1–3.6 və aşağıdakı ★ əlavələr): `DATA_SOURCE=api` rejimində şəkil yükləmə, elan yerləşdirmə, «Elanlarım», moderasiya səhifəsi, sayğaclar, «Nömrəni göstər» və keşin yenilənməsi API ilə işləyir; `DATA_SOURCE=mock` əvvəlki kimidir.
**Arxitektura:** [`backend/ARCHITECTURE.md`](../../backend/ARCHITECTURE.md).

Burada ASP.NET Core API qoşulanda müqavilədə dəyişməli olan hər şey yığılıb. Hər bəndin yanında fazası və frontend-də nəyə toxunduğu yazılıb. Bəndlərin çoxu **əlavədir** (yeni metod və ya sahə). Mövcud kodu qıran bəndlər **⚠** ilə işarələnib.

## Bütün fazalar: dil (az, ru, en)

> **Implemented (phase 0), API tərəfi:** dil `Accept-Language` başlığından seçilir (`az`, `ru`, `en`; standart və ehtiyat dil `az`), cavabda `Content-Language` və `Vary: Accept-Language` olur; `LocalizedText` `{ az, ru?, en? }` bazada `jsonb`-dir; sabit siyahılar JSON-da kebab-case koddur (`bare-root`, `garden-centre`). Frontend tərəfi hələ yoxdur: `apiRepository`-nin başlığı göndərməsi faza 1-də, TypeScript `LocalizedText` tipi admin fazasında gəlir. `repository.ts` və `src/types` faza 0-da dəyişmədi.

> **Implemented (phase 1), frontend tərəfi:** `apiRepository` hər sorğuda `Accept-Language: az` göndərir (sayt hələ yalnız Azərbaycan dilindədir; dil başlığı fetch keşinin açarına daxildir, ona görə ru və en gələndə keş dilə görə ayrılacaq).

- **Repository metodlarına dil parametri əlavə olunmur.** `apiRepository` saytın cari dilini sorğunun kontekstindən oxuyur və API-yə `Accept-Language` başlığı ilə ötürür. Bu, sessiya tokeni ilə eyni üsuldur.
- **Public cavablarda adlar sadə `string` olaraq qalır.** `Category.name`, `City.name`, `PromotionPackage.name`, `summary` və `benefits` istənilən dildə gəlir, o dil yoxdursa `az`-da. Ona görə bu tiplər dəyişmir.
- **Admin cavabları və admin girişləri** üç dilin hamısını daşıyır: ★ `type LocalizedText = { az: string; ru?: string; en?: string }`.
- **Sabit siyahılar API-də koddur.** Bunlar şikayət və rədd səbəbləri (bax: 3.5, 4.1), vahidlər, günəş, su və s.dir. Mətnləri UI tərcümə fayllarında saxlanır. Vahidlər və bitki faktları müqavilədə artıq kod kimidir (`PriceUnit`, `SunNeed`, …), burada dəyişən bir şey yoxdur.

## Faza 1: oxuma

### 1.1 Hər şeyi birdən qaytaran metodlar ⚠

> **Implemented (phase 1), API tərəfi:** `GET /api/v1/sitemap/{listing|seller|service}?cursor&limit` → `{ items: [{ slug, updatedAt }], nextCursor? }` (`nextCursor` geri `cursor` kimi göndərilir); `GET /api/v1/sellers?businessKind&cityId&page&pageSize` → `PageResult<Seller>`; `GET /api/v1/services/{id}/related` → `{ fromProvider, similar }`; `GET /api/v1/providers/{id}/services`. 
>
> **Implemented (phase 1), frontend tərəfi:** ★ `listSitemapEntries(kind, cursor?)` → `SitemapPage` (`src/seo/sitemap.ts` kursoru izləyir; mock bir səhifədə qaytarır, satıcı və xidmətlərin tarixi olmadığı üçün `updatedAt` mock-da boş qalır, ona görə tipdə `updatedAt?`); ★ `getRelatedServices(service)`; `listSellers({ businessKind?, cityId?, page, pageSize? })` → `PageResult<Seller>` (`/saticilar` səhifələnir, növ tablarının sayları ayrıca sorğu ilə); `listPublicListings()` və `listServices()` müqavilədən çıxıb. `generateStaticParams` API rejimində heç nə qaytarmır (`prerenderedSlugs`): elan və xidmət səhifəsi ilk sorğuda yaranır və `revalidate: 60` ilə keşlənir; mock rejimində demo səhifələr əvvəlki kimi build zamanı yaranır. Satıcı səhifəsi xidmətləri `listProviderServices(seller.id)` ilə alır: biznesin provayder id-si mock-da satıcının id-sidir, API-də `GET /providers/{id}/services` artıq satıcı id-sini də qəbul edir. Əlavə: `searchListings` sorğusuna ★ `sellerId?` gəlib (ARCHITECTURE.md §7-dəki `GET /listings?sellerId=`): satıcı səhifəsi satıcının elanlarını bununla yükləyir (ən çox 240), əvvəl isə client komponenti bütün mock elanlarını brauzerə yükləyirdi.

`listPublicListings()`, `listSellers()` və `listServices()` bütün sətirləri qaytarır. Mock üçün bu normaldır, real bazada isə minlərlə elan olacaq. Onları bu yerlər istifadə edir:

| Harada | İndi | Təklif |
|---|---|---|
| `src/seo/sitemap.ts` | üç siyahının hamısı | ★ `listSitemapEntries(kind: 'listing' \| 'seller' \| 'service', cursor?)` → `{ items: { slug, updatedAt }[], nextCursor? }` |
| `elanlar/[slug]/page.tsx` (`generateStaticParams`) | bütün elanlar | `generateStaticParams` çıxır: səhifə ilk sorğuda yaranır və keşlənir |
| `xidmetler/[slug]/page.tsx` | oxşar xidmətləri bütün siyahıdan seçir | ★ `getRelatedServices(service)` → `{ fromProvider, similar }` |
| `saticilar/[slug]/page.tsx` | satıcının xidmətlərini süzür | mövcud `listProviderServices(providerId)` |
| `saticilar/page.tsx` | bütün satıcılar, sonra `type === 'business'` süzgəci | `listSellers({ businessKind?, cityId?, page })` → `PageResult<Seller>` |

### 1.2 Slug-da elanın nömrəsi ⚠

> **Implemented (phase 1), API tərəfi:** slug `<translit başlıq>-<nömrə>`-dir (`zeytun-agaci-olea-europaea-10482`; Azərbaycan hərfləri ASCII-yə, rus hərfləri translit ilə). `GET /api/v1/listings/{slug}` və `GET /api/v1/services/{slug}` əvvəl dəqiq slug-ı, sonra slug-ın sonundakı nömrəni axtarır; cavabdakı `slug` həmişə cari slug-dır.
>
> **Implemented (phase 1), frontend tərəfi:** `elanlar/[slug]` və `xidmetler/[slug]` cavabdakı `slug` URL-dəkindən fərqlidirsə, `permanentRedirect()` ilə (308) cari ünvana keçir.

Slug `zeytun-agaci-10482` formasında olur: transliterasiya olunmuş ad, sonra nömrə. Belə slug həmişə unikaldır. API elanı nömrəyə görə tapır. URL-dəki slug köhnədirsə (ad dəyişib), cavabdakı `slug` yenisi olur və səhifə `permanentRedirect()` ilə ona yönləndirir.

Frontend-də dəyişən: `elanlar/[slug]/page.tsx`, bir neçə sətir. Tip dəyişmir.

### 1.3 `subcategoryId` [categories.md-dəki təklif]

> **Implemented (phase 1), API tərəfi:** public `Listing` cavabında `subcategoryId` var, `subcategory` (ad) sorğunun dilində gəlir. **Implemented (phase 1), frontend tərəfi:** `Listing.subcategoryId?` `src/types`-dadır, mock onu `subcategory` adından çıxarır. `ListingInput.subcategoryId` elan yerləşdirmə ilə (faza 3) gəlir.
>
> **Implemented (phase 3), API tərəfi:** `ListingInput` həm `subcategoryId`-ni, həm də sihirbazın indi göndərdiyi `subcategory` adını (Azərbaycanca, hərf və böyük-kiçik fərqi nəzərə alınmadan) qəbul edir; ikisi də varsa, `subcategoryId` həlledicidir.
>
> **Phase 3, frontend tərəfi:** sihirbaz hələ `subcategory` adını göndərir (API qəbul edir); `ListingInput.subcategoryId`-ni göndərmək sihirbazın alt kateqoriyanı id ilə saxlamasını tələb edir, sayt tərcümə olunanda gəlir.

`Listing` və `ListingInput` tiplərinə `subcategoryId?: string` əlavə olunur (məsələn `agaclar-meyve`). `subcategory` (ad) qalır. Səbəb: alt kateqoriyanın adı dəyişəndə köhnə elanlar qırılmır.

### 1.4 Filtr sayları

> **Implemented (phase 1), API tərəfi:** `GET /api/v1/listings/facets?<kataloqun parametrləri>` → `{ categories: { all, byId }, subcategories, cities: { all, byCity } }`, `facets.ts`-dəki `FacetCounts` ilə eyni forma və eyni qayda (`selectCategory`: kateqoriya seçiləndə alt kateqoriya düşür, «Kök sistemi» yalnız o filtri olan kateqoriyada qalır). API tərəfində 60 saniyəlik keş hələ yoxdur: Next-in `revalidate: 60` keşi bu fazada kifayətdir.
>
> **Implemented (phase 1), frontend tərəfi:** ★ `getFacetCounts(state)` → `FacetCounts` (`repository.ts`); `features/search/facets.ts` artıq hər seçim üçün ayrıca axtarış etmir, repository-ni bir dəfə çağırır (mock eyni qaydanı öz məlumatında sayır). Ana səhifənin şəhər sayları da buradan gəlir.

★ `getFacetCounts(state: SearchState)` → `{ categories: Record<id, number>, cities: Record<id, number> }`. Bu sayları indi `src/features/search/facets.ts` mock məlumatdan hesablayır; real rejimdə repository-dən gələcək.

### 1.5 Şəkil ünvanları

> **Implemented (phase 1), API tərəfi:** `cover`, `images` (və satıcının `image`, `coverImage`, `logo`) şəkil ünvanlarıdır. Demo şəkillər `/images/...` yolu ilə qalır (Next `public/`-dan verir); yüklənən şəkillər faza 3-də `Media:BaseUrl` (CDN) altında olacaq. `coverTablet`, `coverMobile`, `thumbnail` göndərilmir.
>
> **Phase 1, frontend tərəfi:** dəyişən yoxdur: demo şəkillər saytın öz `/images/...` yoludur. `next.config.ts`-də `images.remotePatterns` və CSP-nin `img-src`-i yüklənən şəkillərlə (faza 3, `Media:BaseUrl`) genişlənəcək. `ListingCard` `coverTablet`/`coverMobile` olmayanda `cover`-i göstərir.
>
> **Implemented (phase 3), API tərəfi:** yüklənən şəklin ünvanı onun 1280 px WebP nüsxəsidir: `{Media:BaseUrl}/p/<il>/<ay>/<id>/1280.webp` (320 və 640 nüsxələri eyni qovluqdadır). Development-də `Media:BaseUrl` `http://localhost:5080/media`-dır (API faylları özü verir), ona görə frontend addımında `next.config.ts`-ə `remotePatterns` (`localhost:5080`, sonra CDN) və CSP-yə `img-src` əlavə olunmalıdır.
>
> **Implemented (phase 3), frontend tərəfi:** `src/seo/csp.ts` CSP-nin `img-src`-inə və `images.remotePatterns`-ə `MEDIA_BASE_URL`-i (boşdursa `<API_PUBLIC_URL>/media`, o da boşdursa `<API_BASE_URL>/media`), `connect-src`-ə API-nin ictimai ünvanını (`API_PUBLIC_URL`, boşdursa `API_BASE_URL`) yazır; `DATA_SOURCE=mock` rejimində siyasət əvvəlki kimi yalnız `'self'`-dir. Kartlar və qalereya şəkilləri `<img>` ilə göstərir, `next/image` yalnız ana səhifənin demo şəkilləridir.

`cover`, `images` və `thumbnail` tam URL olur (CDN). `coverTablet` və `coverMobile` göndərilmir, onlar yalnız Figma şəkilləri üçün idi. `ListingCard` onlar olmayanda `cover`-ə keçir, burada heç nə dəyişmir. Dəyişən yeganə şey `next.config.ts`-dir: `images.remotePatterns` və CSP-də `img-src`.

### 1.6 «Razılaşma ilə» qiyməti: müqavilə dəyişmir

> **Implemented (phase 1):** belə elanda `price: 0`, `priceType: 'agreement'`; «Ucuzdan bahaya» və «Bahadan ucuza» sıralamasında sonda gəlir. Qiymət filtri olanda bu elanlar tapılmır, çünki qiymətləri yoxdur (mock-da `maxPrice` onları 0 ₼ kimi tapırdı).

API belə elanlar üçün `price: 0` və `priceType: 'agreement'` göndərir. UI bunu artıq «Razılaşma ilə» kimi göstərir (`src/features/listing/facts.ts:53`). «Ucuzdan bahaya» sıralamasında belə elanlar sonda gəlir. Bu bənd [follow-ups.md](follow-ups.md)-dəki «Price 0» sualını bağlayır.

### 1.7 Xidmətin qiyməti sahələrlə

> **Implemented (phase 1), API tərəfi:** `Service` cavabında `priceType`, `priceUnit` və `priceFrom` var; keçid dövrü üçün `priceLabel` sorğunun dilində hazır mətndir («25 ₼/m²-dən», «от 25 ₼/м²», «from 25 ₼/m²»; ru və en qaralamadır). **Implemented (phase 1), frontend tərəfi:** `Service.priceType?` və `priceUnit?` `src/types`-dadır. UI hələ `priceLabel`-i göstərir; qiyməti sahələrdən cari dildə yığmaq sayt tərcümə olunanda gəlir.

- **Problem.** `Service.priceLabel` hazır azərbaycanca mətndir («25 ₼/m²-dən», `src/data/services.ts`). Üç dildə belə mətni saxlamaq olmur.
- **Təklif.** `Service`-ə ★ `priceType?: PriceType` və ★ `priceUnit?: PriceUnit` əlavə olunur. `priceFrom` artıq var. UI mətni bu sahələrdən cari dildə özü yığır.
- **Keçid dövrü.** UI keçənə qədər API `priceLabel`-i də istənilən dildə hazır göndərir. Sonra `priceLabel` çıxa bilər.

## Faza 2: hesablar

### 2.1 Giriş, çıxış, profil

> **Implemented (phase 2), API tərəfi** (frontend tərəfi aşağıda). Hamısı `/api/v1` altındadır; uğursuz cavablar ProblemDetails-dir, `apiRepository` onların `code`-unu (prefikssiz) müqavilənin `error` sahəsinə çevirir.
>
> - **SMS kodu.** `POST /auth/otp` `{ phone, purpose }` → `OtpChallenge` (`demoCode` yalnız `Otp:ExposeDemoCode=true` olanda, bu da yalnız Development-də mümkündür; Staging və Production onunla başlamır). Xətalar: 400 `validation` (`errors.phone`: `required`, `invalid`, `not-mobile`; kod yalnız +994 mobil nömrələrinə gedir), 409 `account.phone-taken` (`register`, `change-phone`), 404 `account.not-found` (`login`, `reset-password`: hesabı olmayan nömrəyə SMS getmir), 403 `auth.blocked`, 401 (`change-phone` sessiya tələb edir), 429 `otp.too-soon` / `otp.phone-limit` / `otp.ip-limit` (`Retry-After` ilə), 503 `otp.unavailable` (gündəlik ümumi limit və ya SMS provayderi). `POST /auth/otp/verify` `{ challengeId, code }` → `{ ok: true }`; səhv kod 400 `otp.wrong-code` + `attemptsLeft`, 400 `otp.too-many-attempts` (`attemptsLeft: 0`), 400 `otp.expired`. Bu üç kod `OtpVerifyResult.error`-un dəyərləridir.
> - **Qeydiyyat.** `POST /accounts` `RegistrationInput` (+ könüllü `cityId`, `client`, `deviceName`) → 201 `{ ok: true, user: UserProfile, session: { id, token, expiresAt } }`, yəni `LoginResult` + sessiya. Biznes hesabı eyni tranzaksiyada `sellers` sətrini də yaradır (slug şirkətin adından, `cityId` verilməyibsə «Bakı»). Xətalar: 400 `validation`, 400 `otp.not-verified`, 409 `account.phone-taken` / `account.email-taken`.
> - **Giriş.** `POST /auth/login` `{ login, password }` (telefon istənilən yazılışda və ya e-poçt) və `POST /auth/login/otp` `{ otpChallengeId }` → `{ ok, user, session }`. Xətalar: 401 `auth.wrong-credentials`, 423 `auth.locked` (5 səhv şifrədən sonra 15 dəqiqə, `Retry-After`), 403 `auth.blocked`, 429 `auth.too-many-attempts` (bir IP-dən çox səhv şifrə). SMS ilə giriş bağlanmış hesabı da açır. `POST /auth/logout` → 204.
> - **Sessiya.** Token `session.token`-dədir (43 simvol); sayt onu `gs_session` cookie-sində saxlayıb hər sorğuda `Authorization: Bearer <token>` göndərir. 30 gün son istifadədən sayılır; 401 `unauthorized` gələndə cookie silinir.
> - **Profil.** `GET /me` → `UserProfile` + `role`, `locale` (`email` yoxdursa `""`, `phone` E.164: `+994505551234`). `PATCH /me` `{ fullName?, email?, locale? }` (`email: ""` və ya `null` silir). `POST /me/password` `{ current, next }` → `{ ok: true }` (400 `auth.wrong-password`; digər sessiyalar ləğv olunur). `POST /me/phone` `{ otpChallengeId }` → `UserProfile`. `POST /accounts/password-reset` → `{ ok: true }` (bütün sessiyalar ləğv olunur).
> - ★ **Aktiv cihazlar:** `GET /me/sessions` → `[{ id, client: 'web' | 'ios' | 'android', deviceName?, createdAt, lastSeenAt, expiresAt, current }]`, `DELETE /me/sessions/{id}` → 204.
> - ★ **Biznes profili («mağaza»):** `GET /me/seller` → public `Seller` + sahibin öz `phone`-u (varsa) və `version`; `PATCH /me/seller` göndərilən sahələri dəyişir: `name`, `businessKind`, `cityId`, `contactPerson`, `address`, `about`, `terms`, `hours`, `offers`, `phone`, `whatsapp`, `email`, `instagram`, `website`, `responseMinutes`, `location`, könüllü `version` (köhnədirsə 409 `concurrency-conflict`). `""`, `null` və ya `[]` dəyəri silir. Slug ad dəyişəndə dəyişmir. Fərdi hesabda 404 `seller.not-found`. Dəyişiklik `/sellers/{slug}` və `/sellers`-də dərhal görünür.
> - **Qeyd.** Profil formasındakı fərdi hesabın «Şəhər» və «Ünvan» sahələri üçün `users` cədvəlində yer yoxdur (DATABASE.md §3.2), ona görə API onları saxlamır; biznesdə onlar `PATCH /me/seller`-dədir.
>
> **Implemented (phase 2), frontend tərəfi:**
>
> - **Müqavilə.** `repository.ts`-ə `login`, `loginWithOtp`, `logout`, `getMe`, `updateMe`, `changePassword`, `changePhone`, ★ `getOwnSeller`, ★ `updateOwnSeller` gəlib; `register` `LoginResult` qaytarır. `src/types`-da `UserProfile.role` (`UserRole`) və `locale` (`Locale`), `LoginResult`, `LoginError`, `ProfilePatch`, ★ `OwnSeller`, ★ `SellerProfilePatch` var. `LoginResult`-un `ok: false` cavabına könüllü ★ `retryAfterSec` əlavə olunub (`Retry-After`, «N dəqiqə sonra yenidən yoxlayın» üçün); `auth.too-many-attempts` (bir IP-dən çox səhv şifrə) də `locked` kimi gəlir, çünki istifadəçiyə məsləhət eynidir.
> - **Sessiya.** Giriş və qeydiyyat Server Action-ları (`src/features/auth/actions.ts`) API-nin tokenini httpOnly `gs_session` cookie-sində saxlayır (production-da Secure, SameSite=Lax, 30 gün, `path=/`; `src/services/session.ts`). Yanında `gs_hint` cookie-si yazılır: yalnız «daxil olub» və avatarın baş hərfləri (token və ad yoxdur), `src/state/bootstrap.ts`-dəki skript ilk rəsmdən əvvəl onu oxuyur. Cookie-lər bir gündən köhnədirsə, növbəti girişdə yenidən 30 günlük yazılır (API-nin sessiyası da son istifadədən sayılır). 401 gələndə hər ikisi silinir. `apiRepository` tokeni `cookies()`-dən özü oxuyur və hər şəxsi sorğuda `Authorization: Bearer` göndərir; ziyarətçinin IP-si (`X-Client-IP`) və brauzeri (`User-Agent`, «Aktiv cihazlar»ın adı üçün) də gedir. IP yalnız hostinqin proxy-sinin yazdığı başlıqdan götürülür (`CLIENT_IP_HEADER` və ya `X-Forwarded-For`-un sağdan `TRUSTED_PROXY_HOPS`-cu elementi, `src/services/clientIp.ts`), brauzerin göndərdiyi birinci elementdən yox.
> - **Səhifələr.** `/daxil-ol` (şifrə və SMS), `/qeydiyyat`, `/sifreni-berpa-et` API-yə gedir; bərpadan sonra API bütün sessiyaları bağladığı üçün sayt yeni şifrə ilə özü daxil olur. Səhvlər ProblemDetails `code`-una görə Azərbaycan dilində göstərilir (`src/features/auth/messages.ts`). Səhifə yüklənəndə store `gs_hint` varsa serverdən soruşur kim daxil olub (`loadSession`: `GET /me`, biznesdə `GET /me/seller`, `GET /me/favorites`). `/kabinet/profil` `PATCH /me` və biznesdə `PATCH /me/seller` (`version` ilə) yazır, `/saticilar/<slug>` və `/saticilar` dərhal yenilənir (`updateTag('sellers')`); profildəki «İctimai profilə bax» həmin səhifəyə aparır. Nömrə dəyişəndə yeni nömrəyə SMS kodu gedir (`change-phone`), təsdiqdən sonra `POST /me/phone`. «Təhlükəsizlik» `POST /me/password`-dur. Telefon UI-da `+994 50 555 12 34` kimi göstərilir (API E.164 göndərir).
> - **Fərdi hesabın «Şəhər» və «Ünvan» sahələri** API rejimində göstərilmir (saxlanacaq yer yoxdur). Bildiriş açarlarının da API-də sütunu yoxdur: API rejimində hesab üzrə bu brauzerdə saxlanılır.
> - **Mock.** `mockRepository` yeni metodlara demo hesab adından, yaddaşda cavab verir (`mockAccount`, `src/services/mockWrites.ts`); mock rejimində səhifələr əvvəlki kimi brauzerdə daxil olur. ★ «Aktiv cihazlar» (`GET /me/sessions`) üçün UI yoxdur, ona görə müqaviləyə hələ gəlməyib.

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

> **Implemented (phase 3), API tərəfi:** `GET /me/listings` → sessiyanın hesabının bütün elanları (məhsul və xidmət), silinmişlərdən başqa hər statusda, son dəyişən birinci. Hər biri public `Listing` formasındadır, üstəlik sahibin sahələri: `contactPhone` (E.164), ★ `kind` (`product` / `service`), ★ `contactPhoneVerified`, ★ `rejectionReasonCode`, ★ `rejectionNote` (yalnız `rejected`-də), ★ `submittedAt`, ★ `version`. Xidmətin `attributes`-i onun ərazilərinin adlarıdır (sihirbazın önizləməsi kimi). Fərdi hesab da öz elanlarını görür. Qaralamalar bu siyahıda deyil: `GET /me/drafts` (aşağıda, 3.3). `getListingStats` `GET /me/listings/{id}/stats`-dır (3.3).
>
> **Implemented (phase 3), frontend tərəfi:** `listOwnListings()` `GET /me/listings`-dir və ★ `OwnListing[]` qaytarır (`src/types`: `Listing` + `kind`, `contactPhoneVerified`, `rejectionReasonCode?`, `rejectionNote?`, `submittedAt?`, `version`, ★ `photoIds`); `getListingStats` `GET /me/listings/{id}/stats`-dır, kabinet hər elanın statistikasını bir anda ən çox 6 sorğu ilə alır. Sahibin nömrəsi saytın yazılışında gəlir (`+994 50 555 12 34`). ★ `photoIds` (backend dəyişikliyi, bu addımda əlavə olunub): elanın şəkillərinin id-ləri `images` ilə eyni sırada; «Redaktə et» şəkilləri yenidən yükləmədən geri göndərir. Mock demo satıcının elanlarını `OwnListing` kimi qaytarır.
>
> **Implemented (phase 2), frontend tərəfi (müqavilə):** `listOwnListings()` parametrsizdir; `src/features/cabinet/actions.ts` satıcı id-si qəbul etmir. Mock demo satıcının elanlarını qaytarır (brauzerdəki demo sessiyada satıcı olanda soruşulur). API rejimində `GET /me/listings` gələnə qədər sessiyanın biznesinin aktiv elanları (`GET /me` → `sellerId` → `GET /listings?sellerId=`, ən çox 240) göstərilir, fərdi hesabda boş siyahı; `getListingStats` faza 3-ə qədər yoxdur, kabinet rəqəmləri 0 göstərir.

Satıcını sessiya müəyyən edir.

- **Bu, həm də bir xətanı düzəldir:** fərdi istifadəçinin `sellerId`-si yoxdur, ona görə indiki imza ilə o öz elanlarını görə bilməz.
- **`getListingStats(listingId)`** də yalnız elanın sahibinə cavab verir.
- **Frontend-də dəyişən:** `src/features/cabinet/actions.ts`.

### 2.3 Seçilmişlər və yadda saxlanılan axtarışlar

> **Implemented (phase 2), API tərəfi** (frontend tərəfi aşağıda).
>
> - **Seçilmişlər:** `GET /me/favorites` → `string[]` (`listing:<id>`, `service:<id>`, köhnədən yeniyə: sayt da belə əlavə edir); `PUT` və `DELETE /me/favorites/{listing|service}/{id}` → 204, ikisi də təkrar olunanda təsirsizdir; yeni seçilmiş aktiv elan olmalıdır (404 `listing.not-found` / `service.not-found`). `POST /me/favorites/merge` `{ keys }` → birləşmiş siyahı: səhv formalı açarlar (məsələn demo id-ləri), başqa növ və aktiv olmayan elanlar buraxılır, ən çox 500 açar. `listing_counters.favourites` eyni tranzaksiyada yalnız sətir həqiqətən dəyişəndə ±1 olur. ★ `GET /me/favorites/items` → `{ listings: Listing[], services: Service[] }`: «Seçilmişlər» səhifəsi üçün kartlar, açarların sırası ilə (aktiv olmayan elanın kartı yoxdur, açarı qalır).
> - **Axtarışlar:** `GET /me/saved-searches` → `SavedSearch[]` (yenidən köhnəyə, `newCount` ilə: axtarışın filtrinə uyğun, sonuncu açılışdan sonra dərc olunmuş elanlar). `POST` `{ name, query, alerts }` → 201; eyni filtrlər artıq saxlanıbsa 200 və köhnə id (ad və `alerts` yenilənir). `query` saytın `filterQuery`-si kimi saxlanır (`sehife`, `siralama`, `gorunus` çıxır, parametrlər sıralanır). Hesabda ən çox 20 axtarış qalır, ən köhnəsi çıxır (sayt kimi). `PATCH /me/saved-searches/{id}` `{ name?, alerts? }`, `DELETE` → 204. ★ `POST /me/saved-searches/{id}/opened` → `newCount: 0` (istifadəçi axtarışı açdı).
>
> **Implemented (phase 2), frontend tərəfi:** `repository.ts`-də `listFavorites`, `setFavorite`, `mergeFavorites`, ★ `listFavoriteItems`, `listSavedSearches`, `saveSearch`, `updateSavedSearch`, `deleteSavedSearch`, ★ `markSavedSearchOpened`; `src/types`-da ★ `FavoriteItems`, ★ `SavedSearchInput`. API rejimində daxil olmuş ziyarətçinin ürəkləri API-yə gedir (dərhal göstərilir, alınmasa geri qayıdır), girişdən sonra qonağın bu brauzerdəki seçilmişləri `mergeFavorites` ilə hesaba keçir və brauzerdən silinir. «Seçilmişlər» səhifəsi kartları `GET /me/favorites/items`-dən alır. Qonaqların seçilmişləri `localStorage`-da qalır; API-də id ilə public kart oxuması olmadığı üçün API rejimində qonaq «Seçilmişlər» səhifəsində kartların yerinə «daxil olun» görür (ürəklər qalır, girişdə hesaba keçir). «Axtarışlarım» və «Axtarışı yadda saxla» API ilə işləyir; axtarışı açmaq `POST …/opened`-dir.

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

> **Implemented (phase 1), API tərəfi, oxuma hissəsi:** public cavablarda `Listing.contactPhone`, `Seller.phone`, `ServiceProvider.phone` yoxdur, əvəzində `phoneMasked` («+994 50 *** ** 34»; nömrə gizlidirsə, elanda o da yoxdur). Test bütün public cavablarda demo nömrələrin heç birinin olmadığını yoxlayır. `POST /listings/{id}/phone-reveals` və `POST /sellers/{id}/phone-reveals` hələ yoxdur (faza 3): o vaxta qədər `DATA_SOURCE=api` rejimində nömrə göstərilə bilməz.
>
> **Implemented (phase 1), frontend tərəfi:** `Listing.phoneMasked?`, `Seller.phoneMasked?`, `ServiceProvider.phoneMasked?` `src/types`-dadır. `revealPhone(listingId)` və ★ `revealSellerPhone(sellerId)` `ContactReveal` (`{ phone?, whatsappUrl? }`) qaytarır. Mock-un public oxumaları da nömrəsizdir (API kimi), nömrəni yalnız bu iki metod verir, ona görə mock rejimi istifadəçiyə əvvəlki kimi görünür. Səhifələr nömrəni HTML-ə yazmır: «Nömrəni göstər» və «WhatsApp-a yaz» kliklə Server Action-dan (`src/features/contact/actions.ts`) soruşur, cavab gələndə bütün düymələr nömrəni göstərir; WhatsApp ilk klikdə açılır. Elanın sahibinin öz önizləməsi (kabinet) nömrəni soruşmadan göstərir. `apiRepository`-də hər iki metod «not implemented yet (phase 3)» atır, düymə də «Nömrəni göstərmək alınmadı» bildirir. `Listing.contactPhone`, `Seller.phone`, `ServiceProvider.phone` tipdə qalır: sahibin öz elanları, admin və demo məlumat üçün.
>
> **Implemented (phase 3), API tərəfi:** `POST /listings/{id}/phone-reveals` → `ContactReveal` (`{ phone?, whatsappUrl? }`; `phone` E.164-dür, `+994505551234`, UI onu `+994 50 555 12 34` kimi göstərir). Yalnız aktiv elan və xidmət üçün (başqası 404 `listing.not-found`). `phoneHidden` elanda yalnız `whatsappUrl` (`https://wa.me/994505551234`), `whatsapp: false` elanda yalnız `phone`. `POST /sellers/{id}/phone-reveals` → biznesin nömrəsi, yoxdursa sahibinin; `whatsappUrl` satıcının `whatsapp`-ı ilə (404 `seller.not-found`). İkisi də IP üzrə limitlidir (`phone-reveals`: 10 dəqiqədə 30, aşılanda 429 `rate-limited` və `Retry-After`). Elanın açılışı sayılır: eyni ziyarətçi (sessiya, yoxdursa IP + brauzer) gündə bir dəfə (Bakı vaxtı), sahibin özü sayılmır; satıcı səhifəsinin açılışı sayılmır (DATABASE.md-də sayğacı yoxdur). Next bu sorğuları ziyarətçinin `X-Client-IP`-si və `User-Agent`-i ilə göndərməlidir.

- **İndi nömrə elan səhifəsinin HTML-inə yazılır** (`src/views/ListingDetailPage.tsx:105`). «Nömrəni göstər» isə yalnız sayğacı artırır. Real məlumatla bütün nömrələr skreypinqlə yığıla bilər.
- **Public cavablardan çıxan sahələr:** `Listing.contactPhone`, `Seller.phone`, `ServiceProvider.phone`. Onların yerinə `phoneMasked?: string` gəlir («+994 50 *** ** 34»).
- **Nömrə yalnız bu metodlarla verilir:**
  - `revealPhone(listingId)` → `{ phone?: string; whatsappUrl?: string }`;
  - ★ `revealSellerPhone(sellerId)`, eyni cavabla.
  - `phoneHidden` elanda yalnız `whatsappUrl` qaytarılır. Xidmətlər də elan olduğu üçün `revealPhone` onlara da işləyir.
- **Frontend-də dəyişən:** `ListingDetailPage`, `ListingContact`, `SellerContact`, `features/services/contact.ts`. Nömrə serverdən render zamanı yox, kliklə gəlir.
- **Admin cavablarında** nömrələr qalır.

> **Implemented (phase 3), frontend tərəfi:** `apiRepository.revealPhone` və `revealSellerPhone` `POST …/phone-reveals`-dir (ziyarətçinin IP-si, brauzeri və sessiyası ilə: sahibin öz kliki sayılmır); nömrə saytın yazılışına çevrilir. Səhifələrin «Nömrəni göstər» düymələri dəyişmədi.

### 3.2 Şəkil yükləmə

```ts
createPhotoUpload(input: { fileName: string; contentType: string; bytes: number }):
  Promise<{ photoId: string; uploadUrl: string; expiresAt: string }>
```

Brauzer faylı `uploadUrl`-ə `PUT` edir. Bu, birbaşa API-yə gedir, çünki Vercel funksiyası 4,5 MB-dan böyük sorğu qəbul etmir. `ListingInput.photoIds`-in mənası dəyişmir.

> **Implemented (phase 3), API tərəfi.**
>
> - `POST /photos` (sessiya ilə) `{ fileName?, contentType, bytes, purpose? }` → 201 `{ photoId, uploadUrl, expiresAt }`. `contentType`: `image/jpeg`, `image/png`, `image/webp`; `bytes` ≤ 10 MB. Xətalar: 400 `validation` (`contentType: photo.unsupported-type`, `bytes: photo.too-large` / `photo.empty`), 429 `photo.too-many` (hesabda 24 saatda elana bağlanmamış 60 şəkil). `purpose` standartdır: `listing`.
> - `PUT {uploadUrl}` (`/api/v1/photo-uploads/<token>`), gövdə faylın özüdür, `Content-Type` faylın tipi. Sessiya və `X-Internal-Key` lazım deyil: token birdəfəlikdir, 10 dəqiqə yaşayır. CORS yalnız bu ünvan üçün, yalnız `Frontend:BaseUrl` və `Media:UploadOrigins` mənbələrindən, yalnız `PUT` (Development: `localhost:3000` və `localhost:3100`). Cavab dərhal hazırdır (emal sinxrondur): 200 `{ photoId, status: "ready", width, height, url }`. Xətalar: 404 `photo.upload-not-found` (naməlum və ya artıq işlənmiş token), 410 `photo.upload-expired`, 413 `photo.too-large`, 415 `photo.unsupported-type` (ilk baytlar JPEG, PNG, WebP deyil, məsələn HEIC), 422 `photo.too-small` (qısa tərəf < 600 px), `photo.too-many-pixels` (> 50 meqapiksel), `photo.unreadable` (zədəli və ya yarımçıq fayl), 400 `photo.empty`. Rədd edilən şəkil `failed` olur: yenidən cəhd üçün yeni `POST /photos`.
> - API şəkli yenidən kodlayır: düz çevrilir (EXIF orientation), sRGB-yə keçir, bütün metadata (EXIF, GPS, XMP, ICC) silinir, 320, 640 və 1280 px enində WebP nüsxələri saxlanır. Orijinal saxlanmır.
> - Şəkil `ListingInput.photoIds`-ə düşəndə elana bağlanır; 24 saat bağlanmayan şəkil (faylları ilə) gündəlik təmizləmədə silinir.
> - **Frontend üçün:** `connect-src`-ə API-nin ictimai ünvanı (`Media:UploadBaseUrl`, boşdursa sorğunun gəldiyi ünvan) əlavə olunmalıdır.
>
> **Implemented (phase 3), frontend tərəfi:** `createPhotoUpload(input: PhotoUploadRequest): Promise<PhotoUpload>` (`purpose: 'listing'` ilə), tiplər ★ `PhotoUploadRequest`, `PhotoUpload`, ★ `UploadedPhoto` `src/types`-dadır. Sihirbaz şəkilləri əvvəlki kimi brauzerdə saxlayır (qonaq da bütün formanı doldura bilir); «Elanı göndər» basılanda hər şəkil üçün Server Action ünvan alır (`startPhotoUpload`) və brauzer faylı birbaşa `uploadUrl`-ə `PUT` edir (`src/features/posting/upload.ts`, eyni anda 3 fayl). Yüklənən şəklin API id-si qaralamada qalır (`DraftPhoto.remoteId`), ona görə təkrar cəhddə yenidən yüklənmir; ünvanın vaxtı keçibsə bir dəfə yenisi alınır; API `photoIds: not-found`/`not-ready` desə (şəkil 24 saatda silinib), bu brauzerdəki nüsxələr bir dəfə yenidən yüklənir. Brauzer şəkli 2000 px-ə kiçildir, amma qısa tərəfi 600 px-dən aşağı salmır (API daha kiçiyini qəbul etmir). Mock heç nə yükləmir.

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

> **Implemented (phase 3), frontend tərəfi:** `repository.ts`-də `getOwnListing(id)`, `updateListing(id, input, version?)` (`ListingSubmitResult` qaytarır), `renewListing`, `deactivateListing`, `activateListing` (★ `OwnListing` qaytarır), `deleteListing`; `submitListing(input, idempotencyKey?)`. Sihirbaz hər qaralama üçün bir `Idempotency-Key` yaradır (`elan-<uuid>`, qaralamada `sendKey`), göndərilənə qədər eyni qalır. Təsdiq səhifəsi API-nin verdiyi nömrəni göstərir. API rejimində «Elanlarım» API-nin siyahısıdır (brauzerdə heç nə saxlanmır), əməliyyatlar Server Action ilə gedir (`src/features/cabinet/actions.ts`: `changeOwnListing`), cavab gələnə qədər düymə «Yenilənir…» kimi gözləyir, imtina toast ilə deyilir. Rədd səbəbi kodun Azərbaycanca adı və moderatorun izahı ilə göstərilir (`src/features/listing/rejection.ts`). «Redaktə et» elanın şəkillərini API-də saxlayır (`photoIds`, ünvanları ilə göstərilir) və açılan `version`-u göndərir; köhnə versiya 409-da «Elan bu arada dəyişdirilib» deyilir. Sahibin önizləməsi (`/kabinet/elanlar/<slug>`) serverdə `GET /me/listings`-dən qurulur. Elanı saytda dəyişən hər Server Action həmin səhifələri dərhal yeniləyir (`updateTag`, API-nin tag-ları: `listingCacheTags`). ★ Qaralamalar (`/me/drafts`) hələ istifadə olunmur: sihirbazın qaralaması əvvəlki kimi bu brauzerdədir. Mock-da hər şey əvvəlki kimidir.

> **Implemented (phase 3), API tərəfi.** Hamısı sessiya tələb edir; başqasının elanı 404 `listing.not-found`-dur.
>
> - **Göndərmək:** `POST /listings` `ListingInput` → 201 `ListingSubmitResult` (`{ id, slug, number, status: "pending" }`). ★ `Idempotency-Key` başlığı (≤ 80 çap olunan ASCII simvol, məsələn sihirbazın qaralama id-si): eyni açarla təkrar sorğu eyni cavabı alır, eyni açarla başqa gövdə 422 `idempotency.key-reused`. Xətalar: 400 `validation` (`errors` `ListingInput`-un yolları ilə: `title: too-short`, `description: contains-phone`, `plant.heightCm.min: required`, `attributes.availability: required`, `price: out-of-range`, `wholesale.price: not-below-price`, `photoIds: not-found | not-ready | in-use | too-many | duplicate`, `categoryId: invalid | locked`, …), 400 `bad-request` (gövdə formaya uymur, məsələn naməlum enum), 429 `listing.daily-limit` (hesab 24 saatda 30 elan). Qaydalar sihirbazın qaydalarıdır (`src/features/posting/validation.ts`): başlıq 5–80, təsvir 20–3000 və içində nömrə yoxdur, ad 2–50, nömrə Azərbaycan nömrəsi (`contactPhone` hesabın nömrəsidirsə `contactPhoneVerified: true`), gizli nömrədə WhatsApp məcburidir. Hündürlük, yaş və şaxta kəsrlə gəlsə yuvarlaqlaşdırılır. `promotion` saxlanır, ödəniş faza 5-dədir. Biznes hesabının elanı onun satıcı səhifəsinə bağlanır (`sellerId`).
> - **Redaktə:** `PUT /me/listings/{id}` `ListingInput` (+ könüllü `version`) → `{ id, slug, number, status: "pending" }`. Elan yenidən yoxlamaya gedir; aktiv elan yoxlanana qədər saytda görünmür (qərar 2). Dərc olunmuş elanın kateqoriyası və alt kateqoriyası dəyişmir: başqa dəyər `categoryId: locked`. Başlıq dəyişəndə slug dəyişir (nömrə eyni qalır, köhnə link yeni linkə yönləndirilir). Köhnə `version` 409 `concurrency-conflict`.
> - **Status:** `POST /me/listings/{id}/renew` (yalnız `expired`: 30 yeni gün, yuxarı qalxmır), `…/deactivate` (yalnız `active`), `…/activate` (yalnız `inactive`; müddəti keçibsə `expired` olur) → sahibin `Listing`-i; icazəsiz keçid 409 `listing.wrong-status` (`listingStatus` cari statusu deyir). `DELETE /me/listings/{id}` → 204 (sətir qalır, elan hamı üçün yox olur, onun qaralamaları silinir).
> - **Oxumaq:** `GET /me/listings/{id}` → sahibin `Listing`-i (önizləmə, redaktə forması). `getOwnListing` budur.
> - **Statistika:** `GET /me/listings/{id}/stats` → `ListingStats`: `views`, `phoneReveals`, `favourites` cəmi və `viewsByDay` son 14 gün (Bakı vaxtı, `YYYY-MM-DD`, köhnədən yeniyə, baxışsız gün 0).
> - ★ **Qaralamalar** (`listing_drafts`, sihirbazın vəziyyəti olduğu kimi): `GET /me/drafts` → `[{ id, listingId?, data, updatedAt }]`, `POST /me/drafts` `{ data, listingId? }` → 201, `GET`, `PUT` `{ data }`, `DELETE /me/drafts/{id}`. `data` JSON obyektdir, ≤ 64 KB; hesabda ən çox 20 qaralama (409 `draft.too-many`); başqasının qaralaması 404 `draft.not-found`. Kabinet qaralamanı `status: "draft"` kimi göstərmək istəsə, onu `data`-dan özü qurur (API sihirbazın formatını oxumur).

### 3.4 Baxış sayğacı

★ `recordListingView(listingId)`. Elan səhifəsi keşlənəcək, ona görə baxışı serverdəki render saya bilməz. Səhifə yüklənəndə brauzer Server Action ilə xəbər verir. API eyni ziyarətçinin eyni gün təkrar baxışlarını bir dəfə sayır.

> **Implemented (phase 3), API tərəfi:** `POST /listings/{id}/views` → 204 (aktiv elan və xidmət; başqası 404). Eyni ziyarətçi gündə bir dəfə, sahibin özü sayılmır. IP üzrə limit: dəqiqədə 120 (`views`). Seçilmişlərə əlavə də günün sətrinə yazılır (`favourites`).
>
> **Implemented (phase 3), frontend tərəfi:** ★ `recordListingView(listingId)`. Elan və xidmət səhifəsində `ViewBeacon` (render etməyən client komponenti) hər səhifə açılışında bir dəfə Server Action-u (`recordView`) çağırır; xəta səssiz qalır. Yalnız `DATA_SOURCE=api` rejimində qoşulur (mock-un sayacağı yoxdur).

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

> **Implemented (phase 3), API tərəfi, moderasiya hissəsi** (moderator və admin; başqası 403 `forbidden`, sessiyasız 401):
>
> - `GET /admin/moderation?status=pending|approved|rejected&kind=new|recheck&sort=newest|oldest&q&page&pageSize` → `PageResult<ModerationItem>` + ★ `totals: { pending, recheck, approved, rejected }`. Standart: `status=pending`, `sort=newest`, səhifə 20. `q`: elanın nömrəsi və ya başlığın sözləri. `approved`: `active`, `expired`, `inactive` elanlar.
> - `ModerationItem`: `id` (= `listingId`), `number`, `title`, `sellerName`, `submittedAt`, `categoryId`, `kind` (`new`: birinci versiya, `recheck`: sonrakı), `status`, ★ `revision`, ★ `version` (qərarla geri göndərilir), ★ `contactPhoneVerified` (`false`: «Əlaqə nömrəsi təsdiqlənməyib», qərar 3), ★ `photoCount`, ★ `seller` (`{ userId, sellerId?, name, accountType, verified, activeListings, memberSince? }`), ★ `listing` (sahibin `Listing`-i, nömrə daxil), ★ `changes` (son təsdiqlənmiş versiya ilə fərq: `[{ field, before?, after? }]`, sahə adları `ListingInput` yollarıdır: `price`, `title`, `plant.heightCm`, `photos` (sayları), `photos.order`, …), ★ `lastDecision?` (`{ decision, reasonCode?, note?, createdAt }`). `review`-dakı hazır mətnlər (`details`, `seller`, `checks`) API-də yoxdur: UI onları bu sahələrdən öz dilində yığır.
> - `GET /admin/moderation/{listingId}` → bir `ModerationItem`.
> - `POST /admin/moderation/{listingId}/decision` `{ decision: "approve" | "reject", reasonCode?, note?, version }` (`explanation` da `note` kimi qəbul olunur) → `{ listingId, decision, status, version }`. Təsdiq elanı 30 günə dərc edir (ilk dəfədirsə «Ən yenilər»in başına). Rədd `reasonCode` tələb edir, `other` üçün `note` da (≤ 500). Xətalar: 400 `validation`, 404 `listing.not-found`, 409 `concurrency-conflict` (moderator açandan sonra sahib elanı dəyişib və ya başqa moderator qərar verib), 409 `listing.wrong-status` (elan yoxlamada deyil). Hər qərar `moderation_decisions`-a və `audit_log`-a (`listing.approve`, `listing.reject`) yazılır.
> - Şikayətlər, kateqoriyalar, satıcı təsdiqi və bloklama (`AdminRepository`-nin qalanı) faza 4-dədir.
>
> **Implemented (phase 3), frontend tərəfi, moderasiya hissəsi:** `src/services/adminRepository.ts`: `moderationQueue(query)`, `moderationItem(listingId)`, `decide(listingId, d)` (yalnız `DATA_SOURCE=api`). `ModerationStatus`, `ModerationKind` `src/data/admin.ts`-dən `src/types`-a köçüb, yanında ★ `ModerationItem`, `ModerationQueue`, `ModerationQuery`, `ModerationSeller`, `ModerationChange`, `ModerationDecisionRecord`, `ModerationDecisionInput`, `ModerationDecisionResult`, `RejectionReasonCode`. API rejimində `/idareetme` və `/idareetme/moderasiya` serverdə render olunur: sessiyasız ziyarətçiyə «daxil olun», `user` roluna «Bu bölmə moderatorlar üçündür» göstərilir. Filtrlər (status, `kind`, sıra, nömrə və ya başlıq üzrə axtarış, səhifə) və açıq elan ünvandadır; panel elanın şəkillərini, qiymətini, faktlarını, satıcını, yoxlama siyahısını («Əlaqə nömrəsi təsdiqlənməyib» daxil) və son təsdiqlənmiş versiya ilə fərqləri Azərbaycanca yığır (`src/features/admin/moderationApi.ts`). Qərar gördüyü `version` ilə gedir (Server Action `decideModeration`); rədd səbəb kodu və izah tələb edir (demodakı kimi ikisi də məcburidir); 409-da səhifə elanı yenilənmiş göstərir. Təsdiqdən sonra elanın səhifələri dərhal yenilənir (`updateTag`). Kateqoriya filtri API-də olmadığı üçün API rejimində yoxdur. Mock rejimində moderasiya səhifəsi əvvəlki kimi `src/data/admin`-dən oxuyur.

### ★ 3.6 Keşin yenilənməsi (API → sayt)

> **Implemented (phase 3), API tərəfi.** Elan saytda görünəndə və ya saytdan çıxanda (təsdiq, aktiv elanın redaktəsi, deaktiv, aktiv, yeniləmə, silmə, müddətin bitməsi) API dəyişikliklə eyni tranzaksiyada outbox-a xəbər yazır, fon işi onu 5 saniyə ərzində göndərir: `POST {Frontend:BaseUrl}/api/revalidate`, başlıq `Authorization: Bearer {Revalidation:Secret}`, gövdə `{ "tags": [...] }`. Tag-lar `apiRepository`-nin tag-larıdır: `listing:<id>`, `listing:<slug>` (köhnə slug da), `listings`, `home`, `sitemap:listing`; xidmətdə `service:<id>`, `service:<slug>`, `services`, `provider:<ownerId>`, `sitemap:service`; biznesdə `seller:<id>`, `seller:<slug>`, `sellers`. Bir xəbərdə ən çox 64 tag olur (saytın limiti; API-də `Revalidation.MaxTagsPerNotice`): bir anda çox elanın müddəti bitəndə tag-lar bir neçə xəbərə bölünür. 2xx-dən başqa cavab uğursuzluqdur: 5 s, 10 s, 20 s … (ən çox 1 saat) sonra təkrar, 10 cəhddən sonra buraxılır. `Frontend:BaseUrl` və ya `Revalidation:Secret` boşdursa heç nə göndərilmir. **Frontend üçün:** `src/app/api/revalidate/route.ts` (sirr `REVALIDATE_SECRET`, API-nin `Revalidation__Secret`-i ilə eyni; Development-də `dev-revalidate-secret`) hər tag üçün `revalidateTag(tag, 'max')` çağırmalıdır. Route olmasa da səhifələr `revalidate: 60` ilə ən çox bir dəqiqəyə yenilənir.

> **Implemented (phase 3), frontend tərəfi:** `src/app/api/revalidate/route.ts` sirri sabit vaxtlı müqayisə ilə yoxlayır (`REVALIDATE_SECRET` boşdursa hər xəbər 401), ən çox 64 çap olunan tag qəbul edir və hər tag üçün `revalidateTag(tag, { expire: 0 })` çağırır. **`'max'` yox:** Next 16-da `'max'` tag-ın bitmə vaxtını bir il irəli yazır və bir neçə saniyə əvvəl saytın Server Action-unun `updateTag` ilə qoyduğu dərhal bitməni silir; yoxlamada moderator təsdiqindən sonra elanın səhifəsi növbəti ziyarətçiyə bir dəfə də köhnə (404) göründü. Next-in sənədi webhook üçün məhz `{ expire: 0 }`-ı tövsiyə edir. `apiRepository`-nin tag-ları API-nin tag-ları ilə eynidir (ana səhifəyə `home` əlavə olunub).

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

- **`Listing.vip`** sahəsi adı ilə qalır. API onu `is_promoted`-dən doldurur. UI-da «VIP» sözü yenə işlənmir, yalnız «Önə çıxan». **Implemented (phase 1).**
- **`ListingStatus`** və **`OtpPurpose`** dəyişmir. Enum dəyərləri API-də də eyni kebab-case sətirlərdir.
- **`PageResult`**, **`HomeContent`**, **`ServiceSearchResult`** dəyişmir. **Implemented (phase 1):** API eyni formaları qaytarır (`ContractShapeTests` hər cavabı `src/types` ilə müqayisə edir), `apiRepository` onları olduğu kimi qaytarır.
