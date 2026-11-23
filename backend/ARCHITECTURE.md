# GreenStore backend: arxitektura

**Status:** təsdiqlənib (22 noyabr 2026). Faza 0 (skelet) və faza 1 (kataloq cədvəlləri, seed, oxuma endpoint-ləri və saytın `DATA_SOURCE=api` rejimi, `src/services/apiRepository.ts`) yazılıb. Faza 2-nin API tərəfi də hazırdır: SMS kodu, qeydiyyat (biznes hesabı «mağaza»nı da açır), şifrə və SMS ilə giriş, sessiyalar və «Aktiv cihazlar», `/me`, `/me/seller`, seçilmişlər, yadda saxlanılan axtarışlar. Faza 3 həm API, həm sayt tərəfində yazılıb: şəkil yükləmə və emalı (brauzerdən birbaşa API-yə), elan yerləşdirmə (`Idempotency-Key` ilə), «Elanlarım» və qaralamalar, moderasiya (`/idareetme/moderasiya`, `AdminRepository`), müddət, statistika, baxış sayğacı, «Nömrəni göstər», keşin yenilənməsi (`POST /api/revalidate`) və fon işləri. Faza 4-ün API tərəfi hazırdır: şikayətlər (səbəb kodu ilə) və onların admin baxışı, «Usta çağır» (ustalara paylanma, SMS xəbəri outbox ilə, ustanın gələn sorğuları), dəstək, admin panelinin rəqəmləri, kateqoriyaların idarəsi (üç dildə), satıcı təsdiqi və bloklama; sayt tərəfi də yazılıb (şikayət dialoqunun kodları, «Usta çağır», dəstək, ustanın «Gələn sorğular» səhifəsi `/kabinet/sorgular`, `/idareetme` rəqəmləri, `/idareetme/sikayetler`, `/idareetme/kateqoriyalar`). Faza 5-in API tərəfi hazırdır: reklam paketləri (üç dildə), sifariş (`{ order, paymentUrl }`), `IPaymentGateway` və saxta provayder (Development və Staging: API-nin «Test ödənişi» səhifəsi imzalı callback göndərib sayta qaytarır; Production-da reklam satılmır), callback (`payment_events`, `(provider, provider_ref)` üzrə bir dəfə), «Önə çıxan» və «İrəli çək», `Promotions` fon işi; sayt tərəfi də yazılıb (`/reklam`-da «Ödə» ödəniş səhifəsinə aparır, qayıdış səhifəsi `/kabinet/odenis`, kabinetdə «Önə çıxan» və ödənilməmiş seçim). İşə salmaq üçün: [README.md](README.md). **Bütün fazalar (0–5) yazılıb və yoxlanıb**; gecənin yekun hesabatı, end-to-end yoxlama, deploy və yoxlama siyahısı: [backend-status.md](../docs/handoff/backend-status.md). `Dockerfile` və `docker-compose.yml`-in `api-migrate`/`api` servisləri yazılıb, amma yoxlanmayıb (Docker yox idi).
**Müqavilə dəyişiklikləri:** [`docs/handoff/backend-contract.md`](../docs/handoff/backend-contract.md). `repository.ts` və `src/types` hər fazada ayrıca razılıqla dəyişir.

## 1. Tələblər

Arxitekturanı bu cavablar müəyyən edir (noyabr 2026). Biri dəyişsə, uyğun bölmə yenidən baxılır.

| Tələb | Cavab | Arxitekturaya təsiri |
|---|---|---|
| Birinci il aktiv elan | **10 minə qədər** | Axtarış PostgreSQL-də qalır, ayrıca axtarış mühərriki yoxdur. Bir API serveri kifayətdir (§13) |
| Mobil tətbiq | **Sonra, 1 il ərzində** | API indidən açıq REST kimi qurulur, tətbiq sonra eyni endpoint-lərə qoşulur (§9) |
| Dillər | **Azərbaycan, rus, ingilis** | Kateqoriya, şəhər və paket adları bazada üç dildə saxlanır. API mətn yox, kod qaytarır. Axtarış kiril əlifbasını da başa düşür (§8) |
| Komanda | kiçik (1–2 developer) | Bir layihəli, modullara bölünmüş struktur (§3) |

## 2. Qısaca

- **ASP.NET Core 10 (LTS) Web API.** Bir servis kimi deploy olunur. Daxildə modullara bölünür (modul monolit).
- **PostgreSQL 16+**, EF Core 10 və Npgsql ilə.
- **Sayt üçün Next.js bir BFF-dir** (backend-for-frontend). Brauzer API ilə birbaşa danışmır, yeganə istisna şəkil yükləmədir. Gələcək mobil tətbiq isə API-yə birbaşa qoşulacaq.
- **Sessiya** bazada saxlanan tokendir. Sayt üçün Next onu httpOnly cookie-də saxlayır. Mobil tətbiq onu telefonun təhlükəsiz yaddaşında saxlayacaq.
- **Üç dil.** Sistem məlumatı (kateqoriyalar, şəhərlər, paketlər) bazada `{ az, ru, en }` kimi saxlanır. İstifadəçinin yazdığı mətn (elanın adı və təsviri) yazıldığı dildə qalır.
- **Fon işləri** eyni prosesdə işləyir (`BackgroundService`). İki nüsxə eyni işi görməsin deyə PostgreSQL advisory lock istifadə olunur.
- **SMS, ödəniş və fayl yaddaşı** interfeys arxasındadır. Dev və staging-də saxta versiyalar işləyir, ona görə heç nə real göndərilmir.

