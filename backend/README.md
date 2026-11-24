# GreenStore API

ASP.NET Core 10 Web API və PostgreSQL. Sayt (Next.js) onu `DATA_SOURCE=api` rejimində işlədir.

- Arxitektura: [ARCHITECTURE.md](ARCHITECTURE.md)
- Verilənlər bazası: [DATABASE.md](DATABASE.md)
- Frontend müqaviləsi: [docs/handoff/backend-contract.md](../docs/handoff/backend-contract.md)

**Vəziyyət: faza 5-ə qədər (reklam və ödəniş daxil, §15) API və sayt tərəfi.** Faza 0-ın skeleti, faza 1-in kataloqu (§6), faza 2-nin hesabları (§7) və faza 3-ün elan dövrü (§12) üstündə faza 4-ün API-si hazırdır (§14): şikayətlər (`POST /reports`, səbəb kodu ilə) və onların admin baxışı, dəstək (`POST /support`, bilet nömrəsi ilə), admin panelinin rəqəmləri (`GET /admin/overview`), kateqoriyaların idarəsi (üç dildə adlar, filtrlər, adı dəyişəndə elanların axtarış mətni yenidən yığılır), «Təsdiqlənmiş satıcı» və hesabın bloklanması. Sayt `DATA_SOURCE=api` rejimində kataloqu, girişi, kabineti, profili, «mağaza»nı, seçilmişləri, axtarışları və bütün elan dövrünü bu API ilə işlədir (`src/services/apiRepository.ts`, §11): şəkillər brauzerdən birbaşa API-yə yüklənir, elan göndərilir, «Elanlarım»ın əməliyyatları, «Nömrəni göstər», baxış sayğacı və `/idareetme/moderasiya` API-dədir, keş xəbərləri saytın `POST /api/revalidate`-inə gəlir. Faza 4-ün sayt tərəfi də hazırdır: şikayət dialoqu səbəb kodunu göndərir, dəstək forması API-yə gedir, `/idareetme` (rəqəmlər), `/idareetme/sikayetler` və `/idareetme/kateqoriyalar` API ilə işləyir (docs/handoff/backend-contract.md 3.5, 4.1, 4.2). «Usta çağır» (xidmət sorğuları) 24 noyabr 2026-da həm API-dən, həm saytdan çıxarılıb ([docs/handoff/remove-usta-cagir.md](../docs/handoff/remove-usta-cagir.md)).

**Faza 5-in API tərəfi də hazırdır (§15):** reklam paketləri (`GET /promotion-packages`, üç dildə), sifariş (`POST /promotion-orders` → `{ order, paymentUrl }`), saxta ödəniş səhifəsi («Test ödənişi», yalnız Development və Staging), provayderin callback-i (`POST /payments/{provider}/callback`: imza, `payment_events`, təkrar callback ikinci dəfə tətbiq olunmur), ödənişdən sonra «Önə çıxan» və «İrəli çək», `Promotions` fon işi. Saytın tərəfi də hazırdır (backend-contract.md 5.1): `/reklam` paketləri API-dən oxuyur, «Ödə» sifarişi yaradıb ziyarətçini ödəniş səhifəsinə göndərir, provayder onu `/kabinet/odenis?order=<id>` səhifəsinə qaytarır (nəticəni API-dəki sifariş deyir: «Ödəniş qəbul olundu», «Ödəniş yoxlanılır» və ya «Ödəniş alınmadı»), kabinet «Önə çıxan» nişanını və yerləşdirəndə seçilən, hələ ödənilməmiş reklamı («Ödə və işə sal») göstərir.

**Gecənin yekun hesabatı** (nə hazırdır, nə qalıb, deploy və yoxlama siyahısı, təhlükəsizlik riskləri): [docs/handoff/backend-status.md](../docs/handoff/backend-status.md).

**Hələ real olmayanlar** (biznes qərarı gözləyir): SMS provayderi (kodlar indi loqa yazılır, §8), ödəniş provayderi (indi saxta provayder işləyir, Production-da reklam satılmır, §16), hostinq və deploy, şəkillər üçün S3 yaddaşı və CDN (kod hazırdır, §13).

## Tələblər

- **.NET SDK 10** (10.0.100 və ya daha yeni 10.0.x, bax: `global.json`). Yalnız `net10.0`: NuGet-dəki 11.x paketləri .NET 11 üçündür və burada işləmir.
- **PostgreSQL 16+**, lokal quraşdırılmış və ya Docker-də.
- Baza **UTF-8** kodlaşdırması və Unicode-u tanıyan lokal ilə (`C.UTF-8` və ya ICU) yaradılmalıdır. `C` lokalında `pg_trgm` kiril hərflərini söz hərfi saymır və rusca axtarış işləmir.

## 1. Baza

**Docker ilə** (`backend/` qovluğunda):

```bash
docker compose up -d postgres
```