```
Brauzer ──HTTPS──► Next.js (Vercel) ──server-to-server──► GreenStore.Api ──► PostgreSQL
  │                  ▲   cookie: gs_session                  │
  │                  └──── POST /api/revalidate ◄────────────┤──► Fayl yaddaşı (lokal disk / S3)
  │                                                          ├──► SMS provayderi
  ├── şəkil yükləmə (birdəfəlik token) ─────────────────────►│──► Ödəniş provayderi ──callback──► Api
  └── şəkillər ◄── CDN                                       │
                                                             │
Mobil tətbiq (sonra) ──HTTPS, Bearer token─────────────────►─┘
```

## 3. Niyə belə

### Mikroservis yox, modul monolit

Komanda kiçikdir, baza birdir. Bir çox əməliyyat bir neçə modula toxunur və bir tranzaksiyada getməlidir. Məsələn, moderator elanı təsdiqləyəndə elan aktiv olur, alınmış reklam başlayır və keş yenilənir. Modullar qovluqlardır: hər birinin öz endpoint-ləri, entity-ləri və servisləri var.

### Bir layihə, Clean Architecture yox (tövsiyə)

**Tövsiyə:** bir API layihəsi, daxildə modullara bölünmüş.

- **Clean Architecture-ın faydası burada yoxdur.** Onun 4 layihəsi (Domain / Application / Infrastructure / Api) böyük komandalar və bazanı, UI-ı dəyişdirmək ehtimalı üçün faydalıdır. Bizdə 10 min elan və 1–2 developer var, bazanı dəyişmək planı yoxdur. Mobil tətbiq gələndə də struktur dəyişmir, tətbiq eyni endpoint-lərə qoşulur.
- **Xərci isə var:** hər funksiya 4–6 fayla səpələnir (entity, interfeys, handler, DTO, mapping). Kodu yazmaq və nəzərdən keçirmək yavaşlayır.
- **Gələcək üçün qoruyucu qayda:** biznes qaydaları adi C# siniflərindədir və ASP.NET-dən, EF-dən asılı deyil. Bunlara elanın həyat dövrü, qiymət və reklam qaydaları, SMS limitləri aiddir. Hamısı unit testlə yoxlanır. Layihə böyüsə, bu sinifləri ayrıca `GreenStore.Domain` layihəsinə köçürmək çətin olmayacaq.

### Next.js BFF, amma API açıq qurulur

- **Sayt üçün:** CSP artıq `connect-src 'self'`-dir və Server Actions artıq var, yəni frontend bu modelə hazırdır. Token brauzerə heç vaxt düşmür, ona görə XSS onu oğurlaya bilməz. CORS lazım deyil.
- **Mobil tətbiq üçün:** API birinci gündən internetə açıq servis kimi qurulur. Limitlər, icazələr və validasiya API-nin özündədir, Next-ə güvənmir. Ətraflı: §9.

### JWT yox, bazada saxlanan sessiya tokeni

- Sessiyanı dərhal ləğv etmək olur: çıxış, «bütün cihazlardan çıx», istifadəçinin bloklanması, itirilmiş telefon. JWT-də bu çətindir.
- Hər sorğuya bir indeksli axtarış düşür, üstəlik 1 dəqiqəlik yaddaş keşi var. Bu ucuzdur.
- Eyni token həm sayt, həm mobil tətbiq üçün işləyir.
- ASP.NET Core Identity istifadə olunmur, çünki o, e-poçt üçün qurulub, bizdə isə əsas telefon və SMS-dir. Ondan yalnız `PasswordHasher` götürülür (`Microsoft.Extensions.Identity.Core` paketi).

### Məhsul və xidmət üçün bir `listings` cədvəli

«Elan yerləşdir» artıq `kind: 'product' | 'service'` göndərir. Moderasiya, 30 günlük müddət, reklam, seçilmişlər, şikayətlər və statistika hər ikisi üçün eynidir. API `kind = service` olan sətirləri `Service` DTO-suna çevirir. Xidmətə aid sahələr (`areas`, `includes`) boş ola bilən sütunlardır.

### Ayrıca axtarış mühərriki yox, PostgreSQL

10 min elan üçün PostgreSQL kifayətdir. Necə işlədiyi: §8.4. Meilisearch və ya OpenSearch yalnız lazım olanda gəlir: yüz minlərlə elan olanda və ya səhv yazılışa dözümlü axtarış istəniləndə.

## 4. Layihə strukturu

```
backend/
  GreenStore.slnx
  Directory.Build.props         net10.0, nullable, warnings-as-errors
  Directory.Packages.props      bütün paket versiyaları bir yerdə
  docker-compose.yml            PostgreSQL (dev üçün)
  src/GreenStore.Api/
    Program.cs
    Common/                     ProblemDetails, auth handler, rate limit, səhifələmə, saat, id, JSON
      Localization/             LocalizedText, dil seçimi, axtarış normallaşdırması
    Data/                       AppDbContext, entity konfiqurasiyaları, Migrations/
    Modules/
      Taxonomy/                 kateqoriyalar, alt kateqoriyalar, şəhərlər
      Listings/                 axtarış, elan səhifəsi, yerləşdirmə, həyat dövrü, statistika
      Sellers/                  satıcı səhifələri, satıcılar kataloqu, xidmət göstərənlər
      Accounts/                 istifadəçi, SMS kodu, sessiya, cihazlar, profil
      Media/                    şəkil yükləmə, emal, yaddaş
      Engagement/               seçilmişlər, axtarışlar, şikayətlər, «Usta çağır», dəstək
      Promotion/                paketlər, sifarişlər, ödəniş, «İrəli çək» cədvəli
      Admin/                    moderasiya, kateqoriyaların idarəsi, şikayətlərə baxış
      Platform/                 outbox, audit_log, Idempotency-Key (modulların ortaq cədvəlləri)
    Jobs/                       fon işləri
  tests/GreenStore.Api.Tests/   unit və inteqrasiya testləri (real PostgreSQL)
  seed/                         dev və staging üçün nümunə məlumat (src/data-dan ixrac)
```

Bir modulun içi, məsələn `Modules/Listings/`:

```
ListingsEndpoints.cs        HTTP: yollar, giriş/çıxış DTO-ları, icazə. Nazik qalır
Listing.cs                  entity
ListingLifecycle.cs         qayda: hansı statusdan hansına keçmək olar (ASP.NET/EF-siz)
ListingSearch.cs            axtarış sorğusu (EF)
ListingService.cs           yerləşdirmə, redaktə, yeniləmə: qaydanı çağırır, bazaya yazır
Dtos.cs                     JSON formaları, əl ilə çevirmə
```

**Minimal APIs** seçilir: `TypedResults`, daxili OpenAPI 3.1 və .NET 10-un daxili validasiyası. AutoMapper və MediatR istifadə olunmur, bu ölçüdə onlar yalnız qatlar əlavə edir.

**Paketlər** (minimum):

| Paket | Nə üçün | Faza |
|---|---|---|
| `Npgsql.EntityFrameworkCore.PostgreSQL` | EF Core + PostgreSQL | 0 |
| `EFCore.NamingConventions` | cədvəl və sütun adları snake_case | 0 |
| `Microsoft.AspNetCore.OpenApi` | `/openapi/v1.json` | 0 |
| `Microsoft.Extensions.Identity.Core` | yalnız `PasswordHasher` | 2 |
| `NetVips`, `NetVips.Native` | şəkil emalı (libvips, sürətli, sərbəst lisenziya) | 3 |
| `AWSSDK.S3` | S3-uyğun yaddaş (R2, Hetzner, AWS) | 3 |
| `xunit.v3`, `Microsoft.AspNetCore.Mvc.Testing` | testlər | 0 |

## 5. Verilənlər bazası

Ətraflı sxem: **[DATABASE.md](DATABASE.md)**. Orada hər cədvəlin SQL-i, məhdudiyyətlər, indekslər, axtarış, sayğaclar, saxlama müddətləri, miqrasiya qaydaları və baza rolları var.

**Əsas qərarlar:**
- **Bir `listings` cədvəli** həm məhsul, həm xidmət üçün. Filtrə düşən bitki faktları (növ, hündürlük, yaş, kök sistemi) ayrıca sütunlardadır, qalanı jsonb-dədir.
- **Qaralamalar** ayrıca cədvəldədir (`listing_drafts`), **sayğaclar** da ayrıcadır (`listing_counters`). Ona görə `listings`-in yoxlamaları sərt qalır, baxışlar isə redaktə zamanı «elan dəyişib» xətası yaratmır.
- **Hər göndərişin surəti** saxlanır (`listing_revisions`). Moderator nəyin dəyişdiyini görür, qiymət tarixçəsi sonra hazır olur.
- **Çoxdilli adlar** `jsonb`-dədir (`{ az, ru, en }`). Enum-lar `text` və `CHECK`-dir, dəyərləri `src/types` ilə eynidir.
- **Trigger və stored procedure yoxdur.** Qaydalar C#-dadır, baza yalnız bütövlüyü qoruyur.

## 6. Elanın həyat dövrü

```
draft ──göndər──► pending ──təsdiq──► active ──30 gün──► expired
                   │   ▲                │   ▲               │
              rədd │   │ düzəlt,  deaktiv│   │ aktiv et      │ «Yenilə» (pulsuz)
                   ▼   │ göndər          ▼   │               ▼
                 rejected              inactive           active (yeni 30 gün)

active ──redaktə──► pending            istənilən status ──sil──► deleted_at
```

- Bütün keçidlər bir yerdə yazılır: `ListingLifecycle`. Hər icazəli və qadağan keçid unit testlə yoxlanır.
- **Kateqoriya** dərcdən sonra dəyişmir, turbo.az-da marka və model kimi.
- **Müddət.** Təsdiqdə `expires_at = indi + 30 gün` olur. «Yenilə» elanı aktiv edir və `expires_at = indi + 30 gün` yazır. Mətn dəyişmədiyi üçün yenidən moderasiyaya getmir.
- **Reklam aktiv elanla bağlıdır.** Elan önə çıxarılıbsa, `expires_at` reklamın sonundan tez bitə bilməz. Bu qayda alıcının ödədiyi günlərin itməsinin qarşısını alır.
- **Aktiv elanın redaktəsi** elanı `pending`-ə qaytarır, yəni yoxlanana qədər elan saytda görünmür (bax: qərar 1).
- **İki moderator eyni elanı açanda** optimistic concurrency işləyir: PostgreSQL-in `xmin` sütunu. İkinci qərar xəta alır, birincinin üzərinə yazılmır.

## 7. API

### Konvensiyalar

- **Versiya.** Bütün yollar `/api/v1` ilə başlayır. Mobil tətbiq çıxandan sonra `v1`-də qıran dəyişiklik edilmir, belə dəyişiklik `/api/v2`-yə gedir (§9).
- **JSON** camelCase-dir. Enum-lar kebab-case sətirdir (`full-sun`, `bare-root`, `garden-centre`, `one-cixar`), `src/types`-dakı union-larla eynidir. Bunu `JsonStringEnumConverter(JsonNamingPolicy.KebabCaseLower)` edir.
- **Dil** sorğuda `Accept-Language` başlığı ilə seçilir (`az`, `ru`, `en`, standart `az`). Cavabdakı adlar həmin dildə gəlir, ona görə DTO-larda `name` sadə `string` olaraq qalır. Ətraflı: §8.
- **Xətalar** RFC 9457 ProblemDetails formatındadır, sabit `code` sahəsi var (`otp.wrong-code`, `listing.not-editable`, `validation`), sahə üzrə xətalar `errors`-dadır. API mətn yox, kod qaytarır, mətni hər dildə frontend və ya mobil tətbiq göstərir. Server Actions-da artıq belə qurulub.
- **Tarixlər** ISO 8601, UTC ilə (`2026-10-28T06:15:00Z`). Bakı vaxtı ilə göstərmək müştərinin işidir.
- **Səhifələmə:** `page`, `pageSize` (maksimum 60). Cavab `PageResult` formasındadır (`items`, `total`, `page`, `pageCount`), `repository.ts`-də artıq belədir.
- **Yeni nəsə yaradan POST-lar** `Idempotency-Key` başlığını qəbul edir (elan, sifariş, «Usta çağır»). İki dəfə basılan düymə iki elan yaratmır.
- **OpenAPI 3.1** `/openapi/v1.json` ünvanındadır. Mobil tətbiqin müqaviləsi də bu sənəd olacaq.