`docker compose up -d --build` bazadan əlavə miqrasiyanı (`api-migrate`) və API-ni (`api`, <http://localhost:5080>) də konteynerdə işə salır (`Dockerfile`). Bu iki servis və `Dockerfile` Docker-siz maşında yazılıb və **heç vaxt build olunmayıb**: ilk dəfə yoxlayın ([backend-status.md §12](../docs/handoff/backend-status.md#12-docker-yoxlanmayıb)).

**Docker olmadan.** PostgreSQL-də rol və baza bir dəfə yaradılır (superuser ilə, məsələn `sudo -u postgres psql`):

```sql
CREATE ROLE greenstore LOGIN PASSWORD 'greenstore_dev' CREATEDB;
CREATE DATABASE greenstore OWNER greenstore TEMPLATE template0 ENCODING 'UTF8' LOCALE 'C.UTF-8';
```

`pg_trgm` genişlənməsini ilk miqrasiya özü yaradır (PostgreSQL 13+ bazanın sahibinə buna icazə verir). `CREATEDB` testlər üçün lazımdır.

## 2. API-ni işə salmaq

```bash
cd backend
dotnet run --project src/GreenStore.Api
```

- Ünvan: <http://localhost:5080> (`Properties/launchSettings.json`, mühit `Development`).
- Development-də miqrasiyalar başlanğıcda avtomatik tətbiq olunur, sonra seed yazılır: istinad məlumatı (kateqoriyalar, şəhərlər), nümunə marketplace (23 demo hesab, 4 satıcı, 53 elan, 6 xidmət) və iki dev işçi hesabı (§9). Ətraflı: [seed/README.md](seed/README.md).
- Development-də SMS göndərilmir: kod API-nin konsoluna yazılır (`SMS not sent … GreenStore kodunuz: 1234`) və `POST /auth/otp` cavabında `demoCode` kimi qayıdır.
- Nümunə: `curl -H 'Accept-Language: ru' http://localhost:5080/api/v1/categories?kind=product`.
- Yoxlama: `curl http://localhost:5080/health/ready` → `200 {"status":"healthy","checks":{"database":"healthy"}}`.
- OpenAPI sənədi: <http://localhost:5080/openapi/v1.json> (yalnız Development və Staging).
- Yüklənən şəkillər Development-də `src/GreenStore.Api/.media/` qovluğuna yazılır (git-ə düşmür) və <http://localhost:5080/media/...> ünvanından verilir (`Media:BaseUrl`).

| Ünvan | Nə qaytarır |
|---|---|
| `/health/live` | proses işləyir (asılılıqlar yoxlanmır) |
| `/health/ready` | baza cavab verir və bütün miqrasiyalar tətbiq olunub; əks halda `503` |
| `/openapi/v1.json` | OpenAPI 3.1 sənədi (Development, Staging) |
| `/api/v1/...` | API (§6) |

`/health/*` yalnız `GET` və `HEAD` qəbul edir, başqa metod `405` alır.

## 3. Miqrasiyalar

- **Tətbiq etmək** (deploy addımı, işləyib çıxır):

  ```bash
  dotnet run --project src/GreenStore.Api -- migrate
  ```

  Əmr miqrasiyalardan sonra seed də yazır: istinad məlumatı hər mühitdə, nümunə məlumat yalnız `Seed:Demo=true` olanda. Yalnız olmayan sətirlər yazılır, adminin dəyişikliyinin üzərinə yazılmır. Staging və Production-da tətbiq başlayanda miqrasiya **işləmir**, yalnız bu əmrlə. Development-də `Database:MigrateOnStartup` (standart `true`) başlanğıcda da tətbiq edir.
- **Dev bazasını sıfırdan qurmaq** (nümunə məlumat itir): `DROP DATABASE greenstore` və §1-dəki `CREATE DATABASE`, sonra API-ni işə salın.
- **Yeni miqrasiya:**

  ```bash
  dotnet tool restore        # bir dəfə: dotnet-ef 10.0.15 (.config/dotnet-tools.json)
  dotnet ef migrations add <Ad> --project src/GreenStore.Api --output-dir Data/Migrations
  ```

- **SQL-ə baxmaq** (hər PR-da, DATABASE.md §6): `dotnet ef migrations script --project src/GreenStore.Api`.
- `dotnet ef` bağlantını `ConnectionStrings__Default` mühit dəyişənindən götürür, o yoxdursa lokal dev bazasından.
- Miqrasiya tarixçəsi `__ef_migrations_history` cədvəlindədir.
- Tətbiq olunmuş miqrasiya dəyişdirilmir, yenisi yazılır.

## 4. Testlər

```bash
dotnet test
```

- **Unit testlər** (biznes qaydaları, normallaşdırma, slug, kartın mətni, axtarış mətni, dil seçimi, JSON, IP) bazasız işləyir.
- **İnteqrasiya testləri** real PostgreSQL-də işləyir. Test işi `GREENSTORE_TEST_DB` serverində yeni baza yaradır (`greenstore_test_<vaxt>_<id>`), miqrasiyaları tətbiq edir və sonda bazanı silir. Yarımçıq qalmış işlərin 6 saatdan köhnə bazaları növbəti işdə silinir.
- `GREENSTORE_TEST_DB` yoxdursa: `Host=localhost;Port=5432;Database=postgres;Username=greenstore;Password=greenstore_dev`. Rolun `CREATEDB` icazəsi olmalıdır.
- Test bazası `C.UTF-8` lokalı ilə yaradılır. Serverdə bu lokal yoxdursa (adətən macOS və Windows-da quraşdırılmış PostgreSQL), ICU (`und`) işlədilir. Test kiril və Azərbaycan hərflərinin `pg_trgm`-də söz hərfi sayıldığını yoxlayır.
- **Kataloq testləri** (`[Collection("catalogue")]`) ayrıca bazada işləyir: o, miqrasiya olunur və Development kimi seed edilir (`CatalogueApi`), testlər onu yalnız oxuyur. Orada:
  - hər endpoint-in filtrləri, səhifələməsi, sıralaması, 404-ləri və dili;
  - **mock ilə uyğunluq:** `contracts/listing-search-parity.json` və `contracts/service-search-parity.json`-dakı sorğular (mock-un cavabları ilə) bazada işlədilir və eyni elanlar gözlənilir (`SearchParityTests`);
  - **müqavilə formaları:** hər cavab `contracts/frontend-types.json` ilə (yəni `src/types` ilə) müqayisə olunur: sahə adları, JSON tipləri, enum sətirləri, UTC tarixlər; yalnız backend-contract.md-də təsdiqlənmiş əlavələr icazəlidir (`ContractShapeTests`);
  - heç bir public cavabda telefon nömrəsi yoxdur.
- **Seeder testləri** öz bazalarında işləyir: təkrar seed heç nə əlavə etmir, adminin dəyişikliyi qalır, demo məlumat və dev işçi hesabları yalnız istənəndə yazılır.
- **Hesab testləri** (`[Collection("accounts")]`) ayrıca bazada işləyir (`AccountsApi`: Development kimi seed edilmiş). API-nin saatı testin əlindədir (`ManualTimeProvider`), SMS-lər yaddaşa düşür (`CapturingSmsSender`). Orada: SMS kodunun hər limiti (60 saniyə, nömrə üzrə saatda 5 və gündə 10, IP üzrə, gündəlik ümumi limit), 5 cəhd, 5 dəqiqə, HMAC; qeydiyyat (biznes «mağaza»sı ilə), şifrə və SMS ilə giriş, hesabın bağlanması, IP üzrə səhv şifrə limiti, bloklanmış hesab; sessiyanın 30 günlük sürüşən müddəti, `last_seen_at`-ın 5 dəqiqədən bir yazılması, çıxış, cihazdan çıxış, şifrə dəyişəndə və bərpada sessiyaların ləğvi; `/me`, `/me/seller`, seçilmişlər (sayğac daxil), axtarışlar (`newCount`); hər `/me` endpoint-inin sessiya tələb etməsi, rollar, başqasının məlumatına 404, anonim POST-ların limiti; yeni cədvəllərin `CHECK`, `UNIQUE`, FK və indeksləri.
- **Faza 4-ün testləri** də `lifecycle` kolleksiyasındadır (eyni baza): şikayət (qonaq və hesab, təkrar şikayətin eyni cavabı, hədəfin səbəb kodları, `other`-in izahı, moderatorun statusları, `resolution`, tarixçə və `audit_log`); dəstək (bilet nömrəsi, nömrənin E.164-ə çevrilməsi); hər `/admin` yolunun rolu (sessiyasız 401, `user` 403, admin bölmələrində moderator 403) və siyahının tamlığı; admin panelinin rəqəmləri; kateqoriyalar (üç dildə adlar, alt kateqoriya, ad dəyişəndə axtarışın yeni adla tapması, köhnə `version` 409, istifadə olunan kateqoriyanın silinməməsi); satıcının təsdiqi; bloklama (sessiyalar, giriş, elanlar saytdan çıxır və geri qayıdır, gözləyən elan təsdiqlənmir); yeni cədvəllərin `CHECK`, FK, `UNIQUE`, ardıcıllıqları və indeksləri, «Usta çağır» cədvəllərinin silinməsi. Unit testlər: `ReportRules`, `SupportRules`, `CategoryAdminRules` (ikonlar frontend-in `IconName`-i ilə eynidir), formaların gövdəsi `src/types`-ın input tipləri ilə eynidir.
- **Faza 5-in testləri** də `lifecycle` kolleksiyasındadır: paketlər (üç dildə, söndürülmüş seçim görünmür və alınmır); «Önə çıxar»ın tam yolu (sifariş → «Test ödənişi» səhifəsi → «Ödə» → sayta 303 → elan «Önə çıxan», `/listings`-in başında və ana səhifədə, keş xəbəri); təkrar və eyni anda gələn callback-lər bir dəfə tətbiq olunur; imtina, sonra ödəniş; səhv imza (saxlanır, tətbiq olunmur), naməlum provayder və ödəniş, məbləğin uyğunsuzluğu, böyük gövdə; yalnız sahibin aktiv elanı; sahə xətaları; `Idempotency-Key`; ödənilməmiş sifariş limiti; Production-da saxta ödənişin olmaması; paket (`feature` + `bump`), «İrəli çək 1 dəfə», ardıcıl alınan «Önə çıxar» və elanın müddətinin uzanması; yerləşdirəndə seçilən reklam (`pendingPromotion`), redaktədə dəyişməsi; `Promotions` işi (bitən «Önə çıxar», vaxtı çatan «İrəli çək», saytdan çıxmış elanın qaldırılmaması, sonuncu qaldırma, advisory lock); yeni cədvəllərin `CHECK`, FK, `UNIQUE`, ardıcıllığı və indeksləri. Unit testlər: `PromotionRules` (nə başlayır, qaldırmaların fasiləsi, callback-in sifarişə təsiri, qayıdış yolu, sifarişin yoxlanması) və saxta provayder (ödəniş səhifəsinin ünvanı, HMAC imzası, oxuna bilməyən gövdə, Production-da işləməməsi).
- **Elan dövrü testləri** (`[Collection("lifecycle")]`) öz bazalarında işləyir (`LifecycleApi`: Development kimi seed edilmiş, test saatı, yaddaşa düşən SMS və keş xəbərləri, şəkillər testin müvəqqəti qovluğunda). Orada: fərdi və biznes hesabının tam yolu (şəkil → elan → «Yoxlamada» → moderator təsdiqi → kataloq, elanın səhifəsi, satıcı səhifəsi → «Nömrəni göstər» → statistika); şəkil yükləmənin hər qaydası (tip, ölçü, 600 px, piksel limiti, zədəli və yarımçıq fayl, birdəfəlik token, 10 dəqiqə, CORS, gözləyən şəkil limiti); `Idempotency-Key` (təkrar, başqa gövdə, eyni anda dörd sorğu); hər validasiya xətası; moderasiya (rollar, növbə, filtrlər, fərq, rədd səbəbi, köhnə versiya, iki moderator eyni anda, `audit_log`, outbox); «Elanlarım»ın hər əməliyyatı, kateqoriyanın kilidi; sayğacların gündə bir sayılması; fon işləri (müddət, outbox və təkrar, təmizləmə) və yeni cədvəllərin `CHECK`, FK, indeksləri və UNLOGGED `listing_seen`.
- **Qaydaların unit testləri:** `ListingLifecycle`-ın hər status × əməliyyat cütü (icazəli və qadağan), `ListingInputRules`, `RevisionDiff`, şəkil qaydaları və libvips emalı (EXIF-in silinməsi, düz çevirmə, kiçik şəklin böyüdülməməsi), lokal yaddaş, outbox-un təkrar fasiləsi.
- **Saxlanan axtarışın sorğusu** saytın `filterQuery`-si kimi normallaşdırılır: [`contracts/saved-search-query.json`](contracts/saved-search-query.json) nümunələri Node-un `URLSearchParams`-ı ilə yaradılıb, C# testi (`CatalogueQueryStringTests`) onlarla yoxlayır.
- Docker və Testcontainers lazım deyil.
- Testlər VSTest ilə işləyir (`xunit.runner.visualstudio`), ona görə `dotnet test` istənilən qovluqdan işləyir, məsələn repo kökündən `dotnet test backend`.
- **Axtarış normallaşdırması:** [`contracts/search-normalization.json`](contracts/search-normalization.json) nümunələri həm C# testində (`SearchTextTests`), həm frontend testində (`src/test/searchNormalizationParity.test.ts`) yoxlanır. Yeni nümunə hər iki tərəfdə keçməlidir. Frontend-də olmayan davranış `"backendOnly": true` ilə işarələnir və frontend testi onu buraxır.

**Commit-dən əvvəl** (`backend/` dəyişibsə):

```bash
dotnet build backend
dotnet test backend
dotnet format backend --verify-no-changes
```

CI eyni yoxlamaları `.github/workflows/backend.yml`-də PostgreSQL 16 servis konteyneri ilə edir.

## 5. Mühit dəyişənləri

Konfiqurasiya `appsettings.json`-dadır, dev dəyərləri `appsettings.Development.json`-dadır. Mühit dəyişəni eyni açarı əvəz edir (`:` əvəzinə `__`).

| Dəyişən | Nə üçün | Development |
|---|---|---|
| `ASPNETCORE_ENVIRONMENT` | `Development`, `Staging` və ya `Production` | `Development` |
| `ConnectionStrings__Default` | PostgreSQL bağlantısı; boşdursa API başlamır | lokal `greenstore` bazası |
| `Internal__ApiKey` | Next.js serverinin `X-Internal-Key` açarı. `X-Client-IP` yalnız bu açarla qəbul olunur, boşdursa heç vaxt | `dev-internal-key` |
| `Frontend__BaseUrl` | saytın ünvanı: keş yeniləmə xəbərləri (`POST {BaseUrl}/api/revalidate`) və şəkil yükləmənin CORS mənbəyi | `http://localhost:3000` |
| `Revalidation__Secret`, `Revalidation__TimeoutSeconds` | saytın `/api/revalidate`-inə göndərilən gizli açar (`Authorization: Bearer`, saytın `REVALIDATE_SECRET`-i ilə eyni); boşdursa xəbər göndərilmir. Sorğunun vaxt limiti | `dev-revalidate-secret`, `10` |
| `Otp__HmacKey` | SMS kodlarının və IP-lərin HMAC açarı. Boşdursa API heç bir mühitdə başlamır; Production-da ən azı 32 simvol | dev dəyəri |
| `Otp__ExposeDemoCode` | kodu SMS-dən əlavə cavabda da (`demoCode`) qaytarmaq. Yalnız Development-də (və testlərdə): Staging-də və Production-da `true` olsa, API başlamır | `true` |
| `Otp__LifetimeSeconds`, `Otp__ResendSeconds`, `Otp__MaxAttempts`, `Otp__VerifiedLifetimeSeconds` | kodun ömrü (300), təkrar göndərmə fasiləsi (60), cəhd sayı (5, ən çox 5), təsdiqlənmiş kodun qeydiyyat və bərpa üçün etibarlı qaldığı vaxt (1800) | standart |
| `Otp__PerPhoneHourly`, `Otp__PerPhoneDaily` | bir nömrəyə saatda və 24 saatda kod (5, 10) | standart |
| `Otp__PerIpHourly`, `Otp__PerIpDaily` | bir IP-dən (IPv6: /64) saatda və 24 saatda kod (20, 100) | standart |
| `Otp__GlobalDailyCap` | bütün saytda 24 saatda ən çox kod (2000); 80 %-də xəbərdarlıq, aşılanda xəta loqu və `503 otp.unavailable` | standart |
| `Sms__Provider` | SMS göndərən (§8); indi yalnız `log` | `log` |
| `Sms__ApiUrl`, `Sms__Login`, `Sms__Password`, `Sms__ApiKey`, `Sms__Sender`, `Sms__TimeoutSeconds` | real provayderin ayarları (§8); `Password` və `ApiKey` yalnız mühit dəyişəni ilə | boş, `GreenStore`, `10` |
| `Auth__FailedLoginsPerIp`, `Auth__FailedLoginsWindowMinutes` | bir IP-dən səhv şifrə limiti (30 cəhd 15 dəqiqədə), hesabın öz bağlanmasından ayrı | `30`, `15` |
| `Seed__Reference`, `Seed__Demo` | istinad (kateqoriyalar, şəhərlər, reklam paketləri) və nümunə məlumatı; Production-da `Seed__Demo` `false` qalmalıdır, Staging-də nümunə üçün `true` | `true`, `true` |
| `Seed__DevAccounts` | dev admin və moderator hesabları (§9). Yalnız Development-də (və testlərdə): Staging-də və Production-da `true` olsa, API başlamır | `true` |
| `Seed__Directory` | seed fayllarının qovluğu; boşdursa binary-lərin yanındakı `seed/` | boş |
| `Media__BaseUrl` | yüklənən şəkillərin ünvanı (Production-da CDN); demo şəkillər `/images/...` yolu ilə qalır | `http://localhost:5080/media` |
| `Media__Storage` | `local` (API-nin diski, `/media`-dan verilir) və ya `s3` (§13) | `local` |
| `Media__LocalPath` | `local` yaddaşın qovluğu (nisbi yol layihənin qovluğuna görə) | `.media` |
| `Media__UploadBaseUrl` | brauzerin şəkli göndərdiyi API ünvanı (`uploadUrl`), məsələn `https://api.greenstore.az`; boşdursa sorğunun gəldiyi ünvan | boş |
| `Media__UploadOrigins__0`, `__1`, … | `Frontend__BaseUrl`-dən başqa şəkil yükləyə bilən sayt ünvanları (CORS) | `localhost:3000`, `localhost:3100` |
| `Media__MaxBytes`, `Media__MinSide`, `Media__MaxPixels`, `Media__UploadMinutes`, `Media__MaxUnattachedPerUser` | şəkil limitləri: 10 MB, qısa tərəf 600 px, 50 meqapiksel, yükləmə ünvanı 10 dəqiqə, hesabda 24 saatda elana bağlanmamış 60 şəkil | standart |
| `Media__S3__ServiceUrl`, `__Region`, `__Bucket`, `__AccessKey`, `__SecretKey`, `__ForcePathStyle` | S3-uyğun yaddaş (§13); açarlar yalnız mühit dəyişəni ilə | boş |
| `Listings__MaxSubmissionsPerDay`, `Listings__MaxDraftsPerUser`, `Listings__MaxDraftBytes` | hesabın 24 saatda göndərdiyi yeni elan (30), qaralama sayı (20) və ölçüsü (64 KB) | standart |
| `Jobs__Enabled`, `Jobs__FirstRunDelaySeconds`, `Jobs__ExpireListingsSeconds`, `Jobs__OutboxSeconds`, `Jobs__PromotionsSeconds` | tez-tez işləyən fon işləri: müddəti bitən elanlar (10 dəqiqədən bir), outbox (5 saniyədən bir), reklam (10 dəqiqədən bir: bitən «Önə çıxar», «İrəli çək» qaldırmaları) | `true`, `10`, `600`, `5`, `600` |
| `Payments__Provider` | reklam sifarişlərinin ödəniş provayderi (§16); indi yalnız `fake`, o da yalnız Development və Staging-də işləyir. Production-da sifariş `503 payment.unavailable` alır (API başlayanda xəbərdarlıq yazır) | `fake` |
| `Payments__PublicBaseUrl` | API-nin ictimai ünvanı (məsələn `https://api.greenstore.az`): saxta ödəniş səhifəsinin və real provayderin callback ünvanı üçün; boşdursa sorğunun gəldiyi ünvan | boş |
| `Payments__MaxPendingOrdersPerDay` | bir hesabın 24 saatda açdığı ödənilməmiş sifariş (20); aşılanda `429 promotion-order.too-many` | `20` |
| `Payments__Fake__Secret` | saxta provayderin callback imzasının HMAC açarı; boşdursa hər API nüsxəsi öz açarını yaradır (Staging-də bir neçə nüsxə varsa qoyun) | dev dəyəri |
| `RateLimiting__Views__*`, `RateLimiting__PhoneReveals__*`, `RateLimiting__PaymentCallbacks__*` | baxış (dəqiqədə 120), «Nömrəni göstər» (10 dəqiqədə 30) və ödəniş callback-i (dəqiqədə 300) limitləri, IP üzrə | standart |
| `RateLimiting__AnonymousWrites__PermitLimit`, `RateLimiting__AnonymousWrites__WindowSeconds` | anonim POST-ların limiti, IP üzrə | `20`, `60` |
| `Cleanup__Enabled`, `Cleanup__FirstRunDelaySeconds` | gündəlik təmizləmə (ARCHITECTURE.md §12): 7 gündən köhnə SMS kodları, bitəndən 30 gün keçmiş sessiyalar, 24 saatda elana bağlanmayan şəkillər (faylları ilə), 2 gündən köhnə `listing_seen`, 24 saatdan köhnə `Idempotency-Key`-lər, 30 gün əvvəl göndərilmiş outbox, 13 aydan köhnə gündəlik statistika, 2 ildən köhnə `audit_log` və qərarlar; başlanğıcdan 60 saniyə sonra, sonra gündə bir. Bir neçə API nüsxəsində advisory lock ilə yalnız biri işləyir | `true`, `60` |
| `Database__MigrateOnStartup` | başlanğıcda miqrasiya (yalnız Development-də nəzərə alınır) | `true` |
| `GREENSTORE_TEST_DB` | testlərin PostgreSQL serveri | yuxarıdakı standart |

**Gizli açarlar repoda saxlanmır.** Staging və Production-da `ConnectionStrings__Default`, `Internal__ApiKey`, `Otp__HmacKey`, `Revalidation__Secret`, S3 açarları (`Media__S3__AccessKey`, `Media__S3__SecretKey`) və SMS provayderinin açarları (`Sms__Password`, `Sms__ApiKey`) yalnız mühit dəyişənləri ilə verilir. `appsettings.Development.json`-dakı dəyərlər yalnız lokal iş üçündür.

## 6. API qaydaları (qısaca)

Ətraflı: ARCHITECTURE.md §7.

- Bütün endpoint-lər `/api/v1` altındadır.
- **JSON:** sahələr camelCase; enum-lar `src/types`-dakı kimi kebab-case sətirdir (`bare-root`, `garden-centre`, `one-cixar`); tarixlər UTC, `Z` ilə (`2026-10-28T06:15:00Z`); `null` sahələr göndərilmir. Mövqeli record-da könüllü sahəyə `= null` yazılır, yoxsa o sahə məcburi sayılır.
- **Xətalar:** RFC 9457 ProblemDetails (`application/problem+json`), həmişə sabit `code` ilə (`not-found`, `validation`, `rate-limited`, `concurrency-conflict`, …). Sahə xətaları `errors`-dadır: sahə → kodlar. Mətni müştəri koda görə öz dilində göstərir. `Accept` başlığı nə olursa olsun (məsələn, `text/html`), xəta bu formatda gəlir.
- **`bad-request` və `validation`:** gövdə müqaviləyə uymursa (səhv JSON, səhv tip və ya enum, məcburi sahə yoxdur və ya `null`-dur), cavab `400 bad-request`-dir, `errors` olmur. Bu, müştəri kodunun xətasıdır. İstifadəçinin yazdığı dəyərləri modulun validatoru yoxlayır və `400 validation` qaytarır, `errors` ilə. Ona görə formada boş qala bilən sahə DTO-da könüllü və ya sətir olur, boşluğu validator `required` kodu ilə bildirir.
- **Dil:** `Accept-Language` (`az`, `ru`, `en`; standart və ehtiyat dil `az`). Cavabda `Content-Language` və `Vary: Accept-Language` olur.
- **Müştərinin IP-si:** `X-Client-IP` yalnız düzgün `X-Internal-Key` ilə qəbul olunur, yoxsa bağlantının IP-si götürülür. IPv6 limitləri `/64` şəbəkə üzrə sayılır.
- **Id-lər:** UUIDv7, tətbiq yaradır (`Ids.New(clock)`). Saat `TimeProvider`-dən gəlir, testlərdə dəyişdirilir.
- **Rəqabətli yazma:** `xmin` versiyası (`RowVersion`); köhnə versiya ilə yazma `409 concurrency-conflict` qaytarır.
- **Siyahılar:** `page` (1-dən), `pageSize` (1–60). Səhifə sondan kənardadırsa, son səhifə qaytarılır və cavabdakı `page` bunu deyir. Səhv parametr `400 validation` qaytarır, `errors`-da parametrin adı və kodu ilə (`invalid`, `out-of-range`).
- **Telefon nömrələri public cavablarda yoxdur** (qərar 4): yalnız `phoneMasked` («+994 50 *** ** 34»).

### Oxuma endpoint-ləri (faza 1)

| Endpoint | Nə qaytarır |
|---|---|
| `GET /api/v1/categories?kind=product\|service` | kateqoriyalar sıra ilə, aktiv elan sayı ilə (`Category[]`) |
| `GET /api/v1/categories/{id}` | bir kateqoriya; alt kateqoriya id-si `404 category.not-found` |
| `GET /api/v1/cities` | şəhərlər (`City[]`) |
| `GET /api/v1/home` | `HomeContent`: 4 «Önə çıxan», 8 son elan, 3 təsdiqlənmiş satıcı, 3 xidmət |
| `GET /api/v1/listings?q&categoryId&subcategoryId&cityIds&minPrice&maxPrice&promoted&delivery&sellerType&sellerId&heightMin&heightMax&ageMin&ageMax&rootSystem&sort&page&pageSize` | `PageResult<Listing>`; `sort=newest\|price-asc\|price-desc`, standart səhifə 24 |
| `GET /api/v1/listings/facets?…` | filtr sayları: `{ categories: { all, byId }, subcategories, cities: { all, byCity } }` |
| `GET /api/v1/listings/count?categoryId&cityId` | `{ count }` |
| `GET /api/v1/listings/{slug}` | elan; slug-ın sonundakı nömrə həlledicidir, cavabdakı `slug` cari slug-dır |
| `GET /api/v1/listings/{id}/related` | `{ fromSeller, similar }` |
| `GET /api/v1/services?q&categoryId&cityId&providerKind&minPrice&maxPrice&sort&page&pageSize` | `ServiceSearchResult`; `providerKind=company\|individual`, standart səhifə 6 |
| `GET /api/v1/services/{slug}`, `GET /api/v1/services/{id}/related` | xidmət; `{ fromProvider, similar }` |
| `GET /api/v1/providers/{id}`, `GET /api/v1/providers/{id}/services` | `ServiceProvider` (id hesabın id-sidir), onun xidmətləri; xidmətləri biznesin satıcı id-si ilə də vermək olur (satıcı səhifəsi belə soruşur) |
| `GET /api/v1/sellers?businessKind&cityId&page&pageSize` | `PageResult<Seller>`: əvvəl təsdiqlənmişlər, sonra ada görə (Azərbaycan əlifbası). `businessKind`: bu növü olan bizneslər (bir neçə növü olan biznes hər birində çıxır) |
| `GET /api/v1/sellers/{slug}`, `GET /api/v1/sellers/by-id/{id}` | satıcı |
| `GET /api/v1/sitemap/{listing\|seller\|service}?cursor&limit` | `{ items: [{ slug, updatedAt }], nextCursor? }`, `limit` 1–5000 (standart 1000) |

Adlar (kateqoriya, şəhər, biznes növü, kartın atribut sətri, xidmətin qiymət mətni) `Accept-Language` dilində gəlir. İstifadəçinin yazdığı mətn (başlıq, təsvir) yazıldığı kimi qalır.

## 7. Hesablar (faza 2)

Ətraflı formalar və xəta kodları: [backend-contract.md 2.1 və 2.3](../docs/handoff/backend-contract.md#faza-2-hesablar).

| Endpoint | Nə edir |
|---|---|
| `POST /api/v1/auth/otp` `{ phone, purpose }` | SMS kodu göndərir → `OtpChallenge`. `purpose`: `register`, `login`, `reset-password`, `change-phone` (sonuncu sessiya tələb edir) |
| `POST /api/v1/auth/otp/verify` `{ challengeId, code }` | `{ ok: true }` və ya `otp.wrong-code` (`attemptsLeft`), `otp.too-many-attempts`, `otp.expired` |
| `POST /api/v1/accounts` | qeydiyyat → 201 `{ ok, user, session }`; biznes hesabı satıcı profilini də yaradır |
| `POST /api/v1/auth/login` `{ login, password }` | telefon və ya e-poçt ilə giriş → `{ ok, user, session }` |
| `POST /api/v1/auth/login/otp` `{ otpChallengeId }` | SMS kodu ilə giriş |
| `POST /api/v1/auth/logout` | sessiyanı bağlayır → 204 |
| `POST /api/v1/accounts/password-reset` `{ otpChallengeId, password }` | şifrənin bərpası; bütün sessiyalar bağlanır |
| `GET`, `PATCH /api/v1/me` | profil (`role`, `locale` daxil) |
| `POST /api/v1/me/password`, `POST /api/v1/me/phone` | şifrə (digər sessiyalar bağlanır), yeni nömrə (`change-phone` kodu ilə) |
| `GET /api/v1/me/sessions`, `DELETE /api/v1/me/sessions/{id}` | «Aktiv cihazlar», cihazdan çıxış |
| `GET`, `PATCH /api/v1/me/seller` | biznes profili («mağaza»): ad, növ, şəhər, əlaqə şəxsi, ünvan, haqqında, iş saatları, xidmətlər, nömrə, sosial şəbəkələr, `version` |
| `GET /api/v1/me/favorites`, `GET …/items`, `PUT`/`DELETE …/{listing\|service}/{id}`, `POST …/merge` | seçilmişlər |
| `GET`, `POST /api/v1/me/saved-searches`, `PATCH`/`DELETE …/{id}`, `POST …/{id}/opened` | yadda saxlanılan axtarışlar, `newCount` ilə |

**Qaydalar.**
- **Sessiya:** `Authorization: Bearer <token>`. Token 256 bit təsadüfi, bazada yalnız SHA-256-sı saxlanır. Son istifadədən 30 gün yaşayır (sürüşən); istifadə ən çox 5 dəqiqədən bir yazılır. Etibarsız token public endpoint-lərə mane olmur, `/me` isə `401 unauthorized` verir.
- **SMS kodu:** 4 rəqəm, bazada HMAC-SHA256 (`Otp:HmacKey`), 5 cəhd, 5 dəqiqə. Eyni nömrəyə 60 saniyədə bir, saatda 5, 24 saatda 10 kod; IP üzrə və bütün sayt üzrə limitlər (§5). Yalnız +994 mobil nömrələri (10, 50, 51, 55, 60, 70, 77, 99). Hesabı olmayan nömrəyə giriş və bərpa kodu getmir (404), hesabı olan nömrəyə qeydiyyat kodu getmir (409). SMS outbox-dan keçmir, birbaşa göndərilir.
- **Şifrə:** 8–128 simvol, ən azı bir hərf və bir rəqəm; PBKDF2 (`PasswordHasher`). 5 səhv şifrədən sonra hesab 15 dəqiqə bağlanır (`423 auth.locked`, `Retry-After`); SMS ilə giriş bağlanmanı açır. Bir IP-dən 15 dəqiqədə 30 səhv şifrədən sonra həmin IP gözləyir (`429 auth.too-many-attempts`).
- **İcazə:** hər `/me` resursu sessiyanın sahibinindir; başqasının id-si `404` verir (məsələn `session.not-found`). Bütün sahib yoxlamaları bir yerdən keçir: `Modules/Accounts/Auth/Access.cs` (`CanManage`). Rollar `user`, `moderator`, `admin`; işçi endpoint-ləri üçün siyasətlər hazırdır (`Access.StaffPolicy`, `Access.AdminPolicy`).
- **Limit:** bütün anonim POST-lar (`/auth/*`, `/accounts*`, `/reports`, `/support`) IP üzrə `anonymous-writes` limitindədir.

## 8. SMS provayderi

İndi SMS göndərilmir: `Sms:Provider = "log"` mesajı (kodla birlikdə) API-nin loquna yazır (`Modules/Accounts/Sms/LogSmsSender.cs`). Development-dən başqa mühitdə API başlayanda bunun üçün xəbərdarlıq yazır, çünki orada kodu heç kim almır. Real Azərbaycan provayderi (müqavilədən sonra) belə qoşulur:

1. **Sinif yazın:** `Modules/Accounts/Sms/<Ad>SmsSender.cs`, məsələn `AcmeSmsSender`, `ISmsSender`-i həyata keçirir. Yeganə metod `SendAsync(SmsMessage message, CancellationToken ct)`-dir: `message.Phone` E.164-dür (`+994505551234`; provayder `994505551234` istəyirsə `+`-ı atın), `message.Text` artıq alıcının dilindədir. Provayderin HTTP API-sini `HttpClient` ilə çağırın; ayarları konstruktorda `IOptions<SmsOptions>` ilə alın.
2. **Provayder mesajı qəbul etməyəndə istisna atın** (məsələn, `HttpRequestException` və ya `response.EnsureSuccessStatusCode()`). API onda `503 otp.unavailable` qaytarır, xətanı loqa yazır və bu cəhd istifadəçinin limitlərinə sayılmır.
3. **Qeydiyyatdan keçirin:** `Modules/Accounts/Sms/SmsSetup.cs`-də
   - `Providers` siyahısına adı əlavə edin: `[SmsOptions.LogProvider, "acme"]`;
   - `AddSms`-də `services.AddHttpClient<AcmeSmsSender>(c => c.Timeout = TimeSpan.FromSeconds(10));` yazın;
   - `switch`-ə sətir əlavə edin: `"acme" => sp.GetRequiredService<AcmeSmsSender>(),`.
4. **Ayarlar** (`Sms` bölməsi, `SmsOptions`): `Sms__Provider=acme`, `Sms__ApiUrl` (provayderin göndərmə ünvanı), `Sms__Login`, `Sms__Password` və ya `Sms__ApiKey` (gizli: yalnız hostinqin mühit dəyişənlərində), `Sms__Sender` (provayderdə qeydiyyatdan keçmiş göndərən adı, standart `GreenStore`), `Sms__TimeoutSeconds`. Provayderin başqa sahəsi lazımdırsa, `SmsOptions`-a əlavə edin.
5. **Test:** `tests/…/Infrastructure/AccountsApi.cs` testlərdə `ISmsSender`-i `CapturingSmsSender` ilə əvəz edir, ona görə testlər real SMS göndərmir. Provayderin öz sinfi üçün unit test yazın (HTTP cavabını `HttpMessageHandler` ilə saxtalaşdırıb), real nömrəyə yoxlamanı Staging-də edin.
6. **Production:** `Otp__ExposeDemoCode=false` (standartdır; `true` olsa API başlamır) və `Otp__HmacKey` ən azı 32 simvol. SMS mətnləri `Modules/Accounts/Sms/SmsTexts.cs`-dədir (rus və ingilis mətni qaralamadır).

## 9. Dev hesabları

Yalnız Development-də (`Seed:DevAccounts=true`, `appsettings.Development.json`) seed bu iki işçi hesabını yaradır. Parollar yalnız lokal iş üçündür; Staging-də və Production-da `Seed__DevAccounts=true` olsa API başlamır.

| Rol | Telefon | E-poçt | Şifrə |
|---|---|---|---|
| admin | `+994 50 000 00 01` | `admin@greenstore.local` | `Admin-dev-2026` |
| moderator | `+994 50 000 00 02` | `moderator@greenstore.local` | `Moderator-dev-2026` |

- Hər ikisi şifrə ilə (telefon və ya e-poçt) və SMS kodu ilə daxil ola bilər (Development-də kod `demoCode`-dadır).
- **Demo satıcılar** (nümunə marketplace) şifrəsizdir, amma mobil nömrəsi olanlar SMS kodu ilə daxil ola bilər. Məsələn, «Abşeron Tingçilik»in sahibi Elvin Əliyev: `+994 50 555 12 34`. Belə hesabın «mağaza»sı `/me/seller`-dədir.
- Yeni biznes hesabı: `POST /auth/otp` (`purpose: register`) → `demoCode` ilə `POST /auth/otp/verify` → `POST /accounts` (`accountType: business`, `businessKinds`: bir və ya bir neçəsi, `companyName`). Satıcı səhifəsi (`GET /sellers/{slug}`) dərhal açılır, 0 elanla.

## 10. Struktur

```
backend/
  GreenStore.slnx, global.json, Directory.Build.props, Directory.Packages.props
  docker-compose.yml          PostgreSQL 16, miqrasiya və API konteyneri (Docker olanlar üçün; API hissəsi yoxlanmayıb)
  Dockerfile                  API image-i (yoxlanmayıb, ARCHITECTURE.md §16)
  contracts/                  frontend ilə ortaq test faylları (normallaşdırma, src/types-ın forması, mock ilə uyğunluq)
  seed/                       seed faylları və onları src/data-dan yaradan skript (seed/README.md)
  src/GreenStore.Api/
    Program.cs
    Common/                   ProblemDetails, JSON, dil, axtarış mətni, IP, rate limit, health, id-lər
    Data/                     AppDbContext, interceptor, xmin, LocalizedText → jsonb, Migrations/, Seed/ (seeder)
    Modules/                  Taxonomy, Listings (elanlar və xidmətlər, yerləşdirmə, «Elanlarım», qaralamalar, sayğaclar,
                              ListingLifecycle, ListingInputRules, RevisionDiff), Sellers (+ /me/seller), Accounts (SMS
                              kodu, qeydiyyat, giriş, sessiyalar, /me; Auth/, Sms/), Engagement (seçilmişlər, axtarışlar,
                              şikayətlər, dəstək), Media (şəkil yükləmə, libvips emalı, IFileStorage: lokal
                              disk və S3), Admin (moderasiya, panelin rəqəmləri, şikayətlərə baxış, kateqoriyalar, satıcı
                              təsdiqi, bloklama), Promotion (paketlər, sifarişlər, ödəniş: PromotionRules,
                              Payments/ IPaymentGateway və FakePaymentGateway), Platform (outbox, audit_log, Idempotency-Key)
    Jobs/                     fon işləri: ExpireListings, Promotions, Outbox, Cleanup (advisory lock ilə)
  tests/GreenStore.Api.Tests/ unit və inteqrasiya testləri
```

## 11. Sayt bu API ilə

```bash
# 1) API (Development: miqrasiya və seed başlanğıcda)
cd backend && dotnet run --project src/GreenStore.Api
# 2) sayt, repo kökündən, başqa terminalda
DATA_SOURCE=api API_BASE_URL=http://localhost:5080 API_INTERNAL_KEY=dev-internal-key npm run dev
```

- `API_BASE_URL` və `API_INTERNAL_KEY` yalnız serverdədir (`NEXT_PUBLIC_` deyil). `API_INTERNAL_KEY` API-nin `Internal__ApiKey`-i ilə eyni olmalıdır; dev dəyəri `dev-internal-key`-dir, real açar yalnız hostinqin gizli dəyişənlərində saxlanır.
- **Ziyarətçinin IP-si** (`X-Client-IP`) yalnız hostinqin proxy-sinin yazdığı başlıqdan götürülür, brauzerin göndərdiyindən yox (`src/services/clientIp.ts`). Standart: `X-Forwarded-For`-un sonuncu elementi (Vercel, `$proxy_add_x_forwarded_for` ilə nginx). Başqa hostinqdə `CLIENT_IP_HEADER` (hostinqin hər sorğuda yenidən yazdığı başlıq, məsələn `cf-connecting-ip`) və ya `TRUSTED_PROXY_HOPS` (`X-Forwarded-For`-a əlavə edən proxy-lərin sayı) qoyulur. `next start` internetə proxy-siz açılmamalıdır: onda ziyarətçi IP-ni özü seçə və SMS, şifrə və anonim yazma limitlərindən yayına bilər. Ətraflı: kök README.md, «Visitor IP behind the hosting's proxy».
- Public oxumalar Next-in keşində 60 saniyə qalır (`revalidate: 60`, tag-larla). `X-Client-IP` keşlənən oxumalara qoyulmur (keş bütün ziyarətçilər üçün birdir), yalnız ziyarətçiyə aid sorğulara (sonrakı fazaların yazmaları).
- `next build` API rejimində ana səhifəni API-dən oxuyur, ona görə əvvəl API işə salınır. Elan və xidmət səhifələri build zamanı yaranmır: ilk sorğuda yaranır və keşlənir.
- API rejimində də sayt indekslənmir: seed nümunə məlumatdır, indeksləmə yalnız `SEO_INDEXABLE=true` ilə açılır (`src/seo/env.ts`).
- Repository-nin bütün metodları API-yə qoşulub (faza 5-dən). Gələcəkdə endpoint-i hələ olmayan metod API rejimində «not implemented yet (phase N)» xətası verir (`NotImplementedError`).
- **Reklamın ödənişi** (§15): provayder ziyarətçini `{Frontend__BaseUrl}/kabinet/odenis?order=<id>`-ə qaytarır, ona görə saytı `localhost:3100`-də yoxlayanda API `Frontend__BaseUrl=http://localhost:3100` ilə işə salınır (aşağıdakı keş xəbərləri kimi).
- **Şəkil yükləmə** brauzerdən birbaşa API-yə gedir (`PUT uploadUrl`). Saytın CSP-si (`connect-src`) API-nin ictimai ünvanını (`API_PUBLIC_URL`, boşdursa `API_BASE_URL`), `img-src` və `images.remotePatterns` isə şəkillərin ünvanını (`MEDIA_BASE_URL`, boşdursa `<API_PUBLIC_URL>/media`) özü buraxır (`src/seo/csp.ts`). Bu ünvanlar API-nin `Media__UploadBaseUrl` və `Media__BaseUrl`-i ilə eyni olmalıdır; API öz tərəfində CORS-u yalnız saytın mənbəyindən açır (`Frontend__BaseUrl`, `Media__UploadOrigins`).
- **Keş xəbərləri:** saytın `REVALIDATE_SECRET`-i API-nin `Revalidation__Secret`-i ilə eyni olmalıdır (Development: `dev-revalidate-secret`). Saytı `localhost:3100`-də yoxlayanda API-ni `Frontend__BaseUrl=http://localhost:3100` ilə işə salın, yoxsa xəbərlər `localhost:3000`-ə gedir.

## 12. Elan dövrü (faza 3)

Ətraflı formalar və xəta kodları: [backend-contract.md, faza 3](../docs/handoff/backend-contract.md#faza-3-elan-dövrü). Həyat dövrü: ARCHITECTURE.md §6, kod `Modules/Listings/ListingLifecycle.cs`.

| Endpoint | Nə edir |
|---|---|
| `POST /api/v1/photos` `{ contentType, bytes }` | şəkil üçün birdəfəlik yükləmə ünvanı → 201 `{ photoId, uploadUrl, expiresAt }` (sessiya ilə) |
| `PUT /api/v1/photo-uploads/{token}` | brauzer faylı göndərir (sessiyasız, CORS) → `{ photoId, status: "ready", width, height, url }` |
| `POST /api/v1/listings` | elanı göndərir → 201 `{ id, slug, number, status: "pending" }`; `Idempotency-Key` başlığı ilə |
| `GET /api/v1/me/listings`, `GET …/{id}` | «Elanlarım»: hər statusda (silinmişdən başqa), sahibin sahələri ilə (`contactPhone`, `rejectionReasonCode`, `version`, `photoIds`, …) |
| `PUT /api/v1/me/listings/{id}` | redaktə: yenidən yoxlamaya gedir; dərc olunmuş elanın kateqoriyası dəyişmir |
| `POST …/{id}/renew`, `…/deactivate`, `…/activate`, `DELETE …/{id}` | «Yenilə (pulsuz)», «Deaktiv et», «Aktiv et», «Sil» |
| `GET /api/v1/me/listings/{id}/stats` | `ListingStats`: cəmlər və 14 günlük baxışlar |
| `GET`, `POST /api/v1/me/drafts`, `GET`, `PUT`, `DELETE …/{id}` | sihirbazın qaralamaları, olduğu kimi |
| `POST /api/v1/listings/{id}/views` | baxış: eyni ziyarətçi gündə bir dəfə, sahib sayılmır |
| `POST /api/v1/listings/{id}/phone-reveals`, `POST /api/v1/sellers/{id}/phone-reveals` | «Nömrəni göstər» → `{ phone?, whatsappUrl? }`, IP üzrə limitli |
| `GET /api/v1/admin/moderation?status&kind&sort&q&page`, `GET …/{listingId}` | moderasiya növbəsi `totals` ilə; hər element elanın özü, satıcı, son təsdiqlənmiş versiya ilə fərq |
| `POST /api/v1/admin/moderation/{listingId}/decision` | `{ decision, reasonCode?, note?, version }`: təsdiq və ya rədd |

**Qaydalar.**
- **Statuslar:** yeni elan `pending`-dir; təsdiq `active` edir (30 gün, ilk dəfədirsə «Ən yenilər»in başına), rədd `rejected` (səbəb kodu ilə). Hər redaktə elanı yenidən `pending` edir (aktiv elan yoxlanana qədər görünmür) və yeni versiya (`listing_revisions`) yazır. «Yenilə» yalnız `expired` elana, 30 yeni gün verir, yuxarı qaldırmır. Silmə sətri saxlayır (`deleted_at`). Qadağan keçid `409 listing.wrong-status`.
- **Versiya:** moderator qərarı gördüyü `version` ilə göndərir; arada sahib elanı dəyişibsə və ya başqa moderator qərar veribsə, `409 concurrency-conflict`. Sahibin `PUT`-u da könüllü `version` qəbul edir.
- **Şəkillər:** JPEG, PNG və ya WebP (ilk baytlara görə), ≤ 10 MB, qısa tərəf ≥ 600 px, ≤ 50 meqapiksel; zədəli və yarımçıq fayl rədd olunur. API şəkli düz çevirir, sRGB edir, bütün metadata-nı (EXIF, GPS) silir və 320, 640, 1280 px WebP nüsxələrini saxlayır; orijinal saxlanmır. Emal `PUT`-un içində gedir. Elana 24 saatda bağlanmayan şəkil silinir.
- **Nömrə:** `contactPhone` hesabın təsdiqlənmiş nömrəsidirsə `contactPhoneVerified: true`, yoxsa moderator «təsdiqlənməyib» görür (qərar 3). Public cavablarda nömrə yoxdur, yalnız `phone-reveals` verir.
- **Sayğaclar:** baxış və «Nömrəni göstər» `listing_seen` ilə gündə bir dəfə sayılır (sessiya, yoxdursa IP + brauzer, HMAC), `listing_counters` və `listing_daily_stats` (Bakı vaxtı) bir SQL ifadəsində artır.
- **Keş:** elan saytda görünəndə və ya saytdan çıxanda outbox-a `revalidate` xəbəri yazılır (dəyişikliklə eyni tranzaksiyada), `Outbox` işi onu saytın `POST /api/revalidate`-inə göndərir (backend-contract.md 3.6); sayt hər tag-ın keşini dərhal köhnəlmiş sayır. Sayt əlçatan deyilsə, xəbər 10 cəhddən sonra buraxılır və loqda xəbərdarlıq qalır; səhifələr onsuz da 60 saniyəyə yenilənir.
- **Fon işləri** (`Jobs/`): `ExpireListings` (10 dəqiqədən bir), `Promotions` (10 dəqiqədən bir, faza 5), `Outbox` (5 saniyədən bir), `Cleanup` (gündə bir). Hər biri PostgreSQL advisory lock götürür, ona görə bir neçə API nüsxəsində yalnız biri işləyir.

**Əl ilə yoxlama** (Development, API işləyir): `curl` ilə qeydiyyat (§9), sonra

```bash
T=<session.token>; A=http://localhost:5080/api/v1; H=(-H 'X-Internal-Key: dev-internal-key' -H "Authorization: Bearer $T" -H 'Content-Type: application/json')
curl -s "${H[@]}" $A/photos -d '{"contentType":"image/jpeg","bytes":30000}'      # → uploadUrl
curl -s -X PUT -H 'Content-Type: image/jpeg' --data-binary @foto.jpg "<uploadUrl>"  # → status: ready
curl -s "${H[@]}" -H 'Idempotency-Key: 1' $A/listings -d @elan.json                 # → status: pending
```

Moderator (`moderator@greenstore.local`, §9) `GET /admin/moderation` ilə elanı və `version`-u görür, `POST /admin/moderation/{id}/decision` `{ "decision": "approve", "version": "…" }` ilə təsdiqləyir; elan `GET /listings/{slug}`-da görünür.

## 13. Şəkil yaddaşı: S3 və CDN

Development lokal diskdən işləyir. Production üçün (hostinq seçiləndə) S3-uyğun yaddaş (Cloudflare R2, Hetzner Object Storage, AWS S3) belə qoşulur:

1. Bucket yaradın, onun qarşısına CDN qoyun (R2-də bucket-in public domeni və ya Cloudflare; başqalarında CDN-in origin-i bucket olur).
2. Mühit dəyişənləri: `Media__Storage=s3`, `Media__S3__ServiceUrl` (məsələn `https://<account>.r2.cloudflarestorage.com`; AWS-də boş, `Media__S3__Region` ilə), `Media__S3__Bucket`, `Media__S3__AccessKey`, `Media__S3__SecretKey` (gizli), `Media__BaseUrl` (CDN ünvanı, məsələn `https://cdn.greenstore.az`), `Media__UploadBaseUrl` (API-nin ictimai ünvanı).
3. Fayllar `p/<il>/<ay>/<id>/<en>.webp` açarı ilə, `Cache-Control: public, max-age=31536000, immutable` başlığı ilə yazılır: açar heç vaxt təkrarlanmır, ona görə CDN onları uzun müddət saxlaya bilər.
4. Sayt tərəfində `MEDIA_BASE_URL` CDN-in ünvanına (məsələn `https://cdn.greenstore.az`), `API_PUBLIC_URL` API-nin ictimai ünvanına qoyulur: CSP-nin `img-src`-i, `connect-src`-i və `images.remotePatterns` onlardan qurulur (`src/seo/csp.ts`; build-də və serverdə eyni dəyər).
5. Kod: `Modules/Media/FileStorage.cs` (`S3FileStorage`). Lokal disk üçün olan testlər işləyir; S3 ilə real yoxlama Staging-də edilməlidir.

## 14. Şikayətlər, dəstək və admin (faza 4)

Ətraflı formalar və xəta kodları: [backend-contract.md 3.5 və 4.1](../docs/handoff/backend-contract.md#faza-4-şikayətlər). Cədvəllər: DATABASE.md §3.7, §3.8. «Usta çağır» (xidmət sorğuları, `/service-requests`) 24 noyabr 2026-da çıxarılıb: endpoint-lər, `service_requests` və `service_request_recipients` cədvəlləri, SMS xəbərləri və ayarları ([docs/handoff/remove-usta-cagir.md](../docs/handoff/remove-usta-cagir.md)).

| Endpoint | Kim | Nə edir |
|---|---|---|
| `POST /api/v1/reports` `{ target, targetId, reason, comment? }` | hamı (IP limiti) | şikayət → 201 `{ id }`; eyni ziyarətçinin eyni hədəf və səbəblə açıq şikayəti varsa 200 və onun id-si |
| `POST /api/v1/support` `SupportMessageInput` | hamı (IP limiti) | dəstək mesajı → 201 `{ ticket }` |
| `GET /api/v1/admin/overview` | moderator, admin | panelin rəqəmləri: moderasiya, şikayətlər, elanlar, hesablar, satıcılar, dəstək, kateqoriyalar |
| `GET /api/v1/admin/reports?status&target&reason&sort&page`, `GET …/{id}` | moderator, admin | şikayətlər `totals` ilə; hər biri hədəfi (elan sahibin gördüyü kimi, nömrə daxil, və ya satıcı), sahibi, şikayətçi, hədəfin açıq şikayətləri və tarixçə ilə |
| `PATCH /api/v1/admin/reports/{id}` `{ status?, resolution?, note? }` | moderator, admin | `open` → `investigating` → `resolved` (`resolution`: `action-taken` və ya `no-violation`); qeyd tarixçəyə düşür |
| `GET`, `POST /api/v1/admin/categories`, `GET`, `PATCH`, `DELETE …/{id}` | admin | kateqoriyalar və alt kateqoriyalar: `names` və `descriptions` üç dildə (`LocalizedText`), ikon, filtrlər, sıra, `isActive`, `version` |
| `POST /api/v1/admin/sellers/{id}/verify` `{ verified }` | admin | «Təsdiqlənmiş satıcı» |
| `POST /api/v1/admin/users/{id}/block` `{ blocked, reason? }` | admin | hesabı bloklayır və ya açır |

**Qaydalar.**
- **Şikayət səbəbləri** koddur (backend-contract.md 4.1): elan `sold`, `wrong-price`, `wrong-photos`, `wrong-info`, `unreachable`, `duplicate`, `fraud`, `other`; satıcı `unreachable`, `wrong-info`, `misconduct`, `fraud`, `other`; xidmət `not-provided`, `wrong-price`, `stolen-photos`, `unreachable`, `fraud`, `other`. `other` izah tələb edir (≤ 500). Hədəf saytda olmalıdır (aktiv elan və ya xidmət, aktiv hesabın satıcısı).
- **Limitlər:** şikayət və dəstək formaları IP üzrə `anonymous-writes` limitindədir (§5).
- **Kateqoriyalar:** iki səviyyə. Kateqoriyanın `kind`, `form` (`plant`, `pack`, `goods`, `grass`; xidmətdə `service`) və ikonu (`IconName`) var; alt kateqoriya valideyninin növünü götürür, ikonu və filtri olmur. Filtrlər formaya görədir: bitkidə `species`, `height`, `age`, `rootSystem`, xidmətdə `serviceType`, `area`, `priceType` (API özü `rootSystem`-i oxuyur). Azərbaycanca ad məcburidir (≤ 60) və bir valideynin altında təkrarlanmır. Id verilməyibsə addan yaranır (`Bağ dekoru` → `bag-dekoru`). `kind`, `form`, valideyn və id sonra dəyişmir. Ad dəyişəndə həmin kateqoriyanın elanlarının `search_text`-i elə həmin sorğuda yenidən yığılır (500-lük hissələrlə). Kateqoriyanı istifadə edən elan və ya alt kateqoriya varsa silinmir (`409 category.in-use`): `isActive: false` ilə saytdan çıxarılır. Hər dəyişiklik `audit_log`-a yazılır və saytın keşini (`taxonomy`, `listings`, `services`, `home`) yeniləyir.
- **Diqqət (sayt):** sihirbaz alt kateqoriyanı hələ Azərbaycanca adı ilə göndərir (backend-contract.md 1.3). Alt kateqoriyanın Azərbaycanca adını dəyişsəniz və ya onu söndürsəniz, sayt `subcategoryId`-ni göndərənə qədər həmin alt kateqoriyada elan yerləşdirmək olmur (`400 subcategory: invalid`). Rus və ingilis adını dəyişmək təhlükəsizdir.
- **Bloklama:** hesab `blocked` olur, bütün sessiyaları bağlanır (`revoked_at`), giriş `403 auth.blocked` verir, aktiv elanları saytdan çıxır (`inactive`) və keş yenilənir. Bloklanmış hesabın gözləyən elanı təsdiqlənmir (`409 listing.owner-blocked`). Açanda son bloklamanın çıxardığı elanlar geri qayıdır (arada sahib dəyişməyibsə; müddəti bitibsə `expired` olur), köhnə sessiyalar bağlı qalır. Admin özünü bloklaya bilməz. Satıcı səhifəsi açıq qalır (elansız), nömrəsi göstərilmir.
- **İcazə:** moderasiya, şikayətlər və panel moderator və admin üçündür; kateqoriyalar, təsdiq və bloklama yalnız admin üçün. Hər admin əməliyyatı `audit_log`-dadır (`report.update`, `category.create|update|delete`, `seller.verify|unverify`, `user.block|unblock`).

**Əl ilə yoxlama** (Development, API işləyir, dev hesabları §9):

```bash
A=http://localhost:5080/api/v1; J=(-H 'Content-Type: application/json')
ADMIN=$(curl -s "${J[@]}" $A/auth/login -d '{"login":"+994500000001","password":"Admin-dev-2026"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["session"]["token"])')
L=$(curl -s "$A/listings?pageSize=1" | python3 -c 'import sys,json;print(json.load(sys.stdin)["items"][0]["id"])')
curl -s "${J[@]}" $A/reports -d "{\"target\":\"listing\",\"targetId\":\"$L\",\"reason\":\"wrong-price\"}"          # → 201 { id }
curl -s "${J[@]}" $A/support -d '{"topic":"other","name":"Rauf","contact":"rauf@example.az","message":"Sualım var, zəng edin."}'  # → { ticket }
curl -s -H "Authorization: Bearer $ADMIN" $A/admin/overview
curl -s -H "Authorization: Bearer $ADMIN" "$A/admin/reports?status=open"
```

## 15. Reklam və ödəniş (faza 5)

Ətraflı formalar və xəta kodları: [backend-contract.md 5.1](../docs/handoff/backend-contract.md#faza-5-ödəniş). Cədvəllər: DATABASE.md §3.9, qaydalar `Modules/Promotion/PromotionRules.cs`.

| Endpoint | Kim | Nə edir |
|---|---|---|
| `GET /api/v1/promotion-packages` | hamı | `PromotionPackage[]`: «İrəli çək», «Önə çıxar», paket, seçimləri və qiymətləri ilə, sorğunun dilində. Bu mühitdə ödəniş provayderi yoxdursa (Production, real provayder qoşulana qədər) boş siyahı: sayt heç nə satmır |
| `POST /api/v1/promotion-orders` `{ listingId, packageId, optionId, returnPath? }` | sessiya (`Idempotency-Key`) | yalnız sahibin aktiv elanı üçün sifariş → 201 `{ order, paymentUrl }`; məbləğ seçimin indiki qiymətidir |
| `GET /api/v1/me/promotion-orders/{id}` | sessiya | sifarişin indiki statusu (`pending`, `paid`, `failed`) |
| `POST /api/v1/payments/{provider}/callback` | provayder (imza ilə, IP limiti) | ödənişin nəticəsi: `payment_events`-ə yazılır, sifarişə bir dəfə tətbiq olunur → `{ orderId, status }` |
| `GET`, `POST /api/v1/payments/fake/checkout/{ref}` | brauzer (yalnız Development və Staging) | «Test ödənişi» səhifəsi: «Ödə» və ya «İmtina et», sonra 303 ilə sayta qayıdış |

**Qaydalar.**
- **Ödənişdən sonra** (bir tranzaksiyada, elanın sətri kilidlənir): «Önə çıxar» `listing_promotions`-a `feature` sətri yazır, elan `is_promoted` olur, `promoted_until` = sonu, `promoted_at` = indi: ana səhifənin «Önə çıxan elanlar» bloku və «Ən yenilər»in «Önə çıxan» qrupu `promoted_at`-a görə sıralanır, yəni son ödəyən elan elanın öz tarixindən asılı olmayaraq birinci olur. İşləyən «Önə çıxar»ın üstünə alınan yenisi onun sonundan başlayır və elanın qrupdakı yerini (`promoted_at`) dəyişmir. Sonu olmayan «Önə çıxan» (demo elanlar) «Önə çıxar» alanda da sonsuz qalır. «İrəli çək» `bump` sətri yazır və elanı dərhal qaldırır (`bumped_at` və `sort_at` = indi), qalan qaldırmalar günlər üzrə bərabər bölünür (`5 gün, hər gün`: gündə bir). Paket ikisini də yazır. Elanın `expires_at`-ı ödənilən hər şeyin sonuna qədər uzanır. Yerləşdirəndə seçilmiş reklam (`pending_promotion_option_id`) silinir, keş xəbəri outbox-a yazılır.
- **Təkrar callback:** sifariş `(provider, provider_ref)` ilə tapılır və sətri kilidlənir; artıq `paid`-dirsə heç nə dəyişmir (200). `listing_promotions`-da `UNIQUE (order_id, kind)` ikinci sətrə baza səviyyəsində də icazə vermir. `paid`-dən sonra gələn `failed` onu geri qaytarmır; `failed`-dən sonra gələn `paid` (pul çıxılıb) tətbiq olunur. Hər callback, imzası səhv olsa da, `payment_events`-ə yazılır; imzası səhv olanın yalnız ilk 2048 simvolu saxlanır (`{"raw", "truncated": true}`) və gündəlik təmizləmə onu 30 gündən sonra silir (imzalı callback-lər ödəniş qeydidir, qalır).
- **Saytda olmayan elan:** sifariş yalnız aktiv elan üçün yaranır; ödəniş səhifəsində olarkən elan saytdan çıxıbsa (deaktiv, redaktə), «Önə çıxar»ın günləri ödənişdən sayılır (işləyən «Önə çıxar» kimi), «İrəli çək»in qaldırmaları elan qayıdana qədər gözləyir.
- **Yerləşdirəndə seçilən reklam** (`ListingInput.promotion`) satışda olan seçim olmalıdır (`400 promotion: invalid`), elanın `pending_promotion_option_id`-sində qalır və kabinetdə `pendingPromotion` kimi görünür. Elan təsdiqlənəndən sonra sahib onu adi sifarişlə ödəyir; redaktədə formada seçim yoxdursa silinir.
- **`Promotions` işi** (10 dəqiqədən bir): sonu keçən «Önə çıxar»ın nişanını götürür (`is_promoted = false`, `promoted_at` boş; sonu olmayan demo elanlar «Önə çıxan» qalır), vaxtı çatan «İrəli çək»i edir (`bumps_left - 1`, növbəti fasilə sonra). Saytda olmayan (gözləyən, deaktiv, müddəti bitmiş) elanın qaldırmaları saxlanır, elan qayıdanda davam edir.
- **Sahibin elanında** (`GET /me/listings`) `promotion` (`{ packageId, until }`: işləyən «Önə çıxar», yoxdursa «İrəli çək») və `pendingPromotion` gəlir; public cavablarda yalnız `vip` var.

**Əl ilə yoxlama** (Development, API işləyir, aktiv elanı olan hesabın tokeni `T`, elanın id-si `L`):

```bash
A=http://localhost:5080/api/v1; H=(-H 'X-Internal-Key: dev-internal-key' -H "Authorization: Bearer $T" -H 'Content-Type: application/json')
curl -s $A/promotion-packages
curl -s "${H[@]}" -H 'Idempotency-Key: reklam-1' $A/promotion-orders -d "{\"listingId\":\"$L\",\"packageId\":\"one-cixar\",\"optionId\":\"one-cixar-7\"}"   # → { order, paymentUrl }
# paymentUrl-i brauzerdə açın («Test ödənişi» → «Ödə») və ya:
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' -X POST "<paymentUrl>&result=paid"   # → 303 http://localhost:3000/kabinet?order=…&payment=paid
curl -s "$A/listings?sort=newest&pageSize=1"   # → elan birincidir, "vip": true
```

## 16. Ödəniş provayderi

İndi pul alınmır: `Payments:Provider = "fake"` ödənişi API-nin öz «Test ödənişi» səhifəsində «edir» (`Modules/Promotion/Payments/FakePaymentGateway.cs`). Saxta provayder yalnız Development, Staging və testlərdə işləyir; Production-da sifariş `503 payment.unavailable` alır, `GET /promotion-packages` boş siyahı qaytarır (sayt `/reklam`-da «Onlayn ödəniş tezliklə qoşulacaq» deyir, «Elan yerləşdir»də və kabinetdə pullu seçim göstərmir) və API başlayanda xəbərdarlıq yazır, yəni reklam pulsuz verilmir. Provayder işləyən, amma Development olmayan mühitdə `Payments__PublicBaseUrl` boşdursa, API başlayanda xəbərdarlıq yazır: sifarişi Next.js serveri yaradır, sorğunun ünvanı brauzerin aça bilmədiyi daxili ünvan ola bilər. Bank və ya ödəniş xidməti ilə müqavilədən sonra real provayder belə qoşulur:

1. **Sinif yazın:** `Modules/Promotion/Payments/<Ad>PaymentGateway.cs`, `IPaymentGateway`-i həyata keçirir. `Name` URL-də və `promotion_orders.provider`-də görünən addır (kiçik hərflər, məsələn `acme`).
2. **`StartAsync`:** provayderin API-sində ödəniş yaradın (məbləğ `request.Amount` AZN, təsvir `request.Description`, uğur və imtina ünvanı `request.ReturnUrl`, callback ünvanı `{request.ApiBaseUrl}/api/v1/payments/acme/callback`) və `PaymentStart(providerRef, paymentUrl)` qaytarın: `providerRef` provayderin ödəniş id-sidir, callback onu deyəcək. İstisna atsanız sifariş yazılmır.
3. **`Read`:** callback-in imzasını provayderin qaydası ilə yoxlayın (açarı `IOptions` ilə alın, sabit vaxtlı müqayisə) və `PaymentCallback` qaytarın: `ProviderRef`, provayderin hadisə adı, `PaymentOutcome.Paid` / `Failed` / `Unknown`, ödənilən məbləğ. Gövdə oxunmursa istisna atmayın: hər callback olduğu kimi `payment_events`-ə yazılır.
4. **Qeydiyyatdan keçirin:** `Modules/Promotion/PromotionSetup.cs`-də `services.AddSingleton<IPaymentGateway, AcmePaymentGateway>();` (HTTP üçün `AddHttpClient`), ayarlarını `PaymentOptions`-a əlavə edin; gizli açarlar yalnız mühit dəyişənlərində (`Payments__Acme__…`).
5. **Ayarlar:** `Payments__Provider=acme`, `Payments__PublicBaseUrl` (provayderin callback göndərəcəyi API ünvanı). Provayderin kabinetində callback ünvanını `https://<api>/api/v1/payments/acme/callback` yazın.
6. **Test:** provayderin sinfi üçün unit test (imza, hadisələr; HTTP-ni `HttpMessageHandler` ilə saxtalaşdırıb), real ödənişi provayderin test rejimində Staging-də yoxlayın. Qaytarma (`refunded`) və ləğv (`cancelled`) statusları bazada var, endpoint-ləri provayder seçiləndə yazılır.