### Endpoint-lər

İşarə: ★ müqavilədə olmayan yeni metodlardır, [backend-contract.md](../docs/handoff/backend-contract.md)-də izah olunur.

| Modul | Endpoint | `MarketplaceRepository` metodu |
|---|---|---|
| Taxonomy | `GET /categories?kind=product` | `listProductCategories` (`listingCount` daxil) |
| | `GET /categories/{id}` | `getProductCategory` |
| | `GET /cities` | `listCities`, `getCity` |
| Listings | `GET /home` | `getHomeContent` |
| | `GET /listings?q&categoryId&subcategoryId&cityIds&minPrice&maxPrice&promoted&delivery&sellerType&sellerId&heightMin&heightMax&ageMin&ageMax&rootSystem&sort&page&pageSize` | `searchListings` |
| | `GET /listings/facets?…` | ★ `getFacetCounts` (indi `facets.ts` mock-dan sayır) |
| | `GET /listings/count?categoryId&cityId` | `countListings` |
| | `GET /listings/{slug}` | `getPublicListing` |
| | `GET /listings/{id}/related` | `getRelatedListings` |
| | `POST /listings/{id}/views` | ★ baxış sayğacı |
| | `POST /listings/{id}/phone-reveals` | `revealPhone`. Nömrə yalnız burada qaytarılır |
| | `GET /sitemap/{kind}?cursor=` | ★ `listPublicListings` əvəzinə yalnız slug və `updatedAt` |
| Xidmətlər | `GET /services` | `searchServices` |
| | `GET /services/{slug}` | `getService` |
| | `GET /providers/{id}`, `GET /providers/{id}/services` | `getServiceProvider`, `listProviderServices` |
| | `POST /service-requests` | `submitServiceRequest` |
| | `GET /me/service-requests`, `POST /me/service-requests/{id}/seen` | ★ ustanın gələn sorğuları («Gələn sorğular», UI sonra) |
| Sellers | `GET /sellers?businessKind&cityId&page` | `listSellers` (★ səhifələnmiş) |
| | `GET /sellers/{slug}`, `GET /sellers/by-id/{id}` | `getSeller`, `getSellerById` |
| | `POST /sellers/{id}/phone-reveals` | ★ |
| Accounts | `POST /auth/otp`, `POST /auth/otp/verify` | `requestOtp`, `verifyOtp` |
| | `POST /accounts` | `register` (★ sessiya da qaytarır) |
| | `POST /auth/login`, `POST /auth/login/otp`, `POST /auth/logout` | ★ giriş (şifrə və ya SMS) və çıxış |
| | `POST /accounts/password-reset` | `resetPassword` |
| | `GET /me`, `PATCH /me`, `POST /me/password`, `POST /me/phone` | ★ profil (`locale` daxil) |
| | `GET /me/sessions`, `DELETE /me/sessions/{id}` | ★ aktiv cihazlar, cihazdan çıxış |
| | `GET /me/seller`, `PATCH /me/seller` | ★ biznes profili |
| Kabinet | `GET /me/listings`, `GET /me/listings/{id}` | `listOwnListings` (★ satıcını sessiya müəyyən edir) |
| | `GET /me/listings/{id}/stats` | `getListingStats` |
| | `POST /listings` | `submitListing` |
| | `PUT /me/listings/{id}` | ★ redaktə |
| | `POST /me/listings/{id}/renew`, `…/deactivate`, `…/activate`, `DELETE /me/listings/{id}` | ★ |
| | `GET /me/favorites`, `PUT` və `DELETE /me/favorites/{kind}/{id}`, `POST /me/favorites/merge` | ★ qonağın seçilmişləri girişdən sonra hesaba birləşir |
| | `GET`, `POST`, `PATCH`, `DELETE /me/saved-searches` | ★ |
| Media | `POST /photos` → `{ photoId, uploadUrl }`, sonra `PUT {uploadUrl}` | ★ |
| Promotion | `GET /promotion-packages` | `listPromotionPackages` |
| | `POST /promotion-orders` | `createPromotionOrder` (★ `{ order, paymentUrl }`) |
| | `GET /me/promotion-orders/{id}` | ★ sifarişin statusu (provayderdən qayıdandan sonra) |
| | `GET`, `POST /payments/fake/checkout/{ref}` | ★ saxta provayderin «Test ödənişi» səhifəsi (yalnız Development və Staging) |
| | `POST /payments/{provider}/callback` | provayderin webhook-u: imza yoxlanır, təkrar gəlsə təsiri yoxdur |
| Engagement | `POST /reports`, `POST /support` | `submitReport` (★ səbəb kodu), `submitSupportMessage` |
| Admin | `GET /admin/overview` | ★ admin panelinin ana səhifəsi |
| | `GET /admin/moderation`, `POST /admin/moderation/{listingId}/decision` | ★ |
| | `GET /admin/reports`, `GET`, `PATCH /admin/reports/{id}` | ★ |
| | `GET`, `POST /admin/categories`, `GET`, `PATCH`, `DELETE /admin/categories/{id}` | ★ adlar üç dildə; silmək yalnız heç nəyin istifadə etmədiyi kateqoriyanı |
| | `POST /admin/sellers/{id}/verify`, `POST /admin/users/{id}/block` | ★ «Təsdiqlənmiş satıcı», bloklama |

## 8. Çoxdillilik (az, ru, en)

### 8.1 Nə tərcümə olunur, nə olunmur

| Növ | Nümunə | Harada saxlanır |
|---|---|---|
| Sistem məlumatı | kateqoriya, alt kateqoriya, şəhər, reklam paketi | bazada `LocalizedText`, admin üç dildə yazır |
| Sabit siyahılar | şikayət və rədd səbəbləri, biznes növləri, vahidlər (ədəd, kq, m²), günəş və su ehtiyacı | API-də yalnız **kod** (`sold`, `wrong-price`, `piece`, `full-sun`). Mətnləri UI tərcümə fayllarındadır |
| Xəta mesajları | «Kod səhvdir» | API-də kod (`otp.wrong-code`), mətni UI-dadır |
| İstifadəçinin mətni | elanın adı və təsviri, satıcının «Haqqında» bölməsi | yazıldığı kimi qalır, tərcümə olunmur. turbo.az-da da belədir |
| SMS və e-poçt | «GreenStore kodunuz: 1234» | API-də üç dildə şablon, `users.locale`-ə görə seçilir |

### 8.2 API dili necə seçir

- **Next** hər sorğuya saytın cari dilini `Accept-Language` başlığı ilə qoyur. Mobil tətbiq telefonun dilini qoyacaq.
- **Public cavablar** adları seçilmiş dildə sadə sətir kimi qaytarır, məsələn `"name": "Розы"`. Belə olanda mövcud müqavilə (`Category.name: string`) dəyişmir.
- **Admin cavabları** üç dilin hamısını qaytarır (`"names": { "az": …, "ru": …, "en": … }`), çünki admin onları redaktə edir.
- **Keş dilə görə ayrılır:** tag-lara dil əlavə olunur (`listing:<id>:ru`) və ya keş açarına `Accept-Language` daxil edilir.

### 8.3 Linklər

Slug dildən asılı deyil (`zeytun-agaci-10482`), üç dildə eynidir. Dil URL-in əvvəlində gəlir, məsələn `/ru/elanlar/zeytun-agaci-10482`. Dəqiq URL sxemi və `hreflang` frontend qərarıdır (bax: qərar 7).

### 8.4 Axtarış üç dildə

- **`search_text` sütununa** elanın adı, atributları, Latın növ adı, şəhər, kateqoriya və alt kateqoriyanın **üç dildəki adları** yazılır. Beləcə «розы», «roses» və «güllər» eyni elanları tapır, satıcı adı hansı dildə yazsa da.
- **Normallaşdırma** üç əlifbada işləyir:
  - Azərbaycan hərfləri: ə→e, ı→i, ö→o, ü→u, ş→s, ç→c, ğ→g (frontend-in `normalizeSearch`-ü ilə eyni);
  - rus hərfləri: kiçik hərfə çevrilir, ё→е;
  - diakritiklər silinir.
  - İki tərəf (C# və TypeScript) eyni nümunələrlə test olunur.
- **Translit axtarışı** sonraya qalır: latınca «tuya» yazanın kirilcə «туя» yazılmış elanı tapması. Bitkilərdə Latın növ adı (`Thuja occidentalis`) bunun bir hissəsini onsuz da həll edir.

### 8.5 Frontend

- Bu, ayrıca böyük işdir: UI-dakı bütün mətnlər (25 min sətirlik kodda) azərbaycanca yazılıb.
- Backend birinci fazadan üç dili dəstəkləyir. Bu, indi ucuzdur, sonra bazanı dəyişmək bahalı olardı. Frontend-in tərcüməsi ayrıca iş axınıdır və backend-i gözləmir.
- `CLAUDE.md`-dəki «UI mətnləri Azərbaycan dilində» qaydası sonra «üç dildə, standart dil Azərbaycan dili» kimi yenilənməlidir.

## 9. Mobil tətbiqə hazırlıq

Tətbiq 1 il ərzində gələcək. Onun üçün indi edilən və sonraya qalan işlər:

| İndi (backend-in əsasında) | Tətbiq gələndə |
|---|---|
| API internetə açıq servis kimi qurulur: limitlər, icazələr, validasiya API-dədir | `devices` cədvəli və push bildirişləri (FCM / APNs) outbox vasitəsilə |
| Giriş cavabı tokeni JSON-da qaytarır. Sayt üçün Next onu cookie-yə qoyur, tətbiq Keychain / Keystore-a qoyacaq | Tətbiq versiyasının yoxlanması: `X-App-Version` başlığı; köhnə versiya «Tətbiqi yeniləyin» cavabı alır |
| `sessions` cədvəlində `client` və cihazın adı var, «Aktiv cihazlar» işləyir | Deep link-lər: saytın linki tətbiqdə açılır (`apple-app-site-association`, `assetlinks.json`) |
| Bütün mətnlər kodla gəlir (§8), tətbiq onları özü tərcümə edir | |
| OpenAPI sənədi tam və dəqiqdir: tətbiq üçün müqavilə odur | |
| Şəkil yükləmə birbaşa API-yə gedir (§11): tətbiq üçün də eyni axın | |

**Real IP.** Rate limit üçün API-yə müştərinin real IP-si lazımdır.
- Sayt sorğuları Next serverindən gəlir. Next real IP-ni `X-Client-IP` başlığı ilə göndərir, API ona yalnız `X-Internal-Key` açarı düzgün olanda inanır.
  - Next IP-ni yalnız hostinqin proxy-sinin yazdığından götürür: `CLIENT_IP_HEADER` (hostinqin yenidən yazdığı başlıq) və ya `X-Forwarded-For`-un sağdan `TRUSTED_PROXY_HOPS`-cu elementi (standart 1, sonuncu). Brauzerin göndərdiyi birinci element heç vaxt götürülmür. `next start` internetə proxy-siz açılmır (README.md, «Visitor IP behind the hosting's proxy»).
- Mobil sorğular API-yə birbaşa gəlir. IP bağlantıdan götürülür (etibarlı reverse proxy arxasında `X-Forwarded-For`).

## 10. Frontend (sayt) ilə inteqrasiya

- **Yeni fayl `src/services/apiRepository.ts`.** Faylın başında `import 'server-only'` olur. O, `fetch` ilə `API_BASE_URL`-ə (server-only env) gedir. `DATA_SOURCE=api` olanda `getRepository()` onu qaytarır.
- **Next-dən API-yə gedən hər sorğuda bu başlıqlar olur:**
  - `Authorization: Bearer <sessiya>`, istifadəçi daxil olubsa;
  - `Accept-Language`;
  - `X-Client-IP` və `X-Internal-Key`;
  - `traceparent`: loqlarda bir sorğunu Next-dən API-yə qədər izləmək üçün.
- **Sessiya.** Giriş və qeydiyyat Server Action-ları `gs_session` cookie-sini yazır: httpOnly, Secure, SameSite=Lax, 30 gün. `localStorage`-dakı demo sessiya (`src/state/store.tsx`) çıxır.
  - Statik səhifələrdə (məsələn ana səhifə) server cookie oxumur. Başlıq ilk kadrda düzgün görünsün deyə ikinci cookie da yazılır: httpOnly olmayan, həssas olmayan `gs_hint` (yalnız «daxil olub» və adın baş hərfləri). `bootstrap.ts` indiki kimi işləyir, sadəcə `localStorage` əvəzinə bu cookie-ni oxuyur.
- **Keş.** Public oxumalar belə gedir: `fetch(…, { next: { revalidate: 60, tags: ['listing:<id>'] } })`.
  - Moderasiya, redaktə və müddətin bitməsindən sonra API outbox vasitəsilə Next-in `POST /api/revalidate` ünvanına (gizli açarla) xəbər verir. Next `revalidateTag(tag, 'max')` çağırır (yazılan kodda `{ expire: 0 }`, backend-contract.md 3.6). Bir xəbərdə ən çox 64 tag olur; çox elanın müddəti birlikdə bitəndə tag-lar bir neçə xəbərə bölünür.
  - Elan səhifələrindəki `generateStaticParams` çıxır: səhifə ilk sorğuda yaranır və keşlənir.
- **CSP** iki yerdə genişlənir: `connect-src`-yə API-nin ünvanı (yalnız şəkil yükləmə üçün), `img-src`-yə şəkil CDN-i. `next/image` üçün `remotePatterns` əlavə olunur.

## 11. Şəkillər

- **Axın.** Wizard Server Action-ı çağırır, Server Action API-də `POST /photos` edir. API sahibi və limiti yoxlayır (bir elana 12 şəkil) və `{ photoId, uploadUrl }` qaytarır. `uploadUrl` birdəfəlik tokendir, 10 dəqiqə yaşayır. Brauzer faylı bu ünvanla **birbaşa API-yə** göndərir. Mobil tətbiq də eyni axını işlədəcək.
  - Niyə Next-dən keçmir: Vercel funksiyasına gələn sorğunun həcmi 4,5 MB ilə məhduddur, şəkil isə 10 MB-a qədər ola bilər.
- **API faylı belə yoxlayır:**
  - faylın ilk baytları (magic bytes) JPEG, PNG və ya WebP olmalıdır;
  - ≤ 10 MB və ən azı 600 px;
  - piksel sayına yuxarı hədd var, ona görə kiçik faylda gizlənmiş nəhəng şəkil (decompression bomb) serveri yıxa bilməz;
  - şəkil yenidən kodlanır və EXIF silinir. EXIF-də GPS ola bilər, yəni satıcının ev ünvanı.
- **Yaddaş** `IFileStorage` interfeysi arxasındadır. Dev-də lokal diskdir (API `/media`-dan verir). Prod-da S3-uyğun yaddaş və CDN olur (Cloudflare R2, Hetzner və ya AWS, qərar sonra).

## 12. Fon işləri

| İş | Nə vaxt | Nə edir |
|---|---|---|
| `ExpireListings` | 10 dəqiqədən bir | `active` elan `expires_at`-dan keçibsə, `expired` olur (bir dəfədə ən çox 500). Həmin anda sahibi və ya moderator dəyişdirən elan növbəti dəfəyə qalır, qalanları indi bitir |
| `Promotions` | 10 dəqiqədən bir | müddəti bitən «Önə çıxar»ı söndürür; «İrəli çək» paketində növbəti qaldırmanı edir (`bumped_at = sort_at = indi`, `bumps_left - 1`); saytda olmayan elanın qaldırması elan qayıdana qədər gözləyir (`Jobs/Promotions.cs`, faza 5) |
| `Outbox` | 5 saniyədən bir | SMS, push, keş yeniləmə, e-poçt göndərir; uğursuz olanda getdikcə uzanan fasilə ilə təkrar edir. İndi iki növ var: keş yeniləmə (`revalidate`, backend-contract.md 3.6) və ustalara «Usta çağır» SMS xəbəri (`sms-notice`, faza 4; bloklanmış hesaba getmir) |
| `PhotoProcessing` | yükləmə zamanı | şəkil variantlarını yaradır (320, 640, 1280 px WebP), EXIF-i silir. Faza 3-də ayrıca növbə yoxdur: emal `PUT` sorğusunun içində gedir (10 MB-lıq şəkil bir saniyədən az çəkir), ona görə cavab şəklin hazır olub-olmadığını dərhal deyir. Yük artsa, növbəyə köçürmək asandır (`PhotoService.ProcessAsync`) |
| `Cleanup` | gündə bir | 24 saatda elana bağlanmayan şəkilləri (faylları ilə), köhnə sessiyaları, SMS kodlarını, `listing_seen`, `idempotency_keys`, göndərilmiş outbox, köhnə gündəlik statistika, `audit_log` və `moderation_decisions` sətirlərini DATABASE.md §5-in müddətləri ilə silir (`Jobs/Cleanup.cs`) |

## 13. Həcm və resurslar (təxmini)

| | Birinci il | Nəticə |
|---|---|---|
| Aktiv elan | ≤ 10 000 | PostgreSQL axtarışı millisaniyələr çəkir, ayrıca axtarış mühərriki lazım deyil |
| Şəkillər | orta 5 şəkil × ~30 000 elan (köhnələr də qalır) ≈ 150 000 şəkil, 4 variantla ≈ 100 GB | S3-uyğun yaddaşda ucuzdur, CDN mütləqdir |
| API | 1 nüsxə. Dayanmadan deploy üçün 2 nüsxə də olar, fon işləri advisory lock ilə qorunur | ayrıca worker serveri lazım deyil |
| Baza | idarə olunan PostgreSQL, gündəlik backup və nöqtəyə qədər bərpa (PITR) | oxuma replikası lazım deyil |
| Redis | lazım deyil: keş prosesin yaddaşındadır, limitlər bazadadır | 2-dən çox API nüsxəsi olanda yenidən baxılır |

## 14. Təhlükəsizlik

- **Telefon nömrələri public cavablarda olmur.** Nömrə yalnız `phone-reveals` endpoint-i ilə verilir və bu endpoint IP və elan üzrə limitlidir. Bu, nömrələrin skreypinqlə yığılmasının qarşısını alır və «Nömrəni göstər» statistikasını düzgün edir. Faza 1-dən nömrə səhifənin HTML-ində də yoxdur: «Nömrəni göstər» onu kliklə Server Action-dan soruşur (`src/features/contact/actions.ts`). Açıq API-də bu ehtiyat daha da vacibdir, çünki robot artıq Next-dən keçmədən birbaşa API-yə gələ bilər.
- **SMS fırıldağına qarşı** (bot saxta nömrələrə kod istəyib SMS pulunu yandırır):
  - limitlər: hər nömrə üçün 60 saniyədə 1, saatda 5, gündə 10 kod; IP üzrə limit; bütün sayt üçün gündəlik ümumi limit və aşılanda xəbərdarlıq;
  - kod yalnız +994 mobil nömrələrinə gedir;
  - kod 4 rəqəmlidir (UI 4 rəqəm gözləyir), bazada hash kimi saxlanır, 5 cəhd verilir, 5 dəqiqə yaşayır.
- **Şifrələr** PBKDF2 ilə hash olunur (Identity hasher), ən azı 8 simvol. Bir neçə uğursuz cəhddən sonra hesab və IP üzrə giriş müvəqqəti bağlanır.
- **Sessiyalar:** 256 bit təsadüfi token, bazada yalnız SHA-256 hash. Şifrə dəyişəndə digər sessiyalar silinir.
- **İcazələr.** Hər `/me` resursunda sahib yoxlanır, `/admin` rol tələb edir. Admin əməliyyatları `audit_log`-a yazılır.
- **IP ünvanları** yalnız lazım olan yerdə və duzlu hash kimi saxlanır.
- **Gizli açarlar** yalnız mühit dəyişənlərindədir, repoda heç nə olmur.
- **Rate limit** (ASP.NET Core-un daxili limiteri): anonim POST-lar IP üzrə məhdudlaşdırılır.

## 15. Test və CI

- **Unit testlər:** həyat dövrü keçidləri, axtarış normallaşdırması (Azərbaycan və rus hərfləri; frontend-in `normalizeSearch` nümunələri ilə eyni), dil seçimi və `az`-a qayıtma, qiymət və reklam qaydaları, SMS kodu.
- **İnteqrasiya testləri:** `WebApplicationFactory` və real PostgreSQL.
  - Lokal: docker compose və ya quraşdırılmış PostgreSQL. Bu mühitdə Docker daemon-u işləmir, ona görə Testcontainers yox, connection string istifadə olunur.
  - CI: GitHub Actions servis konteyneri.
  - Hər test işi təmiz bazada başlayır.
- **Müqavilə testləri:** JSON cavabları `docs/handoff/contract-additions.md`-dəki formalarla müqayisə olunur. Bir sahənin adı dəyişsə, test qırılır.
- **CI.** Ayrıca iş axını `.github/workflows/backend.yml`: `dotnet format --verify-no-changes`, `dotnet build`, `dotnet test`, PostgreSQL 16 servis konteyneri ilə. Yalnız `backend/**` dəyişəndə işləyir.

## 16. Mühitlər və deploy

| | Dev | Staging | Prod |
|---|---|---|---|
| Məlumat | seed (`src/data`-dan, adlar üç dildə) | seed | boş: yalnız kateqoriyalar, şəhərlər, paketlər |
| SMS | loqa yazılır, `demoCode` qaytarılır | loq və ya test nömrələri | real provayder, `demoCode` heç vaxt qaytarılmır |
| Ödəniş | saxta (API-nin «Test ödənişi» səhifəsi) | saxta və ya provayderin test rejimi | real |
| Şəkil yaddaşı | lokal disk | S3 | S3 və CDN |
| `SEO_INDEXABLE` | `false` | **`false`** | `true` |

> **Diqqət.** `src/seo/env.ts` `DATA_SOURCE` `mock` olmayan kimi indeksləməyə icazə verir. Staging API-də nümunə məlumat olacaq, ona görə orada `SEO_INDEXABLE=false` mütləq saxlanmalıdır.

- **Docker image:** multi-stage build, `mcr.microsoft.com/dotnet/aspnet:10.0` əsasında: `backend/Dockerfile`; lokal `docker-compose.yml`-də `api-migrate` (miqrasiya, sonra çıxır) və `api` servisləri. **Yoxlanmayıb:** yazıldığı maşında Docker daemon yox idi, ilk build-i Docker olan maşında edin.
- **Miqrasiyalar** deploy-un ayrıca addımıdır: API-nin öz `migrate` əmri (image-də `dotnet GreenStore.Api.dll migrate`, lokalda `dotnet run -- migrate`) miqrasiyaları tətbiq edir və çıxır. Əmr eyni image-də olduğu üçün ayrıca EF migrations bundle lazım deyil. Staging və Prod-da tətbiq başlayanda miqrasiya işləmir, yalnız Development-də rahatlıq üçün başlanğıcda işləyir (`Database:MigrateOnStartup`).
- **Sağlamlıq yoxlaması:** `/health/live` və `/health/ready` (sonuncu bazanı da yoxlayır).
- **Loqlar** JSON formatında konsola yazılır. OpenTelemetry (trace və metrikalar) qoşulur, exporter sonra seçilir.
- **Region.** Hər səhifə render-i API-ni çağırır, ona görə API və baza Vercel regionuna yaxın olmalıdır (məsələn, Frankfurt).
- **Hosting** açıq sualdır: Railway, Azure, Hetzner və ya Azərbaycanda data mərkəzi. Docker sayəsində sonra köçmək asandır. Şəxsi məlumatların hansı ölkədə saxlanacağını hüquqşünasla yoxlamaq lazımdır. Hüquqi səhifələr onsuz da hüquqşünas gözləyir.

## 17. Mərhələlər

| Faza | İş | Nəticə |
|---|---|---|
| **0. Skelet** | solution, baza qoşulması, health, OpenAPI, ProblemDetails, `LocalizedText` və dil seçimi, test infrastrukturu, CI | `dotnet test` yaşıl, boş API işləyir |
| **1. Oxuma** | taksonomiya (üç dildə), satıcı, elan və xidmət cədvəlləri, seed, bütün oxuma endpoint-ləri, `apiRepository.ts` | `DATA_SOURCE=api` ilə sayt eyni görünür, amma məlumat bazadan gəlir |
| **2. Hesablar** | SMS kodu, qeydiyyat, giriş, sessiya və cihazlar, `/me`, seçilmişlər, axtarışlar | real giriş; demo sessiya `localStorage`-dan çıxır |
| **3. Elan dövrü** | şəkillər, yerləşdirmə, «Elanlarım», moderasiya, müddət, statistika, nömrələrin gizlədilməsi, keş yeniləmə | elan yerləşdirilir, moderasiyadan keçir, saytda görünür |
| **4. Qalanlar** | şikayətlər və admin baxışı, «Usta çağır», dəstək, kateqoriyaların idarəsi (üç dildə), satıcı təsdiqi | admin paneli real məlumatla işləyir |
| **5. Ödəniş** | sifarişlər, ödəniş provayderi, «İrəli çək» cədvəli | reklam satılır |
| **Paralel: frontend dilləri** | UI tərcümə faylları, `/ru` və `/en` linkləri, `hreflang` | sayt üç dildə |
| **Sonra: mobil** | `devices`, push, versiya yoxlaması, deep link-lər (§9) | tətbiq eyni API ilə işləyir |

**Vəziyyət (23 noyabr 2026):** fazalar 0–5 həm API, həm sayt tərəfində yazılıb, hər biri ayrıca yoxlanıb və sonda saytda başdan sona keçilib ([backend-status.md](../docs/handoff/backend-status.md) §2–3). Real SMS və ödəniş provayderi, hostinq və frontend dilləri sahibin qərarını gözləyir; mobil hələ başlamayıb.

## 18. Qərarlar

**Təsdiqlənib** (22 noyabr 2026):

1. **Frontend necədirsə, backend ona uyğun qurulur.** Filial və işçi hesabları yoxdur. İcazə yoxlamaları kodda bir yerdən keçir (`CanManage`), ona görə onları sonra əlavə etmək asan olacaq.
2. **Aktiv elan redaktə olunanda** yoxlanana qədər saytdan gizlənir.
3. **Slug sonunda nömrə ilə:** `zeytun-agaci-10482`. Üç dildə eynidir. Ad dəyişəndə köhnə link yeni linkə 308 ilə yönləndirilir.
4. **Telefon nömrələri** public cavablarda və səhifənin HTML-ində olmur, yalnız «Nömrəni göstər» ilə verilir (§14).
5. **SMS kodu** 4 rəqəmli qalır. Təhlükəsizliyi sərt limitlər təmin edir.
6. **Commit-dən əvvəl** `backend/` dəyişibsə, `dotnet build` və `dotnet test` də işə salınır (`CLAUDE.md`).
7. **Kod strukturu:** bir layihə, modullara bölünmüş (§3).

**Açıq qalır:**

- **Rus və ingilis dili nə vaxt açılır?** Sayt açılanda, yoxsa sonra? Backend hər iki halda hazır olacaq, sual yalnız frontend tərcüməsinin vaxtıdır. URL sxemi (`/ru/...`) də frontend qərarıdır.

**Biznes sualları.** Bunlar işə başlamağa mane olmur:
- SMS provayderi;
- ödəniş provayderi;
- hosting;
- real reklam qiymətləri;
- fərdi satıcılar üçün pulsuz elan limiti ([pages-v2.md](../docs/handoff/pages-v2.md#open-questions)).
